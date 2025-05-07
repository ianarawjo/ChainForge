from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Union
import os
import numpy as np
import pandas as pd
import lancedb
import hashlib, pickle


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


class LocalVectorStore(VectorStore):
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

