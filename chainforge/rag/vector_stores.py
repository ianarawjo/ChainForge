import shutil
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Union
import os
import numpy as np
import pandas as pd
import lancedb
import hashlib, json, pickle

# Faiss requires 'swig' to be installed, and the 'faiss-cpu' package (or 'faiss-gpu', built from source).
# Swig is only installable via homebrew on macOS, which makes this dependency difficult to support 
# by default. To be safe we soft-fail if it's not installed.
try:
    import faiss
except ImportError:
    faiss = None


def _serialize_metadata(meta: Optional[Dict[str, Any]]) -> bytes:
    """Serialize chunk metadata for storage.

    JSON rather than pickle: these bytes are read back off disk, and unpickling
    is arbitrary code execution. `default=str` keeps the call total for values
    JSON does not model natively.
    """
    return json.dumps(meta or {}, default=str).encode("utf-8")


def _deserialize_metadata(raw: Any) -> Dict[str, Any]:
    """Read metadata written by :func:`_serialize_metadata`.

    Databases created before the switch to JSON hold pickles, so fall back to
    unpickling those rather than failing to open an existing local store.
    """
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    data = bytes(raw)
    if not data:
        return {}
    try:
        return json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return pickle.loads(data)  # legacy store, written before JSON


def _sql_string_literal(value: Any) -> str:
    """Render a value as a SQL string literal for a LanceDB `where` filter.

    LanceDB filters are SQL expressions, so an embedded single quote has to be
    doubled. Without this, a query containing an apostrophe produces an invalid
    predicate -- and, more generally, lets input rewrite the expression.
    """
    return "'" + str(value).replace("'", "''") + "'"


_METRIC_ALIASES = {
    "cosine": "cosine",
    "l2": "l2",
    "euclidean": "l2",
    "dot": "dot",
    "dot_product": "dot",
    "ip": "dot",
}


def normalize_metric(name: Any) -> Optional[str]:
    """Map any accepted metric spelling to "cosine", "l2" or "dot"; None if unknown."""
    return _METRIC_ALIASES.get(str(name or "").lower())


# Every backend reports similarity on the same scale, so a similarity
# threshold -- or a fused score -- means the same whichever store produced it:
#   cosine: (1 + cosine similarity) / 2, in [0, 1]
#   l2:     1 / (1 + squared Euclidean distance), in (0, 1]
#   dot:    the raw dot product
def cosine_to_similarity(cos: float) -> float:
    return (1.0 + float(cos)) / 2.0


def squared_l2_to_similarity(sq_dist: float) -> float:
    return 1.0 / (1.0 + float(sq_dist))


def mmr_select(query_vec, candidate_vecs, k: int, lambda_param: float = 0.5) -> List[int]:
    """Maximal Marginal Relevance: pick k candidates balancing relevance and variety.

    Relevance and redundancy are both cosine similarities. `lambda_param` near
    1 favours relevance; near 0, variety. Returns candidate indices in the
    order they were picked.
    """
    vecs = np.asarray(candidate_vecs, dtype=np.float32)
    if len(vecs) == 0 or k <= 0:
        return []
    query = np.asarray(query_vec, dtype=np.float32)
    query = query / (np.linalg.norm(query) or 1.0)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    vecs = vecs / np.where(norms == 0, 1.0, norms)
    relevance = vecs @ query

    selected: List[int] = []
    remaining = list(range(len(vecs)))
    while remaining and len(selected) < k:
        if selected:
            redundancy = np.max(vecs[remaining] @ vecs[selected].T, axis=1)
        else:
            redundancy = np.zeros(len(remaining))
        scores = lambda_param * relevance[remaining] - (1 - lambda_param) * redundancy
        best = remaining[int(np.argmax(scores))]
        selected.append(best)
        remaining.remove(best)
    return selected


class VectorStore(ABC):
    """
    Abstract base class for vector stores that store and retrieve embeddings.

    This class defines the common interface that all vector store implementations
    should follow, allowing for easy swapping between different backends while
    maintaining the same API.
    """
    def __init__(self, embedding_func: Optional[callable], db_path, db_mode):
        """
        Initialize the vector store.

        Args:
            embedding_func: Optional function to generate embeddings
            db_path: path for DB
            db_mode: "create" to start this store's index afresh, or "load" to
                open an existing one. Either way, only the store's own index is
                touched: db_path may be a folder the user chose, holding other
                files, so it is never emptied wholesale.
        """
        if db_mode not in ("create", "load"):
            raise ValueError(f"Unknown db_mode '{db_mode}'. Use 'create' or 'load'.")
        self.embedding_func = embedding_func
        self.db_mode = db_mode

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
                 table_name: str = "embeddings",
                 db_mode: str = "create"):
        """
        Initialize LanceDB vector store.

        Args:
            db_path: Folder where LanceDB stores the database on disk
            table_name: Name of the table to use for vector storage
            db_mode: "create" drops any existing table of this name, so the
                index holds exactly what is added next; "load" opens an
                existing table, raising if there is none.
        """
        super().__init__(embedding_func, db_path, db_mode)
        if db_mode == "load" and not os.path.isdir(db_path):
            # Checked first: connecting would create the folder.
            raise FileNotFoundError(f"No LanceDB database found at '{db_path}'.")

        self.db = lancedb.connect(db_path)
        self.table_name = table_name
        self.table = None

        # list_tables() replaced the deprecated table_names(), and returns a
        # paged response rather than a list of names -- so testing membership
        # on it directly never finds a table. Fall back for older LanceDB
        # versions still allowed by our floor (>=0.17).
        if hasattr(self.db, "list_tables"):
            names, page_token = [], None
            while True:
                page = (self.db.list_tables(page_token=page_token) if page_token
                        else self.db.list_tables())
                names.extend(getattr(page, "tables", page))
                page_token = getattr(page, "page_token", None)
                if not page_token:
                    break
        else:
            names = list(self.db.table_names())
        table_exists = table_name in names
        if db_mode == "load":
            if not table_exists:
                raise FileNotFoundError(
                    f"No LanceDB table named '{table_name}' in '{db_path}'.")
            self.table = self.db.open_table(table_name)
        elif table_exists:
            self.db.drop_table(table_name)
        

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
            doc_ids_str = ",".join(_sql_string_literal(doc_id) for doc_id in doc_ids)
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
                "metadata": _serialize_metadata(meta)
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
            query: The query embedding vector, or text if an embedding_func was given
            k: Number of results to return
            **kwargs: Additional search parameters:
                - distance_metric: 'cosine', 'l2' / 'euclidean', or 'dot' / 'dot_product'
                - method: 'similarity' (default) or 'mmr'
                - lambda_param: Balance between relevance and variety for MMR (0-1)
                - filters: Query filters in LanceDB syntax

        Returns:
            List of document dictionaries with text, similarity, and metadata.
            Similarity uses the scale shared by every backend; see
            `cosine_to_similarity`.
        """
        if self.table is None:
            return []

        distance_metric = normalize_metric(kwargs.get("distance_metric", "l2")) or "l2"
        method = kwargs.get("method", "similarity")
        if method not in ("similarity", "mmr"):
            raise ValueError(f"Unknown search method: {method}")
        filters = kwargs.get("filters", None)

        if isinstance(query, str):
            if self.embedding_func is None:
                raise ValueError("Embedding function not provided for string query")
            query_embedding = self.embedding_func([query])[0]
        else:
            query_embedding = np.asarray(query, dtype=np.float32).tolist()

        q = self.table.search(query_embedding).metric(distance_metric)
        if filters:
            q = q.where(filters)

        if method == "mmr":
            # Over-fetch, then pick a relevant but varied k from the candidates.
            candidates = q.limit(k * 3).to_pandas()
            picked = mmr_select(query_embedding, list(candidates["vector"]), k,
                                float(kwargs.get("lambda_param", 0.5)))
            results = candidates.iloc[picked]
        else:
            results = q.limit(k).to_pandas()

        formatted_results = []
        for _, row in results.iterrows():
            distance = float(row["_distance"])
            if distance_metric == "cosine":
                # LanceDB's cosine distance is 1 - cosine similarity.
                similarity = cosine_to_similarity(1.0 - distance)
            elif distance_metric == "dot":
                # LanceDB's dot distance is 1 - dot product.
                similarity = 1.0 - distance
            else:
                # LanceDB's l2 distance is the squared Euclidean distance.
                similarity = squared_l2_to_similarity(distance)

            formatted_results.append({
                "id": row["id"],
                "text": row["text"],
                "similarity": float(similarity),
                "metadata": _deserialize_metadata(row["metadata"])
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
            
        results = self.table.search().where(f"id = {_sql_string_literal(doc_id)}").to_pandas()
        
        if len(results) == 0:
            print(f"Document with ID {doc_id} not found")
            return None
        
        row = results.iloc[0]
        return {
            "id": row["id"],
            "text": row["text"],
            "embedding": row["vector"],
            "metadata": _deserialize_metadata(row["metadata"])
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
                "metadata": _deserialize_metadata(row["metadata"])
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
                 metric: str = "l2",
                 db_mode: str = "create"):
        """
        Args:
            db_path: Directory where FAISS index and metadata are stored
            embedding_func: Optional function to generate embeddings
            index_name: Name of the FAISS index file (without extension)
            metric: 'l2' / 'euclidean', 'dot' / 'dot_product' / 'ip', or 'cosine'
            db_mode: "create" replaces any index of this name; "load" opens the
                existing one, raising if there is none. A loaded index keeps
                the metric it was built with.
        """
        super().__init__(embedding_func, db_path, db_mode)

        if faiss is None:
            raise ImportError("Faiss is not installed. Please install 'faiss-cpu' or 'faiss-gpu' if you would like to use Faiss vector store methods. You may need to install 'swig' as well; on MacOS this can be done with 'brew install swig'.")

        self.db_path = db_path
        self.index_name = index_name
        self.metric = normalize_metric(metric) or "l2"

        self.index_file = os.path.join(db_path, f"{index_name}.faiss")
        self.meta_file = os.path.join(db_path, f"{index_name}_meta.pkl")

        self.index = None
        self.id_to_meta = {}  # id -> dict with text, metadata, vector index
        self.ids = []         # list of ids in FAISS order

        if db_mode == "load":
            if not (os.path.exists(self.index_file) and os.path.exists(self.meta_file)):
                raise FileNotFoundError(f"No FAISS index named '{index_name}' in '{db_path}'.")
            self._load()
        else:
            os.makedirs(db_path, exist_ok=True)
            for path in (self.index_file, self.meta_file):
                if os.path.exists(path):
                    os.remove(path)

    def _generate_id(self, text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    def _new_index(self, dim: int):
        # Cosine is inner product over normalized vectors.
        return faiss.IndexFlatL2(dim) if self.metric == "l2" else faiss.IndexFlatIP(dim)

    def _similarity(self, score: float) -> float:
        """FAISS returns squared L2 distances or inner products; see cosine_to_similarity."""
        if self.metric == "l2":
            return squared_l2_to_similarity(score)
        if self.metric == "cosine":
            return cosine_to_similarity(score)
        return float(score)

    def _save(self):
        if self.index is not None:
            faiss.write_index(self.index, self.index_file)
        # Stored as JSON rather than a pickle; see _serialize_metadata. The
        # per-document "metadata" values are already JSON bytes, so decode them
        # for storage and re-encode on load.
        payload = {
            "id_to_meta": {
                doc_id: {**meta, "metadata": _deserialize_metadata(meta.get("metadata"))}
                for doc_id, meta in self.id_to_meta.items()
            },
            "ids": self.ids,
            "metric": self.metric,
        }
        with open(self.meta_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, default=str)

    def _load(self):
        self.index = faiss.read_index(self.index_file)
        with open(self.meta_file, "rb") as f:
            raw = f.read()
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            data = pickle.loads(raw)  # legacy store, written before JSON
        # Normalize metadata back to the serialized form used in memory.
        self.id_to_meta = {
            doc_id: {**meta, "metadata": _serialize_metadata(
                _deserialize_metadata(meta.get("metadata")))}
            for doc_id, meta in (data.get("id_to_meta") or {}).items()
        }
        self.ids = data.get("ids", [])

        # Search with the metric the vectors were indexed for.
        stored_metric = normalize_metric(data.get("metric"))
        if stored_metric is None:
            # Written before the metric was recorded, when every inner-product
            # index held normalized vectors.
            stored_metric = "cosine" if self.index.metric_type == faiss.METRIC_INNER_PRODUCT else "l2"
        if stored_metric != self.metric:
            print(f"Note: FAISS index '{self.index_name}' was built for the {stored_metric} "
                  f"metric, so it is searched with that rather than {self.metric}.")
            self.metric = stored_metric

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
            self.index = self._new_index(dim)

        # Add to FAISS
        new_embeddings_np = np.array(new_embeddings).astype("float32")
        if self.metric == "cosine":
            faiss.normalize_L2(new_embeddings_np)
        self.index.add(new_embeddings_np)

        # Update meta
        start_idx = len(self.ids)
        for i, doc_id in enumerate(new_doc_ids):
            self.ids.append(doc_id)
            self.id_to_meta[doc_id] = {
                "text": new_texts[i],
                "metadata": _serialize_metadata(new_metadata[i]),
                "vector_index": start_idx + i
            }

        self._save()
        return doc_ids

    def search(self, query: Union[str, List[float]], k: int = 5, **kwargs) -> List[Dict[str, Any]]:
        """
        Search by query embedding, or by text given an embedding_func.

        kwargs:
            method: 'similarity' (default) or 'mmr'
            lambda_param: Balance between relevance and variety for MMR (0-1)

        The metric is the index's own; see __init__.
        """
        if self.index is None or not self.ids:
            return []

        method = kwargs.get("method", "similarity")
        if method not in ("similarity", "mmr"):
            raise ValueError(f"Unknown search method: {method}")

        if isinstance(query, str):
            if self.embedding_func is None:
                raise ValueError("Embedding function not provided for string query")
            query_emb = self.embedding_func([query])[0]
        else:
            query_emb = query

        query_emb = np.array(query_emb, dtype="float32").reshape(1, -1)
        if self.metric == "cosine":
            faiss.normalize_L2(query_emb)

        n = len(self.ids)
        D, I = self.index.search(query_emb, min(k * 3 if method == "mmr" else k, n))
        found = [(int(idx), float(score)) for idx, score in zip(I[0], D[0]) if 0 <= idx < n]
        if method == "mmr" and found:
            vectors = [self.index.reconstruct(idx) for idx, _ in found]
            picked = mmr_select(query_emb[0], vectors, k, float(kwargs.get("lambda_param", 0.5)))
            found = [found[i] for i in picked]

        results = []
        for idx, score in found[:k]:
            doc_id = self.ids[idx]
            meta = self.id_to_meta[doc_id]
            results.append({
                "id": doc_id,
                "text": meta["text"],
                "similarity": self._similarity(score),
                "metadata": _deserialize_metadata(meta["metadata"])
            })
        return results

    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        meta = self.id_to_meta.get(doc_id)
        if meta is None:
            return None
        return {
            "id": doc_id,
            "text": meta["text"],
            "embedding": None,  # Embedding not stored directly
            "metadata": _deserialize_metadata(meta["metadata"])
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
        # Stored vectors are already normalized when the metric is cosine.
        new_embeddings = np.array([embeddings[i] for i in keep_indices]).astype("float32")
        self.index = self._new_index(new_embeddings.shape[1])
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
