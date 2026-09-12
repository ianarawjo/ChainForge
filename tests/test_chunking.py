import pytest
from chainforge.rag.chunkers import (
    chonkie_token, chonkie_sentence, chonkie_recursive, chonkie_semantic, 
    chonkie_late,
    overlapping_openai_tiktoken, overlapping_huggingface_tokenizers,
    syntax_nltk, syntax_texttiling
)

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
  
  @pytest.mark.slow
  def test_chonkie_semantic(self):
    chunker = chonkie_semantic
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  @pytest.mark.slow
  def test_chonkie_semantic_with_parameters(self):
    chunker = chonkie_semantic
    chunks = chunker(self.dummy_document, chunk_size=100, threshold=0.5,
              min_sentences=2, similarity_window=2)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
  

  # Late chunker may pose problems because 
  # its dependencies require numpy>=2.0 yet other libraries 
  # require numpy<2.0.
  @pytest.mark.slow
  def test_chonkie_late(self):
    chunker = chonkie_late
    if chunker is None or not callable(chunker):
      pytest.skip("chonkie_late chunker not fully implemented")
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)

  def test_overlapping_tiktoken(self):
    chunker = overlapping_openai_tiktoken
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_overlapping_tiktoken_with_parameters(self):
    chunker = overlapping_openai_tiktoken
    chunks = chunker(self.dummy_document, model="gpt-3.5-turbo", 
                     chunk_size=100, chunk_overlap=25)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
  
  @pytest.mark.slow
  def test_overlapping_huggingface(self):
    chunker = overlapping_huggingface_tokenizers
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_syntax_nltk(self):
    chunker = syntax_nltk
    chunks = chunker(self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)
  
  def test_syntax_texttiling(self):
    chunker = syntax_texttiling
    # Note: The texttiling chunker may not work well with short texts, so
    # we are using a longer dummy document for testing.
    chunks = chunker(self.dummy_document + "\n\n" + self.dummy_document)
    assert isinstance(chunks, list)
    assert len(chunks) > 0
    for chunk in chunks:
      assert isinstance(chunk, str)



class TestMarkdownHeaderChunking:
  """The markdown_header chunker had no coverage."""

  def _chunk(self, text, **kwargs):
    from chainforge.rag.chunkers import ChunkingMethodRegistry
    return ChunkingMethodRegistry.get_handler("markdown_header")(text, **kwargs)

  def test_splits_at_atx_headings_and_keeps_them(self):
    chunks = self._chunk("# One\nalpha\n\n# Two\nbeta")
    assert len(chunks) == 2
    assert chunks[0].startswith("# One")
    assert "alpha" in chunks[0]
    assert chunks[1].startswith("# Two")

  def test_all_heading_levels(self):
    text = "\n".join(f"{'#' * lvl} H{lvl}\nbody{lvl}" for lvl in range(1, 7))
    chunks = self._chunk(text)
    assert len(chunks) == 6
    for lvl, chunk in enumerate(chunks, start=1):
      assert chunk.startswith(f"{'#' * lvl} H{lvl}")

  def test_leading_preamble_becomes_its_own_chunk(self):
    chunks = self._chunk("intro text\n\n# Section\nbody")
    assert len(chunks) == 2
    assert chunks[0] == "intro text"

  def test_text_without_headings_is_one_chunk(self):
    assert self._chunk("just a paragraph") == ["just a paragraph"]

  def test_hash_without_a_following_space_is_not_a_heading(self):
    # "#hashtag" is not an ATX heading.
    assert len(self._chunk("#hashtag body text")) == 1

  def test_crlf_line_endings(self):
    chunks = self._chunk("# One\r\nalpha\r\n# Two\r\nbeta")
    assert len(chunks) == 2

  def test_none_input(self):
    assert self._chunk(None) == [""]

  def test_empty_and_whitespace_input(self):
    assert self._chunk("") == [""]
    assert self._chunk("   \n  ") == ["   \n  "]
