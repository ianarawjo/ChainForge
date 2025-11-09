import sys
from typing import List, Dict, Any, Callable, Union

# === Reranking Registry ===
class RerankingMethodRegistry:
    """Registry for document reranker methods."""
    _methods: Dict[str, Callable] = {}

    @classmethod
    def register(cls, identifier: str):
        """Decorator to register a reranking function."""
        if not isinstance(identifier, str) or not identifier:
            raise ValueError("Method identifier must be a non-empty string.")

        def decorator(handler_func: Callable):
            if not callable(handler_func):
                raise TypeError("Registered handler must be a callable function.")
            if identifier in cls._methods:
                print(f"Warning: Overwriting existing reranking method '{identifier}'.", file=sys.stderr)
            cls._methods[identifier] = handler_func
            return handler_func
        return decorator

    @classmethod
    def get_handler(cls, identifier: str) -> Union[Callable, None]:
        """Get the handler function for a given method identifier."""
        return cls._methods.get(identifier)

# === Reranker Methods ===
@RerankingMethodRegistry.register("cross_encoder")
def cross_encoder_rerank(documents: List[str], query: str = "", **kwargs: Any) -> List[Dict[str, Any]]:
    """
    Rerank documents using a cross-encoder model, using the
    `sentence-transformers` library.

    See https://sbert.net/docs/cross_encoder/pretrained_models.html for available models.
    
    Args:
        documents: List of document texts to rerank
        query: Query text for relevance scoring
        **kwargs: Additional settings including:
            - model: Cross-encoder model name
            - top_k: Number of top documents to return
            - batch_size: Batch size for processing
    
    Returns:
        List of dictionaries with 'document', 'score', and 'index' keys
    """
    try:
        from sentence_transformers import CrossEncoder
    except ImportError:
        raise ImportError("sentence-transformers library is required for cross-encoder reranking")
    
    if not documents:
        return []
    
    if not query:
        # If no query provided, return documents in original order with synthetic scores
        return [
            {
                "document": doc,
                "score": 1.0 - (i / len(documents)),
                "index": i
            }
            for i, doc in enumerate(documents)
        ]
    
    model_name = kwargs.get("model", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    top_k = int(kwargs.get("top_k", min(5, len(documents))))
    batch_size = int(kwargs.get("batch_size", 32))
    
    try:
        # Load the cross-encoder model
        model = CrossEncoder(model_name)
        
        # Create query-document pairs
        pairs = [(query, doc) for doc in documents]
        
        # Get relevance scores
        scores = model.predict(pairs, batch_size=batch_size)
        
        # Create results with scores and original indices
        results = [
            {
                "document": documents[i],
                "score": float(scores[i]),
                "index": i
            }
            for i in range(len(documents))
        ]
        
        # Sort by score (descending) and return top_k
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
        
    except Exception as e:
        print(f"Error in cross-encoder reranking: {e}", file=sys.stderr)
        raise

@RerankingMethodRegistry.register("cohere_rerank")
def cohere_rerank(documents: List[str], query: str = "", **kwargs: Any) -> List[Dict[str, Any]]:
    """
    Rerank documents using Cohere's reranking API.
    
    Args:
        documents: List of document texts to rerank
        query: Query text for relevance scoring
        **kwargs: Additional settings including:
            - model: Cohere model name (e.g., 'rerank-v3.5')
            - top_k: Number of top documents to return
            - max_chunks_per_doc: Maximum chunks per document
            - api_keys: Dictionary containing API keys (optional)
    
    Returns:
        List of dictionaries with 'document', 'score', and 'index' keys
    """
    try:
        import cohere
    except ImportError:
        raise ImportError("cohere library is required for Cohere reranking")
    
    if not documents:
        return []
    
    if not query:
        # If no query provided, return documents in original order with synthetic scores
        return [
            {
                "document": doc,
                "score": 1.0 - (i / len(documents)),
                "index": i
            }
            for i, doc in enumerate(documents)
        ]
    
    model_name = kwargs.get("model", "rerank-v3.5")
    top_k = int(kwargs.get("top_k", min(5, len(documents))))
    max_chunks_per_doc = int(kwargs.get("max_chunks_per_doc", 10))
    api_keys = kwargs.get("api_keys")
    
    # Get API key from api_keys parameter or environment
    import os
    api_key = api_keys and api_keys.get("Cohere") or os.getenv("COHERE_API_KEY")
    if not api_key:
        raise ValueError("Cohere API key not found in api_keys parameter or COHERE_API_KEY environment variable")
    
    try:
        # Initialize Cohere client
        co = cohere.ClientV2(api_key)
        
        # Limit documents if too many
        docs_to_rerank = documents[:max_chunks_per_doc * top_k] if len(documents) > max_chunks_per_doc * top_k else documents
        
        # Call Cohere rerank API
        response = co.rerank(
            model=model_name,
            query=query,
            documents=docs_to_rerank,
            top_n=top_k
        )
        
        # Format results
        results = []
        for result in response.results:
            original_index = result.index
            results.append({
                "document": docs_to_rerank[original_index],
                "score": float(result.relevance_score),
                "index": original_index
            })
        
        return results
        
    except Exception as e:
        print(f"Error in Cohere reranking: {e}", file=sys.stderr)
        raise
