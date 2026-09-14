import math, heapq, os, re
from typing import List, Any, Tuple, Dict
import numpy as np
from chainforge.rag.simple_preprocess import simple_preprocess
from chainforge.rag.vector_stores import (
    LancedbVectorStore, FaissVectorStore, normalize_metric, mmr_select,
)


# Define a registry for retrieval methods
class RetrievalMethodRegistry:
    _methods = {}
    
    @classmethod
    def register(cls, method_name):
        def decorator(handler_func):
            cls._methods[method_name] = handler_func
            return handler_func
        return decorator
        
    @classmethod
    def get_handler(cls, method_name):
        return cls._methods.get(method_name)

def normalize_query(raw_q: Any) -> Tuple[Dict[str, Any], str]:
    """
    Turn any raw_q (dict or other) into:
      1) a normalized query-object dict
      2) the canonical text string to use
    """
    if isinstance(raw_q, dict):
        q_obj = raw_q
    else:
        q_obj = {"text": str(raw_q)}

    text = str(
        q_obj.get("text")
        or q_obj.get("query")
        or q_obj.get("prompt", "")
    )
    return q_obj, text

def _attach_chunk_identity(hits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Lift docTitle/chunkId out of stored metadata onto each hit.

    Vector stores return {id, text, similarity, metadata}, but /retrieve reads
    `docTitle`/`chunkId` off the hit itself -- and rank fusion keys documents
    by `chunkId`. Without this, embedding-based retrieval loses document
    attribution, and every chunk fuses under the same empty doc_id so a fused
    group collapses to a single row.

    Stores written before this existed have no docTitle/chunkId in their
    metadata; those fall back to "" exactly as they did before.
    """
    for hit in hits:
        meta = hit.get("metadata") or {}
        hit.setdefault("docTitle", meta.get("docTitle", "") if isinstance(meta, dict) else "")
        hit.setdefault("chunkId", meta.get("chunkId", "") if isinstance(meta, dict) else "")
    return hits


@RetrievalMethodRegistry.register("embedding")
def handle_embedding(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path):
    """
    Unified embedding-based retrieval handler that delegates to the vector
    store backend named by `storage_backend`: in-memory, LanceDB or FAISS.

    The similarity metric is passed through to the vector store, which handles
    the actual similarity computation.
    """
    storage_backend = settings.get("storage_backend", "lancedb")
    similarity_metric = settings.get("similarity_metric", "cosine")

    # Map similarity metric names to backend-specific metric names
    metric_map = {
        "cosine": "cosine",
        "euclidean": "l2",
        "dot_product": "dot",
    }
    settings = {**settings, "metric": metric_map.get(similarity_metric, "cosine")}

    handler_name = {
        "memory": "memory_vector_store",
        "lancedb": "lancedb_vector_store",
        "faiss": "faiss_vector_store",
    }.get(storage_backend)
    if handler_name is None:
        raise ValueError(f"Unsupported storage backend: {storage_backend}. Use 'memory', 'lancedb' or 'faiss'.")
    handler = RetrievalMethodRegistry.get_handler(handler_name)
    return handler(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path)

@RetrievalMethodRegistry.register("bm25")
def handle_bm25(chunk_objs: List[Dict], query_objs: List[Any], settings: Dict[str, Any]) -> List[Dict]:
    from rank_bm25 import BM25Okapi
    """Retrieve top-k chunks for each query using BM25."""
    # An empty corpus has nothing to index; match the boolean/overlap methods
    # and return no hits rather than letting BM25Okapi divide by zero.
    if not chunk_objs:
        return [{"query_object": normalize_query(q)[0], "retrieved_chunks": []}
                for q in query_objs]

    # Build BM25 index
    docs = [str(c.get("text", "")) for c in chunk_objs]
    tokenized_corpus = [simple_preprocess(doc) for doc in docs]
    k1 = float(settings.get("bm25_k1", 1.5))
    b = float(settings.get("bm25_b", 0.75))
    bm25 = BM25Okapi(tokenized_corpus, k1=k1, b=b)

    top_k = int(settings.get("top_k", 5))
    results: List[Dict] = []

    for raw_q in query_objs:
        # Normalize and extract text
        q_obj, query_text = normalize_query(raw_q)
        # Tokenize for scoring
        tokens = simple_preprocess(query_text)

        # Score & normalize
        scores = bm25.get_scores(tokens)
        if scores.size == 0:
            results.append({"query_object": q_obj, "retrieved_chunks": []})
            continue

        max_score = float(scores.max()) or 1.0
        normalized = (scores / max_score).tolist()

        # Pick top-k & build hits
        top_idxs = sorted(
            range(len(normalized)),
            key=lambda i: normalized[i],
            reverse=True
        )[:top_k]

        hits = []
        for idx in top_idxs:
            c = chunk_objs[idx]
            hits.append({
                "text":       c.get("text", ""),
                "similarity": normalized[idx],
                "docTitle":   c.get("docTitle", ""),
                "chunkId":    c.get("chunkId", ""),
            })

        results.append({
            "query_object":     q_obj,
            "retrieved_chunks": hits
        })

    return results


@RetrievalMethodRegistry.register("tfidf")
def handle_tfidf(chunk_objs: List[Dict], query_objs: List[Any], settings: Dict[str, Any]) -> List[Dict]:
    from sklearn.feature_extraction.text import TfidfVectorizer
    """Retrieve top-k chunks for each query using TF-IDF cosine similarity."""
    # Safely cast settings
    top_k = int(settings.get("top_k", 5))
    max_features = int(settings.get("max_features", 500))

    # Prepare the corpus texts
    docs = [str(c.get("text", "")) for c in chunk_objs]

    empty_results = [{"query_object": normalize_query(q)[0], "retrieved_chunks": []}
                     for q in query_objs]
    if not docs:
        return empty_results

    # Fit the TF-IDF vectorizer. A corpus of only stop words (or only empty
    # strings) yields an empty vocabulary, which sklearn raises on.
    vectorizer = TfidfVectorizer(stop_words="english", max_features=max_features)
    try:
        tfidf_matrix = vectorizer.fit_transform(docs)
    except ValueError:
        return empty_results

    results: List[Dict] = []
    for raw_q in query_objs:
        # Normalize and extract text
        q_obj, query_text = normalize_query(raw_q)

        # Transform query into vector
        query_vec = vectorizer.transform([query_text])

        # Compute raw similarities
        sims = (tfidf_matrix * query_vec.T).toarray().flatten()
        max_sim = float(sims.max()) if sims.size and sims.max() > 0 else 1.0
        normalized = sims / max_sim

        # Pick top-k indices
        top_idxs = sorted(
            range(len(normalized)),
            key=lambda i: normalized[i],
            reverse=True
        )[:top_k]

        # Build hits
        hits = []
        for idx in top_idxs:
            c = chunk_objs[idx]
            hits.append({
                "text":       c.get("text", ""),
                "similarity": float(normalized[idx]),
                "docTitle":   c.get("docTitle", ""),
                "chunkId":    c.get("chunkId", ""),
            })

        results.append({
            "query_object":     q_obj,
            "retrieved_chunks": hits
        })

    return results

@RetrievalMethodRegistry.register("boolean")
def handle_boolean(chunk_objs: List[Dict], query_objs: List[Any], settings: Dict[str, Any]) -> List[Dict]:
    """Retrieve chunks by boolean overlap (minimum token matches)."""
    # Cast settings
    top_k = int(settings.get("top_k", 5))
    required_match_count = int(settings.get("required_match_count", 1))

    # Pre-tokenize chunks
    chunk_texts = [str(c.get("text", "")) for c in chunk_objs]
    tokenized_chunks = [set(simple_preprocess(text)) for text in chunk_texts]

    results: List[Dict] = []
    for raw_q in query_objs:
        # Normalize and extract text
        q_obj, query_text = normalize_query(raw_q)

        # Tokenize the query
        q_tokens = set(simple_preprocess(query_text))

        # If not enough tokens, no hits
        if len(q_tokens) < required_match_count:
            results.append({"query_object": q_obj, "retrieved_chunks": []})
            continue

        scored: List[Tuple[int, float]] = []
        for idx, c_tokens in enumerate(tokenized_chunks):
            matches = len(q_tokens & c_tokens)
            if matches >= required_match_count:
                score = matches / (len(c_tokens) or 1)
                scored.append((idx, score))

        # Sort & take top_k
        scored.sort(key=lambda x: x[1], reverse=True)

        # Build retrieved_chunks
        retrieved: List[Dict] = []
        if scored:
            top_score = scored[0][1] or 1.0
            for idx, raw_score in scored[:top_k]:
                c = chunk_objs[idx]
                norm_score = raw_score / top_score
                retrieved.append({
                    "text":       c.get("text", ""),
                    "similarity": float(norm_score),
                    "docTitle":   c.get("docTitle", ""),
                    "chunkId":    c.get("chunkId", ""),
                })

        results.append({
            "query_object":     q_obj,
            "retrieved_chunks": retrieved
        })

    return results


@RetrievalMethodRegistry.register("overlap")
def handle_keyword_overlap(chunk_objs: List[Dict], query_objs: List[Any], settings: Dict[str, Any]) -> List[Dict]:
    """Retrieve chunks by keyword overlap (raw token count)."""
    # Settings
    top_k = int(settings.get("top_k", 5))

    # Pre-tokenize chunks
    docs = [str(c.get("text", "")) for c in chunk_objs]
    tokenized_chunks = [set(simple_preprocess(doc)) for doc in docs]

    results: List[Dict] = []
    for raw_q in query_objs:
        # Normalize and extract text
        q_obj, query_text = normalize_query(raw_q)

        # Tokenize the query
        q_tokens = set(simple_preprocess(query_text))

        # Score by overlap count
        scored: List[Tuple[int, int]] = []
        for idx, c_tokens in enumerate(tokenized_chunks):
            overlap = len(q_tokens & c_tokens)
            scored.append((idx, overlap))

        # Sort descending
        scored.sort(key=lambda x: x[1], reverse=True)

        # Build retrieved list
        retrieved: List[Dict] = []
        if scored and scored[0][1] > 0:
            max_overlap = scored[0][1]
            for idx, raw_score in scored[:top_k]:
                c = chunk_objs[idx]
                norm_score = raw_score / max_overlap
                retrieved.append({
                    "text":       c.get("text", ""),
                    "similarity": float(norm_score),
                    "docTitle":   c.get("docTitle", ""),
                    "chunkId":    c.get("chunkId", ""),
                })

        results.append({
            "query_object":     q_obj,
            "retrieved_chunks": retrieved
        })

    return results

@RetrievalMethodRegistry.register("clustered")
def handle_clustered(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path):
    """
    Retrieve chunks using a combination of query similarity and cluster similarity.
    """
    from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine
    from sklearn.cluster import KMeans

    top_k = settings.get("top_k", 5)
    n_clusters = settings.get("n_clusters", 3)
    query_coeff = settings.get("query_coeff", 0.6)
    center_coeff = settings.get("center_coeff", 0.4)
    results = []
    
    # Convert embeddings to numpy array for clustering
    X = np.array(chunk_embeddings)
    
    # Only perform clustering if we have enough samples
    if len(X) >= 2:
        n_clusters = min(n_clusters, len(X))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        labels = kmeans.fit_predict(X)
        cluster_centers = kmeans.cluster_centers_
        
        for query_obj, query_emb in zip(query_objs, query_embeddings):
            min_heap = []
            query_emb_np = np.array(query_emb).reshape(1, -1)
            
            for i, (chunk, chunk_emb) in enumerate(zip(chunk_objs, chunk_embeddings)):
                # Calculate similarity to query
                chunk_emb_np = np.array(chunk_emb).reshape(1, -1)
                query_sim = float(sklearn_cosine(chunk_emb_np, query_emb_np)[0][0])
                
                # Calculate similarity to cluster center
                center_sim = float(sklearn_cosine(
                    chunk_emb_np, 
                    cluster_centers[labels[i]].reshape(1, -1)
                )[0][0])
                
                # Combined similarity score (weighted)
                combined_sim = query_coeff * query_sim + center_coeff * center_sim
                
                if len(min_heap) < top_k:
                    heapq.heappush(min_heap, (combined_sim, i))
                elif combined_sim > min_heap[0][0]:
                    heapq.heappushpop(min_heap, (combined_sim, i))
            
            # Convert heap to sorted results
            retrieved = []
            for sim, i in sorted(min_heap, reverse=True):
                chunk = chunk_objs[i]
                retrieved.append({
                    "text": chunk.get("text", ""),
                    "similarity": float(sim),
                    "docTitle": chunk.get("docTitle", ""),
                    "chunkId": chunk.get("chunkId", ""),
                })
            
            results.append({'query_object': query_obj, 'retrieved_chunks': retrieved})
    return results


# === Shared by the vector store handlers ===

_BACKEND_OF_METHOD = {
    "memory_vector_store": "memory",
    "lancedb_vector_store": "lancedb",
    "faiss_vector_store": "faiss",
}

_MODE_SETTING = {"lancedb": "lancedb_mode", "faiss": "faiss_mode"}


def uses_existing_index(base_method: str, settings: Dict[str, Any]) -> bool:
    """Whether a method searches an index already on disk, ignoring the connected chunks."""
    if base_method == "embedding":
        backend = settings.get("storage_backend", "lancedb")
    else:
        backend = _BACKEND_OF_METHOD.get(base_method)
    mode_setting = _MODE_SETTING.get(backend)
    return mode_setting is not None and settings.get(mode_setting) == "load"


def _index_folder(user_path: str, scratch_path: str, loading: bool) -> str:
    """The folder a store's index lives in: the user's, or a scratch one.

    Loading needs the user's: the scratch folder is rebuilt on every run.
    """
    if user_path:
        return user_path
    if loading:
        raise ValueError("Loading an existing index needs its path. Set the index path, "
                         "or build the index from the connected chunks instead.")
    return scratch_path


def _per_chunk_method(name: str, settings: Dict[str, Any], user_path: str) -> str:
    """Name a saved index after its chunking method, when there are several.

    /retrieve runs each method once per chunking method, so with one fixed name
    each run would replace the index the previous one saved. `_index_suffix` is
    set by /retrieve only when several chunking methods are connected. Scratch
    indexes are rebuilt every run anyway, so they keep the plain name.
    """
    suffix = re.sub(r"\W+", "_", str(settings.get("_index_suffix") or "")).strip("_")
    return f"{name}_{suffix}" if suffix and user_path else name


def _search_method(settings: Dict[str, Any]) -> str:
    """"similarity" or "mmr".

    The setting keeps its original name, `lancedb_search_method`, so saved flows
    still load, though it applies to every backend. "hybrid" was once offered
    but never ran, so flows that saved it have always had plain similarity
    search, and still get it.
    """
    method = str(settings.get("lancedb_search_method") or "similarity").lower()
    if method not in ("similarity", "mmr"):
        print(f"Warning: search method '{method}' is not supported; using similarity search.")
        return "similarity"
    return method


def _apply_threshold(hits: List[Dict[str, Any]], settings: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Drop hits scoring below `similarity_threshold`, a percentage (0-100)."""
    threshold = settings.get("similarity_threshold")
    if threshold is None or threshold == "":
        return hits
    cutoff = float(threshold) / 100.0
    return [h for h in hits if h["similarity"] >= cutoff]


def _chunk_metadata(chunk_objs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{
        "fill_history": chunk.get("fill_history", {}),
        "metadata": chunk.get("metadata", {}),
        "docTitle": chunk.get("docTitle", ""),
        "chunkId": chunk.get("chunkId", ""),
    } for chunk in chunk_objs]


def _search_store(store, query_objs, query_embeddings, settings, metric):
    """Run every query against a store, applying the search method and threshold."""
    top_k = int(settings.get("top_k", 5))
    method = _search_method(settings)
    results = []
    for query_obj, query_emb in zip(query_objs, query_embeddings):
        hits = store.search(
            query=query_emb if query_emb is not None else query_obj.get("text", ""),
            k=top_k,
            distance_metric=metric,
            method=method,
        )
        results.append({'query_object': query_obj,
                        'retrieved_chunks': _apply_threshold(_attach_chunk_identity(hits), settings)})
    return results


@RetrievalMethodRegistry.register("lancedb_vector_store")
def handle_lancedb_vector_store(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path):
    """
    Retrieve chunks using a local vector store with LanceDB.

    The index is built from the connected chunks: in a scratch folder by
    default, or at `lancedb_path`, where it is left for later. With
    `lancedb_mode` "load", the table already at `lancedb_path` is searched
    as it is, and the connected chunks are ignored.
    """
    metric = normalize_metric(settings.get("metric", "l2"))
    if metric is None:
        print(f"Warning: Invalid LanceDB metric '{settings.get('metric')}' specified. Defaulting to 'l2'.")
        metric = "l2"

    loading = uses_existing_index("lancedb_vector_store", settings)
    if not loading and (not chunk_objs or not chunk_embeddings):
        raise Exception("Error: chunk_objs or chunk_embeddings are empty.")
    if not query_objs or not query_embeddings:
        raise Exception("Error: query_objs or query_embeddings are empty.")

    user_path = os.path.expanduser(str(settings.get("lancedb_path") or "").strip())
    folder = _index_folder(user_path, db_path, loading)
    table = str(settings.get("lancedb_table") or "").strip() or "embeddings"

    if loading:
        vector_store = LancedbVectorStore(db_path=folder, table_name=table, db_mode="load")
    else:
        vector_store = LancedbVectorStore(
            db_path=folder,
            table_name=_per_chunk_method(table, settings, user_path),
            db_mode="create",
        )
        vector_store.add(
            texts=[chunk.get("text", "") for chunk in chunk_objs],
            embeddings=chunk_embeddings,
            metadata=_chunk_metadata(chunk_objs),
        )

    return _search_store(vector_store, query_objs, query_embeddings, settings, metric)


@RetrievalMethodRegistry.register("faiss_vector_store")
def handle_faiss_vector_store(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path):
    """
    Retrieve chunks using a FAISS index.

    `faiss_path` may name a folder or a .faiss file. As with LanceDB, the index
    is built from the connected chunks unless `faiss_mode` is "load".
    """
    loading = uses_existing_index("faiss_vector_store", settings)

    user_path = os.path.expanduser(str(settings.get("faiss_path") or "").strip())
    index_name = "index"
    if user_path.endswith(".faiss"):
        user_path, index_name = os.path.split(user_path[:-len(".faiss")])
        user_path = user_path or "."
    folder = _index_folder(user_path, db_path, loading)

    if loading:
        vector_store = FaissVectorStore(db_path=folder, index_name=index_name,
                                        metric=settings.get("metric", "l2"), db_mode="load")
    else:
        vector_store = FaissVectorStore(
            db_path=folder,
            index_name=_per_chunk_method(index_name, settings, user_path),
            metric=settings.get("metric", "l2"),
            db_mode="create",
        )
        vector_store.add(
            texts=[chunk.get("text", "") for chunk in chunk_objs],
            embeddings=chunk_embeddings,
            metadata=_chunk_metadata(chunk_objs),
        )

    return _search_store(vector_store, query_objs, query_embeddings, settings, vector_store.metric)


@RetrievalMethodRegistry.register("memory_vector_store")
def handle_memory_vector_store(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path=None):
    """
    Retrieve chunks by exact search over their embeddings, held in memory.

    Nothing to install and no files written; the index is rebuilt every run.
    Scores use the same scale as the LanceDB and FAISS stores.
    """
    if not chunk_objs or chunk_embeddings is None or len(chunk_embeddings) == 0:
        raise Exception("Error: chunk_objs or chunk_embeddings are empty.")
    if not query_objs or query_embeddings is None or len(query_embeddings) == 0:
        raise Exception("Error: query_objs or query_embeddings are empty.")

    metric = normalize_metric(settings.get("metric", "cosine")) or "cosine"
    top_k = int(settings.get("top_k", 5))
    method = _search_method(settings)

    vectors = np.asarray(chunk_embeddings, dtype=np.float32)
    norms = np.linalg.norm(vectors, axis=1)
    norms[norms == 0] = 1.0
    metadata = _chunk_metadata(chunk_objs)

    results = []
    for query_obj, query_emb in zip(query_objs, query_embeddings):
        query = np.asarray(query_emb, dtype=np.float32)
        if metric == "cosine":
            cos = (vectors @ query) / (norms * (np.linalg.norm(query) or 1.0))
            sims = (1.0 + cos) / 2.0  # as vector_stores.cosine_to_similarity
        elif metric == "dot":
            sims = vectors @ query
        else:
            sims = 1.0 / (1.0 + np.sum((vectors - query) ** 2, axis=1))

        order = np.argsort(-sims, kind="stable")
        if method == "mmr":
            candidates = order[:top_k * 3]
            order = candidates[mmr_select(query, vectors[candidates], top_k)]

        hits = [{
            "text": chunk_objs[i].get("text", ""),
            "similarity": float(sims[i]),
            "metadata": metadata[i],
        } for i in order[:top_k]]
        results.append({'query_object': query_obj,
                        'retrieved_chunks': _apply_threshold(_attach_chunk_identity(hits), settings)})
    return results


def cosine_to_similarity_array(cos):
    """Vectorized form of vector_stores.cosine_to_similarity."""
    return (1.0 + cos) / 2.0
