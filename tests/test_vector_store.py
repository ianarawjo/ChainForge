import pytest
import tempfile
import os
import numpy as np
from chainforge.rag.vector_stores import LocalVectorStore

class TestLocalVectorStore:
     
    @pytest.fixture
    def dummy_embedder(self):
        """A simple mock embedding function that generates random vectors"""
        def _embed(texts):
            return [np.random.randn(384).tolist() for _ in texts]
        return _embed
    
    @pytest.fixture
    def dummy_documents(self):
        """Return dummy documents about programming languages"""
        return [
            "Python is an interpreted high-level general-purpose programming language. Its design philosophy emphasizes code readability with its use of significant indentation.",
            "JavaScript is a programming language that conforms to the ECMAScript specification. JavaScript is high-level, often just-in-time compiled, and multi-paradigm.",
            "Java is a high-level, class-based, object-oriented programming language that is designed to have as few implementation dependencies as possible.",
            "C++ is a general-purpose programming language created by Bjarne Stroustrup as an extension of the C programming language.",
            "Ruby is an interpreted, high-level, general-purpose programming language. It was designed and developed in the mid-1990s by Yukihiro Matsumoto in Japan.",
            "Go is a statically typed, compiled programming language designed at Google by Robert Griesemer, Rob Pike, and Ken Thompson.",
            "Rust is a multi-paradigm, high-level, general-purpose programming language designed for performance and safety, especially safe concurrency.",
            "Swift is a general-purpose, multi-paradigm, compiled programming language developed by Apple Inc. for iOS, iPadOS, macOS, watchOS, tvOS, and Linux."
        ]
    
    @pytest.fixture
    def dummy_metadata(self):
        """Return metadata for dummy documents"""
        return [
            {"language": "Python", "year": 1991, "creator": "Guido van Rossum", "paradigm": "multi-paradigm"},
            {"language": "JavaScript", "year": 1995, "creator": "Brendan Eich", "paradigm": "multi-paradigm"},
            {"language": "Java", "year": 1995, "creator": "James Gosling", "paradigm": "object-oriented"},
            {"language": "C++", "year": 1985, "creator": "Bjarne Stroustrup", "paradigm": "multi-paradigm"},
            {"language": "Ruby", "year": 1995, "creator": "Yukihiro Matsumoto", "paradigm": "multi-paradigm"},
            {"language": "Go", "year": 2009, "creator": "Google", "paradigm": "concurrent"},
            {"language": "Rust", "year": 2010, "creator": "Mozilla", "paradigm": "multi-paradigm"},
            {"language": "Swift", "year": 2014, "creator": "Apple", "paradigm": "multi-paradigm"}
        ]
    
    @pytest.fixture
    def vector_store(self, tmp_path, dummy_embedder):
        """Create a temporary vector store for testing"""
        temp_dir = tmp_path / 'chainforge_test'
        temp_dir.mkdir(exist_ok=True)
        db_path = os.path.join(temp_dir, 'test_vector_store.db')
        store = LocalVectorStore(db_path=db_path, embedding_func=dummy_embedder)
        yield store
        # Cleanup
        # if os.path.exists(db_path):
        #     os.remove(db_path)
        # if os.path.exists(temp_dir):
        #     os.rmdir(temp_dir)

    def test_add_and_count(self, vector_store, dummy_documents, dummy_metadata):
        """Test adding documents to the vector store and counting them"""
        # Add documents
        ids = vector_store.add(dummy_documents, metadata=dummy_metadata)
        
        # Verify correct number of IDs returned
        assert len(ids) == len(dummy_documents)
        
        # Verify count method
        assert vector_store.count() == len(dummy_documents)
        
        # Verify adding same documents again doesn't increase count
        ids2 = vector_store.add(dummy_documents, metadata=dummy_metadata)
        assert vector_store.count() == len(dummy_documents)
        assert set(ids) == set(ids2)  # IDs should be the same

    def test_get_by_id(self, vector_store, dummy_documents, dummy_metadata):
        """Test retrieving documents by ID"""
        ids = vector_store.add(dummy_documents, metadata=dummy_metadata)
        
        # Get Python document
        python_doc = vector_store.get(ids[0])
        assert python_doc is not None
        assert python_doc["text"] == dummy_documents[0]
        assert python_doc["metadata"] == dummy_metadata[0]
        assert python_doc["id"] == ids[0]
        
        # Test non-existent ID
        non_existent = vector_store.get("this_id_does_not_exist")
        assert non_existent is None

    def test_get_all(self, vector_store, dummy_documents, dummy_metadata):
        """Test retrieving all documents"""
        vector_store.add(dummy_documents, metadata=dummy_metadata)
        
        # Get all documents
        all_docs = vector_store.get_all()
        assert len(all_docs) == len(dummy_documents)

        # Verify data of all documents match the original
        for i, doc in enumerate(all_docs):
            assert doc["text"] == dummy_documents[i]
            assert doc["metadata"] == dummy_metadata[i]
            assert doc["embedding"] is not None  # Ensure embedding exists
        
        # Get with limit
        limited_docs = vector_store.get_all(limit=3)
        assert len(limited_docs) == 3
        
        # Get with offset
        offset_docs = vector_store.get_all(offset=2)
        assert len(offset_docs) == len(dummy_documents) - 2
        
        # Combine limit and offset
        paged_docs = vector_store.get_all(limit=2, offset=2)
        assert len(paged_docs) == 2

    def test_delete(self, vector_store, dummy_documents, dummy_metadata):
        """Test deleting documents"""
        ids = vector_store.add(dummy_documents, metadata=dummy_metadata)
        
        # Delete first two documents
        success = vector_store.delete(ids[:2])
        assert success
        
        # Verify count decreased
        assert vector_store.count() == len(dummy_documents) - 2
        
        # Verify first document no longer exists
        assert vector_store.get(ids[0]) is None
        
        # But third document still exists
        assert vector_store.get(ids[2]) is not None

    def test_update(self, vector_store, dummy_documents, dummy_metadata):
        """Test updating documents"""
        ids = vector_store.add(dummy_documents, metadata=dummy_metadata)
        assert vector_store.count() == len(dummy_documents)
        
        # Update text
        updated_text = "Python is an amazing language for data science and machine learning!"
        new_id = vector_store.update(ids[0], text=updated_text)
        assert new_id is not None  # New ID should be returned
        
        # Verify text was updated
        doc = vector_store.get(new_id)
        assert doc is not None
        assert doc["text"] == updated_text
        assert doc["metadata"] == dummy_metadata[0]  # Metadata unchanged
        
        # Update metadata
        updated_metadata = {"language": "Python", "year": 1991, 
                           "creator": "Guido van Rossum", 
                           "paradigm": "multi-paradigm",
                           "usage": "data science, web development, automation"}
        new_new_id = vector_store.update(new_id, metadata=updated_metadata)
        assert new_new_id is not None  # New ID should be returned
        assert new_new_id == new_id  # ID should remain the same, because we didn't change text
        
        # Verify metadata was updated
        doc = vector_store.get(new_id)
        assert doc["text"] == updated_text  # Text remains the same from previous update
        assert doc["metadata"] == updated_metadata

    def test_search_with_embedding(self, vector_store, dummy_documents, dummy_metadata, dummy_embedder):
        """Test searching with a query embedding"""
        vector_store.add(dummy_documents, metadata=dummy_metadata)
        
        # Generate a random query embedding
        query_embedding = np.random.randn(384).tolist()
        
        # Simple similarity search
        results = vector_store.search(query_embedding, k=3)
        assert len(results) <= 3  # May be fewer if there are fewer documents
        for result in results:
            assert "id" in result
            assert "text" in result
            assert "score" in result
            assert "metadata" in result
        
        # Try different distance_metrics 
        results_l2 = vector_store.search(query_embedding, k=3, distance_metric="l2")
        assert len(results_l2) <= 3
        results_cosine = vector_store.search(query_embedding, k=3, distance_metric="cosine")
        assert len(results_cosine) <= 3
        results_dot = vector_store.search(query_embedding, k=3, distance_metric="dot")
        assert len(results_dot) <= 3

        # Test MMR search
        mmr_results = vector_store.search(query_embedding, k=3, method="mmr")
        assert len(mmr_results) <= 3
        
        # Test hybrid search
        hybrid_results = vector_store.search(query_embedding, k=3, method="hybrid")
        assert len(hybrid_results) <= 3

    def test_clear(self, vector_store, dummy_documents, dummy_metadata):
        """Test clearing all documents"""
        vector_store.add(dummy_documents, metadata=dummy_metadata)
        assert vector_store.count() == len(dummy_documents)
        
        # Clear the store
        success = vector_store.clear()
        assert success
        
        # Verify store is empty
        assert vector_store.count() == 0
        assert len(vector_store.get_all()) == 0

    def test_search_with_embedding_function(self, vector_store, dummy_documents, dummy_metadata):
        """Test searching using the embedding function"""
        # Add documents using the embedding function
        vector_store.add(dummy_documents, metadata=dummy_metadata)
        
        # Use the same embedding function for a query
        query = "Which programming language is best for web development?"
        query_embedding = vector_store.embedding_func([query])[0]
        
        results = vector_store.search(query_embedding, k=3)
        assert len(results) <= 3
        
        # Results should have all required fields
        for result in results:
            assert "id" in result
            assert "text" in result  
            assert "score" in result
            assert "metadata" in result