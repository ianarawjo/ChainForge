import os

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

"""

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


@EmbeddingMethodRegistry.register("huggingface")
def huggingface_embedder(texts, model_name="sentence-transformers/all-mpnet-base-v2", path=None, 
                         api_keys=None):
    """
    Generate embeddings using HuggingFace Transformers.
    
    Args:
        texts: List of text strings to embed
        model_name: HuggingFace model name/path (default: sentence-transformers/all-mpnet-base-v2)
        path: in case you need to you local path
        
    Returns:
        List of embeddings for each text
    """
    try:
        from transformers import AutoTokenizer, AutoModel
        import torch

        print(f"Using HuggingFace model: {model_name} for {len(texts)} texts")

        if path:
            model_name = path

        # Load model and tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModel.from_pretrained(model_name)

        embeddings = []
        batch_size = 32
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_embeddings = []

            for t in batch_texts:
                inputs = tokenizer(t, return_tensors="pt", truncation=True, padding=True,
                                   max_length=512)  # Add max_length for safety
                with torch.no_grad():
                    outputs = model(**inputs)
                # Use mean pooling by default
                emb = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
                batch_embeddings.append(emb)

            embeddings.extend(batch_embeddings)

        return embeddings
    except Exception as e:
        print(f"HuggingFace embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate HuggingFace embeddings: {str(e)}")


@EmbeddingMethodRegistry.register("openai")
def openai_embedder(texts, model_name="text-embedding-ada-002", path=None, api_keys=None):
    """
    Generate embeddings using OpenAI Embeddings.
    
    Args:
        texts: List of text strings to embed
        model_name: OpenAI embedding model to use (default: text-embedding-ada-002)
        path: not used
        
    Returns:
        List of embeddings for each text
    """
    try:
        from openai import OpenAI
        client = OpenAI()

        print(f"Using OpenAI model: {model_name} for {len(texts)} texts")

        # Get the OpenAI API key from environment or settings
        openai_api_key = api_keys and api_keys.get("OpenAI") or os.environ.get("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("Missing OpenAI key.")

        client.api_key = openai_api_key

        embeddings = []
        # Process in batches of 16 to stay within rate limits
        batch_size = 16
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            batch_embeddings = []

            for t in batch_texts:
                resp = client.embeddings.create(input=t, model=model_name)
                emb = resp.data[0].embedding
                batch_embeddings.append(emb)

            embeddings.extend(batch_embeddings)

        return embeddings
    except Exception as e:
        print(f"OpenAI embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate OpenAI embeddings: {str(e)}")


@EmbeddingMethodRegistry.register("cohere")
def cohere_embedder(texts, model_name="embed-english-v2.0", path=None, api_keys=None):
    """
    Generate embeddings using Cohere Embeddings.
    
    Args:
        texts: List of text strings to embed
        model_name: Cohere embedding model to use (default: embed-english-v2.0)
        path: non utilisé
        
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

        co = cohere.Client(api_key)

        batch_size = 32
        embeddings = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            response = co.embed(texts=batch_texts, model=model_name)
            embeddings.extend(response.embeddings)

        return embeddings
    except Exception as e:
        print(f"Cohere embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate Cohere embeddings: {str(e)}")


@EmbeddingMethodRegistry.register("sentence-transformers")
def sentence_transformers_embedder(texts, model_name="all-MiniLM-L6-v2", path=None, api_keys=None):
    """
    Generate embeddings using Sentence Transformers.
    
    Args:
        texts: List of text strings to embed
        model_name: Sentence Transformers model name (default: all-MiniLM-L6-v2)
        
    Returns:
        List of embeddings for each text
    """
    try:
        from sentence_transformers import SentenceTransformer
        print(f"Using SentenceTransformer model: {model_name} for {len(texts)} texts")

        if path:
            model_name = path

        model = SentenceTransformer(model_name)

        # Process in reasonable batch sizes
        batch_size = 32
        embeddings = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]
            _embs = model.encode(batch_texts).tolist()
            embeddings.extend(_embs)

        return embeddings
    except Exception as e:
        print(f"SentenceTransformer embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate SentenceTransformer embeddings: {str(e)}")


@EmbeddingMethodRegistry.register("azure-openai")
def azure_openai_embedder(texts, model_name="text-embedding-ada-002", deployment_name=None, api_keys=None):
    """
    Generate embeddings using Azure OpenAI Embeddings.

    Args:
        texts: List of text strings to embed
        model_name: OpenAI embedding model to use (default: text-embedding-ada-002)
        deployment_name: used for name of deployment

    Returns:
        List of embeddings for each text
    """
    try:
        from openai import AzureOpenAI
        import concurrent.futures
        from tqdm import tqdm

        print(f"Using Azure OpenAI model: {model_name} for {len(texts)} texts")

        azure_api_key = api_keys and api_keys.get("Azure_OpenAI") or os.environ.get("AZURE_OPENAI_API_KEY")
        azure_endpoint = api_keys and api_keys.get("Azure_OpenAI_Endpoint") or os.environ.get("AZURE_OPENAI_ENDPOINT")

        if not azure_api_key:
            raise ValueError("API key for Azure OpenAI is missing.")
        if not azure_endpoint:
            raise ValueError("Endpoint for Azure OpenAI is missing.")

        client = AzureOpenAI(
            api_key=azure_api_key,
            api_version="2023-05-15",
            azure_endpoint=azure_endpoint
        )

        embeddings = []
        batch_size = 16

        def get_embedding(t):
            resp = client.embeddings.create(
                input=t,
                model=deployment_name
            )
            return resp.data[0].embedding

        # Initialisation de tqdm pour le nombre total de textes
        with tqdm(total=len(texts), desc="Generation of embeddings using Azure OpenAI") as pbar:
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    batch_embeddings = list(executor.map(get_embedding, batch_texts))
                embeddings.extend(batch_embeddings)
                pbar.update(len(batch_texts))

        return embeddings
    except Exception as e:
        print(f"Azure OpenAI embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate OpenAI embeddings: {str(e)}")
