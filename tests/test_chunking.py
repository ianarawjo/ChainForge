import pytest
from chainforge.rag.chunk_handlers import chonkie_token, chonkie_sentence, chonkie_recursive, chonkie_semantic, chonkie_sdpm, chonkie_late, chonkie_neural

class TestChonkieChunking:
  
  @pytest.fixture(autouse=True)
  def setup(self):
    # A dummy document to use for all tests
    self.dummy_document = """
    This is a test document. It contains several sentences.
    Each sentence should be treated as a potential chunk boundary.
    We have different paragraphs too!
    And some more text to make it a bit longer.
    This way we can test chunking methods properly.
    Let's add even more text to ensure we have enough tokens for meaningful chunking.
    Machine learning models often need a certain amount of text to work with.
    The quick brown fox jumps over the lazy dog.
    Now is the time for all good men to come to the aid of their country.
    """
  
  def test_chonkie_token(self):
    chunker = chonkie_token
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_chonkie_token_with_parameters(self):
    chunker = chonkie_token
    chunks = chunker(self.dummy_document, chunk_size=100, chunk_overlap=10, tokenizer="gpt2")
    assert isinstance(chunks, list)
    assert len(chunks) > 0
  
  def test_chonkie_sentence(self):
    chunker = chonkie_sentence
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_chonkie_sentence_with_parameters(self):
    chunker = chonkie_sentence 
    chunks = chunker(self.dummy_document, chunk_size=100, chunk_overlap=10, 
              min_sentences_per_chunk=2, min_characters_per_sentence=5)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
  
  def test_chonkie_recursive(self):
    chunker = chonkie_recursive
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_chonkie_recursive_with_parameters(self):
    chunker = chonkie_recursive
    chunks = chunker(self.dummy_document, chunk_size=100, 
              min_characters_per_chunk=10)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
  
  def test_chonkie_semantic(self):
    chunker = chonkie_semantic
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_chonkie_semantic_with_parameters(self):
    chunker = chonkie_semantic
    chunks = chunker(self.dummy_document, chunk_size=100, threshold=0.5,
              min_sentences=2, similarity_window=2)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
  
  def test_chonkie_sdpm(self):
    chunker = chonkie_sdpm
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_chonkie_sdpm_with_parameters(self):
    chunker = chonkie_sdpm 
    chunks = chunker(self.dummy_document, chunk_size=24, threshold=0.01,
              skip_window=1, min_sentences=1)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
  
  def test_chonkie_late(self):
    chunker = chonkie_late
    if chunker is None or not callable(chunker):
      pytest.skip("chonkie_late chunker not fully implemented")
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
  
  def test_chonkie_neural(self):
    chunker = chonkie_neural
    if chunker is None or not callable(chunker):
      pytest.skip("chonkie_neural chunker not fully implemented")
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
