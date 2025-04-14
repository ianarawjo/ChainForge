import os
import hashlib
import getpass

def get_password(prompt="🔐 Enter password: ") -> str:
  return getpass.getpass(prompt)

def hash_password(password: str, salt: bytes, iterations=100_000) -> bytes:
  return hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations)

def save_password(password: str, hash_filepath: str):
  salt = os.urandom(16)
  hashed = hash_password(password, salt)
  with open(hash_filepath, "wb") as f:
    f.write(salt + hashed)

def verify_password(password: str, hash_filepath: str) -> bool:
  with open(hash_filepath, "rb") as f:
    data = f.read()
  salt = data[:16]
  stored_hash = data[16:]
  test_hash = hash_password(password, salt)
  return test_hash == stored_hash

def ensure_password(hash_filepath: str, create_new_msg: str = "") -> str:
  if not os.path.exists(hash_filepath):
    # First time setup
    while True:
      if create_new_msg:
        print(create_new_msg)
      pw1 = get_password("Create new password: ")
      pw2 = get_password("Confirm password: ")
      if len(pw1) < 8:
        print("❌ Password must be at least 8 characters long. Try again.")
        continue
      if pw1 != pw2:
        print("❌ Passwords do not match. Try again.")
        continue
      save_password(pw1, hash_filepath)
      print("✅ Password set.")
      return pw1
  else:
    # Verify password
    for _ in range(3):  # Allow 3 tries
      pw = get_password()
      if verify_password(pw, hash_filepath):
        print("✅ Password verified.")
        return pw
      print("❌ Incorrect password.")
    print("Too many failed attempts. Exiting.")
    exit(1)
