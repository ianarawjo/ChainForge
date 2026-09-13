"""Regression tests for previously-fixed RAG bugs.

Each class here corresponds to a bug that shipped. They are cheap and pin down
behaviour that is easy to reintroduce.
"""

import inspect
import pickle

import pytest

from chainforge.rag.chunkers import _chonkie_kwargs
from chainforge.rag.vector_stores import (
    LancedbVectorStore,
    _deserialize_metadata,
    _serialize_metadata,
    _sql_like_pattern,
    _sql_string_literal,
)


class TestSQLLiteralEscaping:
    """LanceDB filters are SQL expressions built by interpolation.

    A query containing an apostrophe used to produce
    "Unterminated string literal" and abort hybrid search.
    """

    def test_plain_value(self):
        assert _sql_string_literal("abc") == "'abc'"

    def test_single_quote_is_doubled(self):
        assert _sql_string_literal("what's") == "'what''s'"

    def test_quote_soup(self):
        assert _sql_string_literal("' OR 1=1 --") == "''' OR 1=1 --'"

    def test_non_strings_are_stringified(self):
        assert _sql_string_literal(42) == "'42'"

    def test_like_pattern_wraps_in_wildcards(self):
        assert _sql_like_pattern("abc") == "'%abc%'"

    @pytest.mark.parametrize("raw,escaped", [
        ("100%", r"'%100\%%'"),
        ("a_b", r"'%a\_b%'"),
        ("back\\slash", r"'%back\\slash%'"),
    ])
    def test_like_wildcards_are_escaped(self, raw, escaped):
        assert _sql_like_pattern(raw) == escaped

    def test_like_pattern_quotes_are_also_doubled(self):
        assert _sql_like_pattern("what's") == "'%what''s%'"


class TestHybridSearchQuoting:
    """End-to-end: the escaping above has to satisfy the real SQL parser."""

    @pytest.fixture
    def store(self, temp_db_dir, fake_embedder):
        store = LancedbVectorStore(db_path=temp_db_dir, table_name="quoting",
                                   embedding_func=fake_embedder)
        store.add(
            ["Python is what's best for web dev", "Java is 100% verbose",
             "an a_b pattern here"],
            metadata=[{"i": 1}, {"i": 2}, {"i": 3}],
        )
        return store

    @pytest.mark.parametrize("keyword", [
        "best", "what's", "100%", "a_b", "back\\slash", "' OR 1=1 --", '"quoted"',
    ])
    def test_hostile_keywords_do_not_raise(self, store, keyword, fake_embedder):
        query = fake_embedder(["anything"])[0]
        results = store.search(query, k=3, method="hybrid", keyword=keyword)
        assert isinstance(results, list)

    def test_underscore_is_a_literal_not_a_wildcard(self, store):
        rows = store.table.search().where(
            f"text LIKE {_sql_like_pattern('a_b')} ESCAPE '\\'"
        ).to_pandas()
        assert list(rows["text"]) == ["an a_b pattern here"]

    def test_percent_is_a_literal_not_a_wildcard(self, store):
        rows = store.table.search().where(
            f"text LIKE {_sql_like_pattern('100%')} ESCAPE '\\'"
        ).to_pandas()
        assert list(rows["text"]) == ["Java is 100% verbose"]

    def test_get_with_a_quoted_id_returns_none_rather_than_raising(self, store):
        assert store.get("x' OR '1'='1") is None


class TestMetadataSerialization:
    """Metadata moved from pickle to JSON; old stores must still open."""

    def test_round_trip(self):
        meta = {"docTitle": "d", "chunkId": "c1", "n": 3, "nested": {"a": [1, 2]}}
        assert _deserialize_metadata(_serialize_metadata(meta)) == meta

    def test_new_payloads_are_json_not_pickle(self):
        assert _serialize_metadata({"a": 1}) == b'{"a": 1}'

    def test_legacy_pickle_payloads_still_load(self):
        meta = {"docTitle": "legacy", "n": 1}
        assert _deserialize_metadata(pickle.dumps(meta)) == meta

    def test_none_and_empty(self):
        assert _deserialize_metadata(None) == {}
        assert _deserialize_metadata(b"") == {}
        assert _serialize_metadata(None) == b"{}"

    def test_already_decoded_dict_passes_through(self):
        assert _deserialize_metadata({"a": 1}) == {"a": 1}

    def test_unserializable_values_do_not_raise(self):
        class Weird:
            def __str__(self):
                return "weird"

        out = _deserialize_metadata(_serialize_metadata({"obj": Weird()}))
        assert out["obj"] == "weird"

    def test_metadata_survives_a_store_round_trip(self, temp_db_dir, fake_embedder):
        store = LancedbVectorStore(db_path=temp_db_dir, table_name="meta",
                                   embedding_func=fake_embedder)
        store.add(["doc one"], metadata=[{"docTitle": "A", "n": 1}])
        hit = store.search(fake_embedder(["doc one"])[0], k=1)[0]
        assert hit["metadata"] == {"docTitle": "A", "n": 1}


class TestChonkieKwargAdaptation:
    """Chonkie renamed constructor parameters after 1.3.x.

    `tokenizer_or_token_counter` -> `tokenizer` and
    `min_sentences` -> `min_sentences_per_chunk`, which broke three chunkers
    under the unbounded `chonkie>=1.0` requirement.
    """

    def test_renames_to_whatever_the_class_accepts(self):
        class NewStyle:
            def __init__(self, tokenizer=None, chunk_size=None):
                pass

        out = _chonkie_kwargs(NewStyle, tokenizer_or_token_counter="gpt2", chunk_size=8)
        assert out == {"tokenizer": "gpt2", "chunk_size": 8}

    def test_keeps_the_old_name_when_that_is_what_is_accepted(self):
        class OldStyle:
            def __init__(self, tokenizer_or_token_counter=None, chunk_size=None):
                pass

        out = _chonkie_kwargs(OldStyle, tokenizer_or_token_counter="gpt2", chunk_size=8)
        assert out == {"tokenizer_or_token_counter": "gpt2", "chunk_size": 8}

    def test_maps_min_sentences_both_ways(self):
        class New:
            def __init__(self, min_sentences_per_chunk=None):
                pass

        class Old:
            def __init__(self, min_sentences=None):
                pass

        assert _chonkie_kwargs(New, min_sentences=2) == {"min_sentences_per_chunk": 2}
        assert _chonkie_kwargs(Old, min_sentences_per_chunk=2) == {"min_sentences": 2}

    def test_unknown_kwargs_are_dropped_not_passed_on(self, capsys):
        class Narrow:
            def __init__(self, chunk_size=None):
                pass

        out = _chonkie_kwargs(Narrow, chunk_size=4, nonexistent_option=1)
        assert out == {"chunk_size": 4}
        assert "nonexistent_option" in capsys.readouterr().err

    def test_uninspectable_callable_passes_kwargs_through(self, monkeypatch):
        """When the signature cannot be read, defer to Chonkie's own errors."""
        def refuse(_):
            raise ValueError("no signature available")

        monkeypatch.setattr(inspect, "signature", refuse)
        assert _chonkie_kwargs(object, chunk_size=4) == {"chunk_size": 4}

    def test_warning_path_survives_a_nameless_callable(self, capsys):
        """The helper must not assume it was handed a class with __name__."""
        out = _chonkie_kwargs(object(), chunk_size=4)
        assert out == {}
        assert "chunk_size" in capsys.readouterr().err

    @pytest.mark.parametrize("method", ["chonkie_sentence", "chonkie_recursive"])
    def test_affected_chunkers_run_against_the_installed_chonkie(self, method):
        """These raised TypeError on chonkie >= 1.4."""
        from chainforge.rag.chunkers import ChunkingMethodRegistry

        handler = ChunkingMethodRegistry.get_handler(method)
        chunks = handler("One. Two! Three? Four. Five. " * 8, chunk_size=64)
        assert chunks and all(isinstance(c, str) for c in chunks)

    def test_installed_chonkie_matches_one_of_the_known_spellings(self):
        """Fail loudly if Chonkie renames these again."""
        from chonkie import SentenceChunker

        params = set(inspect.signature(SentenceChunker.__init__).parameters)
        assert params & {"tokenizer", "tokenizer_or_token_counter"}, (
            f"SentenceChunker takes neither known tokenizer kwarg: {sorted(params)}"
        )
