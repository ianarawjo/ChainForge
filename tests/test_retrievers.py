import pytest
import json
from flask import Flask
from unittest.mock import patch, MagicMock
import sys
import os
from chainforge.flask_app import app

# Add the parent directory to sys.path to import flask_app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def client():
  """Create a test client for the app."""
  app.config['TESTING'] = True
  with app.test_client() as client:
    yield client

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
  
  @patch('chainforge.rag.retrievers.handle_bm25')
  def test_retrieve_bm25(self, mock_bm25, client):
    """Test the /retrieve endpoint with BM25."""
    # Set up mock response
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
    mock_bm25.return_value = mock_response
    
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
          "metavars": {"docTitle": "Programming Languages", "chunkId": "chunk1"}
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
    
    # Verify mock called correctly
    mock_bm25.assert_called_once()
    
    # Check response format
    result = json.loads(response.data)
    assert isinstance(result, list)
    assert len(result) > 0
    assert "text" in result[0]
    assert "metavars" in result[0]
    assert "method" in result[0]["metavars"]
  
  @patch('chainforge.rag.retrievers.handle_tfidf')
  def test_retrieve_tfidf(self, mock_tfidf, client):
    """Test the /retrieve endpoint with TF-IDF."""
    # Set up mock response
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
    mock_tfidf.return_value = mock_response
    
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
          "metavars": {"docTitle": "Installation Guide", "chunkId": "chunk2"}
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
    
    # Verify mock called correctly
    mock_tfidf.assert_called_once()
  