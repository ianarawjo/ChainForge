import os
from functools import lru_cache

"""
NOTE: The following API key names are passed in from the ChainForge settings:

OpenAI: "",
OpenAI_BaseURL: "",
Anthropic: "",
Google: "",
Azure_OpenAI: "",
Azure_OpenAI_Endpoint: "",
HuggingFace: "",
AlephAlpha: "",
AlephAlpha_BaseURL: "",
Ollama_BaseURL: "",
AWS_Access_Key_ID: "",
AWS_Secret_Access_Key: "",
AWS_Session_Token: "",
AWS_Region: "us-east-1",
AmazonBedrock: JSON.stringify({ credentials: {}, region: "us-east-1" }),
Together: "",

Every embedder is called as
    embedder(texts, model_name=..., path=..., api_keys=..., input_type=...)
where input_type is "document" for chunks and "query" for queries. Asymmetric
retrieval models embed the two differently, and ignoring that quietly costs
ranking quality.
"""

# Instruction the BGE-family authors specify for the query side.
_BGE_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


def instruction_prefix(model_name, input_type):
    """The text a model's authors say to prepend, for queries or documents.

    Mirrors `queryPrefix` in react-server/src/backend/browserEmbeddings.ts, so
    a model ranks the same whether it runs on the server or in the browser.
    Models not listed here take their input unprefixed.
    """
    name = (model_name or "").lower()
    is_query = input_type == "query"

    if "e5-" in name and "instruct" not in name and "mistral" not in name:
        # intfloat/e5-* and multilingual-e5-*: both sides are prefixed.
        return "query: " if is_query else "passage: "
    if "nomic-embed-text" in name:
        return "search_query: " if is_query else "search_document: "
    if "arctic-embed" in name and "v2" in name:
        return "query: " if is_query else ""
    if ("bge-" in name and "-en" in name) or "mxbai-embed" in name or "arctic-embed" in name:
        return _BGE_QUERY_INSTRUCTION if is_query else ""
    return ""


def _with_prefix(texts, model_name, input_type):
    prefix = instruction_prefix(model_name, input_type)
    return [prefix + t for t in texts] if prefix else list(texts)


class EmbeddingMethodRegistry:
    _models = {}

    @classmethod
    def register(cls, model_name):
        def decorator(embedding_func):
            cls._models[model_name] = embedding_func
            return embedding_func

        return decorator

    @classmethod
    def get_embedder(cls, model_name):
        return cls._models.get(model_name)

    @classmethod
    def list_models(cls):
        return list(cls._models.keys())


# Loading a model takes seconds, and /retrieve embeds chunks and queries in
# separate calls, so keep the most recently used ones in memory.
@lru_cache(maxsize=2)
def _load_huggingface_model(name):
    from transformers import AutoTokenizer, AutoModel
    tokenizer = AutoTokenizer.from_pretrained(name)
    model = AutoModel.from_pretrained(name)
    model.eval()
    return tokenizer, model


@lru_cache(maxsize=2)
def _load_sentence_transformer(name):
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(name)


@EmbeddingMethodRegistry.register("huggingface")
def huggingface_embedder(texts, model_name="sentence-transformers/all-mpnet-base-v2", path=None,
                         api_keys=None, input_type="document"):
    """
    Generate embeddings using HuggingFace Transformers, mean-pooled.

    Args:
        texts: List of text strings to embed
        model_name: HuggingFace model name/path (default: sentence-transformers/all-mpnet-base-v2)
        path: in case you need to you local path
        input_type: "document" or "query"

    Returns:
        List of embeddings for each text
    """
    try:
        import torch

        print(f"Using HuggingFace model: {model_name} for {len(texts)} texts")
        tokenizer, model = _load_huggingface_model(path or model_name)
        texts = _with_prefix(texts, model_name, input_type)

        embeddings = []
        batch_size = 32
        for i in range(0, len(texts), batch_size):
            inputs = tokenizer(texts[i:i + batch_size], return_tensors="pt", truncation=True,
                               padding=True, max_length=512)
            with torch.no_grad():
                hidden = model(**inputs).last_hidden_state
            # Mean over real tokens only; padding would otherwise dilute
            # shorter texts in a batch.
            mask = inputs["attention_mask"].unsqueeze(-1).to(hidden.dtype)
            pooled = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
            embeddings.extend(pooled.tolist())

        return embeddings
    except Exception as e:
        print(f"HuggingFace embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate HuggingFace embeddings: {str(e)}")


@EmbeddingMethodRegistry.register("openai")
def openai_embedder(texts, model_name="text-embedding-3-small", path=None, api_keys=None,
                    input_type="document"):
    """
    Generate embeddings using OpenAI Embeddings.

    Args:
        texts: List of text strings to embed
        model_name: OpenAI embedding model to use (default: text-embedding-3-small)
        path: not used

    Returns:
        List of embeddings for each text
    """
    try:
        from openai import OpenAI

        # Get the OpenAI API key from environment or settings
        openai_api_key = api_keys and api_keys.get("OpenAI") or os.environ.get("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("Missing OpenAI key.")

        client = OpenAI(api_key=openai_api_key)
        print(f"Using OpenAI model: {model_name} for {len(texts)} texts")
        return _embed_in_batches(client, model_name, texts)
    except Exception as e:
        print(f"OpenAI embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate OpenAI embeddings: {str(e)}")


def _embed_in_batches(client, model, texts, batch_size=256):
    """Embed through an OpenAI-style client, many texts per request."""
    embeddings = []
    for i in range(0, len(texts), batch_size):
        resp = client.embeddings.create(input=texts[i:i + batch_size], model=model)
        # The API documents `index` as each input's position; don't rely on order.
        embeddings.extend(d.embedding for d in sorted(resp.data, key=lambda d: d.index))
    return embeddings


@EmbeddingMethodRegistry.register("cohere")
def cohere_embedder(texts, model_name="embed-english-v3.0", path=None, api_keys=None,
                    input_type="document"):
    """
    Generate embeddings using Cohere Embeddings.

    Args:
        texts: List of text strings to embed
        model_name: Cohere embedding model to use (default: embed-english-v3.0)
        path: not used
        input_type: "document" or "query"; v3+ models require it

    Returns:
        List of embeddings for each text
    """
    try:
        import cohere
        print(f"Using Cohere model: {model_name} for {len(texts)} texts")

        # Get API key from environment or settings
        api_key = api_keys and api_keys.get("Cohere") or os.environ.get("COHERE_API_KEY")
        if not api_key:
            raise ValueError("Cohere API key not found in environment or app config")

        co = cohere.ClientV2(api_key)
        cohere_input_type = "search_query" if input_type == "query" else "search_document"

        batch_size = 96  # the most texts Cohere accepts per request
        embeddings = []
        for i in range(0, len(texts), batch_size):
            response = co.embed(texts=texts[i:i + batch_size], model=model_name,
                                input_type=cohere_input_type, embedding_types=["float"])
            embeddings.extend(response.embeddings.float_)

        return embeddings
    except Exception as e:
        print(f"Cohere embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate Cohere embeddings: {str(e)}")


@EmbeddingMethodRegistry.register("sentence-transformers")
def sentence_transformers_embedder(texts, model_name="all-MiniLM-L6-v2", path=None, api_keys=None,
                                   input_type="document"):
    """
    Generate embeddings using Sentence Transformers.

    Args:
        texts: List of text strings to embed
        model_name: Sentence Transformers model name (default: all-MiniLM-L6-v2)
        input_type: "document" or "query"

    Returns:
        List of embeddings for each text
    """
    try:
        print(f"Using SentenceTransformer model: {model_name} for {len(texts)} texts")
        model = _load_sentence_transformer(path or model_name)
        texts = _with_prefix(texts, model_name, input_type)
        return model.encode(texts, batch_size=32).tolist()
    except Exception as e:
        print(f"SentenceTransformer embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate SentenceTransformer embeddings: {str(e)}")


@EmbeddingMethodRegistry.register("azure-openai")
def azure_openai_embedder(texts, model_name="text-embedding-3-small", path=None, api_keys=None,
                          input_type="document"):
    """
    Generate embeddings using Azure OpenAI Embeddings.

    Args:
        texts: List of text strings to embed
        model_name: The Azure deployment name. Azure routes by deployment, so
            this is what the Embedding Model field holds for this provider.

    Returns:
        List of embeddings for each text
    """
    try:
        from openai import AzureOpenAI

        print(f"Using Azure OpenAI deployment: {model_name} for {len(texts)} texts")

        azure_api_key = api_keys and api_keys.get("Azure_OpenAI") or os.environ.get("AZURE_OPENAI_API_KEY")
        azure_endpoint = api_keys and api_keys.get("Azure_OpenAI_Endpoint") or os.environ.get("AZURE_OPENAI_ENDPOINT")

        if not azure_api_key:
            raise ValueError("API key for Azure OpenAI is missing.")
        if not azure_endpoint:
            raise ValueError("Endpoint for Azure OpenAI is missing.")
        if not model_name:
            raise ValueError("Enter your Azure deployment name as the embedding model.")

        client = AzureOpenAI(
            api_key=azure_api_key,
            api_version="2023-05-15",
            azure_endpoint=azure_endpoint
        )
        return _embed_in_batches(client, model_name, texts)
    except Exception as e:
        print(f"Azure OpenAI embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate Azure OpenAI embeddings: {str(e)}")
