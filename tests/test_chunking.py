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
  """The markdown_header chunker.

  Cases come from tests/fixtures/markdown_header_cases.json, which the
  TypeScript port in browserChunkers.ts reads too. The frontend runs its own
  implementation (so a flow chunks the same with or without a backend), so the
  two must agree; sharing the cases means a divergence fails a build rather
  than quietly changing how documents are split.
  """

  @staticmethod
  def _cases():
    import json, pathlib as _p
    fixture = _p.Path(__file__).parent / "fixtures" / "markdown_header_cases.json"
    return json.loads(fixture.read_text(encoding="utf-8"))["cases"]

  def _chunk(self, text, **kwargs):
    from chainforge.rag.chunkers import ChunkingMethodRegistry
    return ChunkingMethodRegistry.get_handler("markdown_header")(text, **kwargs)

  def test_shared_cases(self):
    cases = self._cases()
    assert len(cases) > 0
    for case in cases:
      assert self._chunk(case["input"]) == case["expected"], (
        f"markdown_header diverged from the shared fixture on "
        f"{case['input']!r}"
      )

  def test_none_input(self):
    # Not in the shared fixture: JSON has no way to express Python's None,
    # and the TS side takes null/undefined instead.
    assert self._chunk(None) == [""]
