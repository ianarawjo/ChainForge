import math, os, heapq
from typing import List, Any, Tuple, Dict
import numpy as np
from chainforge.rag.simple_preprocess import simple_preprocess
from chainforge.rag.vector_stores import LancedbVectorStore, FaissVectorStore


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

@RetrievalMethodRegistry.register("bm25")
def handle_bm25(chunk_objs: List[Dict], query_objs: List[Any], settings: Dict[str, Any]) -> List[Dict]:
    from rank_bm25 import BM25Okapi
    """Retrieve top-k chunks for each query using BM25."""
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

    # Fit the TF-IDF vectorizer
    vectorizer = TfidfVectorizer(stop_words="english", max_features=max_features)
    tfidf_matrix = vectorizer.fit_transform(docs)

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

# Helper functions for similarity calculations
def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors"""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a in vec1))
    norm_b = math.sqrt(sum(b * b for b in vec2))
    return dot_product / (norm_a * norm_b) if norm_a * norm_b > 0 else 0

def manhattan_distance(vec1, vec2):
    """Compute Manhattan distance between two vectors"""
    return sum(abs(a - b) for a, b in zip(vec1, vec2))

def euclidean_distance(vec1, vec2):
    """Compute Euclidean distance between two vectors"""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(vec1, vec2)))

@RetrievalMethodRegistry.register("cosine")
def handle_cosine_similarity(chunks, chunk_embeddings, query_objs, query_embeddings, settings):
    """
    Retrieve chunks using cosine similarity between embeddings.
    
    This implementation uses a min-heap to keep only the top-k results in memory.
    """
    top_k = settings.get("top_k", 5)
    results = []
    
    for (query_obj, query_emb) in zip(query_objs, query_embeddings):
        # Use a min heap to keep track of top k results
        min_heap = []
        
        # Calculate similarities and maintain heap of size top_k
        for i, (chunk, chunk_emb) in enumerate(zip(chunks, chunk_embeddings)):
            sim = cosine_similarity(chunk_emb, query_emb)
            
            # If heap is not full, add the item
            if len(min_heap) < top_k:
                heapq.heappush(min_heap, (sim, i))
            # If similarity is higher than the smallest in heap, replace it
            elif sim > min_heap[0][0]:
                heapq.heappushpop(min_heap, (sim, i))
        
        # Convert heap to sorted results (highest similarity first)
        retrieved = []
        for sim, i in sorted(min_heap, reverse=True):
            chunk = chunks[i]
            retrieved.append({
                "text": chunk.get("text", ""),
                "similarity": float(sim),
                "docTitle": chunk.get("docTitle", ""),
                "chunkId": chunk.get("chunkId", ""),
            })
        
        results.append({'query_object': query_obj, 'retrieved_chunks': retrieved})
    
    return results

@RetrievalMethodRegistry.register("manhattan")
def handle_manhattan(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings):
    """
    Retrieve chunks using Manhattan distance between embeddings.
    """
    top_k = settings.get("top_k", 5)
    results = []
    
    for query_obj, query_emb in zip(query_objs, query_embeddings):
        # Use a min heap to keep track of top k results
        min_heap = []
        
        # Calculate similarities and maintain heap of size top_k
        for i, (chunk, chunk_emb) in enumerate(zip(chunk_objs, chunk_embeddings)):
            # Lower Manhattan distance = higher similarity
            distance = manhattan_distance(chunk_emb, query_emb)
            sim = 1.0 / (1.0 + distance)  # Transform to similarity score
            
            if len(min_heap) < top_k:
                heapq.heappush(min_heap, (sim, i))
            elif sim > min_heap[0][0]:
                heapq.heappushpop(min_heap, (sim, i))
        
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

@RetrievalMethodRegistry.register("euclidean")
def handle_euclidean(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings):
    """
    Retrieve chunks using Euclidean distance between embeddings.
    """
    top_k = settings.get("top_k", 5)
    results = []
    
    for query_obj, query_emb in zip(query_objs, query_embeddings):
        min_heap = []
        
        for i, (chunk, chunk_emb) in enumerate(zip(chunk_objs, chunk_embeddings)):
            distance = euclidean_distance(chunk_emb, query_emb)
            sim = 1.0 / (1.0 + distance)  # Transform to similarity score
            
            if len(min_heap) < top_k:
                heapq.heappush(min_heap, (sim, i))
            elif sim > min_heap[0][0]:
                heapq.heappushpop(min_heap, (sim, i))
        
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

@RetrievalMethodRegistry.register("clustered")
def handle_clustered(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings):
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


@RetrievalMethodRegistry.register("lancedb_vector_store")
def handle_lancedb_vector_store(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path):
    """
    Retrieve chunks using a local vector store with LanceDB.
    """

    top_k = settings.get("top_k", 5)
    user_requested_metric = settings.get("metric", "l2").lower()
    if user_requested_metric not in ["l2", "cosine", "dot"]:
        print(f"Warning: Invalid FAISS metric '{user_requested_metric}' specified. Defaulting to 'l2'.")
        user_requested_metric = "l2"

    # Basic Input Validation
    if not chunk_objs or not chunk_embeddings:
        raise Exception("Error: chunk_objs or chunk_embeddings are empty.")
    if not query_objs or not query_embeddings:
        raise Exception("Error: query_objs or query_embeddings are empty.")

    # Create a local vector store (loading an existing one from disk if it exists)
    vector_store = LancedbVectorStore(
        db_path=db_path,
        embedding_func=None,
    )

    # Add chunks to the vector store
    # NOTE: This will automatically skip chunks that are already in the store, 
    # since the store used the hash of the chunk text as the ID.
    vector_store.add(
        texts=[chunk.get("text", "") for chunk in chunk_objs],
        embeddings=chunk_embeddings,
        metadata=[{
            "fill_history": chunk.get("fill_history", {}),
            "metadata": chunk.get("metadata", {}), 
        } for chunk in chunk_objs],
    )

    # Perform a similarity search for each query
    results = []
    for query_obj, query_emb in zip(query_objs, query_embeddings):
        # Perform the search
        res = vector_store.search(
            query=query_emb if query_emb is not None else query_obj.get("text", ""),
            k=top_k,
            metric=user_requested_metric,
        )
        results.append({'query_object': query_obj, 'retrieved_chunks': res})

    return results


@RetrievalMethodRegistry.register("faiss_vector_store")
def handle_faiss_vector_store(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings, db_path):
    top_k = settings.get("top_k", 5)
    metric = settings.get("metric", "l2")
    vector_store = FaissVectorStore(
        db_path=db_path,
        embedding_func=None,
        index_name="index",
        metric=metric
    )
    # Ajout des documents (si besoin)
    vector_store.add(
        texts=[chunk.get("text", "") for chunk in chunk_objs],
        embeddings=chunk_embeddings,
        metadata=[{
            "fill_history": chunk.get("fill_history", {}),
            "metadata": chunk.get("metadata", {}),
        } for chunk in chunk_objs],
    )
    # Recherche pour chaque requête
    results = []
    for query_obj, query_emb in zip(query_objs, query_embeddings):
        res = vector_store.search(
            query=query_emb if query_emb is not None else query_obj.get("text", ""),
            k=top_k,
        )
        results.append({'query_object': query_obj, 'retrieved_chunks': res})
    return results
