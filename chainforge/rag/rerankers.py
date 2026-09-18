import sys
from typing import List, Dict, Any, Callable, Union
from collections import defaultdict
import copy
from functools import lru_cache

from chainforge.rag.devices import torch_device, warn_falling_back_to_cpu


@lru_cache(maxsize=2)
def _load_cross_encoder(model_name: str, device: str = "cpu"):
    """Load a cross-encoder once per process rather than on every /rerank call."""
    from sentence_transformers import CrossEncoder
    return CrossEncoder(model_name, device=device)


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
        # Create query-document pairs
        pairs = [(query, doc) for doc in documents]

        # Get relevance scores
        device = torch_device()
        try:
            scores = _load_cross_encoder(model_name, device).predict(pairs, batch_size=batch_size)
        except (RuntimeError, NotImplementedError) as e:
            if device == "cpu":
                raise
            warn_falling_back_to_cpu("Cross-encoder reranking", device, e)
            scores = _load_cross_encoder(model_name, "cpu").predict(pairs, batch_size=batch_size)
        
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
            - max_tokens_per_doc: Longer documents are truncated to this many tokens
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
    max_tokens_per_doc = kwargs.get("max_tokens_per_doc")
    api_keys = kwargs.get("api_keys")

    # Get API key from api_keys parameter or environment
    import os
    api_key = api_keys and api_keys.get("Cohere") or os.getenv("COHERE_API_KEY")
    if not api_key:
        raise ValueError("Cohere API key not found in api_keys parameter or COHERE_API_KEY environment variable")

    try:
        co = cohere.ClientV2(api_key)

        request = {"model": model_name, "query": query, "documents": documents, "top_n": top_k}
        # Flows saved earlier carry max_chunks_per_doc instead. Cohere's v2 API
        # has no such parameter, and it was being used to drop every document
        # past max_chunks_per_doc * top_k before reranking, so it is ignored.
        if max_tokens_per_doc not in (None, ""):
            request["max_tokens_per_doc"] = int(max_tokens_per_doc)
        response = co.rerank(**request)

        return [
            {
                "document": documents[result.index],
                "score": float(result.relevance_score),
                "index": result.index,
            }
            for result in response.results
        ]

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

def fusion_doc_key(chunk_id, doc_title, text):
    """Identifies one chunk across the rankings being fused.

    chunkId alone is not enough: it is the chunk's position within its own
    document, so chunk 0 of one document would fuse with chunk 0 of another.
    chunkId leads so that, when fused scores tie, order still follows it.
    Mirrored by fusionDocKey in react-server/src/backend/browserRetrieve.ts.
    """
    return "\u0000".join((str(chunk_id or ""), str(doc_title or ""), str(text or "")))


def _min_max_scaled(scores):
    """Rescale one method's scores to [0, 1].

    Methods score on unrelated scales -- BM25 relative to its best hit, cosine
    around 0.5-1, cross-encoders unbounded -- so summing raw scores lets
    whichever runs largest decide the ranking. If every score is the same,
    each is that method's best, so each becomes 1.
    """
    if not scores:
        return {}
    lo, hi = min(scores.values()), max(scores.values())
    if hi == lo:
        return {d: 1.0 for d in scores}
    return {d: (s - lo) / (hi - lo) for d, s in scores.items()}


def weighted_avg_fuse(method_lists, weights_by_method=None):
    """Weighted sum of each method's scores, after scaling each method to [0, 1]."""
    weights_by_method = weights_by_method or {}

    # gather all doc ids present in any method list
    all_doc_ids = set()
    for items in method_lists.values():
        for it in items:
            all_doc_ids.add(it["doc_id"])

    # index scaled scores by method -> doc_id -> score
    raw_score = {
        mid: _min_max_scaled({it["doc_id"]: float(it["score"]) for it in items})
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

