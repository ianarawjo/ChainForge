"""Tests for the keyword (non-embedding) retrieval methods.

bm25, tfidf, boolean and overlap all share the signature
`(chunk_objs, query_objs, settings)` and need no models or network, so this
module runs in well under a second. The existing /retrieve endpoint tests
patch `get_handler` with a MagicMock, meaning the ranking logic below was
never actually executed before.
"""

import pytest

from chainforge.rag.retrievers import RetrievalMethodRegistry, normalize_query

# Methods that return the top_k chunks regardless of whether anything matched
# (scores are normalized against the max, which falls back to 1.0).
SCORING_METHODS = ["bm25", "tfidf"]
# Methods that return nothing when no query token overlaps any chunk.
OVERLAP_METHODS = ["boolean", "overlap"]
ALL_METHODS = SCORING_METHODS + OVERLAP_METHODS


@pytest.fixture
def chunks():
    return [
        {"text": "Python emphasizes code readability",
         "docTitle": "languages.md", "chunkId": "c1"},
        {"text": "JavaScript runs in the browser",
         "docTitle": "languages.md", "chunkId": "c2"},
        {"text": "Rust focuses on memory safety",
         "docTitle": "systems.md", "chunkId": "c3"},
    ]


def retrieve(method, chunks, queries, **settings):
    handler = RetrievalMethodRegistry.get_handler(method)
    assert handler is not None, f"{method} is not registered"
    return handler(chunks, queries, settings)


def hits_for(method, chunks, query, **settings):
    return retrieve(method, chunks, [{"text": query}], **settings)[0]["retrieved_chunks"]


class TestContract:
    """Every keyword method must agree on the response shape."""

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_one_result_per_query(self, method, chunks):
        results = retrieve(method, chunks,
                           [{"text": "python"}, {"text": "browser"}], top_k=2)
        assert len(results) == 2
        for r in results:
            assert set(r) >= {"query_object", "retrieved_chunks"}

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_hit_fields(self, method, chunks):
        hit = hits_for(method, chunks, "python readability", top_k=1)[0]
        assert set(hit) == {"text", "similarity", "docTitle", "chunkId"}
        assert isinstance(hit["similarity"], float)

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_metadata_is_carried_through(self, method, chunks):
        hit = hits_for(method, chunks, "memory safety", top_k=1)[0]
        assert hit["chunkId"] == "c3"
        assert hit["docTitle"] == "systems.md"
        assert hit["text"] == "Rust focuses on memory safety"

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_top_k_is_respected(self, method, chunks):
        assert len(hits_for(method, chunks, "python readability", top_k=1)) <= 1
        assert len(hits_for(method, chunks, "python readability", top_k=2)) <= 2

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_top_k_larger_than_corpus(self, method, chunks):
        assert len(hits_for(method, chunks, "python", top_k=99)) <= len(chunks)

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_scores_are_descending(self, method, chunks):
        sims = [h["similarity"] for h in hits_for(method, chunks, "python code", top_k=3)]
        assert sims == sorted(sims, reverse=True)

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_best_hit_is_normalized_to_one(self, method, chunks):
        hits = hits_for(method, chunks, "python readability", top_k=3)
        assert hits[0]["similarity"] == pytest.approx(1.0)

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_empty_chunk_list(self, method):
        assert hits_for(method, [], "anything", top_k=3) == []

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_no_queries(self, method, chunks):
        assert retrieve(method, chunks, [], top_k=3) == []


class TestRanking:

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_ranks_the_matching_chunk_first(self, method, chunks):
        assert hits_for(method, chunks, "python readability", top_k=3)[0]["chunkId"] == "c1"
        assert hits_for(method, chunks, "browser javascript", top_k=3)[0]["chunkId"] == "c2"
        assert hits_for(method, chunks, "memory safety rust", top_k=3)[0]["chunkId"] == "c3"

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_chunk_without_text_is_tolerated(self, method, chunks):
        # NOTE: keep the corpus at 3+ documents. BM25's IDF term is
        # log(N-n+0.5) - log(n+0.5), which is exactly 0 when a term appears in
        # half of a two-document corpus -- every score ties and ordering
        # becomes meaningless.
        corpus = chunks + [{"chunkId": "no_text"}]
        hits = hits_for(method, corpus, "python readability", top_k=4)
        assert hits[0]["chunkId"] == "c1"

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_corpus_of_only_stopwords(self, method):
        """Degenerate corpora must not raise (tfidf builds an empty vocabulary)."""
        corpus = [{"text": "the and of", "chunkId": "s1"}]
        hits_for(method, corpus, "the", top_k=2)  # must not raise


class TestNoMatchBehaviour:
    """The two families differ here deliberately; pin the difference down."""

    @pytest.mark.parametrize("method", SCORING_METHODS)
    def test_scoring_methods_still_return_chunks_at_zero(self, method, chunks):
        hits = hits_for(method, chunks, "zzzz qqqq", top_k=2)
        assert len(hits) == 2
        assert all(h["similarity"] == pytest.approx(0.0) for h in hits)

    @pytest.mark.parametrize("method", OVERLAP_METHODS)
    def test_overlap_methods_return_nothing(self, method, chunks):
        assert hits_for(method, chunks, "zzzz qqqq", top_k=2) == []


class TestBM25Settings:

    def test_k1_and_b_are_accepted(self, chunks):
        hits = hits_for("bm25", chunks, "python readability",
                        top_k=3, bm25_k1=1.2, bm25_b=0.5)
        assert hits[0]["chunkId"] == "c1"

    def test_string_settings_are_coerced(self, chunks):
        """The endpoint may hand settings over as strings from form data."""
        hits = hits_for("bm25", chunks, "python", top_k="2", bm25_k1="1.5", bm25_b="0.75")
        assert len(hits) == 2


class TestBooleanSettings:

    def test_required_match_count_filters_results(self, chunks):
        # One shared token is enough by default...
        assert len(hits_for("boolean", chunks, "python browser", required_match_count=1, top_k=3)) == 2
        # ...but no single chunk contains both of these tokens.
        assert hits_for("boolean", chunks, "python browser", required_match_count=2, top_k=3) == []

    def test_query_shorter_than_required_matches_yields_nothing(self, chunks):
        assert hits_for("boolean", chunks, "python", required_match_count=5, top_k=3) == []


class TestNormalizeQuery:
    """Query objects reach the retrievers in several shapes."""

    def test_plain_string(self):
        q_obj, text = normalize_query("hello")
        assert text == "hello" and q_obj == {"text": "hello"}

    def test_dict_with_text(self):
        q_obj, text = normalize_query({"text": "hello", "extra": 1})
        assert text == "hello" and q_obj["extra"] == 1

    def test_falls_back_to_query_then_prompt(self):
        assert normalize_query({"query": "from query"})[1] == "from query"
        assert normalize_query({"prompt": "from prompt"})[1] == "from prompt"

    def test_text_wins_over_the_others(self):
        assert normalize_query({"text": "a", "query": "b", "prompt": "c"})[1] == "a"

    def test_non_string_is_stringified(self):
        assert normalize_query(42)[1] == "42"

    @pytest.mark.parametrize("method", ALL_METHODS)
    def test_string_queries_work_end_to_end(self, method, chunks):
        results = retrieve(method, chunks, ["python readability"], top_k=1)
        assert results[0]["query_object"] == {"text": "python readability"}
        assert results[0]["retrieved_chunks"][0]["chunkId"] == "c1"


class TestSimplePreprocess:
    """The tokenizer every keyword retriever depends on.

    Vendored from gensim; the only behaviour that matters here is what it does
    to a query, since that decides what can match.
    """

    def test_lowercases_and_splits_on_punctuation(self):
        from chainforge.rag.simple_preprocess import simple_preprocess
        assert simple_preprocess("Hello, World!") == ["hello", "world"]

    def test_drops_digits(self):
        from chainforge.rag.simple_preprocess import simple_preprocess
        assert "42" not in simple_preprocess("answer is 42 today")

    def test_drops_tokens_shorter_than_min_len(self):
        from chainforge.rag.simple_preprocess import simple_preprocess
        # min_len defaults to 2, so single characters are dropped.
        assert simple_preprocess("a bb ccc") == ["bb", "ccc"]

    def test_min_and_max_len_are_configurable(self):
        from chainforge.rag.simple_preprocess import simple_preprocess
        assert simple_preprocess("a bb ccc", min_len=1) == ["a", "bb", "ccc"]
        assert simple_preprocess("bb ccc", max_len=2) == ["bb"]

    def test_deaccent_is_opt_in(self):
        from chainforge.rag.simple_preprocess import simple_preprocess
        assert simple_preprocess("café") == ["café"]
        assert simple_preprocess("café", deacc=True) == ["cafe"]

    def test_empty_input(self):
        from chainforge.rag.simple_preprocess import simple_preprocess
        assert simple_preprocess("") == []

    def test_punctuation_only_input(self):
        from chainforge.rag.simple_preprocess import simple_preprocess
        assert simple_preprocess("!!! ??? ...") == []
