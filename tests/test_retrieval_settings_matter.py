"""Every setting a Retrieval node method offers must change what /retrieve does.

Several settings once sat in the form doing nothing: the LanceDB metric, the
similarity threshold, the search method, index paths and modes, the provider.
Each is listed in tests/fixtures/rag_setting_keys.json (see
settings_contract.py). This module requires that every setting of a method run
on the server has a test below showing that changing it -- and only it --
changes the outcome of a /retrieve request shaped as the node sends it, starting
from the defaults its form fills in. retrievalSettings.test.ts does the same for
methods run in the browser.
"""

import os
from unittest.mock import patch

import numpy as np
import pytest

from conftest import _embed_one, faiss_installed
from settings_contract import (
    effect_params, form_defaults, registry, server_methods, stale_effects, untested_settings,
)

import chainforge.flask_app as flask_app

NODE = "retrieval"

NEEDS_FAISS = [
    pytest.mark.needs_faiss,
    pytest.mark.skipif(not faiss_installed(), reason="faiss not installed (pip install faiss-cpu)"),
]

# "cat" is in fewer than half the documents, so BM25 gives it a positive idf.
KEYWORD_CHUNKS = [
    "cat cat cat",
    "cat sat quietly beside the old wooden garden fence today",
    "dog barks loudly",
    "bird sings",
    "fish swims",
    "the cat and the dog",
    "horse runs",
    "cow eats",
]


def _unit(v):
    v = np.asarray(v, dtype=float)
    return (v / np.linalg.norm(v)).tolist()


# "a" and "b" are near-duplicates and closest to "q"; "c" differs.
VECTORS = {
    "a": _unit([1, 0.2, 0]),
    "b": _unit([1, 0.2, 0.02]),
    "c": _unit([0.1, 1, 0]),
    "q": _unit([1, 1, 0]),
}
EMBEDDING_CHUNKS = ["a", "b", "c"]


class Runner:
    """Sends /retrieve requests and records what the embedders were asked for."""

    def __init__(self, client, media_dir, tmp_path):
        self.client = client
        self.media_dir = media_dir
        self.tmp_path = tmp_path
        self.providers = []
        self.embed_calls = []

    def embedder_for(self, provider):
        self.providers.append(provider)

        def embed(texts, model_name=None, path=None, api_keys=None, input_type=None):
            self.embed_calls.append({"model_name": model_name, "path": path})
            return [VECTORS.get(t) or _embed_one(t) for t in texts]

        return embed

    def retrieve(self, method, settings, chunks=None, query=None):
        spec = {"id": "m1", "baseMethod": method, "methodName": "Method", "library": "L",
                "settings": {**form_defaults(NODE, method), **settings}}
        if method == "embedding":
            # Set from the menu when the method was added.
            spec["embeddingProvider"] = "huggingface"
            chunks = chunks or EMBEDDING_CHUNKS
            query = query or "q"
        body = {
            "methods": [spec],
            "chunks": [{"text": text, "fill_history": {"chunkMethod": "cm"},
                        "metavars": {"docTitle": "doc.md", "chunkId": str(i)}}
                       for i, text in enumerate(chunks or KEYWORD_CHUNKS)],
            "queries": [{"text": query or "cat"}],
        }
        resp = self.client.post("/retrieve", json=body)
        assert resp.status_code == 200, resp.get_json()
        return resp.get_json()

    def ranking(self, method, settings, **kwargs):
        rows = self.retrieve(method, settings, **kwargs)
        return [(r["text"], round(r["eval_res"]["items"][0]["similarity"], 6)) for r in rows]

    def texts(self, method, settings, **kwargs):
        return sorted(r["text"] for r in self.retrieve(method, settings, **kwargs))

    def fresh_dir(self, name):
        path = self.tmp_path / name
        path.mkdir()
        return path


EFFECTS, effect = registry()


# --- Keyword methods ------------------------------------------------------

@effect("bm25", "top_k")
@effect("tfidf", "top_k")
@effect("boolean", "top_k")
@effect("overlap", "top_k")
def _keyword_top_k(run, method):
    return run.ranking(method, {"top_k": 3}), run.ranking(method, {"top_k": 1})


@effect("bm25", "bm25_k1")
def _bm25_k1(run, method):
    return run.ranking(method, {"top_k": 8}), run.ranking(method, {"top_k": 8, "bm25_k1": 0.5})


@effect("bm25", "bm25_b")
def _bm25_b(run, method):
    return run.ranking(method, {"top_k": 8}), run.ranking(method, {"top_k": 8, "bm25_b": 0.0})


@effect("tfidf", "max_features")
def _tfidf_max_features(run, method):
    # With a one-word vocabulary, "fence" is no longer a feature at all.
    return (run.ranking(method, {"top_k": 3, "max_features": 500}, query="fence"),
            run.ranking(method, {"top_k": 3, "max_features": 1}, query="fence"))


@effect("boolean", "required_match_count")
def _boolean_required_matches(run, method):
    return (run.ranking(method, {"top_k": 8, "required_match_count": 1}, query="cat dog"),
            run.ranking(method, {"top_k": 8, "required_match_count": 2}, query="cat dog"))


# --- Server embedding methods ---------------------------------------------

@effect("embedding", "top_k")
def _embedding_top_k(run, method):
    return run.ranking(method, {"top_k": 3}), run.ranking(method, {"top_k": 1})


@effect("embedding", "similarity_threshold")
def _similarity_threshold(run, method):
    return (run.ranking(method, {"similarity_threshold": 0}, query="a"),
            run.ranking(method, {"similarity_threshold": 99.9}, query="a"))


@effect("embedding", "similarity_metric")
def _similarity_metric(run, method):
    return (run.ranking(method, {"similarity_metric": "cosine"}),
            run.ranking(method, {"similarity_metric": "dot_product"}))


@effect("embedding", "lancedb_search_method")
def _search_method(run, method):
    return (run.ranking(method, {"top_k": 2, "lancedb_search_method": "similarity"}),
            run.ranking(method, {"top_k": 2, "lancedb_search_method": "mmr"}))


@effect("embedding", "storage_backend")
def _storage_backend(run, method):
    # The backends score alike by design; what differs is where the index lives.
    run.retrieve(method, {"storage_backend": "memory"})
    in_memory = sorted(os.listdir(run.media_dir))
    run.retrieve(method, {"storage_backend": "lancedb"})
    return in_memory, sorted(os.listdir(run.media_dir))


@effect("embedding", "embeddingProvider")
def _embedding_provider(run, method):
    run.retrieve(method, {"embeddingProvider": "huggingface"})
    base = run.providers[-1]
    run.retrieve(method, {"embeddingProvider": "openai"})
    return base, run.providers[-1]


@effect("embedding", "embeddingModel")
def _embedding_model(run, method):
    run.retrieve(method, {"embeddingModel": "fake-model"})
    base = run.embed_calls[-1]["model_name"]
    run.retrieve(method, {"embeddingModel": "other-model"})
    return base, run.embed_calls[-1]["model_name"]


@effect("embedding", "embeddingLocalPath")
def _embedding_local_path(run, method):
    run.retrieve(method, {"embeddingLocalPath": ""})
    base = run.embed_calls[-1]["path"]
    run.retrieve(method, {"embeddingLocalPath": "/models/my-model"})
    return base, run.embed_calls[-1]["path"]


def _saved_index_path(run, method, backend, path_setting, marker):
    run.retrieve(method, {"storage_backend": backend})
    saved = run.tmp_path / "saved"
    base = (saved / marker).exists()
    run.retrieve(method, {"storage_backend": backend, path_setting: str(saved)})
    return base, (saved / marker).exists()


def _index_mode(run, method, backend, path_setting, mode_setting):
    saved = str(run.tmp_path / "saved")
    settings = {"storage_backend": backend, path_setting: saved}
    run.retrieve(method, {**settings, mode_setting: "create"}, chunks=["a"])
    loaded = run.texts(method, {**settings, mode_setting: "load"}, chunks=["b", "c"])
    built = run.texts(method, {**settings, mode_setting: "create"}, chunks=["b", "c"])
    return built, loaded


@effect("embedding", "lancedb_path")
def _lancedb_path(run, method):
    return _saved_index_path(run, method, "lancedb", "lancedb_path", "embeddings.lance")


@effect("embedding", "lancedb_table")
def _lancedb_table(run, method):
    first, second = run.fresh_dir("first"), run.fresh_dir("second")
    run.retrieve(method, {"storage_backend": "lancedb", "lancedb_path": str(first)})
    run.retrieve(method, {"storage_backend": "lancedb", "lancedb_path": str(second),
                          "lancedb_table": "custom"})
    return sorted(os.listdir(first)), sorted(os.listdir(second))


@effect("embedding", "lancedb_mode")
def _lancedb_mode(run, method):
    return _index_mode(run, method, "lancedb", "lancedb_path", "lancedb_mode")


@effect("embedding", "faiss_path", marks=NEEDS_FAISS)
def _faiss_path(run, method):
    return _saved_index_path(run, method, "faiss", "faiss_path", "index.faiss")


@effect("embedding", "faiss_mode", marks=NEEDS_FAISS)
def _faiss_mode(run, method):
    return _index_mode(run, method, "faiss", "faiss_path", "faiss_mode")


# --- The contract ---------------------------------------------------------

@pytest.mark.parametrize("method", sorted(server_methods(NODE)))
def test_every_server_setting_has_a_test_showing_it_matters(method):
    untested = untested_settings(NODE, method, EFFECTS)
    assert untested == [], (
        f"{method} offers settings with no test showing they change retrieval: {untested}. "
        "Add an @effect for each, or explain in NO_EFFECT_EXPECTED why it has none.")


def test_no_effect_tests_for_settings_that_no_longer_exist():
    assert stale_effects(NODE, EFFECTS) == []


@pytest.fixture
def run(client, tmp_path, monkeypatch):
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    monkeypatch.setattr(flask_app, "MEDIA_DIR", str(media_dir))
    runner = Runner(client, str(media_dir), tmp_path)
    with patch.object(flask_app.EmbeddingMethodRegistry, "get_embedder",
                      side_effect=runner.embedder_for):
        yield runner


@pytest.mark.parametrize("method, setting", effect_params(EFFECTS))
def test_changing_the_setting_changes_retrieval(run, method, setting):
    observe, _ = EFFECTS[(method, setting)]
    base, changed = observe(run, method)
    assert base != changed, f"{method}.{setting} had no effect: {base!r}"
