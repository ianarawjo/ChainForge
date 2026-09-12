"""Tests for the RAG HTTP endpoints: /chunk, /rerank and /getRetrieveProgress.

Only /retrieve had endpoint coverage before, so the request parsing, settings
type-coercion, custom-provider dispatch and error mapping here were untested.
All of it is exercised with spies rather than real models, so the module is
fast.
"""

import io
import json
from unittest.mock import patch

import pytest

import chainforge.flask_app as flask_app


def document(text="One. Two! Three? Four."):
    """The /chunk endpoint takes the text as an uploaded file named 'document'."""
    return (io.BytesIO(text.encode("utf-8")), "doc.txt")


@pytest.fixture
def chunk_spy():
    """Replace the chunker lookup with a spy that records its kwargs."""
    calls = []

    def handler(text, **kwargs):
        calls.append({"text": text, "kwargs": kwargs})
        return ["chunk-a", "chunk-b"]

    with patch.object(flask_app.ChunkingMethodRegistry, "get_handler",
                      return_value=handler):
        yield calls


@pytest.fixture
def rerank_spy():
    calls = []

    def handler(documents, query="", **kwargs):
        calls.append({"documents": documents, "query": query, "kwargs": kwargs})
        return [{"text": d, "score": 1.0 - i, "index": i}
                for i, d in enumerate(documents)]

    with patch.object(flask_app.RerankingMethodRegistry, "get_handler",
                      return_value=handler):
        yield calls


class TestChunkEndpoint:

    def test_happy_path(self, client, chunk_spy):
        resp = client.post("/chunk", data={"baseMethod": "chonkie_token",
                                           "document": document()})
        assert resp.status_code == 200
        assert resp.get_json() == {"chunks": ["chunk-a", "chunk-b"]}

    def test_document_is_decoded_as_utf8(self, client, chunk_spy):
        client.post("/chunk", data={"baseMethod": "x",
                                    "document": document("héllo wörld")})
        assert chunk_spy[0]["text"] == "héllo wörld"

    def test_invalid_utf8_is_tolerated(self, client, chunk_spy):
        resp = client.post("/chunk", data={
            "baseMethod": "x",
            "document": (io.BytesIO(b"ok \xff\xfe bytes"), "doc.txt"),
        })
        assert resp.status_code == 200
        assert "ok" in chunk_spy[0]["text"]

    def test_empty_request_is_rejected(self, client):
        assert client.post("/chunk").status_code == 400

    def test_missing_base_method(self, client):
        resp = client.post("/chunk", data={"document": document()})
        assert resp.status_code == 400
        assert "baseMethod" in resp.get_json()["error"]

    def test_missing_document(self, client):
        resp = client.post("/chunk", data={"baseMethod": "chonkie_token"})
        assert resp.status_code == 400
        assert "document" in resp.get_json()["error"]

    def test_unsupported_method(self, client):
        with patch.object(flask_app.ChunkingMethodRegistry, "get_handler",
                          return_value=None):
            resp = client.post("/chunk", data={"baseMethod": "nope",
                                               "document": document()})
        assert resp.status_code == 400
        assert "Unsupported chunking method" in resp.get_json()["error"]

    def test_value_error_maps_to_400(self, client):
        def boom(text, **kwargs):
            raise ValueError("bad config")
        with patch.object(flask_app.ChunkingMethodRegistry, "get_handler",
                          return_value=boom):
            resp = client.post("/chunk", data={"baseMethod": "x",
                                               "document": document()})
        assert resp.status_code == 400
        assert "bad config" in resp.get_json()["error"]

    def test_import_error_maps_to_500(self, client):
        def boom(text, **kwargs):
            raise ImportError(name="somepkg")
        with patch.object(flask_app.ChunkingMethodRegistry, "get_handler",
                          return_value=boom):
            resp = client.post("/chunk", data={"baseMethod": "x",
                                               "document": document()})
        assert resp.status_code == 500
        assert "somepkg" in resp.get_json()["error"]

    def test_unexpected_error_does_not_leak_details(self, client):
        def boom(text, **kwargs):
            raise RuntimeError("internal detail with a /path/secret")
        with patch.object(flask_app.ChunkingMethodRegistry, "get_handler",
                          return_value=boom):
            resp = client.post("/chunk", data={"baseMethod": "x",
                                               "document": document()})
        assert resp.status_code == 500
        assert "secret" not in resp.get_json()["error"]


class TestChunkSettingsCoercion:
    """Form fields arrive as strings and must be cast before reaching a chunker."""

    def test_known_ints_become_ints(self, client, chunk_spy):
        client.post("/chunk", data={"baseMethod": "x", "document": document(),
                                    "chunk_size": "256", "chunk_overlap": "16",
                                    "top_k": "5"})
        kwargs = chunk_spy[0]["kwargs"]
        assert kwargs["chunk_size"] == 256
        assert kwargs["chunk_overlap"] == 16
        assert kwargs["top_k"] == 5

    def test_known_floats_become_floats(self, client, chunk_spy):
        client.post("/chunk", data={"baseMethod": "x", "document": document(),
                                    "bm25_k1": "1.5", "bm25_b": "0.75"})
        kwargs = chunk_spy[0]["kwargs"]
        assert kwargs["bm25_k1"] == pytest.approx(1.5)
        assert kwargs["bm25_b"] == pytest.approx(0.75)

    @pytest.mark.parametrize("raw,expected", [
        ("true", True), ("True", True), ("yes", True),
        ("false", False), ("no", False), ("", False), ("anything", False),
    ])
    def test_known_bools(self, client, chunk_spy, raw, expected):
        client.post("/chunk", data={"baseMethod": "x", "document": document(),
                                    "keep_separator": raw})
        assert chunk_spy[0]["kwargs"]["keep_separator"] is expected

    def test_unknown_keys_stay_strings(self, client, chunk_spy):
        client.post("/chunk", data={"baseMethod": "x", "document": document(),
                                    "tokenizer": "gpt2"})
        assert chunk_spy[0]["kwargs"]["tokenizer"] == "gpt2"

    def test_base_method_is_not_forwarded_as_a_setting(self, client, chunk_spy):
        client.post("/chunk", data={"baseMethod": "x", "document": document()})
        assert "baseMethod" not in chunk_spy[0]["kwargs"]

    def test_uncastable_value_falls_back_to_the_raw_string(self, client, chunk_spy):
        """A bad int must not 500; it is passed through unchanged."""
        resp = client.post("/chunk", data={"baseMethod": "x", "document": document(),
                                           "chunk_size": "not-a-number"})
        assert resp.status_code == 200
        assert chunk_spy[0]["kwargs"]["chunk_size"] == "not-a-number"


class TestChunkCustomProvider:

    def test_custom_provider_is_dispatched(self, client):
        def custom(text, **kwargs):
            return ["from-custom"]

        with patch.object(flask_app.ChunkingMethodRegistry, "get_handler",
                          return_value=None), \
             patch.object(flask_app.ProviderRegistry, "get",
                          return_value={"func": custom}):
            resp = client.post("/chunk", data={"baseMethod": "__custom/MyChunker",
                                               "document": document()})
        assert resp.status_code == 200
        assert resp.get_json()["chunks"] == ["from-custom"]

    def test_unknown_custom_provider_is_rejected(self, client):
        with patch.object(flask_app.ChunkingMethodRegistry, "get_handler",
                          return_value=None), \
             patch.object(flask_app.ProviderRegistry, "get", return_value=None):
            resp = client.post("/chunk", data={"baseMethod": "__custom/Missing",
                                               "document": document()})
        assert resp.status_code == 400


class TestRerankEndpoint:

    def test_happy_path(self, client, rerank_spy):
        resp = client.post("/rerank", data={
            "baseMethod": "cross_encoder",
            "documents": json.dumps(["doc one", "doc two"]),
            "query": "one",
        })
        assert resp.status_code == 200
        assert len(resp.get_json()["reranked_documents"]) == 2
        assert rerank_spy[0]["documents"] == ["doc one", "doc two"]
        assert rerank_spy[0]["query"] == "one"

    def test_empty_request_is_rejected(self, client):
        assert client.post("/rerank").status_code == 400

    def test_missing_base_method(self, client):
        resp = client.post("/rerank", data={"documents": "[]"})
        assert resp.status_code == 400
        assert "baseMethod" in resp.get_json()["error"]

    def test_missing_documents(self, client):
        resp = client.post("/rerank", data={"baseMethod": "cross_encoder"})
        assert resp.status_code == 400
        assert "documents" in resp.get_json()["error"]

    def test_malformed_documents_json(self, client):
        resp = client.post("/rerank", data={"baseMethod": "cross_encoder",
                                            "documents": "{not json"})
        assert resp.status_code == 400
        assert "Invalid JSON" in resp.get_json()["error"]

    def test_documents_must_be_a_list(self, client):
        resp = client.post("/rerank", data={"baseMethod": "cross_encoder",
                                            "documents": '{"a": 1}'})
        assert resp.status_code == 400
        assert "JSON array" in resp.get_json()["error"]

    def test_malformed_api_keys_json(self, client):
        resp = client.post("/rerank", data={"baseMethod": "cross_encoder",
                                            "documents": "[]",
                                            "api_keys": "{not json"})
        assert resp.status_code == 400

    def test_api_keys_must_be_an_object(self, client):
        resp = client.post("/rerank", data={"baseMethod": "cross_encoder",
                                            "documents": "[]",
                                            "api_keys": "[1, 2]"})
        assert resp.status_code == 400
        assert "api_keys" in resp.get_json()["error"]

    def test_api_keys_are_forwarded_to_the_handler(self, client, rerank_spy):
        client.post("/rerank", data={
            "baseMethod": "cohere_rerank",
            "documents": json.dumps(["a"]),
            "api_keys": json.dumps({"Cohere": "sk-test"}),
        })
        assert rerank_spy[0]["kwargs"]["api_keys"] == {"Cohere": "sk-test"}

    def test_settings_coercion(self, client, rerank_spy):
        client.post("/rerank", data={
            "baseMethod": "cross_encoder",
            "documents": json.dumps(["a"]),
            "top_k": "3", "lambda_param": "0.5", "normalize_scores": "true",
            "model_name": "some/model",
        })
        kwargs = rerank_spy[0]["kwargs"]
        assert kwargs["top_k"] == 3
        assert kwargs["lambda_param"] == pytest.approx(0.5)
        assert kwargs["normalize_scores"] is True
        assert kwargs["model_name"] == "some/model"

    def test_reserved_fields_are_not_forwarded_as_settings(self, client, rerank_spy):
        client.post("/rerank", data={"baseMethod": "cross_encoder",
                                     "documents": json.dumps(["a"]),
                                     "query": "q"})
        for reserved in ("baseMethod", "documents", "query"):
            assert reserved not in rerank_spy[0]["kwargs"]

    def test_unsupported_method(self, client):
        with patch.object(flask_app.RerankingMethodRegistry, "get_handler",
                          return_value=None):
            resp = client.post("/rerank", data={"baseMethod": "nope",
                                                "documents": "[]"})
        assert resp.status_code == 400

    def test_custom_provider_is_dispatched(self, client):
        def custom(documents, query="", **kwargs):
            return [{"text": "custom", "score": 1.0, "index": 0}]

        with patch.object(flask_app.RerankingMethodRegistry, "get_handler",
                          return_value=None), \
             patch.object(flask_app.ProviderRegistry, "get",
                          return_value={"func": custom}):
            resp = client.post("/rerank", data={"baseMethod": "__custom/MyReranker",
                                                "documents": json.dumps(["a"])})
        assert resp.status_code == 200
        assert resp.get_json()["reranked_documents"][0]["text"] == "custom"

    def test_value_error_maps_to_400(self, client):
        def boom(documents, query="", **kwargs):
            raise ValueError("missing API key")
        with patch.object(flask_app.RerankingMethodRegistry, "get_handler",
                          return_value=boom):
            resp = client.post("/rerank", data={"baseMethod": "x",
                                                "documents": "[]"})
        assert resp.status_code == 400
        assert "missing API key" in resp.get_json()["error"]


class TestRetrieveProgressEndpoint:

    def test_returns_a_mapping(self, client):
        resp = client.get("/getRetrieveProgress")
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), dict)

    def test_reports_completion_after_a_run(self, client, sample_chunks, sample_queries):
        body = {
            "methods": [{"id": "m1", "baseMethod": "bm25", "methodName": "BM25",
                         "library": "BM25", "settings": {"top_k": 2}}],
            "chunks": [{"text": c["text"],
                        "fill_history": {"chunkMethod": "cm"},
                        "metavars": {"docTitle": c["docTitle"], "chunkId": c["chunkId"]}}
                       for c in sample_chunks],
            "queries": sample_queries,
        }
        assert client.post("/retrieve", json=body).status_code == 200
        assert client.get("/getRetrieveProgress").get_json() == {"BM25": 100}

    def test_a_new_run_replaces_the_previous_progress(self, client, sample_chunks):
        def run(method_name):
            return client.post("/retrieve", json={
                "methods": [{"id": "m1", "baseMethod": "bm25",
                             "methodName": method_name, "library": "BM25",
                             "settings": {"top_k": 1}}],
                "chunks": [{"text": sample_chunks[0]["text"],
                            "fill_history": {"chunkMethod": "cm"},
                            "metavars": {"chunkId": "c1"}}],
                "queries": [{"text": "python"}],
            })

        run("First")
        run("Second")
        progress = client.get("/getRetrieveProgress").get_json()
        assert "First" not in progress
        assert progress == {"Second": 100}


class TestRetrieveErrorReporting:

    def test_all_methods_failing_reports_why(self, client, sample_chunks):
        """Previously this returned an empty 200, indistinguishable from 'no matches'."""
        def boom(*args, **kwargs):
            raise RuntimeError("retriever exploded")

        with patch.object(flask_app.RetrievalMethodRegistry, "get_handler",
                          return_value=boom):
            resp = client.post("/retrieve", json={
                "methods": [{"id": "m1", "baseMethod": "bm25", "methodName": "BM25",
                             "library": "BM25", "settings": {}}],
                "chunks": [{"text": sample_chunks[0]["text"],
                            "fill_history": {"chunkMethod": "cm"},
                            "metavars": {"chunkId": "c1"}}],
                "queries": [{"text": "python"}],
            })
        assert resp.status_code == 400
        assert "retriever exploded" in resp.get_json()["error"]

    def test_partial_failure_still_returns_results(self, client, sample_chunks):
        """One broken method must not wipe out a working one."""
        real = flask_app.RetrievalMethodRegistry.get_handler("bm25")

        def dispatch(base_method):
            if base_method == "broken":
                def boom(*a, **k):
                    raise RuntimeError("nope")
                return boom
            return real

        chunks = [{"text": c["text"], "fill_history": {"chunkMethod": "cm"},
                   "metavars": {"chunkId": c["chunkId"]}} for c in sample_chunks]
        with patch.object(flask_app.RetrievalMethodRegistry, "get_handler",
                          side_effect=dispatch):
            resp = client.post("/retrieve", json={
                "methods": [
                    {"id": "m1", "baseMethod": "broken", "methodName": "Broken",
                     "library": "X", "settings": {}},
                    {"id": "m2", "baseMethod": "bm25", "methodName": "BM25",
                     "library": "BM25", "settings": {"top_k": 2}},
                ],
                "chunks": chunks,
                "queries": [{"text": "python readability"}],
            })
        assert resp.status_code == 200
        methods = {r["vars"]["retrievalMethod"] for r in resp.get_json()}
        assert methods == {"BM25"}


class TestRagUnavailable:
    """With the [rag] extra absent the registries do not exist.

    These routes are registered unconditionally, so without the guard they
    raised NameError and returned an HTML 500.
    """

    @pytest.fixture
    def rag_disabled(self, monkeypatch):
        monkeypatch.setattr(flask_app, "RAG_AVAILABLE", False)

    def test_chunk_returns_501(self, client, rag_disabled):
        resp = client.post("/chunk", data={"baseMethod": "x", "document": document()})
        assert resp.status_code == 501
        assert "chainforge[rag]" in resp.get_json()["error"]

    def test_retrieve_returns_501(self, client, rag_disabled):
        assert client.post("/retrieve", json={}).status_code == 501

    def test_rerank_returns_501(self, client, rag_disabled):
        resp = client.post("/rerank", data={"baseMethod": "x", "documents": "[]"})
        assert resp.status_code == 501

    def test_progress_returns_501(self, client, rag_disabled):
        assert client.get("/getRetrieveProgress").status_code == 501

    def test_check_rag_available_reports_false(self, client, rag_disabled):
        resp = client.post("/app/checkRagAvailable")
        assert resp.status_code == 200
        assert resp.get_json() == {"rag_available": False}

    def test_core_endpoints_keep_working(self, client, rag_disabled):
        """Disabling RAG must not affect the non-RAG API."""
        resp = client.post("/app/fetchEnvironAPIKeys", json={"keymap": {}})
        assert resp.status_code == 200
