# For Retrieval Methods
from sklearn.feature_extraction.text import TfidfVectorizer
from rank_bm25 import BM25Okapi
from gensim.utils import simple_preprocess

class EmbeddingModelRegistry:
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

@EmbeddingModelRegistry.register("huggingface")
def huggingface_embedder(texts, model_name="sentence-transformers/all-mpnet-base-v2"):
    """
    Generate embeddings using HuggingFace Transformers.
    
    Args:
        texts: List of text strings to embed
        model_name: HuggingFace model name/path (default: sentence-transformers/all-mpnet-base-v2)
        
    Returns:
        List of embeddings for each text
    """
    try:
        from transformers import AutoTokenizer, AutoModel
        import torch
        
        print(f"Using HuggingFace model: {model_name} for {len(texts)} texts")
        
        # Load model and tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModel.from_pretrained(model_name)
        
        embeddings = []
        batch_size = 32
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
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

@EmbeddingModelRegistry.register("OpenAI Embeddings")
def openai_embedder(texts, model_name="text-embedding-ada-002"):
    """
    Generate embeddings using OpenAI Embeddings.
    
    Args:
        texts: List of text strings to embed
        model_name: OpenAI embedding model to use (default: text-embedding-ada-002)
        
    Returns:
        List of embeddings for each text
    """
    try:
        import openai
        print(f"Using OpenAI model: {model_name} for {len(texts)} texts")
        
        embeddings = []
        # Process in batches of 16 to stay within rate limits
        batch_size = 16
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            batch_embeddings = []
            
            for t in batch_texts:
                resp = openai.Embedding.create(input=t, model=model_name)
                emb = resp["data"][0]["embedding"]
                batch_embeddings.append(emb)
                
            embeddings.extend(batch_embeddings)
            
        return embeddings
    except Exception as e:
        print(f"OpenAI embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate OpenAI embeddings: {str(e)}")

@EmbeddingModelRegistry.register("Cohere Embeddings")
def cohere_embedder(texts, model_name="embed-english-v2.0"):
    """
    Generate embeddings using Cohere Embeddings.
    
    Args:
        texts: List of text strings to embed
        model_name: Cohere embedding model to use (default: embed-english-v2.0)
        
    Returns:
        List of embeddings for each text
    """
    try:
        import cohere
        print(f"Using Cohere model: {model_name} for {len(texts)} texts")
        
        # Get API key from environment or settings
        api_key = os.environ.get("COHERE_API_KEY")
        if not api_key:
            from flask import current_app
            api_key = current_app.config.get("COHERE_API_KEY")
            
        if not api_key:
            raise ValueError("Cohere API key not found in environment or app config")
            
        co = cohere.Client(api_key)
        
        batch_size = 32  
        embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            response = co.embed(texts=batch_texts, model=model_name)
            embeddings.extend(response.embeddings)
            
        return embeddings
    except Exception as e:
        print(f"Cohere embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate Cohere embeddings: {str(e)}")

@EmbeddingModelRegistry.register("Sentence Transformers")
def sentence_transformers_embedder(texts, model_name="all-MiniLM-L6-v2"):
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
        
        model = SentenceTransformer(model_name)
        
        # Process in reasonable batch sizes
        batch_size = 32
        embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            embeddings = model.encode(batch_texts).tolist()
            embeddings.extend(embeddings)
            
        return embeddings
    except Exception as e:
        print(f"SentenceTransformer embedder failed: {str(e)}")
        raise ValueError(f"Failed to generate SentenceTransformer embeddings: {str(e)}")

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

@RetrievalMethodRegistry.register("bm25")
def handle_bm25(chunk_objs, query_objs, settings):
    top_k = settings.get("top_k", 5)
    k1 = settings.get("bm25_k1", 1.5)
    b = settings.get("bm25_b", 0.75)
    # Extract text from objects
    chunk_texts = [chunk.get("text", "") for chunk in chunk_objs]

    # Preprocess corpus once
    tokenized_corpus = [simple_preprocess(doc) for doc in chunk_texts]
    bm25 = BM25Okapi(tokenized_corpus, k1=k1, b=b)
    results = []
    for query_obj in query_objs:
        tokenized_query = simple_preprocess(query_obj.get("text", ""))
        raw_scores = bm25.get_scores(tokenized_query)
        # Normalize scores
        max_score = max(raw_scores) if raw_scores.any() and max(raw_scores) > 0 else 1
        normalized_scores = [score / max_score for score in raw_scores]
        
        # Build result objects with all the necessary metadata
        retrieved = []
        scored_chunks = sorted(zip(chunk_objs, normalized_scores), key=lambda x: x[1], reverse=True)
        
        for chunk, similarity in scored_chunks[:top_k]:
            retrieved.append({
                "text": chunk.get("text", ""),
                "similarity": float(similarity),
                "docTitle": chunk.get("docTitle", ""),
                "chunkId": chunk.get("chunkId", ""),
            })
        
        results.append({'query_object': query_obj, 'retrieved_chunks': retrieved})
    
    return results

@RetrievalMethodRegistry.register("tfidf")
def handle_tfidf(chunk_objs, query_objs, settings):
    top_k = settings.get("top_k", 5)
    max_features = settings.get("max_features", 500)
    
    # Extract text from chunk objects
    chunk_texts = [chunk.get("text", "") for chunk in chunk_objs]
    # Create and fit vectorizer once for all queries
    vectorizer = TfidfVectorizer(stop_words="english", max_features=max_features)
    tfidf_matrix = vectorizer.fit_transform(chunk_texts)
    
    results = []
    for query_obj in query_objs:
        query_vec = vectorizer.transform([query_obj.get("text", "")])
        sims = (tfidf_matrix * query_vec.T).toarray().flatten()
        
        # Normalize scores
        max_sim = sims.max() if sims.size > 0 and sims.max() > 0 else 1
        normalized_sims = sims / max_sim
        
        # Build result objects
        retrieved = []
        ranked_idx = normalized_sims.argsort()[::-1][:top_k]
        
        for i in ranked_idx:
            chunk = chunk_objs[i]
            retrieved.append({
                "text": chunk.get("text", ""),
                "similarity": float(normalized_sims[i]),
                "docTitle": chunk.get("docTitle", ""),
                "chunkId": chunk.get("chunkId", ""),
            })
        
        results.append({'query_object': query_obj, 'retrieved_chunks': retrieved})
    
    return results

@RetrievalMethodRegistry.register("boolean")
def handle_boolean(chunk_objs, query_objs, settings):
    top_k = settings.get("top_k", 5)
    required_match_count = settings.get("required_match_count", 1)
    
    # Extract text from chunk objects
    chunk_texts = [chunk.get("text", "") for chunk in chunk_objs]
    
    results = []
    for query_obj in query_objs:
        q_tokens = set(simple_preprocess(query_obj.get("text", "")))
        if len(q_tokens) < required_match_count:
            # Not enough tokens in query to match the required count
            results.append({'query_object': query_obj, 'retrieved_chunks': []})
            continue
            
        scored = []
        for i, c in enumerate(chunk_texts):
            c_tokens = set(simple_preprocess(c))
            matches = len(q_tokens.intersection(c_tokens))
            if matches >= required_match_count:
                score = matches / (len(c_tokens) + 1e-9)  # Normalize by document length
                scored.append((i, score))
                
        # Sort by score
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Normalize scores
        retrieved = []
        if scored:
            max_score = scored[0][1]
            for i, score in scored[:top_k]:
                chunk = chunk_objs[i]
                normalized_score = score / max_score if max_score > 0 else 0
                retrieved.append({
                    "text": chunk.get("text", ""),
                    "similarity": float(normalized_score),
                    "docTitle": chunk.get("docTitle", ""),
                    "chunkId": chunk.get("chunkId", ""),
                })
        
        results.append({'query_object': query_obj, 'retrieved_chunks': retrieved})
    
    return results

@RetrievalMethodRegistry.register("overlap")
def handle_keyword_overlap(chunk_objs, query_objs, settings):
    top_k = settings.get("top_k", 5)
    
    # Extract text from chunk objects
    chunk_texts = [chunk.get("text", "") for chunk in chunk_objs]
    
    results = {}
    for query_obj in query_objs:
        q_tokens = set(simple_preprocess(query_obj.get("text", "")))
        scored = []
        
        for i, c in enumerate(chunk_texts):
            c_tokens = set(simple_preprocess(c))
            overlap = len(q_tokens.intersection(c_tokens))
            scored.append((i, overlap))
            
        # Sort by overlap count
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Normalize scores
        retrieved = []
        if scored and scored[0][1] > 0:  # Ensure max score > 0
            max_score = scored[0][1]
            for i, score in scored[:top_k]:
                chunk = chunk_objs[i]
                normalized_score = score / max_score
                retrieved.append({
                    "text": chunk.get("text", ""),
                    "similarity": float(normalized_score),
                    "docTitle": chunk.get("docTitle", ""),
                    "chunkId": chunk.get("chunkId", ""),
                })
        else:
            # No overlaps found
            retrieved = []
        
        results.append({'query_object': query_obj, 'retrieved_chunks': retrieved})
    
    return results

import numpy as np
import heapq
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine
from sklearn.cluster import KMeans
import math


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


# VECTOR STORE RETRIEVAL METHODS
from langchain_core.embeddings import Embeddings
from typing import List
import numpy as np

# --- Define DummyEmbeddings Class ---
class DummyEmbeddings(Embeddings):
    """
    A dummy embedding class implementing the LangChain Embeddings interface.
    Used when pre-computed embeddings are provided.
    Returns zero vectors of the specified dimension.
    """
    def __init__(self, dimension: int):
        if not isinstance(dimension, int) or dimension <= 0:
            raise ValueError(f"Dimension must be a positive integer, got {dimension}")
        self.dimension = dimension
        # Store a zero vector template for efficiency
        self._zero_vector = [0.0] * self.dimension

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Return zero vectors for a list of documents."""
        return [self._zero_vector for _ in texts]

    def embed_query(self, text: str) -> List[float]:
        """Return a single zero vector for a query."""
        return self._zero_vector

# FAISS
import faiss
import os
from langchain_community.vectorstores import FAISS
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_core.documents import Document

@RetrievalMethodRegistry.register("faiss")
def handle_faiss(chunk_objs, chunk_embeddings, query_objs, query_embeddings, settings):
    """
    Retrieve chunks using FAISS with L2 (Euclidean) or IP (Inner Product) metric.
    """
    top_k = settings.get("top_k", 5)
    user_requested_metric = settings.get("metric", "l2").lower()
    if user_requested_metric not in ["l2", "ip"]:
        print(f"Warning: Invalid FAISS metric '{user_requested_metric}' specified. Defaulting to 'l2'.")
        user_requested_metric = "l2"

    faiss_mode = settings.get("faissMode", "create").lower()
    faiss_path = settings.get("faissPath", "")
    try:
        similarity_threshold = float(settings.get("similarity_threshold", 0)) / 100.0
        similarity_threshold = max(0.0, min(1.0, similarity_threshold))
    except ValueError:
        print("Warning: Invalid similarity_threshold value. Defaulting to 0.")
        similarity_threshold = 0.0

    results = []

    # Basic Input Validation
    if not chunk_objs or not chunk_embeddings:
         print("Error: chunk_objs or chunk_embeddings are empty.")
         return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]
    if not query_objs or not query_embeddings:
         print("Error: query_objs or query_embeddings are empty.")
         return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

    try:
        if not isinstance(chunk_embeddings[0], list) or not isinstance(query_embeddings[0], list):
             raise TypeError("Embeddings should be lists of lists of floats.")
        dimension = len(chunk_embeddings[0])
        query_dimension = len(query_embeddings[0])
    except (IndexError, TypeError) as e:
         print(f"Error validating embedding structure: {e}")
         return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

    if dimension != query_dimension:
         print(f"Error: Embedding dimension mismatch: Chunks({dimension}), Queries({query_dimension})")
         return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

    chunk_embeddings_np = np.array(chunk_embeddings).astype('float32')
    query_embeddings_np = np.array(query_embeddings).astype('float32')

    try:
        dummy_embeddings = DummyEmbeddings(dimension=dimension)
    except ValueError as e:
         print(f"Error: Failed to initialize DummyEmbeddings: {e}")
         return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

    vector_store = None

    # === Step 1: Initialize LangChain FAISS Vector Store ===
    try:
        if faiss_mode == "load":
            index_file = os.path.join(faiss_path, "index.faiss")
            pkl_file = os.path.join(faiss_path, "index.pkl")
            if not faiss_path or not os.path.exists(index_file) or not os.path.exists(pkl_file):
                print(f"Error: FAISS index not found in folder '{faiss_path}' for loading.")
                return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

            vector_store = FAISS.load_local(
                folder_path=faiss_path,
                embeddings=dummy_embeddings,
                index_name="index",
                allow_dangerous_deserialization=True
            )

            # Check Loaded Index Dimension
            loaded_dimension = vector_store.index.d
            if loaded_dimension != dimension:
                 print(f"Error: Dimension mismatch: Loaded index({loaded_dimension}), Provided queries({dimension})")
                 return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

            # Check if loaded metric matches requested metric
            loaded_metric_type = vector_store.index.metric_type
            loaded_metric_str = "l2" if loaded_metric_type == faiss.METRIC_L2 else "ip" if loaded_metric_type == faiss.METRIC_INNER_PRODUCT else "unknown"

            if loaded_metric_str != user_requested_metric and loaded_metric_str != "unknown":
                 print(f"Warning: Loaded FAISS index metric ('{loaded_metric_str}') does not match requested metric ('{user_requested_metric}'). Using the loaded index's metric for search.")
            elif loaded_metric_str == "unknown":
                 print(f"Warning: Loaded FAISS index has an unknown metric type ({loaded_metric_type}). Proceeding with caution, interpreting as L2.")

        elif faiss_mode == "create":
            texts = [chunk.get("text", "") for chunk in chunk_objs]
            metadatas = [{"docTitle": chunk.get("docTitle", ""), "chunkId": chunk.get("chunkId", str(i))} for i, chunk in enumerate(chunk_objs)]

            # Create index based on user_requested_metric
            if user_requested_metric == "ip":
                print("Creating FAISS index with IP metric (normalizing vectors for Cosine Similarity).")
                # IMPORTANT: Normalize vectors for IP index to compute cosine similarity
                faiss.normalize_L2(chunk_embeddings_np)
                index = faiss.IndexFlatIP(dimension)
            else: # Default or user_requested_metric == "l2"
                print("Creating FAISS index with L2 metric.")
                index = faiss.IndexFlatL2(dimension)

            docstore = InMemoryDocstore({str(i): Document(page_content=texts[i], metadata=metadatas[i]) for i in range(len(texts))})
            index_to_docstore_id = {i: str(i) for i in range(len(texts))}

            index.add(chunk_embeddings_np)

            vector_store = FAISS(
                embedding_function=dummy_embeddings,
                index=index,
                docstore=docstore,
                index_to_docstore_id=index_to_docstore_id
            )

            if faiss_path:
                try:
                    if not os.path.isdir(faiss_path):
                         os.makedirs(faiss_path, exist_ok=True)
                    vector_store.save_local(folder_path=faiss_path, index_name="index")
                    print(f"FAISS index saved to {faiss_path}")
                except Exception as e_save:
                     print(f"Warning: Error saving FAISS index to {faiss_path}: {e_save}. Retrieval will continue.")

        else:
             print(f"Error: Invalid faissMode: '{faiss_mode}'. Must be 'create' or 'load'.")
             return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

    except Exception as e_init:
        print(f"Error during FAISS index initialization ({faiss_mode} mode): {e_init}")
        return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]


    if not vector_store or not isinstance(vector_store.index, faiss.Index):
         print("Error: Failed to initialize a valid FAISS vector store object.")
         return [{'query_object': q_obj, 'retrieved_chunks': []} for q_obj in query_objs]

    # === Step 2: Determine the metric of the active index for searching ===
    search_metric_type = vector_store.index.metric_type
    if search_metric_type == faiss.METRIC_L2:
        search_metric = "l2"
    elif search_metric_type == faiss.METRIC_INNER_PRODUCT:
        search_metric = "ip"
    else:
        print(f"Warning: Active FAISS index has unexpected metric type {search_metric_type}. Defaulting to L2 interpretation for search.")
        search_metric = "l2" # Fallback interpretation

    print(f"Performing FAISS search using {search_metric.upper()} metric.")

    # === Step 3: Perform FAISS Retrieval ===
    for query_obj, q_embedding in zip(query_objs, query_embeddings_np):
        retrieved = []
        try:
            query_vec = q_embedding.reshape(1, -1).astype('float32')

            # IMPORTANT: Normalize query vector if using IP index for cosine similarity
            if search_metric == "ip":
                faiss.normalize_L2(query_vec)

            search_results = vector_store.similarity_search_with_score_by_vector(
                embedding=query_vec[0],
                k=top_k
            )

            # === Step 4: Convert results, interpret score based on metric, apply threshold ===
            for doc, score in search_results:
                similarity_score = 0.0
                raw_score = float(score)

                if search_metric == "l2":
                    # Convert L2 distance to similarity score (common method: 1 / (1 + distance))
                    l2_distance = max(0.0, raw_score)
                    similarity_score = 1.0 / (1.0 + l2_distance)
                elif search_metric == "ip":
                    # Score from IP index (after normalization) is cosine similarity
                    similarity_score = max(0.0, min(1.0, raw_score))

                # Apply the user-defined similarity threshold
                if similarity_score >= similarity_threshold:
                    retrieved.append({
                        "text": doc.page_content,
                        "similarity": round(similarity_score, 6),
                        "docTitle": doc.metadata.get("docTitle", ""),
                        "chunkId": doc.metadata.get("chunkId", ""),
                    })

            # Sort final results by similarity AFTER score conversion and thresholding
            retrieved.sort(key=lambda x: x["similarity"], reverse=True)
            results.append({'query_object': query_obj, 'retrieved_chunks': retrieved})

        except Exception as e_search:
            query_text_preview = query_obj.get("text", "N/A")[:70] + "..." if isinstance(query_obj, dict) else str(query_obj)[:70] + "..."
            print(f"Error during similarity search for query '{query_text_preview}': {e_search}")
            results.append({'query_object': query_obj, 'retrieved_chunks': []})

    return results

# Pinecone 

# ChromaDB