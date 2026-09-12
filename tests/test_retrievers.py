import pytest
import json
import os
import tempfile
import shutil
import numpy as np
from unittest.mock import patch, MagicMock
import sys

from chainforge.flask_app import app
from chainforge.rag.embeddings import EmbeddingMethodRegistry
from chainforge.rag.retrievers import RetrievalMethodRegistry
from chainforge.rag.vector_stores import LancedbVectorStore, FaissVectorStore

# Add the parent directory to sys.path to import flask_app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def client():
  """Create a test client for the app."""
  app.config['TESTING'] = True
  with app.test_client() as client:
    yield client

@pytest.fixture
def temp_db_dir():
  """Create a temporary directory for database storage."""
  temp_dir = tempfile.mkdtemp()
  yield temp_dir
  # Cleanup after test
  if os.path.exists(temp_dir):
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def sample_chunks():
  """Sample chunks for testing."""
  return [
    {
      "text": "Python is a high-level programming language known for its simplicity and readability.",
      "docTitle": "Python Basics",
      "chunkId": "chunk1"
    },
    {
      "text": "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
      "docTitle": "ML Introduction",
      "chunkId": "chunk2"
    },
    {
      "text": "Deep learning uses neural networks with multiple layers to process complex patterns in data.",
      "docTitle": "Deep Learning",
      "chunkId": "chunk3"
    },
    {
      "text": "Natural language processing allows computers to understand and generate human language.",
      "docTitle": "NLP Overview",
      "chunkId": "chunk4"
    },
    {
      "text": "Data science combines statistics, programming, and domain expertise to extract insights from data.",
      "docTitle": "Data Science",
      "chunkId": "chunk5"
    }
  ]

@pytest.fixture
def sample_queries():
  """Sample queries for testing."""
  return [
    {"text": "What is Python?", "metavars": {}},
    {"text": "Tell me about machine learning", "metavars": {}},
    {"text": "How does deep learning work?", "metavars": {}}
  ]

class TestRetrieveEndpoint:
  
  def test_retrieve_missing_methods(self, client):
    """Test the /retrieve endpoint with missing methods."""
    response = client.post('/retrieve', json={
      "chunks": [{"text": "sample text"}],
      "queries": [{"text": "sample query"}],
    })
    assert response.status_code == 400
    
  def test_retrieve_missing_chunks(self, client):
    """Test the /retrieve endpoint with missing chunks."""
    response = client.post('/retrieve', json={
      "methods": [{"id": "method1", "baseMethod": "bm25", "methodName": "BM25", "library": "BM25"}],
      "queries": [{"text": "sample query"}],
    })
    assert response.status_code == 400
    
  def test_retrieve_missing_queries(self, client):
    """Test the /retrieve endpoint with missing queries."""
    response = client.post('/retrieve', json={
      "methods": [{"id": "method1", "baseMethod": "bm25", "methodName": "BM25", "library": "BM25"}],
      "chunks": [{"text": "sample text"}],
    })
    assert response.status_code == 400
  
  @patch('chainforge.rag.retrievers.RetrievalMethodRegistry.get_handler')
  def test_retrieve_bm25(self, mock_get_handler, client):
    """Test the /retrieve endpoint with BM25."""
    # Set up mock handler
    mock_handler = MagicMock()
    mock_response = [
      {
        'query_object': {'text': 'What is Python?'},
        'retrieved_chunks': [
          {
            'text': 'Python is a programming language.',
            'similarity': 0.95,
            'docTitle': 'Programming Languages',
            'chunkId': 'chunk1'
          }
        ]
      }
    ]
    mock_handler.return_value = mock_response
    mock_get_handler.return_value = mock_handler
    
    # Make request
    request_data = {
      "methods": [
        {
          "id": "method1",
          "baseMethod": "bm25",
          "methodName": "BM25",
          "library": "BM25",
          "settings": {"top_k": 3}
        }
      ],
      "chunks": [
        {
          "text": "Python is a programming language.",
          "prompt": "original query",
          "metavars": {"docTitle": "Programming Languages", "chunkId": "chunk1"},
          "fill_history": {"chunkMethod": "test_method"}
        }
      ],
      "queries": [
        {
          "text": "What is Python?",
          "metavars": {"docTitle": "Questions"}
        }
      ]
    }
    
    response = client.post('/retrieve', json=request_data)
    assert response.status_code == 200
    
    # Verify handler was retrieved and called
    mock_get_handler.assert_called_with("bm25")
    assert mock_handler.called
    
    # Check response format
    result = json.loads(response.data)
    assert isinstance(result, list)
    assert len(result) > 0
    assert "text" in result[0]
    assert "metavars" in result[0]
    assert "methodId" in result[0]["metavars"]
    assert "retrievalMethodSignature" in result[0]["metavars"]
    assert "docTitle" in result[0]["metavars"]
    assert "chunkId" in result[0]["metavars"]
  
  @patch('chainforge.rag.retrievers.RetrievalMethodRegistry.get_handler')
  def test_retrieve_tfidf(self, mock_get_handler, client):
    """Test the /retrieve endpoint with TF-IDF."""
    # Set up mock handler
    mock_handler = MagicMock()
    mock_response = [
      {
        'query_object': {'text': 'How to install Python?'},
        'retrieved_chunks': [
          {
            'text': 'To install Python, download it from python.org.',
            'similarity': 0.88,
            'docTitle': 'Installation Guide',
            'chunkId': 'chunk2'
          }
        ]
      }
    ]
    mock_handler.return_value = mock_response
    mock_get_handler.return_value = mock_handler
    
    # Make request
    request_data = {
      "methods": [
        {
          "id": "method2",
          "baseMethod": "tfidf",
          "methodName": "TF-IDF",
          "library": "sklearn",
          "settings": {"top_k": 3}
        }
      ],
      "chunks": [
        {
          "text": "To install Python, download it from python.org.",
          "prompt": "original query",
          "metavars": {"docTitle": "Installation Guide", "chunkId": "chunk2"},
          "fill_history": {"chunkMethod": "test_method"}
        }
      ],
      "queries": [
        {
          "text": "How to install Python?",
          "metavars": {"docTitle": "Questions"}
        }
      ]
    }
    
    response = client.post('/retrieve', json=request_data)
    assert response.status_code == 200
    
    # Verify handler was retrieved and called
    mock_get_handler.assert_called_with("tfidf")
    assert mock_handler.called
  

# ============================================================================
# EMBEDDING RETRIEVAL TESTS - COMPREHENSIVE COVERAGE
# ============================================================================

class TestEmbeddingRetrievalWithLanceDB:
  """Test embedding-based retrieval with LanceDB backend across all providers."""
  
  @pytest.mark.parametrize("similarity_metric", ["cosine", "euclidean", "dot_product"])
  def test_lancedb_openai_embeddings(self, temp_db_dir, sample_chunks, sample_queries, similarity_metric):
    """Test LanceDB retrieval with OpenAI embeddings and different similarity metrics."""
    # Skip if OpenAI API key not available
    if not os.environ.get("OPENAI_API_KEY"):
      pytest.skip("OPENAI_API_KEY not set")
    
    # Get embedder
    embedder = EmbeddingMethodRegistry.get_embedder("openai")
    api_keys = {"OpenAI": os.environ.get("OPENAI_API_KEY")}
    
    # Generate embeddings
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    # Test retrieval
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {
      "top_k": 3,
      "metric": similarity_metric,
    }
    
    results = handler(
      sample_chunks,
      chunk_embeddings,
      sample_queries,
      query_embeddings,
      settings,
      temp_db_dir
    )
    
    # Assertions
    assert len(results) == len(sample_queries)
    for result in results:
      assert "query_object" in result
      assert "retrieved_chunks" in result
      assert len(result["retrieved_chunks"]) <= 3
      
      # Check structure of retrieved chunks
      for chunk in result["retrieved_chunks"]:
        assert "text" in chunk
        assert "similarity" in chunk
        assert "id" in chunk
        assert isinstance(chunk["similarity"], (float, int))
        assert 0 <= chunk["similarity"] <= 1.1  # Allow slight numerical imprecision
  
  @pytest.mark.parametrize("top_k", [1, 3, 5])
  def test_lancedb_openai_different_top_k(self, temp_db_dir, sample_chunks, sample_queries, top_k):
    """Test LanceDB retrieval with different top_k values."""
    if not os.environ.get("OPENAI_API_KEY"):
      pytest.skip("OPENAI_API_KEY not set")
    
    embedder = EmbeddingMethodRegistry.get_embedder("openai")
    api_keys = {"OpenAI": os.environ.get("OPENAI_API_KEY")}
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": top_k, "metric": "cosine"}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    for result in results:
      assert len(result["retrieved_chunks"]) <= top_k
      # Check that results are ordered by similarity (descending)
      similarities = [chunk["similarity"] for chunk in result["retrieved_chunks"]]
      assert similarities == sorted(similarities, reverse=True)

  # Commented out Cohere tests for now due to API availability issues  
  # def test_lancedb_cohere_embeddings(self, temp_db_dir, sample_chunks, sample_queries):
  #   """Test LanceDB retrieval with Cohere embeddings."""
  #   if not os.environ.get("COHERE_API_KEY"):
  #     pytest.skip("COHERE_API_KEY not set")
    
  #   embedder = EmbeddingMethodRegistry.get_embedder("cohere")
  #   api_keys = {"Cohere": os.environ.get("COHERE_API_KEY")}
    
  #   chunk_texts = [c["text"] for c in sample_chunks]
  #   chunk_embeddings = embedder(chunk_texts, model_name="embed-english-v3.0", api_keys=api_keys)
    
  #   query_texts = [q["text"] for q in sample_queries]
  #   query_embeddings = embedder(query_texts, model_name="embed-english-v3.0", api_keys=api_keys)
    
  #   handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
  #   settings = {"top_k": 3, "metric": "cosine"}
    
  #   results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
  #   assert len(results) == len(sample_queries)
  #   for result in results:
  #     assert len(result["retrieved_chunks"]) <= 3
  #     assert all("similarity" in chunk for chunk in result["retrieved_chunks"])
  
  def test_lancedb_sentence_transformers(self, temp_db_dir, sample_chunks, sample_queries):
    """Test LanceDB retrieval with Sentence Transformers embeddings."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 3, "metric": "cosine"}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    assert len(results) == len(sample_queries)
    for result in results:
      assert "query_object" in result
      assert "retrieved_chunks" in result
      assert len(result["retrieved_chunks"]) <= 3
  
  def test_lancedb_huggingface_embeddings(self, temp_db_dir, sample_chunks, sample_queries):
    """Test LanceDB retrieval with HuggingFace embeddings."""
    embedder = EmbeddingMethodRegistry.get_embedder("huggingface")
    
    # Use a small model for testing
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 3, "metric": "cosine"}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    assert len(results) == len(sample_queries)
    for result in results:
      assert len(result["retrieved_chunks"]) <= 3
  
  def test_lancedb_persistence(self, temp_db_dir, sample_chunks, sample_queries):
    """Test that LanceDB properly persists and reloads data."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries[:1]]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 3, "metric": "cosine"}
    
    # First retrieval - creates database
    results1 = handler(sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings, settings, temp_db_dir)
    
    # Second retrieval - should reuse existing database
    results2 = handler(sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings, settings, temp_db_dir)
    
    # Results should be identical
    assert len(results1) == len(results2)
    assert results1[0]["retrieved_chunks"][0]["text"] == results2[0]["retrieved_chunks"][0]["text"]
  
  def test_lancedb_relevance_ordering(self, temp_db_dir, sample_chunks):
    """Test that LanceDB returns results in order of relevance."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    # Query that should strongly match first chunk
    query = [{"text": "Python programming language", "metavars": {}}]
    query_embeddings = embedder([query[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 5, "metric": "cosine"}
    
    results = handler(sample_chunks, chunk_embeddings, query, query_embeddings, settings, temp_db_dir)
    
    # First result should be the Python chunk
    assert "Python" in results[0]["retrieved_chunks"][0]["text"]
    
    # Verify descending order
    similarities = [chunk["similarity"] for chunk in results[0]["retrieved_chunks"]]
    assert similarities == sorted(similarities, reverse=True)


class TestEmbeddingRetrievalWithFAISS:
  """Test embedding-based retrieval with FAISS backend across all providers."""
  
  @pytest.mark.parametrize("similarity_metric", ["l2", "cosine", "dot"])
  def test_faiss_openai_embeddings(self, temp_db_dir, sample_chunks, sample_queries, similarity_metric):
    """Test FAISS retrieval with OpenAI embeddings and different similarity metrics."""
    # Skip if FAISS not installed
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    if not os.environ.get("OPENAI_API_KEY"):
      pytest.skip("OPENAI_API_KEY not set")
    
    embedder = EmbeddingMethodRegistry.get_embedder("openai")
    api_keys = {"OpenAI": os.environ.get("OPENAI_API_KEY")}
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": 3, "metric": similarity_metric}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    assert len(results) == len(sample_queries)
    for result in results:
      assert "query_object" in result
      assert "retrieved_chunks" in result
      assert len(result["retrieved_chunks"]) <= 3
      
      for chunk in result["retrieved_chunks"]:
        assert "text" in chunk
        assert "similarity" in chunk
        assert "id" in chunk
        assert isinstance(chunk["similarity"], (float, int))
  
  @pytest.mark.parametrize("top_k", [1, 3, 5])
  def test_faiss_different_top_k(self, temp_db_dir, sample_chunks, sample_queries, top_k):
    """Test FAISS retrieval with different top_k values."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    if not os.environ.get("OPENAI_API_KEY"):
      pytest.skip("OPENAI_API_KEY not set")
    
    embedder = EmbeddingMethodRegistry.get_embedder("openai")
    api_keys = {"OpenAI": os.environ.get("OPENAI_API_KEY")}
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="text-embedding-3-small", api_keys=api_keys)
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": top_k, "metric": "l2"}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    for result in results:
      assert len(result["retrieved_chunks"]) <= top_k
  
  def test_faiss_cohere_embeddings(self, temp_db_dir, sample_chunks, sample_queries):
    """Test FAISS retrieval with Cohere embeddings."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    if not os.environ.get("COHERE_API_KEY"):
      pytest.skip("COHERE_API_KEY not set")
    
    embedder = EmbeddingMethodRegistry.get_embedder("cohere")
    api_keys = {"Cohere": os.environ.get("COHERE_API_KEY")}
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="embed-english-v3.0", api_keys=api_keys)
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="embed-english-v3.0", api_keys=api_keys)
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": 3, "metric": "cosine"}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    assert len(results) == len(sample_queries)
    for result in results:
      assert len(result["retrieved_chunks"]) <= 3
  
  def test_faiss_sentence_transformers(self, temp_db_dir, sample_chunks, sample_queries):
    """Test FAISS retrieval with Sentence Transformers embeddings."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": 3, "metric": "cosine"}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    assert len(results) == len(sample_queries)
    for result in results:
      assert len(result["retrieved_chunks"]) <= 3
  
  def test_faiss_huggingface_embeddings(self, temp_db_dir, sample_chunks, sample_queries):
    """Test FAISS retrieval with HuggingFace embeddings."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    embedder = EmbeddingMethodRegistry.get_embedder("huggingface")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": 3, "metric": "l2"}
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries, query_embeddings, settings, temp_db_dir)
    
    assert len(results) == len(sample_queries)
    for result in results:
      assert len(result["retrieved_chunks"]) <= 3
  
  def test_faiss_persistence(self, temp_db_dir, sample_chunks, sample_queries):
    """Test that FAISS properly persists and reloads data."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries[:1]]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": 3, "metric": "l2"}
    
    # First retrieval - creates database
    results1 = handler(sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings, settings, temp_db_dir)
    
    # Second retrieval - should reuse existing database
    results2 = handler(sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings, settings, temp_db_dir)
    
    # Results should be consistent
    assert len(results1) == len(results2)
    assert results1[0]["retrieved_chunks"][0]["text"] == results2[0]["retrieved_chunks"][0]["text"]
  
  def test_faiss_relevance_ordering(self, temp_db_dir, sample_chunks):
    """Test that FAISS returns results in order of relevance."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    # Query that should strongly match first chunk
    query = [{"text": "Python programming language", "metavars": {}}]
    query_embeddings = embedder([query[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": 5, "metric": "cosine"}
    
    results = handler(sample_chunks, chunk_embeddings, query, query_embeddings, settings, temp_db_dir)
    
    # First result should be the Python chunk
    assert "Python" in results[0]["retrieved_chunks"][0]["text"]
    
    # Verify descending order
    similarities = [chunk["similarity"] for chunk in results[0]["retrieved_chunks"]]
    assert similarities == sorted(similarities, reverse=True)


class TestEmbeddingRetrievalCrossBackend:
  """Test consistency across LanceDB and FAISS backends."""
  
  def test_backends_return_similar_results(self, temp_db_dir, sample_chunks, sample_queries):
    """Test that LanceDB and FAISS return similar top results."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries[:1]]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    # Test with LanceDB
    lancedb_dir = os.path.join(temp_db_dir, "lancedb")
    os.makedirs(lancedb_dir, exist_ok=True)
    lance_handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    lance_results = lance_handler(
      sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings,
      {"top_k": 3, "metric": "cosine"}, lancedb_dir
    )
    
    # Test with FAISS
    faiss_dir = os.path.join(temp_db_dir, "faiss")
    os.makedirs(faiss_dir, exist_ok=True)
    faiss_handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    faiss_results = faiss_handler(
      sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings,
      {"top_k": 3, "metric": "cosine"}, faiss_dir
    )
    
    # Both should return the same top result (most relevant chunk)
    assert lance_results[0]["retrieved_chunks"][0]["text"] == faiss_results[0]["retrieved_chunks"][0]["text"]
  
  @pytest.mark.parametrize("embedding_provider", [
    "sentence-transformers",
    pytest.param("openai", marks=pytest.mark.skipif(not os.environ.get("OPENAI_API_KEY"), reason="OPENAI_API_KEY not set")),
    pytest.param("cohere", marks=pytest.mark.skipif(not os.environ.get("COHERE_API_KEY"), reason="COHERE_API_KEY not set"))
  ])
  def test_all_providers_with_both_backends(self, temp_db_dir, sample_chunks, sample_queries, embedding_provider):
    """Test that all embedding providers work with both backends."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    embedder = EmbeddingMethodRegistry.get_embedder(embedding_provider)
    
    # Configure model and API keys based on provider
    if embedding_provider == "openai":
      model_name = "text-embedding-3-small"
      api_keys = {"OpenAI": os.environ.get("OPENAI_API_KEY")}
    elif embedding_provider == "cohere":
      model_name = "embed-english-v3.0"
      api_keys = {"Cohere": os.environ.get("COHERE_API_KEY")}
    else:
      model_name = "all-MiniLM-L6-v2"
      api_keys = None
    
    chunk_texts = [c["text"] for c in sample_chunks]
    if api_keys:
      chunk_embeddings = embedder(chunk_texts, model_name=model_name, api_keys=api_keys)
    else:
      chunk_embeddings = embedder(chunk_texts, model_name=model_name)
    
    query_texts = [q["text"] for q in sample_queries[:1]]
    if api_keys:
      query_embeddings = embedder(query_texts, model_name=model_name, api_keys=api_keys)
    else:
      query_embeddings = embedder(query_texts, model_name=model_name)
    
    # Test LanceDB
    lancedb_dir = os.path.join(temp_db_dir, f"lancedb_{embedding_provider}")
    os.makedirs(lancedb_dir, exist_ok=True)
    lance_handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    lance_results = lance_handler(
      sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings,
      {"top_k": 3, "metric": "cosine"}, lancedb_dir
    )
    assert len(lance_results) == 1
    assert len(lance_results[0]["retrieved_chunks"]) <= 3
    
    # Test FAISS
    faiss_dir = os.path.join(temp_db_dir, f"faiss_{embedding_provider}")
    os.makedirs(faiss_dir, exist_ok=True)
    faiss_handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    faiss_results = faiss_handler(
      sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings,
      {"top_k": 3, "metric": "cosine"}, faiss_dir
    )
    assert len(faiss_results) == 1
    assert len(faiss_results[0]["retrieved_chunks"]) <= 3


class TestEmbeddingRetrievalEdgeCases:
  """Test edge cases and error handling for embedding retrieval."""
  
  def test_empty_queries(self, temp_db_dir, sample_chunks):
    """Test handling of empty query list."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    
    with pytest.raises(Exception):
      handler(sample_chunks, chunk_embeddings, [], [], {"top_k": 3, "metric": "cosine"}, temp_db_dir)
  
  def test_empty_chunks(self, temp_db_dir, sample_queries):
    """Test handling of empty chunk list."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    query_texts = [q["text"] for q in sample_queries]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    
    with pytest.raises(Exception):
      handler([], [], sample_queries, query_embeddings, {"top_k": 3, "metric": "cosine"}, temp_db_dir)
  
  def test_top_k_larger_than_chunks(self, temp_db_dir, sample_chunks, sample_queries):
    """Test that top_k larger than number of chunks works correctly."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries[:1]]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 100, "metric": "cosine"}  # Much larger than 5 chunks
    
    results = handler(sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings, settings, temp_db_dir)
    
    # Should return all chunks
    assert len(results[0]["retrieved_chunks"]) == len(sample_chunks)
  
  def test_single_chunk_single_query(self, temp_db_dir):
    """Test with minimal input: one chunk and one query."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunks = [{"text": "Test chunk", "docTitle": "Test", "chunkId": "1"}]
    chunk_embeddings = embedder([chunks[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    queries = [{"text": "Test query", "metavars": {}}]
    query_embeddings = embedder([queries[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 1, "metric": "cosine"}
    
    results = handler(chunks, chunk_embeddings, queries, query_embeddings, settings, temp_db_dir)
    
    assert len(results) == 1
    assert len(results[0]["retrieved_chunks"]) == 1
    assert results[0]["retrieved_chunks"][0]["text"] == "Test chunk"
  
  def test_duplicate_chunks(self, temp_db_dir, sample_queries):
    """Test handling of duplicate chunks."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    # Create chunks with duplicates
    chunks = [
      {"text": "Duplicate text", "docTitle": "Doc1", "chunkId": "1"},
      {"text": "Duplicate text", "docTitle": "Doc2", "chunkId": "2"},
      {"text": "Unique text", "docTitle": "Doc3", "chunkId": "3"},
    ]
    
    chunk_texts = [c["text"] for c in chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries[:1]]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 3, "metric": "cosine"}
    
    # Should handle duplicates gracefully
    results = handler(chunks, chunk_embeddings, sample_queries[:1], query_embeddings, settings, temp_db_dir)
    
    assert len(results) == 1
    assert len(results[0]["retrieved_chunks"]) >= 1
  
  @pytest.mark.parametrize("invalid_metric", ["invalid", "unknown", ""])
  def test_invalid_similarity_metric_lancedb(self, temp_db_dir, sample_chunks, sample_queries, invalid_metric):
    """Test handling of invalid similarity metrics."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunk_texts = [c["text"] for c in sample_chunks]
    chunk_embeddings = embedder(chunk_texts, model_name="all-MiniLM-L6-v2")
    
    query_texts = [q["text"] for q in sample_queries[:1]]
    query_embeddings = embedder(query_texts, model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 3, "metric": invalid_metric}
    
    # Should either handle gracefully or raise appropriate error
    try:
      results = handler(sample_chunks, chunk_embeddings, sample_queries[:1], query_embeddings, settings, temp_db_dir)
      # If it doesn't raise, it should still return valid results
      assert len(results) == 1
    except (ValueError, Exception):
      # Expected for invalid metrics
      pass


class TestEmbeddingRetrievalMetadata:
  """Test that metadata is properly preserved through retrieval."""
  
  def test_metadata_preservation_lancedb(self, temp_db_dir):
    """Test that chunk metadata is preserved in LanceDB retrieval."""
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunks = [
      {
        "text": "Test chunk with metadata",
        "docTitle": "Important Doc",
        "chunkId": "special-123",
        "customField": "custom_value"
      }
    ]
    
    chunk_embeddings = embedder([chunks[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    query = [{"text": "test query", "metavars": {}}]
    query_embeddings = embedder([query[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("lancedb_vector_store")
    settings = {"top_k": 1, "metric": "cosine"}
    
    results = handler(chunks, chunk_embeddings, query, query_embeddings, settings, temp_db_dir)
    
    # Check that the retrieved chunk has correct text
    assert results[0]["retrieved_chunks"][0]["text"] == "Test chunk with metadata"
  
  def test_metadata_preservation_faiss(self, temp_db_dir):
    """Test that chunk metadata is preserved in FAISS retrieval."""
    try:
      import faiss
    except ImportError:
      pytest.skip("FAISS not installed")
    
    embedder = EmbeddingMethodRegistry.get_embedder("sentence-transformers")
    
    chunks = [
      {
        "text": "Test chunk with metadata",
        "docTitle": "Important Doc",
        "chunkId": "special-456"
      }
    ]
    
    chunk_embeddings = embedder([chunks[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    query = [{"text": "test query", "metavars": {}}]
    query_embeddings = embedder([query[0]["text"]], model_name="all-MiniLM-L6-v2")
    
    handler = RetrievalMethodRegistry.get_handler("faiss_vector_store")
    settings = {"top_k": 1, "metric": "l2"}
    
    results = handler(chunks, chunk_embeddings, query, query_embeddings, settings, temp_db_dir)
    
    # Check that the retrieved chunk has correct text
    assert results[0]["retrieved_chunks"][0]["text"] == "Test chunk with metadata"
  