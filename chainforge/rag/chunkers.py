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

    tokenizer = kwargs.get("tokenizer", "bert-base-uncased")

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
    import sys

    # Try to load the SpaCy model and handle errors if it's not found
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError as e:
        print(f"spaCy model 'en_core_web_sm' not found. Please run 'python -m spacy download en_core_web_sm'. Error: {e}", file=sys.stderr)
        
        # Optionally, you can download the model automatically here if you want
        print("Attempting to download the model...")
        try:
            from subprocess import run
            run(["python", "-m", "spacy", "download", "en_core_web_sm"], check=True)
            print("Model downloaded successfully.")
            nlp = spacy.load("en_core_web_sm")  # Reload after download
        except Exception as download_error:
            print(f"Error downloading the model: {download_error}", file=sys.stderr)
            raise ValueError("spaCy language model not available.") from download_error

    doc = nlp(text)  # Process the single text directly
    sents = [s.text.strip() for s in doc.sents if s.text.strip()]
    return sents if sents else [text]

@ChunkingMethodRegistry.register("syntax_texttiling")
def syntax_texttiling(text: str, **kwargs: Any) -> List[str]:
    try:
        # Ensure necessary NLTK data is downloaded (punkt is often needed)
        import nltk
        from nltk.tokenize import TextTilingTokenizer
    except ImportError:
        print("NLTK not found or TextTilingTokenizer unavailable.", file=sys.stderr)
        raise ValueError("NLTK TextTilingTokenizer unavailable.")

    # Check if the 'punkt' tokenizer is available
    try:
        nltk.data.find('tokenizers/punkt')
    except nltk.downloader.DownloadError:
        print("NLTK 'punkt' data not found. Attempting download...", file=sys.stderr)
        nltk.download('punkt', quiet=True)

    # Check if the 'stopwords' corpus is available
    try:
        nltk.data.find('corpora/stopwords')
    except LookupError:
        print("Stopwords corpus not found. Downloading now...")
        nltk.download('stopwords')

    try: 
        tt = TextTilingTokenizer()
        chunks = tt.tokenize(text)
        return chunks if chunks else [text]
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
    )

    texts = [t.text for t in chunker.chunk(text)]
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_sentence")
def chonkie_sentence(text: str, **kwargs: Any) -> List[str]:
    from chonkie import SentenceChunker
    import json

    tokenizer_or_token_counter = kwargs.get("tokenizer_or_token_counter", "gpt2")
    chunk_size = int(kwargs.get("chunk_size", 512))
    chunk_overlap = int(kwargs.get("chunk_overlap", 0))
    min_sentences_per_chunk = int(kwargs.get("min_sentences_per_chunk", 1))
    min_characters_per_sentence = int(kwargs.get("min_characters_per_sentence", 12))
    delim = kwargs.get("delim", '[".", "!", "?", "\\n\\n"]')
    include_delim = kwargs.get("include_delim", "prev")
    if len(include_delim.strip()) == 0:
        include_delim = None

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
    )

    texts = [t.text for t in chunker.chunk(text)]
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
    )

    texts = [t.text for t in chunker.chunk(text)]
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_semantic")
def chonkie_semantic(text: str, **kwargs: Any) -> List[str]:
    from chonkie import SemanticChunker
    import json

    # Basic parameters
    embedding_model = kwargs.get("embedding_model", "minishlab/potion-base-8M")
    embedding_path = kwargs.get("embedding_local_path", '')
    if embedding_path != '':
        embedding_model = embedding_path
    chunk_size = int(kwargs.get("chunk_size", 512))
    threshold = kwargs.get("threshold", "auto")
    mode = kwargs.get("mode", "window")
    
    # Advanced parameters
    similarity_window = int(kwargs.get("similarity_window", 1))
    min_sentences = int(kwargs.get("min_sentences", 1))
    min_chunk_size = kwargs.get("min_chunk_size", 0)
    min_characters_per_sentence = int(kwargs.get("min_characters_per_sentence", 12))
    threshold_step = float(kwargs.get("threshold_step", 0.01))
    
    # Handle delimiters - convert from JSON string if needed
    delim = kwargs.get("delim", '[".", "!", "?", "\\n\\n"]')
    try: 
        delim = json.loads(delim)  # Parse JSON format
        if not isinstance(delim, list) or not all(isinstance(d, str) for d in delim):
            raise ValueError("Delim must be a JSON parseable string representing an array of characters.")
    except Exception as e:
        print(f"Invalid JSON format for delim: {delim}. Using default delimiters. Error: {e}", file=sys.stderr)
        delim = ['.', '!', '?', '\n\n']

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
        min_characters_per_sentence=min_characters_per_sentence,
        threshold_step=threshold_step,
        delim=delim,
        **({} if min_chunk_size == 0 else {'min_chunk_size': min_chunk_size})
    )

    texts = [t.text for t in chunker.chunk(text)]
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_sdpm")
def chonkie_sdpm(text: str, **kwargs: Any) -> List[str]:
    from chonkie import SDPMChunker
    import json

    # Basic parameters
    embedding_model = kwargs.get("embedding_model", "minishlab/potion-base-8M")
    embedding_path = kwargs.get("embedding_local_path", '')
    if embedding_path != '':
        embedding_model = embedding_path
    chunk_size = int(kwargs.get("chunk_size", 512))
    threshold = kwargs.get("threshold", "auto")
    mode = kwargs.get("mode", "window")
    
    # Advanced parameters
    similarity_window = int(kwargs.get("similarity_window", 1))
    min_sentences = int(kwargs.get("min_sentences", 1))
    min_chunk_size = int(kwargs.get("min_chunk_size", 2))  # Default is 2 for SDPM
    min_characters_per_sentence = int(kwargs.get("min_characters_per_sentence", 12))
    threshold_step = float(kwargs.get("threshold_step", 0.01))
    
    # SDPM-specific parameter
    skip_window = int(kwargs.get("skip_window", 1))
    
    # Handle delimiters - convert from JSON string if needed
    delim = kwargs.get("delim", '[".", "!", "?", "\\n\\n"]')
    include_delim = kwargs.get("include_delim", None)
    
    try: 
        delim = json.loads(delim)  # Parse JSON format
        if not isinstance(delim, list) or not all(isinstance(d, str) for d in delim):
            raise ValueError("Delim must be a JSON parseable string representing an array of characters.")
    except Exception as e:
        print(f"Invalid JSON format for delim: {delim}. Using default delimiters. Error: {e}", file=sys.stderr)
        delim = ['.', '!', '?', '\n\n']

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
        skip_window=skip_window,
    )

    texts = [t.text for t in chunker.chunk(text)]
    return texts if texts else [text]

@ChunkingMethodRegistry.register("chonkie_late")
def chonkie_late(text: str, **kwargs: Any) -> List[str]:
    from chonkie import LateChunker, RecursiveRules
    import json

    # Basic parameters
    embedding_model = kwargs.get("embedding_model", "sentence-transformers/all-MiniLM-L6-v2")
    embedding_path = kwargs.get("embedding_local_path", '')
    if embedding_path != '':
        embedding_model = embedding_path
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
    )

    chunks = chunker.chunk(text)
    return [chunk.text for chunk in chunks] if chunks else [text]

@ChunkingMethodRegistry.register("chonkie_neural")
def chonkie_neural(text: str, **kwargs: Any) -> List[str]:
    from chainforge.rag.custom_chunkers.neural_chunker_with_local_files import NeuralChunker

    # Basic parameters
    model = kwargs.get("model", "mirth/chonky_modernbert_base_1")
    model_path = kwargs.get("model_local_path", '')
    if model_path != '':
        model = model_path
    device = kwargs.get("device", None)  # None will auto-detect the best available device
    min_characters_per_chunk = int(kwargs.get("min_characters_per_chunk", 10))
    
    # Note: NeuralChunker returns chunks as "chunks" by default, but we need "texts"
    # to be consistent with other handlers in our registry
    
    try:
        chunker = NeuralChunker(
            model=model,
            device_map=device,
            min_characters_per_chunk=min_characters_per_chunk,
        )
        latechunk_objs = chunker.chunk(text)
        return [chunk.text for chunk in latechunk_objs] if latechunk_objs else [text]
    except Exception as e:
        raise Exception(f"Error during neural chunking: {e}. Make sure you've installed with 'pip install \"chonkie[neural]\"'.")
    
