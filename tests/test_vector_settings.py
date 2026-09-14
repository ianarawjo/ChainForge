"""Embedding retrieval settings that the Retrieval node offered but used to ignore.

Each of these was in the settings form and silently had no effect: the
similarity metric on LanceDB, the similarity threshold, the search method, the
in-memory backend, and index paths and modes. Uses `fake_embedder` and
hand-built vectors, so no model is loaded.
"""

import os
from unittest.mock import patch

import numpy as np
import pytest

from conftest import faiss_installed

import chainforge.flask_app as flask_app
from chainforge.rag.retrievers import RetrievalMethodRegistry, uses_existing_index
from chainforge.rag.vector_stores import LancedbVectorStore

FAISS = pytest.param("faiss", marks=[
    pytest.mark.needs_faiss,
    pytest.mark.skipif(not faiss_installed(), reason="faiss not installed (pip install faiss-cpu)"),
])
BACKENDS = ["memory", "lancedb", FAISS]
SAVING_BACKENDS = ["lancedb", FAISS]


def run(chunks, vectors, queries, query_vectors, db_path, **settings):
    handler = RetrievalMethodRegistry.get_handler("embedding")
    return handler(chunks, vectors, queries, query_vectors, settings, db_path)


@pytest.fixture
def corpus(sample_chunks, fake_embedder):
    query = {"text": sample_chunks[0]["text"]}
    return {
        "chunks": sample_chunks,
        "vectors": fake_embedder([c["text"] for c in sample_chunks]),
        "queries": [query],
        "query_vectors": fake_embedder([query["text"]]),
    }


def run_corpus(corpus, db_path, **settings):
    return run(corpus["chunks"], corpus["vectors"], corpus["queries"],
               corpus["query_vectors"], db_path, **settings)


def chunk_ids(results):
    return [h["chunkId"] for h in results[0]["retrieved_chunks"]]


def expected_similarity(metric, a, b):
    """The shared similarity scale; see vector_stores.cosine_to_similarity."""
    a, b = np.asarray(a), np.asarray(b)
    if metric == "cosine":
        return (1 + a @ b / (np.linalg.norm(a) * np.linalg.norm(b))) / 2
    if metric == "dot_product":
        return a @ b
    return 1 / (1 + np.sum((a - b) ** 2))


def index_settings(backend, path, mode):
    if backend == "lancedb":
        return {"storage_backend": "lancedb", "lancedb_path": str(path), "lancedb_mode": mode}
    return {"storage_backend": "faiss", "faiss_path": str(path), "faiss_mode": mode}


@pytest.mark.parametrize("backend", BACKENDS)
class TestSimilarityMetric:

    @pytest.mark.parametrize("metric", ["cosine", "euclidean", "dot_product"])
    def test_scores_follow_the_chosen_metric(self, corpus, temp_db_dir, backend, metric):
        """Regression: LanceDB searched with L2 whatever metric was chosen."""
        results = run_corpus(corpus, temp_db_dir, top_k=3, storage_backend=backend,
                             similarity_metric=metric)
        vector_of = {c["chunkId"]: v for c, v in zip(corpus["chunks"], corpus["vectors"])}
        hits = results[0]["retrieved_chunks"]
        assert len(hits) == 3
        for hit in hits:
            expected = expected_similarity(metric, corpus["query_vectors"][0], vector_of[hit["chunkId"]])
            assert hit["similarity"] == pytest.approx(expected, abs=1e-5)


@pytest.mark.parametrize("backend", BACKENDS)
class TestSimilarityThreshold:

    def test_hits_below_the_threshold_are_dropped(self, corpus, temp_db_dir, backend):
        """Regression: the threshold slider had no effect.

        The query is the first chunk's own text, so only that chunk scores ~100%.
        """
        results = run_corpus(corpus, temp_db_dir, top_k=3, storage_backend=backend,
                             similarity_metric="cosine", similarity_threshold=99.9)
        assert chunk_ids(results) == [corpus["chunks"][0]["chunkId"]]

    def test_without_a_threshold_nothing_is_dropped(self, corpus, temp_db_dir, backend):
        results = run_corpus(corpus, temp_db_dir, top_k=3, storage_backend=backend)
        assert len(chunk_ids(results)) == 3


def _unit(v):
    v = np.asarray(v, dtype=float)
    return (v / np.linalg.norm(v)).tolist()


@pytest.fixture
def near_duplicates():
    """"a" and "b" are near-identical and closest to the query; "c" differs."""
    chunks = [{"text": t, "docTitle": "d", "chunkId": t} for t in ("a", "b", "c")]
    vectors = [_unit([1, 0.2, 0]), _unit([1, 0.2, 0.02]), _unit([0.1, 1, 0])]
    return chunks, vectors, [{"text": "q"}], [_unit([1, 1, 0])]


@pytest.mark.parametrize("backend", BACKENDS)
class TestSearchMethod:

    def test_similarity_returns_the_closest(self, near_duplicates, temp_db_dir, backend):
        results = run(*near_duplicates, temp_db_dir, top_k=2, storage_backend=backend,
                      lancedb_search_method="similarity")
        assert chunk_ids(results) == ["a", "b"]

    def test_mmr_trades_a_near_duplicate_for_variety(self, near_duplicates, temp_db_dir, backend):
        """Regression: MMR could not be reached from the settings form."""
        results = run(*near_duplicates, temp_db_dir, top_k=2, storage_backend=backend,
                      lancedb_search_method="mmr")
        assert chunk_ids(results) == ["a", "c"]

    def test_hybrid_saved_by_older_flows_runs_as_similarity(self, near_duplicates, temp_db_dir, backend):
        results = run(*near_duplicates, temp_db_dir, top_k=2, storage_backend=backend,
                      lancedb_search_method="hybrid")
        assert chunk_ids(results) == ["a", "b"]


class TestInMemoryBackend:

    def test_writes_no_files(self, corpus, tmp_path):
        """Regression: the settings form offered this backend, and choosing it raised."""
        scratch = tmp_path / "scratch.db"
        results = run_corpus(corpus, str(scratch), top_k=2, storage_backend="memory")
        assert len(chunk_ids(results)) == 2
        assert not scratch.exists()

    def test_unknown_backends_are_still_refused(self, corpus, temp_db_dir):
        with pytest.raises(ValueError, match="storage backend"):
            run_corpus(corpus, temp_db_dir, storage_backend="pineapple")


@pytest.mark.parametrize("backend", SAVING_BACKENDS)
class TestIndexLocation:

    def test_building_leaves_other_files_in_the_folder_alone(self, corpus, tmp_path, backend):
        """Regression: opening a store emptied its whole folder."""
        keep = tmp_path / "notes.txt"
        keep.write_text("keep me", encoding="utf-8")
        for _ in range(2):
            run_corpus(corpus, "unused", top_k=2, **index_settings(backend, tmp_path, "create"))
        assert keep.read_text(encoding="utf-8") == "keep me"

    def test_a_saved_index_loads_without_the_chunks(self, corpus, tmp_path, backend):
        """Regression: indexes could be neither saved to a chosen path nor loaded."""
        built = run_corpus(corpus, "unused", top_k=3, **index_settings(backend, tmp_path, "create"))
        loaded = run([], None, corpus["queries"], corpus["query_vectors"], "unused",
                     top_k=3, **index_settings(backend, tmp_path, "load"))
        assert chunk_ids(loaded) == chunk_ids(built)
        assert all(h["docTitle"] for h in loaded[0]["retrieved_chunks"])

    def test_loading_needs_a_path(self, corpus, temp_db_dir, backend):
        with pytest.raises(ValueError, match="needs its path"):
            run([], None, corpus["queries"], corpus["query_vectors"], temp_db_dir,
                **index_settings(backend, "", "load"))

    def test_loading_a_missing_index_raises(self, corpus, tmp_path, backend):
        with pytest.raises(FileNotFoundError):
            run([], None, corpus["queries"], corpus["query_vectors"], "unused",
                **index_settings(backend, tmp_path / "nothing-here", "load"))

    def test_rebuilding_drops_chunks_from_the_previous_build(self, corpus, tmp_path, backend):
        run_corpus(corpus, "unused", top_k=3, **index_settings(backend, tmp_path, "create"))
        first = corpus["chunks"][:1]
        results = run(first, corpus["vectors"][:1], corpus["queries"], corpus["query_vectors"],
                      "unused", top_k=3, **index_settings(backend, tmp_path, "create"))
        assert chunk_ids(results) == [first[0]["chunkId"]]

    def test_each_chunking_method_saves_its_own_index(self, corpus, tmp_path, backend):
        for chunk_method in ("Chunker A", "Chunker B"):
            run_corpus(corpus, "unused", top_k=1, _index_suffix=chunk_method,
                       **index_settings(backend, tmp_path, "create"))
        if backend == "lancedb":
            for table in ("embeddings_Chunker_A", "embeddings_Chunker_B"):
                LancedbVectorStore(db_path=str(tmp_path), table_name=table, db_mode="load")
        else:
            assert (tmp_path / "index_Chunker_A.faiss").exists()
            assert (tmp_path / "index_Chunker_B.faiss").exists()


@pytest.mark.parametrize("backend", BACKENDS)
def test_a_scratch_index_is_rebuilt_each_run(corpus, temp_db_dir, backend):
    run_corpus(corpus, temp_db_dir, top_k=3, storage_backend=backend)
    first = corpus["chunks"][:1]
    results = run(first, corpus["vectors"][:1], corpus["queries"], corpus["query_vectors"],
                  temp_db_dir, top_k=3, storage_backend=backend)
    assert chunk_ids(results) == [first[0]["chunkId"]]


@pytest.mark.needs_faiss
@pytest.mark.skipif(not faiss_installed(), reason="faiss not installed (pip install faiss-cpu)")
class TestFaissPaths:

    def test_path_may_name_a_faiss_file(self, corpus, tmp_path):
        run_corpus(corpus, "unused", top_k=1, storage_backend="faiss",
                   faiss_path=str(tmp_path / "mine.faiss"))
        assert (tmp_path / "mine.faiss").exists()
        assert (tmp_path / "mine_meta.pkl").exists()

    def test_a_loaded_index_keeps_the_metric_it_was_built_with(self, corpus, tmp_path):
        built = run_corpus(corpus, "unused", top_k=3, similarity_metric="cosine",
                           **index_settings("faiss", tmp_path, "create"))
        loaded = run([], None, corpus["queries"], corpus["query_vectors"], "unused", top_k=3,
                     similarity_metric="euclidean", **index_settings("faiss", tmp_path, "load"))
        assert ([h["similarity"] for h in loaded[0]["retrieved_chunks"]]
                == pytest.approx([h["similarity"] for h in built[0]["retrieved_chunks"]]))

    def test_an_index_saved_before_metrics_were_recorded_infers_its_metric(self, corpus, tmp_path):
        """Older sidecar files have no "metric"; their inner-product indexes held normalized vectors."""
        import json
        from chainforge.rag.vector_stores import FaissVectorStore

        store = FaissVectorStore(db_path=str(tmp_path), metric="cosine")
        store.add([c["text"] for c in corpus["chunks"]], embeddings=corpus["vectors"])
        meta_file = tmp_path / "index_meta.pkl"
        payload = json.loads(meta_file.read_text(encoding="utf-8"))
        del payload["metric"]
        meta_file.write_text(json.dumps(payload), encoding="utf-8")

        loaded = FaissVectorStore(db_path=str(tmp_path), metric="l2", db_mode="load")
        assert loaded.metric == "cosine"


class TestLanceDBTableLookup:

    def test_rebuilding_works_among_many_tables(self, corpus, tmp_path):
        """Regression: the existence check never found a table on LanceDB 0.38.

        Its list_tables() returns a response object, not names, and the
        deprecated table_names() stops at 10. Rebuilding then tried to create a
        table that already existed. "zz" sorts after the other tables.
        """
        for i in range(12):
            filler = LancedbVectorStore(db_path=str(tmp_path), table_name=f"t{i:02d}")
            filler.add(["x"], embeddings=corpus["vectors"][:1])
        for _ in range(2):
            store = LancedbVectorStore(db_path=str(tmp_path), table_name="zz")
            store.add([c["text"] for c in corpus["chunks"]], embeddings=corpus["vectors"])
        assert store.count() == len(corpus["chunks"])


class TestUsesExistingIndex:

    @pytest.mark.parametrize("base_method, settings, expected", [
        ("embedding", {"storage_backend": "lancedb", "lancedb_mode": "load"}, True),
        ("embedding", {"storage_backend": "faiss", "faiss_mode": "load"}, True),
        ("embedding", {"storage_backend": "lancedb", "faiss_mode": "load"}, False),
        ("embedding", {"storage_backend": "memory", "lancedb_mode": "load"}, False),
        ("embedding", {"lancedb_mode": "load"}, True),  # LanceDB is the default backend
        ("lancedb_vector_store", {"lancedb_mode": "load"}, True),
        ("faiss_vector_store", {"faiss_mode": "create"}, False),
        ("bm25", {"lancedb_mode": "load"}, False),
    ])
    def test_cases(self, base_method, settings, expected):
        assert uses_existing_index(base_method, settings) is expected


class TestThroughEndpoint:
    """The /retrieve endpoint's handling of saved and loaded indexes."""

    @pytest.fixture
    def embed_calls(self):
        return []

    @pytest.fixture
    def endpoint(self, client, fake_embedder, temp_db_dir, monkeypatch, embed_calls):
        monkeypatch.setattr(flask_app, "MEDIA_DIR", temp_db_dir)

        def spy(texts, model_name=None, path=None, api_keys=None, input_type=None):
            embed_calls.append(input_type)
            return fake_embedder(texts)

        with patch.object(flask_app.EmbeddingMethodRegistry, "get_embedder", return_value=spy):
            yield client

    @staticmethod
    def body(sample_chunks, chunk_methods, **settings):
        method = {"id": "m1", "baseMethod": "embedding", "methodName": "Embeddings",
                  "library": "L", "embeddingProvider": "sentence-transformers",
                  "settings": {"top_k": 3, "similarity_metric": "cosine",
                               "embeddingModel": "fake-model", **settings}}
        chunks = [{"text": c["text"], "fill_history": {"chunkMethod": cm},
                   "metavars": {"docTitle": c["docTitle"], "chunkId": c["chunkId"]}}
                  for cm in chunk_methods for c in sample_chunks]
        return {"methods": [method], "chunks": chunks,
                "queries": [{"text": sample_chunks[0]["text"]}]}

    def test_chunks_and_queries_are_embedded_as_such(self, endpoint, sample_chunks, embed_calls):
        endpoint.post("/retrieve", json=self.body(sample_chunks, ["A"], storage_backend="memory"))
        assert embed_calls == ["document", "query"]

    def test_each_chunking_method_saves_its_own_index(self, endpoint, sample_chunks, tmp_path):
        resp = endpoint.post("/retrieve", json=self.body(
            sample_chunks, ["A", "B"], storage_backend="lancedb", lancedb_path=str(tmp_path)))
        assert resp.status_code == 200, resp.get_json()
        for table in ("embeddings_A", "embeddings_B"):
            LancedbVectorStore(db_path=str(tmp_path), table_name=table, db_mode="load")

    def test_loading_runs_once_without_embedding_chunks(self, endpoint, sample_chunks, tmp_path, embed_calls):
        endpoint.post("/retrieve", json=self.body(
            sample_chunks, ["A"], storage_backend="lancedb", lancedb_path=str(tmp_path)))
        embed_calls.clear()

        resp = endpoint.post("/retrieve", json=self.body(
            sample_chunks, ["A", "B"], storage_backend="lancedb",
            lancedb_path=str(tmp_path), lancedb_table="embeddings", lancedb_mode="load"))
        assert resp.status_code == 200, resp.get_json()
        rows = resp.get_json()
        # One run's hits, not one per chunking method, labelled by their source.
        assert len(rows) == len(sample_chunks)
        assert {r["vars"]["chunkMethod"] for r in rows} == {"(existing index)"}
        assert "document" not in embed_calls
