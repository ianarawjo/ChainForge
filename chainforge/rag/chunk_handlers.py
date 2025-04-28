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

    chunk_size = int(kwargs.get("chunk_size", 200))
    chunk_overlap = int(kwargs.get("chunk_overlap", 50))

    # Consider making model name configurable if needed
    try:
        enc = tiktoken.encoding_for_model("gpt-3.5-turbo")
    except Exception as e:
         print(f"Warning: Could not get tiktoken encoding for gpt-3.5-turbo, falling back to cl100k_base. Error: {e}", file=sys.stderr)
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

    # Consider making model name configurable
    tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
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
    import nltk
    from nltk.tokenize import TextTilingTokenizer

    try:
        # Ensure necessary NLTK data is downloaded (punkt is often needed)
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