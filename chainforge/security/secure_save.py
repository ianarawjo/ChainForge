import json
import os
import base64
from typing import Union, Tuple
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.fernet import Fernet

def generate_key(password: str, salt: bytes) -> bytes:
  kdf = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=salt,
    iterations=100_000,
  )
  return base64.urlsafe_b64encode(kdf.derive(password.encode()))

def load_json_file(filepath_w_ext: str, secure: bool, password: Union[str, None] = None) -> Tuple[Union[dict, None], Union[str, None]]:  
  """
    Load a JSON file. If secure is True, load the encrypted file and decrypt it using the provided password.
    If secure is False, load the plain JSON file.

    Returns a tuple of (data, filepath) where data is the loaded JSON data and filepath is the true path to the file.
  """
  enc_filepath = filepath_w_ext + ".enc"
  if secure and not os.path.exists(enc_filepath):
    print(f"❌ Encrypted file not found at path: {enc_filepath}. Looking for non-encrypted file at same path...")
    secure = False  # Fallback to load a non-encrypted file

  if not secure:
    if os.path.exists(filepath_w_ext):
      with open(filepath_w_ext, "r") as f:
        return json.load(f), filepath_w_ext
    print(f"❌ File not found at path: {filepath_w_ext}. Failed to load.")
    return None, None  # File not found

  if password is None or len(password) == 0:
    print("❌ Password is required for secure load. Please provide a password at application start.")
    return None, None  # Failure

  if not os.path.exists(enc_filepath):
    print(f"❌ Encrypted file not found at path: {enc_filepath}. Failed to load.")
    return None, None

  try:
    # Read the combined data (salt + encrypted data) from the file
    with open(enc_filepath, "rb") as f:
      combined_data = f.read()

    # Extract the salt (first 16 bytes) and the encrypted data
    salt = combined_data[:16]
    encrypted_data = combined_data[16:]

    # Generate the key using the password and salt
    key = generate_key(password, salt)
    # Create a Fernet object with the key
    fernet = Fernet(key)

    # Decrypt the data
    decrypted = fernet.decrypt(encrypted_data)
    return json.loads(decrypted), enc_filepath
  except Exception as e:
    print(f"❌ Failed to decrypt file: {enc_filepath}. Error: {e}")
    return None, None

def save_json_file(data: dict, filepath_w_ext: str, secure: bool, password: Union[str, None] = None) -> bool:
  """
    Save `data` to a JSON file. If secure is True, encrypt the file using the provided password.
    If secure is False, save the plain JSON file.
  """
  if not secure:
    try: 
      # Save the config to a JSON file
      with open(filepath_w_ext, "w") as f:
        json.dump(data, f, indent=2)
      return True  # Success
    except Exception as e:
      print(f"❌ Failed to save file: {filepath_w_ext}. Error: {e}")
      return False

  if password is None or len(password) == 0:
    print("❌ Password is required for secure save. Please provide a password at application start.")
    return False  # Failure

  # Filepath for encrypted config as extra .enc extension
  enc_filepath = filepath_w_ext + ".enc"

  # Generate a new salt
  salt = os.urandom(16)
  # Generate the key using the password and salt
  key = generate_key(password, salt) 
  # Create a Fernet object with the key
  fernet = Fernet(key)

  try:
    # Encrypt the data
    encrypted = fernet.encrypt(json.dumps(data).encode())
    # Combine the salt and encrypted data
    combined_data = salt + encrypted
    # Write the combined data to the file
    with open(enc_filepath, "wb") as f:
      f.write(combined_data)
    # If there is an existing unencrypted file at the non-.enc path, delete it.
    # This is to remove the possibility of duplicates. 
    if os.path.exists(filepath_w_ext):
      os.remove(filepath_w_ext)
    return True  # Success
  except Exception as e:
    print(f"❌ Failed to encrypt file: {enc_filepath}. Error: {e}")
    return False
