# --- Chunk Endpoint ---
import sys
from typing import List, Dict, Any, Callable, Union

# === Define the Chunking Registry (Place after imports) ===
class ChunkingMethodRegistry:
    """Registry for text chunking methods."""
    _methods: Dict[str, Callable] = {}

    @classmethod
    def register(cls, identifier: str):
        """Decorator to register a chunking function."""
        if not isinstance(identifier, str) or not identifier:
            raise ValueError("Method identifier must be a non-empty string.")

        def decorator(handler_func: Callable):
            if not callable(handler_func):
                raise TypeError("Registered handler must be a callable function.")
            if identifier in cls._methods:
                 print(f"Warning: Overwriting existing chunking method '{identifier}'.", file=sys.stderr)
            cls._methods[identifier] = handler_func
            # print(f"Registered chunking method: {identifier}") # Optional: for debugging
            return handler_func
        return decorator

    @classmethod
    def get_handler(cls, identifier: str) -> Union[Callable, None]:
        """Get the handler function for a given method identifier."""
        return cls._methods.get(identifier)

# === Chunking Helper Functions ===
@ChunkingMethodRegistry.register("overlapping_langchain")
def overlapping_langchain_textsplitter(text: str, **kwargs: Any) -> List[str]:
    # LangChain's Text Splitter
    from langchain.text_splitter import RecursiveCharacterTextSplitter

    chunk_size = int(kwargs.get("chunk_size", 200))
    chunk_overlap = int(kwargs.get("chunk_overlap", 50))
    keep_separator = bool(kwargs.get("keep_separator", True))

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap, keep_separator=keep_separator
    )
    chunks = splitter.split_text(text)
    return chunks if chunks else [text]

@ChunkingMethodRegistry.register("overlapping_openai_tiktoken")
def overlapping_openai_tiktoken(text: str, **kwargs: Any) -> List[str]:
    # OpenAI's Tiktoken for token-based chunking
    import tiktoken

    model = kwargs.get("model", "gpt-3.5-turbo")
    chunk_size = int(kwargs.get("chunk_size", 200))
    chunk_overlap = int(kwargs.get("chunk_overlap", 50))

    # Consider making model name configurable if needed
    try:
        enc = tiktoken.encoding_for_model(model)
    except Exception as e:
         print(f"Warning: Could not get tiktoken encoding for model {model}, falling back to cl100k_base. Error: {e}", file=sys.stderr)
         enc = tiktoken.get_encoding("cl100k_base")

    tokens = enc.encode(text)
    result = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens)) # Prevent overshoot
        chunk_tokens = tokens[start:end]
        # Filter out potential empty strings from decoding edge cases
        decoded_chunk = enc.decode(chunk_tokens).strip()
        if decoded_chunk:
            result.append(decoded_chunk)

        # Ensure overlap doesn't push start before 0
        start = max(0, end - chunk_overlap)

        # Break if we've processed the last chunk or start isn't advancing
        if end == len(tokens) or start >= end:
            break

        # Safety break for potential infinite loops if overlap >= size
        if chunk_overlap >= chunk_size and start > 0:
            print(f"Warning: chunk_overlap ({chunk_overlap}) >= chunk_size ({chunk_size}). Breaking loop early.", file=sys.stderr)
            break

    return result if result else [text]

@ChunkingMethodRegistry.register("overlapping_huggingface_tokenizers")
def overlapping_huggingface_tokenizers(text: str, **kwargs: Any) -> List[str]:
    # HuggingFace Tokenizers for token-based chunking
    from transformers import AutoTokenizer

    tokenizer = int(kwargs.get("tokenizer", "bert-base-uncased"))

    # Consider making model name configurable
    try:
        tokenizer = AutoTokenizer.from_pretrained(tokenizer)
    except Exception as e:
        print(f"Error loading HuggingFace tokenizer model '{tokenizer}': {e}", file=sys.stderr)
        raise ValueError(f"Failed to load HuggingFace tokenizer model {tokenizer}.") from e
    
    chunk_size = int(kwargs.get("chunk_size", 200))
    chunk_overlap = int(kwargs.get("chunk_overlap", 50))

    tokens = tokenizer.encode(text, add_special_tokens=False) # Avoid splitting on special tokens
    result = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens)) # Prevent overshoot
        chunk_tokens = tokens[start:end]
        # skip_special_tokens=True ensures things like [CLS] aren't in the output text
        decoded_chunk = tokenizer.decode(chunk_tokens, skip_special_tokens=True).strip()
        if decoded_chunk:
            result.append(decoded_chunk)

        start = max(0, end - chunk_overlap) # Ensure overlap doesn't push start before 0

        # Break if we've processed the last chunk or start isn't advancing
        if end == len(tokens) or start >= end:
            break

        # Safety break for potential infinite loops if overlap >= size
        if chunk_overlap >= chunk_size and start > 0:
            print(f"Warning: chunk_overlap ({chunk_overlap}) >= chunk_size ({chunk_size}). Breaking loop early.", file=sys.stderr)
            break

    return result if result else [text]

@ChunkingMethodRegistry.register("syntax_spacy")
def syntax_spacy(text: str, **kwargs: Any) -> List[str]:
    # SpaCy for sentence splitting and NLP objects
    import spacy

    # Load model once and cache it if possible, or handle loading errors
    try:
        # Potential optimization: cache the loaded nlp model globally?
        # global _spacy_nlp_en
        # if '_spacy_nlp_en' not in globals():
        #     _spacy_nlp_en = spacy.load("en_core_web_sm")
        # nlp = _spacy_nlp_en
        nlp = spacy.load("en_core_web_sm")
    except OSError as e:
        print(f"spaCy model 'en_core_web_sm' not found. Please run 'python -m spacy download en_core_web_sm'. Error: {e}", file=sys.stderr)
        raise ValueError("spaCy language model not available.") from e

    doc = nlp(text) # Process the single text directly
    sents = [s.text.strip() for s in doc.sents if s.text.strip()]
    return sents if sents else [text]

@ChunkingMethodRegistry.register("syntax_texttiling")
def syntax_texttiling(text: str, **kwargs: Any) -> List[str]:
    try:
        # Ensure necessary NLTK data is downloaded (punkt is often needed)
        import nltk
        from nltk.tokenize import TextTilingTokenizer

        try:
            nltk.data.find('tokenizers/punkt')
        except nltk.downloader.DownloadError:
            print("NLTK 'punkt' data not found. Attempting download...", file=sys.stderr)
            nltk.download('punkt', quiet=True)
        
        tt = TextTilingTokenizer()
        chunks = tt.tokenize(text)
        return chunks if chunks else [text]
    except ImportError:
        print("NLTK not found or TextTilingTokenizer unavailable.", file=sys.stderr)
        raise ValueError("NLTK TextTilingTokenizer unavailable.")
    except Exception as e:
        print(f"Error during NLTK TextTiling: {e}", file=sys.stderr)
        raise

"""
   Chonkie Methods
"""
@ChunkingMethodRegistry.register("chonkie_token")
def chonkie_token(text: str, **kwargs: Any) -> List[str]:
    from chonkie import TokenChunker

    tokenizer = kwargs.get("tokenizer", "gpt2")
    chunk_size = int(kwargs.get("chunk_size", 512))
    chunk_overlap = int(kwargs.get("chunk_overlap", 0))

    chunker = TokenChunker(
        tokenizer=tokenizer,  # Supports string identifiers
        chunk_size=chunk_size,    # Maximum tokens per chunk
        chunk_overlap=chunk_overlap,  # Overlap between chunks
        return_type="texts",
    )

    texts = chunker.chunk(text)
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_sentence")
def chonkie_sentence(text: str, **kwargs: Any) -> List[str]:
    from chonkie import SentenceChunker
    import json

    tokenizer_or_token_counter = kwargs.get("tokenizer_or_token_counter", "gpt2")
    chunk_size = int(kwargs.get("chunk_size", 512))
    chunk_overlap = int(kwargs.get("chunk_overlap", 0))
    min_sentences_per_chunk = int(kwargs.get("min_sentences_per_chunk", 1))
    min_characters_per_sentence = int(kwargs.get("min_characters_per_sentence", 0))
    delim = kwargs.get("delim", "['.', '!', '?', '\\n']")
    include_delim = kwargs.get("include_delim", None)

    try: 
        delim = json.loads(delim)  # Validate JSON format
        if not isinstance(delim, list) or not all(isinstance(d, str) for d in delim):
            raise ValueError("Delim must be a JSON parseable string representing an array of characters.")
    except Exception as e:
        print(f"Invalid JSON format for delim: {delim}. Delimeter must be a JSON parseable string representing an array of characters. Skipping custom delimeter. Error: {e}", file=sys.stderr)
        delim = ['.', '!', '?', '\n']

    chunker = SentenceChunker(
        tokenizer_or_token_counter=tokenizer_or_token_counter,
        chunk_size=chunk_size,       
        chunk_overlap=chunk_overlap,    
        min_sentences_per_chunk=min_sentences_per_chunk,  
        min_characters_per_sentence=min_characters_per_sentence,
        delim=delim,  # Custom delimiters
        include_delim=include_delim,  # Include delimiters in the chunk
        return_type="texts",
    )

    texts = chunker.chunk(text)
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_recursive")
def chonkie_recursive(text: str, **kwargs: Any) -> List[str]:
    from chonkie import RecursiveChunker, RecursiveRules
    import json

    tokenizer_or_token_counter = kwargs.get("tokenizer_or_token_counter", "gpt2")
    chunk_size = int(kwargs.get("chunk_size", 512))
    min_characters_per_chunk = int(kwargs.get("min_characters_per_chunk", 12))

    # If provided, will override the default rules and provided delimeters
    # Format is "<name>-<language>", e.g., "markdown-en"
    # https://huggingface.co/datasets/chonkie-ai/recipes/viewer/recipes/train?row=5&views%5B%5D=recipes
    use_premade_recipe = kwargs.get("use_premade_recipe", None)

    # Custom recipe is assumed to be a JSON parseable string,
    # representing a list of dictionaries for RecursiveLevels. 
    # For format, see https://docs.chonkie.ai/chunkers/recursive-chunker and the above dataset,
    # far right column, "recipe" under the "recursive_rules"->"levels" key. 
    # If provided, will override the default rules and provided delimeters
    custom_recipe = kwargs.get("custom_recipe", None)

    rules = RecursiveRules()
    if custom_recipe: 
        try:
            rules = RecursiveRules.from_dict({ "levels": json.loads(custom_recipe) })
        except Exception as e:
            print(f"Invalid JSON format for custom recipe: {custom_recipe}. Error: {e}", file=sys.stderr)
            custom_recipe = None
    elif use_premade_recipe:
        try:
            if "-" in use_premade_recipe:
                # Initialize using recipe (e.g., "markdown-en")
                name, lang = use_premade_recipe.split("-")
                rules = RecursiveRules.from_recipe(name=name, lang=lang)
            else:
                # Handle language-only case
                # Initialize using recipe (e.g., "en")
                rules = RecursiveRules.from_recipe(lang=use_premade_recipe)
        except Exception as e:
            print(f"Invalid recipe name for use_premade_recipe: {use_premade_recipe}. Error: {e}", file=sys.stderr)
            use_premade_recipe = None

    chunker = RecursiveChunker(
        tokenizer_or_token_counter=tokenizer_or_token_counter,
        chunk_size=chunk_size,
        rules=rules,
        min_characters_per_chunk=min_characters_per_chunk,
        return_type="texts",
    )

    texts = chunker.chunk(text)
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_semantic")
def chonkie_semantic(text: str, **kwargs: Any) -> List[str]:
    from chonkie import SemanticChunker
    import json

    # Basic parameters
    embedding_model = kwargs.get("embedding_model", "minishlab/potion-base-8M")
    chunk_size = int(kwargs.get("chunk_size", 512))
    threshold = kwargs.get("threshold", "auto")
    mode = kwargs.get("mode", "window")
    
    # Advanced parameters
    similarity_window = int(kwargs.get("similarity_window", 1))
    min_sentences = int(kwargs.get("min_sentences", 1))
    min_chunk_size = kwargs.get("min_chunk_size", None)
    min_characters_per_sentence = int(kwargs.get("min_characters_per_sentence", 12))
    threshold_step = float(kwargs.get("threshold_step", 0.01))
    
    # Handle delimiters - convert from JSON string if needed
    delim = kwargs.get("delim", "['.', '!', '?', '\\n']")
    try: 
        delim = json.loads(delim)  # Parse JSON format
        if not isinstance(delim, list) or not all(isinstance(d, str) for d in delim):
            raise ValueError("Delim must be a JSON parseable string representing an array of characters.")
    except Exception as e:
        print(f"Invalid JSON format for delim: {delim}. Using default delimiters. Error: {e}", file=sys.stderr)
        delim = ['.', '!', '?', '\n']

    # Convert threshold to appropriate type if it's a string and not "auto"
    if isinstance(threshold, str) and threshold != "auto":
        try:
            threshold = float(threshold)
        except ValueError:
            print(f"Invalid threshold value: {threshold}. Using 'auto' instead.", file=sys.stderr)
            threshold = "auto"

    # Handle min_chunk_size - convert to int if provided
    if min_chunk_size is not None:
        try:
            min_chunk_size = int(min_chunk_size)
        except ValueError:
            print(f"Invalid min_chunk_size value: {min_chunk_size}. Using None instead.", file=sys.stderr)
            min_chunk_size = None

    chunker = SemanticChunker(
        embedding_model=embedding_model,
        threshold=threshold,
        mode=mode,
        chunk_size=chunk_size,
        similarity_window=similarity_window,
        min_sentences=min_sentences,
        min_chunk_size=min_chunk_size,
        min_characters_per_sentence=min_characters_per_sentence,
        threshold_step=threshold_step,
        delim=delim,
        return_type="texts",  # Always return as texts to match other handlers
    )

    texts = chunker.chunk(text)
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_sdpm")
def chonkie_sdpm(text: str, **kwargs: Any) -> List[str]:
    from chonkie import SDPMChunker
    import json

    # Basic parameters
    embedding_model = kwargs.get("embedding_model", "minishlab/potion-base-8M")
    chunk_size = int(kwargs.get("chunk_size", 512))
    threshold = kwargs.get("threshold", "auto")
    mode = kwargs.get("mode", "window")
    
    # Advanced parameters
    similarity_window = int(kwargs.get("similarity_window", 1))
    min_sentences = int(kwargs.get("min_sentences", 1))
    min_chunk_size = kwargs.get("min_chunk_size", 2)  # Default is 2 for SDPM
    min_characters_per_sentence = int(kwargs.get("min_characters_per_sentence", 12))
    threshold_step = float(kwargs.get("threshold_step", 0.01))
    
    # SDPM-specific parameter
    skip_window = int(kwargs.get("skip_window", 1))
    
    # Handle delimiters - convert from JSON string if needed
    delim = kwargs.get("delim", "['.', '!', '?', '\\n']")
    include_delim = kwargs.get("include_delim", None)
    
    try: 
        delim = json.loads(delim)  # Parse JSON format
        if not isinstance(delim, list) or not all(isinstance(d, str) for d in delim):
            raise ValueError("Delim must be a JSON parseable string representing an array of characters.")
    except Exception as e:
        print(f"Invalid JSON format for delim: {delim}. Using default delimiters. Error: {e}", file=sys.stderr)
        delim = ['.', '!', '?', '\n']

    # Convert threshold to appropriate type if it's a string and not "auto"
    if isinstance(threshold, str) and threshold != "auto":
        try:
            threshold = float(threshold)
        except ValueError:
            print(f"Invalid threshold value: {threshold}. Using 'auto' instead.", file=sys.stderr)
            threshold = "auto"

    chunker = SDPMChunker(
        embedding_model=embedding_model,
        threshold=threshold,
        mode=mode,
        chunk_size=chunk_size,
        similarity_window=similarity_window,
        min_sentences=min_sentences,
        min_chunk_size=min_chunk_size,
        min_characters_per_sentence=min_characters_per_sentence,
        threshold_step=threshold_step,
        delim=delim,
        include_delim=include_delim,
        skip_window=skip_window,
        return_type="texts",
    )

    texts = chunker.chunk(text)
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_late")
def chonkie_late(text: str, **kwargs: Any) -> List[str]:
    from chonkie import LateChunker, RecursiveRules
    import json

    # Basic parameters
    embedding_model = kwargs.get("embedding_model", "all-MiniLM-L6-v2")
    chunk_size = int(kwargs.get("chunk_size", 512))
    min_characters_per_chunk = int(kwargs.get("min_characters_per_chunk", 24))

    # If provided, will override the default rules
    # Format is "<name>-<language>", e.g., "markdown-en"
    use_premade_recipe = kwargs.get("use_premade_recipe", None)

    # Custom recipe is assumed to be a JSON parseable string,
    # representing a list of dictionaries for RecursiveLevels
    custom_recipe = kwargs.get("custom_recipe", None)

    # Handle rules setup (similar to recursive chunker)
    rules = RecursiveRules()
    if custom_recipe: 
        try:
            rules = RecursiveRules.from_dict({ "levels": json.loads(custom_recipe) })
        except Exception as e:
            print(f"Invalid JSON format for custom recipe: {custom_recipe}. Error: {e}", file=sys.stderr)
            custom_recipe = None
    elif use_premade_recipe:
        try:
            # Initialize using recipe (e.g., "markdown-en")
            if "-" in use_premade_recipe:
                # Initialize using recipe (e.g., "markdown-en")
                name, lang = use_premade_recipe.split("-")
                rules = RecursiveRules.from_recipe(name=name, lang=lang)
            else:
                # Handle language-only case
                # Initialize using recipe (e.g., "en")
                rules = RecursiveRules.from_recipe(lang=use_premade_recipe)
        except Exception as e:
            print(f"Invalid recipe name for use_premade_recipe: {use_premade_recipe}. Error: {e}", file=sys.stderr)
            use_premade_recipe = None

    # Initialize standard chunker with provided parameters
    chunker = LateChunker(
        embedding_model=embedding_model,
        chunk_size=chunk_size,
        rules=rules,
        min_characters_per_chunk=min_characters_per_chunk,
        return_type="texts", 
    )

    texts = chunker.chunk(text)
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_neural")
def chonkie_neural(text: str, **kwargs: Any) -> List[str]:
    from chonkie import NeuralChunker

    # Basic parameters
    model = kwargs.get("model", "mirth/chonky_modernbert_base_1")
    device = kwargs.get("device", None)  # None will auto-detect the best available device
    min_characters_per_chunk = int(kwargs.get("min_characters_per_chunk", 10))
    
    # Note: NeuralChunker returns chunks as "chunks" by default, but we need "texts"
    # to be consistent with other handlers in our registry
    
    try:
        chunker = NeuralChunker(
            model=model,
            device=device,
            min_characters_per_chunk=min_characters_per_chunk,
        )
        latechunk_objs = chunker.chunk(text)
        return [chunk.text for chunk in latechunk_objs] if latechunk_objs else [text]
    except Exception as e:
        raise Exception(f"Error during neural chunking: {e}. Make sure you've installed with 'pip install \"chonkie[neural]\"'.", file=sys.stderr)

# --- Custom chunker ---
from typing import TypedDict, Optional
import os
import traceback
import json
from werkzeug.utils import secure_filename

class CustomChunkerSettingsSchema(TypedDict):
    settings: Dict[str, Any]
    ui: Dict[str, Any]

class CustomChunkerMetadata(TypedDict):
    identifier: str
    name: str
    emoji: str
    settings_schema: Optional[CustomChunkerSettingsSchema]

# --- Decorator ---

# Temporary store for metadata captured during script execution by initCustomChunker
_newly_registered_chunkers: List[CustomChunkerMetadata] = []

def custom_chunker(
    identifier: str,
    name: str,
    emoji: str = '🧩',
    settings_schema: Optional[CustomChunkerSettingsSchema] = None
):
    """
    Decorator to register a custom chunking function and its metadata.

    Args:
        identifier: Unique string ID for the chunker. Will be used as 'baseMethod'.
        name: User-friendly display name.
        emoji: Emoji icon for the UI.
        settings_schema: Optional dictionary matching react-jsonschema-form structure
                         with 'settings' and 'ui' keys.
    """
    if not isinstance(identifier, str) or not identifier:
        raise ValueError("Chunker identifier must be a non-empty string.")
    if identifier in ChunkingMethodRegistry._methods:
        print(f"Warning: Custom chunker identifier '{identifier}' might conflict with a built-in or existing one.", file=sys.stderr)
    # Basic validation of schema structure if provided
    if settings_schema and (not isinstance(settings_schema, dict) or 'settings' not in settings_schema or 'ui' not in settings_schema):
         print(f"Warning: Invalid settings_schema structure for chunker '{identifier}'. It should have 'settings' and 'ui' keys.", file=sys.stderr)
         settings_schema = None # Discard invalid schema

    def decorator(handler_func: Callable[[str, Any], List[str]]):
        # 1. Register the actual handler function with the existing registry
        if not callable(handler_func):
            raise TypeError(f"The object decorated with @custom_chunker (identifier: {identifier}) must be a callable function.")
        ChunkingMethodRegistry.register(identifier)(handler_func)

        # 2. Capture metadata for the frontend/persistence
        metadata: CustomChunkerMetadata = {
            "identifier": identifier,
            "name": name,
            "emoji": emoji,
            "settings_schema": settings_schema,
        }
        _newly_registered_chunkers.append(metadata)
        # print(f"Registered custom chunker via decorator: {name} ({identifier})") # For debugging
        return handler_func
    return decorator

# --- Expected Protocol (for documentation); not implemented yet ---
class ChunkerProviderProtocol:
    def __call__(self, text: str, **kwargs: Any) -> List[str]:
        """
        Protocol definition for custom chunker functions.

        Args:
            text: The input text to be chunked.
            **kwargs: Settings passed from the UI, based on settings_schema.

        Returns:
            A list of strings representing the chunks.
        """
        return NotImplementedError("Custom chunker functions must implement this protocol.")


# Where custom chunkers are stored, might want to move this to a parent directory that also contains providers?
CUSTOM_CHUNKERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'custom_chunkers_data')
CUSTOM_CHUNKERS_METADATA_FILE = os.path.join(CUSTOM_CHUNKERS_DIR, 'metadata.json')
os.makedirs(CUSTOM_CHUNKERS_DIR, exist_ok=True)

def _load_chunker_metadata() -> Dict[str, CustomChunkerMetadata]:
    """Loads the metadata file."""
    if not os.path.exists(CUSTOM_CHUNKERS_METADATA_FILE):
        return {}
    try:
        with open(CUSTOM_CHUNKERS_METADATA_FILE, 'r', encoding='utf-8') as f:
            # Basic validation could be added here
            data = json.load(f)
            if isinstance(data, dict):
                return data
            else:
                print(f"Error: Invalid format in {CUSTOM_CHUNKERS_METADATA_FILE}. Expected a JSON object.", file=sys.stderr)
                return {}
    except json.JSONDecodeError:
        print(f"Error reading custom chunker metadata file: {CUSTOM_CHUNKERS_METADATA_FILE}", file=sys.stderr)
        return {}
    except IOError as e:
        print(f"Error opening custom chunker metadata file {CUSTOM_CHUNKERS_METADATA_FILE}: {e}", file=sys.stderr)
        return {}

def _save_chunker_metadata(metadata: Dict[str, CustomChunkerMetadata]):
    """Saves the metadata file."""
    try:
        with open(CUSTOM_CHUNKERS_METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
    except IOError as e:
        print(f"Error writing custom chunker metadata to {CUSTOM_CHUNKERS_METADATA_FILE}: {e}", file=sys.stderr)
    except TypeError as e:
        print(f"Error serializing custom chunker metadata: {e}", file=sys.stderr)


# --- Server Startup Loading ---

def load_and_register_cached_custom_chunkers():
    """Loads .py files for cached chunkers and executes them to register handlers."""
    #print("Loading cached custom chunkers...")
    all_metadata = _load_chunker_metadata()
    registered_count = 0
    exec_globals = {'__file__': __file__} # Provide a basic global context

    for identifier, meta in all_metadata.items():
        # Use a secure version of the identifier for the filename
        safe_filename = secure_filename(identifier)
        if not safe_filename:
             print(f"Warning: Skipping custom chunker with invalid identifier for filename: {identifier}", file=sys.stderr)
             continue
        script_filename = f"{safe_filename}.py"
        script_path = os.path.join(CUSTOM_CHUNKERS_DIR, script_filename)

        if os.path.exists(script_path):
            try:
                with open(script_path, 'r', encoding='utf-8') as f:
                    code = f.read()
                # IMPORTANT: Execute in a controlled context if possible.
                # exec() is inherently risky. For production, consider sandboxing.
                exec(code, exec_globals) # Make sure registry decorator runs
                # Check if it was actually registered in this run (it might already be there)
                if identifier in ChunkingMethodRegistry._methods:
                     # print(f"Successfully loaded and registered: {identifier}") # Verbose
                     registered_count += 1
                else:
                     print(f"Warning: Code in {script_path} executed but did not register handler for identifier '{identifier}'. Check the @custom_chunker decorator.", file=sys.stderr)

            except Exception as e:
                print(f"Error loading or executing custom chunker script {script_path}: {e}\n{traceback.format_exc()}", file=sys.stderr)
        else:
            print(f"Warning: Metadata found for '{identifier}', but script not found at {script_path}. Metadata might be stale.", file=sys.stderr)

    print(f"Finished loading custom chunkers. {registered_count} handlers active (including potential duplicates if re-run).")