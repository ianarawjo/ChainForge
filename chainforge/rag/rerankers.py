import sys
from typing import List, Dict, Any, Callable, Union
from collections import defaultdict
import copy

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

# === Retrieval Fusion Methods ===

def _best_obj_for_doc(method_lists, doc_id):
    best_mid, best_rank = None, 10**9
    for mid, items in method_lists.items():
        for it in items:
            if it["doc_id"] == doc_id and it["rank"] < best_rank:
                best_rank, best_mid = it["rank"], mid
    for it in method_lists[best_mid]:
        if it["doc_id"] == doc_id:
            return it["obj"]
    return None

def weighted_avg_fuse(method_lists, weights_by_method=None):
    """Simple weighted average of raw sccores"""
    weights_by_method = weights_by_method or {}

    # gather all doc ids present in any method list
    all_doc_ids = set()
    for items in method_lists.values():
        for it in items:
            all_doc_ids.add(it["doc_id"])

    # index raw scores by method -> doc_id -> score
    raw_score = {
        mid: {it["doc_id"]: float(it["score"]) for it in items}
        for mid, items in method_lists.items()
    }

    fused_scores = {}
    for d in all_doc_ids:
        s = 0.0
        for mid, scores in raw_score.items():
            w = float(weights_by_method.get(mid, 1.0))
            s += w * scores.get(d, 0.0)
        fused_scores[d] = s

    fused = []
    for d, s in fused_scores.items():
        base_obj = _best_obj_for_doc(method_lists, d)
        fused.append((d, s, base_obj))
    fused.sort(key=lambda x: (-x[1], x[0]))
    return fused

def rrf_fuse(method_lists, k=60, weights_by_method=None):
    """RRF uses ranks with the 1/(k + rank) formula; weights apply per method."""
    weights_by_method = weights_by_method or {}
    rank_maps = {
        mid: {it["doc_id"]: int(it["rank"]) for it in items}
        for mid, items in method_lists.items()
    }
    all_docs = set()
    for items in method_lists.values():
        for it in items:
            all_docs.add(it["doc_id"])

    fused = []
    for d in all_docs:
        score, contributors = 0.0, []
        for mid, rmap in rank_maps.items():
            r = rmap.get(d)
            if r is not None:
                w = float(weights_by_method.get(mid, 1.0))
                score += w * (1.0 / (k + r))
                contributors.append(mid)
        best_mid = min(contributors, key=lambda m: rank_maps[m][d])
        best_obj = next(it["obj"] for it in method_lists[best_mid] if it["doc_id"] == d)
        fused.append((d, score, best_obj))
    fused.sort(key=lambda x: (-x[1], x[0]))
    return fused

