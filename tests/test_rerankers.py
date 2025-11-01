import sys
import os
import pytest

# Add the parent directory to sys.path to import modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import after path setup
from chainforge.rag.rerankers import RerankingMethodRegistry


def _has_sentence_transformers():
    """Check if sentence-transformers library is available."""
    try:
        import sentence_transformers  # noqa: F401
        return True
    except ImportError:
        return False


class TestRerankers:
    
    @pytest.mark.skipif(
        not _has_sentence_transformers(),
        reason="sentence-transformers library not available"
    )
    def test_cross_encoder_rerank(self):
        """Test cross-encoder reranking with a small model."""
        # Sample documents and query
        documents = [
            "Python is a programming language",
            "The weather is nice today",
            "Machine learning uses algorithms",
            "Cats are cute animals"
        ]
        query = "programming language"
        
        # Get the cross-encoder handler
        cross_encoder_handler = RerankingMethodRegistry.get_handler("cross_encoder")
        assert cross_encoder_handler is not None
        
        # Test with the smallest available model
        results = cross_encoder_handler(
            documents=documents,
            query=query,
            model="cross-encoder/ms-marco-MiniLM-L-6-v2",  # Smallest available model
            top_k=2
        )
        
        # Verify results structure
        assert isinstance(results, list)
        assert len(results) <= 2  # Should return top_k results
        
        for result in results:
            assert "document" in result
            assert "score" in result
            assert "index" in result
            assert isinstance(result["score"], float)
            assert isinstance(result["index"], int)
            assert result["document"] in documents
        
        # Results should be sorted by score (descending)
        if len(results) > 1:
            assert results[0]["score"] >= results[1]["score"]

    @pytest.mark.skipif(
        not os.getenv("COHERE_API_KEY"),
        reason="COHERE_API_KEY environment variable not set"
    )
    def test_cohere_rerank(self):
        """Test Cohere reranking with actual API call."""
        # Sample documents and query
        documents = [
            "Python is a programming language",
            "The weather is nice today",
            "Machine learning uses algorithms",
            "Cats are cute animals",
        ]
        query = "programming language"
        
        # Get the cohere rerank handler
        cohere_handler = RerankingMethodRegistry.get_handler("cohere_rerank")
        assert cohere_handler is not None
        
        # Test reranking with actual API call
        results = cohere_handler(
            documents=documents,
            query=query,
            model="rerank-v3.5",
            top_k=2
        )
        
        # Verify results structure
        assert isinstance(results, list)
        assert len(results) <= 2  # Should return top_k results or fewer
        assert len(results) > 0  # Should return at least one result
        
        for result in results:
            assert "document" in result
            assert "score" in result
            assert "index" in result
            assert isinstance(result["score"], float)
            assert isinstance(result["index"], int)
            assert result["document"] in documents
            assert 0.0 <= result["score"] <= 1.0  # Cohere scores are typically between 0 and 1
        
        # Results should be sorted by score (descending)
        if len(results) > 1:
            assert results[0]["score"] >= results[1]["score"]
        
        # The most relevant document should be about programming
        # (given our query "programming language")
        most_relevant = results[0]["document"]
        assert "Python" in most_relevant or "programming" in most_relevant
