from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Union
import os
import numpy as np
import pandas as pd
import lancedb
import hashlib, pickle

# Faiss requires 'swig' to be installed, and the 'faiss-cpu' package (or 'faiss-gpu', built from source).
# Swig is only installable via homebrew on macOS, which makes this dependency difficult to support 
# by default. To be safe we soft-fail if it's not installed.
try:
    import faiss
except ImportError:
    faiss = None


class VectorStore(ABC):
    """
    Abstract base class for vector stores that store and retrieve embeddings.

    This class defines the common interface that all vector store implementations
    should follow, allowing for easy swapping between different backends while
    maintaining the same API.
    """
    def __init__(self, embedding_func: Optional[callable] = None):
        """
        Initialize the vector store.

        Args:
            embedding_func: Optional function to generate embeddings
        """
        self.embedding_func = embedding_func

    @abstractmethod
    def add(self, texts: List[str], embeddings: Optional[List[List[float]]] = None,
            metadata: Optional[List[Dict[str, Any]]] = None) -> List[str]:
        """
        Add documents and their embeddings to the store.

        Args:
            texts: List of text documents
            embeddings: List of embedding vectors for each document
            metadata: Optional list of metadata dictionaries for each document

        Returns:
            List of document IDs for the added documents
        """
        pass

    @abstractmethod
    def search(self, query: Union[str, List[float]], k: int = 5,
               **kwargs) -> List[Dict[str, Any]]:
        """
        Search for similar documents based on a query or query embedding.

        Args:
            query: The query as a string (if embedding_func was passed on init), or the embedding vector
            k: Number of results to return
            **kwargs: Additional search parameters (method, filters, etc.)

        Returns:
            List of document dictionaries with text, score, and metadata
        """
        pass

    @abstractmethod
    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document by ID.

        Args:
            doc_id: Document ID

        Returns:
            Document dictionary or None if not found
        """
        pass

    @abstractmethod
    def delete(self, doc_ids: List[str]) -> bool:
        """
        Delete documents by ID.

        Args:
            doc_ids: List of document IDs to delete

        Returns:
            Boolean indicating success
        """
        pass

    @abstractmethod
    def update(self, doc_id: str, text: Optional[str] = None,
               embedding: Optional[List[float]] = None,
               metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Update a document by ID.

        Args:
            doc_id: Document ID
            text: New text (if None, text is not updated)
            embedding: New embedding (if None, embedding is not updated)
            metadata: New metadata (if None, metadata is not updated)

        Returns:
            Boolean indicating success
        """
        pass

    @abstractmethod
    def get_all(self, limit: Optional[int] = None,
                offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get all documents in the store.

        Args:
            limit: Maximum number of documents to return (None for all)
            offset: Number of documents to skip

        Returns:
            List of document dictionaries
        """
        pass

    @abstractmethod
    def count(self) -> int:
        """
        Get the number of documents in the store.

        Returns:
            Number of documents
        """
        pass

    @abstractmethod
    def clear(self) -> bool:
        """
        Clear all documents from the store.

        Returns:
            Boolean indicating success
        """
        pass


class LancedbVectorStore(VectorStore):
    """
    Vector store implementation using LanceDB for local vector storage.
    
    LanceDB is an open-source, local-first vector database that's optimized for
    efficient vector similarity search and is particularly suitable for
    embeddings storage on a local machine.
    """
    
    def __init__(self, 
                 db_path: str = "lancedb",
                 embedding_func: Optional[callable] = None, 
                 table_name: str = "embeddings"):
        """
        Initialize LanceDB vector store.
        
        Args:
            uri: Path where LanceDB will store the database on disk
            table_name: Name of the table to use for vector storage
        """
        # Create directory if it doesn't exist
        os.makedirs(db_path, exist_ok=True)
        
        # Connect to the database
        self.db = lancedb.connect(db_path)
        self.table_name = table_name
        self.table = None
        
        # Check if table exists
        table_names = list(self.db.table_names())
        if table_name in table_names:
            self.table = self.db.open_table(table_name)
        
        super().__init__(embedding_func)
    
    def _generate_id(self, text: str) -> str:
        """Generate SHA256 hash of text to use as document ID"""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
    
    def add(self, texts: List[str], embeddings: Optional[List[List[float]]] = None, 
            metadata: Optional[List[Dict[str, Any]]] = None) -> List[str]:
        """
        Add documents and their embeddings to the store.
        
        Args:
            texts: List of text documents
            embeddings: List of embedding vectors for each document
            metadata: Optional list of metadata dictionaries for each document
        
        Returns:
            List of document IDs for the added documents
        """
        # Validate inputs
        if not texts:
            raise ValueError("No texts provided to add")
        if metadata is None:
            metadata = [{} for _ in range(len(texts))]
        elif len(metadata) != len(texts):
            raise ValueError("Number of metadata items must match number of texts")
        
        # Generate IDs for new documents using SHA256 hash
        doc_ids = [self._generate_id(text) for text in texts]

        # Check if the hashed id already exists and if so, remove them from the list
        # NOTE: We don't use upsert because we want to avoid running the embedding function
        # on documents that already exist in the database, which could be expensive. 
        orig_doc_ids = doc_ids.copy()
        if self.table is not None:
            doc_ids_str = ",".join([f"'{doc_id}'" for doc_id in doc_ids])
            existing_ids = self.table.search().where(f"id IN ({doc_ids_str})").to_pandas()
            existing_ids = set(existing_ids["id"].tolist())
            if existing_ids:
                print(f"Found {len(existing_ids)} existing IDs in the database. Removing them from the list.")
                # Get the indices of the existing IDs
                existing_indices = [i for i, doc_id in enumerate(doc_ids) if doc_id in existing_ids]
                # Remove the existing IDs from the lists, before proceeding
                doc_ids = [doc_id for i, doc_id in enumerate(doc_ids) if i not in existing_indices]
                texts = [text for i, text in enumerate(texts) if i not in existing_indices]
                metadata = [meta for i, meta in enumerate(metadata) if i not in existing_indices]
                if embeddings is not None:
                    embeddings = [embedding for i, embedding in enumerate(embeddings) if i not in existing_indices]

        # If no new documents to add, return existing IDs
        if not texts:
            print("No documents are new. Returning existing IDs.")
            return orig_doc_ids

        # Sanity check that lengths match
        if len(texts) != len(doc_ids) or len(doc_ids) != len(metadata) or (embeddings is not None and len(embeddings) != len(texts)):
            raise ValueError("Mismatched lengths of texts, IDs, metadata, and/or embeddings")

        if embeddings is None:
            if self.embedding_func is None:
                raise ValueError("No embedding function provided and no embeddings given")
            
            # Generate embeddings using the embedding function
            embeddings = self.embedding_func(texts)
            if not isinstance(embeddings, list) or not all(isinstance(e, list) for e in embeddings):
                raise ValueError("Embeddings must be a list of lists")

        if len(texts) != len(embeddings):
            raise ValueError("Number of texts and embeddings must match")
        
        # Create the table if it doesn't exist
        if self.table is None:
            if not embeddings:
                raise ValueError("Cannot create table with empty embeddings list")
            
            vector_dimension = len(embeddings[0])
            
            # Create schema for the table using PyArrow
            import pyarrow as pa

            # Get schema for metadata based on first item if available
            # metadata_fields = []
            # if metadata and metadata[0]:
            #     for key, value in metadata[0].items():
            #         if isinstance(value, str):
            #             metadata_fields.append(pa.field(key, pa.string()))
            #         elif isinstance(value, int):
            #             metadata_fields.append(pa.field(key, pa.int64()))
            #         elif isinstance(value, float):
            #             metadata_fields.append(pa.field(key, pa.float64()))
            #         elif isinstance(value, bool):
            #             metadata_fields.append(pa.field(key, pa.bool_()))
            #         else:
            #             # Convert other types to string
            #             metadata_fields.append(pa.field(key, pa.string()))
            
            # Import pickle for serialization
            
            # Create a schema with metadata as a binary field
            schema = pa.schema([
                pa.field("id", pa.string()),
                pa.field("text", pa.string()),
                pa.field("vector", pa.list_(pa.float32(), vector_dimension)),
                pa.field("metadata", pa.binary())  # Store as binary data
            ])
            self.table = self.db.create_table(self.table_name, schema=schema)
        
        # Create data to add
        data = []
        for i, (doc_id, text, embedding, meta) in enumerate(zip(doc_ids, texts, embeddings, metadata)):
            doc = {
                "id": doc_id,
                "text": text,
                "vector": embedding,
                "metadata": pickle.dumps(meta)  # Serialize metadata to binary
            }
            data.append(doc)
        
        # Add data to the table
        self.table.add(data)
        
        return orig_doc_ids  # Return original IDs, including those that were not added
    
    def search(self, query: Union[str, List[float]], k: int = 5, 
               **kwargs) -> List[Dict[str, Any]]:
        """
        Search for similar documents based on a query embedding.
        
        Args:
            query_embedding: The query embedding vector
            k: Number of results to return
            **kwargs: Additional search parameters:
                - distance_metric: Distance metric for search ('l2', 'cosine', or 'dot')
                - method: Search method ('similarity', 'mmr', 'hybrid')
                - lambda_param: Balance between relevance and diversity for MMR (0-1)
                - keyword: Keyword for hybrid search
                - blend: Balance between vector and keyword scores (0-1)
                - filters: Query filters in LanceDB syntax
        
        Returns:
            List of document dictionaries with text, score, and metadata
        """
        if self.table is None:
            return []
            
        distance_metric = kwargs.get("distance_metric", "l2")
        method = kwargs.get("method", "similarity")
        filters = kwargs.get("filters", None)

        # Check if query is a string or embedding, and handle accordingly
        if isinstance(query, str):
            # If query is a string, generate embedding using the embedding function
            if self.embedding_func is None:
                raise ValueError("Embedding function not provided for string query")
            query_embedding = self.embedding_func([query])[0]
        elif isinstance(query, list):
            # If query is a list, assume it's already an embedding
            query_embedding = query
        
        # Search the table using the query embedding and distance metric
        q = self.table.search(query_embedding).metric(distance_metric)
        
        if filters:
            q = q.where(filters)
        
        if method == "similarity":
            # Standard cosine similarity search
            results = q.limit(k).to_pandas()
        
        elif method == "mmr":
            # Maximum Marginal Relevance search
            lambda_param = kwargs.get("lambda_param", 0.5)
            results = q.limit(k * 3).to_pandas()  # Get more results for diversity filtering
            
            # Apply MMR algorithm to rerank
            vectors = np.array([r["vector"] for _, r in results.iterrows()])
            query_vec = np.array(query_embedding)
            
            # Normalize vectors
            query_vec = query_vec / np.linalg.norm(query_vec)
            vectors = vectors / np.linalg.norm(vectors, axis=1)[:, np.newaxis]
            
            # Calculate similarities
            sims = np.dot(vectors, query_vec)
            
            # MMR reranking
            selected = []
            remaining = list(range(len(vectors)))
            
            while len(selected) < k and remaining:
                best_score = -1
                best_idx = -1
                
                for i in remaining:
                    relevance = sims[i]
                    
                    # Calculate diversity component
                    if selected:
                        sel_vectors = vectors[selected]
                        diversity_sim = np.max(np.dot(vectors[i], sel_vectors.T))
                        mmr_score = lambda_param * relevance - (1 - lambda_param) * diversity_sim
                    else:
                        mmr_score = relevance
                    
                    if mmr_score > best_score:
                        best_score = mmr_score
                        best_idx = i
                
                if best_idx != -1:
                    selected.append(best_idx)
                    remaining.remove(best_idx)
            
            results = results.iloc[selected]
        
        elif method == "hybrid":
            # Hybrid search combining vector similarity with keyword matching
            keyword = kwargs.get("keyword", "")
            blend = kwargs.get("blend", 0.5)
            
            if not keyword:
                return self.search(query_embedding, k, method="similarity")
            
            # Get vector search results
            vector_results = q.limit(k * 2).to_pandas()
            
            # Get keyword search results
            keyword_query = self.table.search().where(f"text LIKE '%{keyword}%'").limit(k * 2)
            keyword_results = keyword_query.to_pandas()
            
            # Combine results with blended scoring
            all_results = {}
            
            # Add vector results with blended score
            for _, row in vector_results.iterrows():
                doc_id = row["id"]
                vector_score = row["_distance"]  # LanceDB distance score
                all_results[doc_id] = {"row": row, "similarity": blend * vector_score}
            
            # Add or update with keyword results
            for _, row in keyword_results.iterrows():
                doc_id = row["id"]
                keyword_score = 1.0  # Binary match score for simplicity
                
                if doc_id in all_results:
                    all_results[doc_id]["similarity"] += (1 - blend) * keyword_score
                else:
                    all_results[doc_id] = {"row": row, "similarity": (1 - blend) * keyword_score}
            
            # Sort by blended score and take top k
            sorted_results = sorted(all_results.values(), key=lambda x: x["similarity"], reverse=True)[:k]
            results = pd.DataFrame([r["row"] for r in sorted_results])
        
        else:
            raise ValueError(f"Unknown search method: {method}")
        
        # Format results
        formatted_results = []
        for _, row in results.iterrows():
            formatted_results.append({
                "id": row["id"],
                "text": row["text"],
                "similarity": 1 - row["_distance"],  # Convert distance to similarity score
                "metadata": pickle.loads(row["metadata"])  # Deserialize metadata
            })
        
        return formatted_results
    
    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a document by ID.
        
        Args:
            doc_id: Document ID
            
        Returns:
            Document dictionary or None if not found
        """
        if self.table is None:
            return None
            
        results = self.table.search().where(f"id = '{doc_id}'").to_pandas()
        
        if len(results) == 0:
            print(f"Document with ID {doc_id} not found")
            return None
        
        row = results.iloc[0]
        return {
            "id": row["id"],
            "text": row["text"],
            "embedding": row["vector"],
            "metadata": pickle.loads(row["metadata"])  # Deserialize metadata
        }
    
    def delete(self, doc_ids: List[str]) -> bool:
        """
        Delete documents by ID.
        
        Args:
            doc_ids: List of document IDs to delete
            
        Returns:
            Boolean indicating success
        """
        if self.table is None or not doc_ids:
            return True
        
        # Build OR condition for multiple IDs
        conditions = " OR ".join([f"id = '{doc_id}'" for doc_id in doc_ids])
        
        try:
            self.table.delete(conditions)
            return True
        except Exception as e:
            print(f"Error deleting documents: {e}")
            return False
    
    def update(self, doc_id: str, text: Optional[str] = None, 
               embedding: Optional[List[float]] = None,
               metadata: Optional[Dict[str, Any]] = None) -> Union[str, None]:
        """
        Update a document by ID.
        
        Args:
            doc_id: Document ID
            text: New text (if None, text is not updated)
            embedding: New embedding (if None, embedding is not updated)
            metadata: New metadata (if None, metadata is not updated)
            
        Returns:
            The new document ID if updated successfully, None otherwise.
            New ID is generated if text is updated.
        """
        if self.table is None:
            return False
            
        # Get the current document
        current_doc = self.get(doc_id)
        if current_doc is None:
            return None
    
        # Delete the old document if it exists
        # NOTE: This is a cheap method of updating the document, but it may not be the most efficient.
        if not self.delete([doc_id]):
            return None
        
        # Check if text has changed
        text_has_changed =  text is not None and text != current_doc["text"]
        new_text = text if text is not None else current_doc["text"]
        new_embedding = embedding if embedding is not None else (None if text_has_changed else current_doc["embedding"])
        new_metadata = metadata if metadata is not None else current_doc["metadata"]

        # Add the updated document
        try:
            # Add the new document with updated text and/or embedding
            new_ids = self.add([new_text],
                               embeddings=[new_embedding] if new_embedding is not None else None,
                               metadata=[new_metadata] if new_metadata is not None else None)
            return new_ids[0]
        except Exception as e:
            print(f"Error updating document: {e}")
            return None
    
    def get_all(self, limit: Optional[int] = None, 
                offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get all documents in the store.
        
        Args:
            limit: Maximum number of documents to return (None for all)
            offset: Number of documents to skip
            
        Returns:
            List of document dictionaries
        """
        if self.table is None:
            return []
            
        query = self.table.search()
        
        if offset > 0:
            query = query.offset(offset)
        
        if limit is not None:
            query = query.limit(limit)
        
        results = query.to_pandas()
        
        formatted_results = []
        for _, row in results.iterrows():
            formatted_results.append({
                "id": row["id"],
                "text": row["text"],
                "embedding": row["vector"],
                "metadata": pickle.loads(row["metadata"])  # Deserialize metadata
            })
        
        return formatted_results
    
    def count(self) -> int:
        """
        Get the number of documents in the store.
        
        Returns:
            Number of documents
        """
        if self.table is None:
            return 0
            
        # Convert to pandas and get the count
        return len(self.table.to_pandas())
    
    def clear(self) -> bool:
        """
        Clear all documents from the store.
        
        Returns:
            Boolean indicating success
        """
        if self.table is None:
            return True
            
        try:
            # Delete the table and set to None - will be recreated on next add()
            self.db.drop_table(self.table_name)
            self.table = None
            return True
        except Exception as e:
            print(f"Error clearing vector store: {e}")
            return False


class FaissVectorStore(VectorStore):
    """
    Vector store implementation using FAISS for local vector storage.
    Stores embeddings in a FAISS index and keeps texts/metadata in a sidecar file.
    """

    def __init__(self,
                 db_path: str = "faissdb",
                 embedding_func: Optional[callable] = None,
                 index_name: str = "index",
                 metric: str = "l2"):
        """
        Args:
            db_path: Directory where FAISS index and metadata are stored
            embedding_func: Optional function to generate embeddings
            index_name: Name of the FAISS index file (without extension)
            metric: 'l2' or 'ip' (inner product/cosine)
        """

        if faiss is None:
            raise ImportError("Faiss is not installed. Please install 'faiss-cpu' or 'faiss-gpu' if you would like to use Faiss vector store methods. You may need to install 'swig' as well; on MacOS this can be done with 'brew install swig'.")

        os.makedirs(db_path, exist_ok=True)
        self.db_path = db_path
        self.index_name = index_name
        self.metric = metric.lower()
        self.index_file = os.path.join(db_path, f"{index_name}.faiss")
        self.meta_file = os.path.join(db_path, f"{index_name}_meta.pkl")
        self.embedding_func = embedding_func

        self.index = None
        self.id_to_meta = {}  # id -> dict with text, metadata, vector index
        self.ids = []         # list of ids in FAISS order

        self._load()

        super().__init__(embedding_func)

    def _generate_id(self, text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    def _save(self):
        if self.index is not None:
            faiss.write_index(self.index, self.index_file)
        with open(self.meta_file, "wb") as f:
            pickle.dump({"id_to_meta": self.id_to_meta, "ids": self.ids}, f)

    def _load(self):
        if os.path.exists(self.index_file) and os.path.exists(self.meta_file):
            self.index = faiss.read_index(self.index_file)
            with open(self.meta_file, "rb") as f:
                data = pickle.load(f)
                self.id_to_meta = data.get("id_to_meta", {})
                self.ids = data.get("ids", [])
        else:
            self.index = None
            self.id_to_meta = {}
            self.ids = []

    def add(self, texts: List[str], embeddings: Optional[List[List[float]]] = None,
            metadata: Optional[List[Dict[str, Any]]] = None) -> List[str]:
        if not texts:
            raise ValueError("No texts provided to add")
        if metadata is None:
            metadata = [{} for _ in range(len(texts))]
        elif len(metadata) != len(texts):
            raise ValueError("Number of metadata items must match number of texts")

        doc_ids = [self._generate_id(text) for text in texts]

        # Remove already existing IDs
        new_texts, new_embeddings, new_metadata, new_doc_ids = [], [], [], []
        for i, doc_id in enumerate(doc_ids):
            if doc_id not in self.id_to_meta:
                new_texts.append(texts[i])
                new_metadata.append(metadata[i])
                new_doc_ids.append(doc_id)
                if embeddings is not None:
                    new_embeddings.append(embeddings[i])

        if not new_texts:
            return doc_ids

        # Compute embeddings if not provided
        if embeddings is None:
            if self.embedding_func is None:
                raise ValueError("No embedding function provided and no embeddings given")
            new_embeddings = self.embedding_func(new_texts)
        if len(new_embeddings) != len(new_texts):
            raise ValueError("Number of embeddings and texts must match")

        # Prepare FAISS index
        dim = len(new_embeddings[0])
        if self.index is None:
            if self.metric == "ip":
                self.index = faiss.IndexFlatIP(dim)
            else:
                self.index = faiss.IndexFlatL2(dim)

        # Add to FAISS
        new_embeddings_np = np.array(new_embeddings).astype("float32")
        if self.metric == "ip":
            faiss.normalize_L2(new_embeddings_np)
        self.index.add(new_embeddings_np)

        # Update meta
        start_idx = len(self.ids)
        for i, doc_id in enumerate(new_doc_ids):
            self.ids.append(doc_id)
            self.id_to_meta[doc_id] = {
                "text": new_texts[i],
                "metadata": pickle.dumps(new_metadata[i]),
                "vector_index": start_idx + i
            }

        self._save()
        return doc_ids

    def search(self, query: Union[str, List[float]], k: int = 5, **kwargs) -> List[Dict[str, Any]]:
        if self.index is None or not self.ids:
            return []

        # Prepare query embedding
        if isinstance(query, str):
            if self.embedding_func is None:
                raise ValueError("Embedding function not provided for string query")
            query_emb = self.embedding_func([query])[0]
        else:
            query_emb = query

        query_emb = np.array(query_emb, dtype="float32").reshape(1, -1)
        if self.metric == "ip":
            faiss.normalize_L2(query_emb)

        D, I = self.index.search(query_emb, min(k, len(self.ids)))
        results = []
        for idx, dist in zip(I[0], D[0]):
            if idx < 0 or idx >= len(self.ids):
                continue
            doc_id = self.ids[idx]
            meta = self.id_to_meta[doc_id]
            similarity = 1.0 / (1.0 + dist) if self.metric == "l2" else float(dist)
            results.append({
                "id": doc_id,
                "text": meta["text"],
                "similarity": similarity,
                "metadata": pickle.loads(meta["metadata"])
            })
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results

    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        meta = self.id_to_meta.get(doc_id)
        if meta is None:
            return None
        return {
            "id": doc_id,
            "text": meta["text"],
            "embedding": None,  # Embedding not stored directly
            "metadata": pickle.loads(meta["metadata"])
        }

    def delete(self, doc_ids: List[str]) -> bool:
        if not doc_ids or self.index is None:
            return True
        # Remove from meta and ids
        indices_to_remove = [self.ids.index(doc_id) for doc_id in doc_ids if doc_id in self.ids]
        if not indices_to_remove:
            return True
        # Remove from FAISS by rebuilding index (FAISS does not support delete)
        keep_indices = [i for i in range(len(self.ids)) if i not in indices_to_remove]
        if not keep_indices:
            self.index = None
            self.ids = []
            self.id_to_meta = {}
            self._save()
            return True
        embeddings = self.index.reconstruct_n(0, len(self.ids))
        new_embeddings = np.array([embeddings[i] for i in keep_indices]).astype("float32")
        if self.metric == "ip":
            faiss.normalize_L2(new_embeddings)
            self.index = faiss.IndexFlatIP(new_embeddings.shape[1])
        else:
            self.index = faiss.IndexFlatL2(new_embeddings.shape[1])
        self.index.add(new_embeddings)
        # Update ids and meta
        new_ids = [self.ids[i] for i in keep_indices]
        new_id_to_meta = {doc_id: self.id_to_meta[doc_id] for doc_id in new_ids}
        # Update vector_index in meta
        for i, doc_id in enumerate(new_ids):
            new_id_to_meta[doc_id]["vector_index"] = i
        self.ids = new_ids
        self.id_to_meta = new_id_to_meta
        self._save()
        return True

    def update(self, doc_id: str, text: Optional[str] = None,
               embedding: Optional[List[float]] = None,
               metadata: Optional[Dict[str, Any]] = None) -> bool:
        # Remove and re-add
        current = self.get(doc_id)
        if current is None:
            return False
        self.delete([doc_id])
        new_text = text if text is not None else current["text"]
        new_embedding = embedding if embedding is not None else None
        new_metadata = metadata if metadata is not None else current["metadata"]
        self.add([new_text], embeddings=[new_embedding] if new_embedding is not None else None,
                 metadata=[new_metadata])
        return True

    def get_all(self, limit: Optional[int] = None, offset: int = 0) -> List[Dict[str, Any]]:
        all_ids = self.ids[offset:offset + limit if limit is not None else None]
        return [self.get(doc_id) for doc_id in all_ids]

    def count(self) -> int:
        return len(self.ids)

    def clear(self) -> bool:
        self.index = None
        self.ids = []
        self.id_to_meta = {}
        if os.path.exists(self.index_file):
            os.remove(self.index_file)
        if os.path.exists(self.meta_file):
            os.remove(self.meta_file)
        return True