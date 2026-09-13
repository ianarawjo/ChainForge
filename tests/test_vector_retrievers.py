"""Fast tests for the vector-store retrieval handlers.

test_retrievers.py covers the same handlers with real embedding models, which
costs ~1.8s per test and is marked `slow`. This module uses the deterministic
`fake_embedder` instead, so the retrieval plumbing stays covered when running
`pytest -m "not slow"`.

Because the fake embedder hashes text, querying with a chunk's exact text
produces an identical vector -- which makes ranking assertions meaningful
without a real model.
"""

from unittest.mock import patch

import pytest

from conftest import needs_faiss

import chainforge.flask_app as flask_app
from chainforge.rag.retrievers import RetrievalMethodRegistry

LANCEDB_METRICS = ["l2", "cosine", "dot"]


def run(method, chunks, embeddings, queries, query_embeddings, db_path, **settings):
    handler = RetrievalMethodRegistry.get_handler(method)
    assert handler is not None, f"{method} is not registered"
    return handler(chunks, embeddings, queries, query_embeddings, settings, db_path)


@pytest.fixture
def embedded(sample_chunks, sample_queries, fake_embedder):
    """Chunk and query embeddings for the shared sample corpus."""
    return {
        "chunks": sample_chunks,
        "chunk_embeddings": fake_embedder([c["text"] for c in sample_chunks]),
        "queries": sample_queries,
        "query_embeddings": fake_embedder([q["text"] for q in sample_queries]),
    }


class TestLanceDBHandler:

    def test_one_result_per_query(self, embedded, temp_db_dir):
        results = run("lancedb_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir, top_k=3)
        assert len(results) == len(embedded["queries"])
        for r in results:
            assert set(r) == {"query_object", "retrieved_chunks"}

    def test_hits_carry_document_identity(self, embedded, temp_db_dir):
        """Regression: these came back as empty strings.

        The endpoint reads docTitle/chunkId off each hit, and rank fusion keys
        documents by chunkId -- so losing them collapsed every fused group to a
        single row.
        """
        results = run("lancedb_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir, top_k=3)
        hits = results[0]["retrieved_chunks"]
        assert hits, "expected hits"
        assert {h["chunkId"] for h in hits} == {"c1", "c2", "c3"}
        assert all(h["docTitle"] == "languages.md" for h in hits)

    def test_top_k_is_respected(self, embedded, temp_db_dir):
        for k in (1, 2, 3):
            results = run("lancedb_vector_store", embedded["chunks"],
                          embedded["chunk_embeddings"], embedded["queries"],
                          embedded["query_embeddings"], temp_db_dir, top_k=k)
            assert all(len(r["retrieved_chunks"]) <= k for r in results)

    def test_top_k_larger_than_corpus(self, embedded, temp_db_dir):
        results = run("lancedb_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir, top_k=99)
        assert all(len(r["retrieved_chunks"]) <= len(embedded["chunks"])
                   for r in results)

    @pytest.mark.parametrize("metric", LANCEDB_METRICS)
    def test_every_supported_metric_works(self, embedded, temp_db_dir, metric):
        results = run("lancedb_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir,
                      top_k=3, metric=metric)
        assert all(r["retrieved_chunks"] for r in results)

    @pytest.mark.parametrize("metric", ["", "unknown", "euclidean"])
    def test_unsupported_metric_falls_back_instead_of_raising(
        self, embedded, temp_db_dir, metric
    ):
        results = run("lancedb_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir,
                      top_k=2, metric=metric)
        assert len(results) == len(embedded["queries"])

    def test_exact_text_match_ranks_first(self, sample_chunks, temp_db_dir, fake_embedder):
        target = sample_chunks[2]
        queries = [{"text": target["text"]}]
        results = run("lancedb_vector_store", sample_chunks,
                      fake_embedder([c["text"] for c in sample_chunks]),
                      queries, fake_embedder([target["text"]]),
                      temp_db_dir, top_k=3, metric="cosine")
        assert results[0]["retrieved_chunks"][0]["chunkId"] == target["chunkId"]

    def test_scores_are_descending(self, embedded, temp_db_dir):
        results = run("lancedb_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir,
                      top_k=3, metric="cosine")
        sims = [h["similarity"] for h in results[0]["retrieved_chunks"]]
        assert sims == sorted(sims, reverse=True)

    def test_store_persists_across_calls(self, embedded, temp_db_dir):
        """A second call reuses the store on disk rather than rebuilding it."""
        first = run("lancedb_vector_store", embedded["chunks"],
                    embedded["chunk_embeddings"], embedded["queries"],
                    embedded["query_embeddings"], temp_db_dir, top_k=3)
        second = run("lancedb_vector_store", embedded["chunks"],
                     embedded["chunk_embeddings"], embedded["queries"],
                     embedded["query_embeddings"], temp_db_dir, top_k=3)
        assert ([h["chunkId"] for h in first[0]["retrieved_chunks"]]
                == [h["chunkId"] for h in second[0]["retrieved_chunks"]])

    def test_duplicate_text_within_one_batch_is_kept(self, temp_db_dir, fake_embedder):
        """Documents the current de-duplication boundary.

        Ids are a hash of the chunk text, and `add()` only filters against rows
        already in the table -- so duplicates *within a single batch* are both
        inserted and share an id. Retrieval then returns the same text twice.
        """
        chunks = [
            {"text": "same text", "docTitle": "d", "chunkId": "a"},
            {"text": "same text", "docTitle": "d", "chunkId": "b"},
        ]
        results = run("lancedb_vector_store", chunks,
                      fake_embedder([c["text"] for c in chunks]),
                      [{"text": "same text"}], fake_embedder(["same text"]),
                      temp_db_dir, top_k=5)
        hits = results[0]["retrieved_chunks"]
        assert len(hits) == 2
        assert len({h["id"] for h in hits}) == 1

    def test_re_adding_the_same_text_does_not_grow_the_store(self, temp_db_dir, fake_embedder):
        """Across calls, de-duplication does apply."""
        chunks = [{"text": "only text", "docTitle": "d", "chunkId": "a"}]
        embeddings = fake_embedder(["only text"])
        for _ in range(3):
            results = run("lancedb_vector_store", chunks, embeddings,
                          [{"text": "only text"}], fake_embedder(["only text"]),
                          temp_db_dir, top_k=5)
        assert len(results[0]["retrieved_chunks"]) == 1

    def test_empty_chunks_raises(self, temp_db_dir, fake_embedder):
        with pytest.raises(Exception, match="empty"):
            run("lancedb_vector_store", [], [], [{"text": "q"}],
                fake_embedder(["q"]), temp_db_dir, top_k=3)

    def test_empty_queries_raises(self, sample_chunks, temp_db_dir, fake_embedder):
        with pytest.raises(Exception, match="empty"):
            run("lancedb_vector_store", sample_chunks,
                fake_embedder([c["text"] for c in sample_chunks]),
                [], [], temp_db_dir, top_k=3)


class TestEmbeddingHandlerRouting:
    """`embedding` maps friendly metric names and delegates to a backend."""

    @pytest.mark.parametrize("similarity_metric", ["cosine", "euclidean", "dot_product"])
    def test_lancedb_backend(self, embedded, temp_db_dir, similarity_metric):
        results = run("embedding", embedded["chunks"], embedded["chunk_embeddings"],
                      embedded["queries"], embedded["query_embeddings"], temp_db_dir,
                      top_k=2, storage_backend="lancedb",
                      similarity_metric=similarity_metric)
        assert all(r["retrieved_chunks"] for r in results)

    def test_identity_is_preserved_through_the_router(self, embedded, temp_db_dir):
        results = run("embedding", embedded["chunks"], embedded["chunk_embeddings"],
                      embedded["queries"], embedded["query_embeddings"], temp_db_dir,
                      top_k=3, storage_backend="lancedb")
        assert all(h["chunkId"] for h in results[0]["retrieved_chunks"])

    def test_unsupported_backend_raises(self, embedded, temp_db_dir):
        with pytest.raises(ValueError, match="storage backend"):
            run("embedding", embedded["chunks"], embedded["chunk_embeddings"],
                embedded["queries"], embedded["query_embeddings"], temp_db_dir,
                storage_backend="pineapple")


@needs_faiss
class TestFaissHandler:

    def test_one_result_per_query(self, embedded, temp_db_dir):
        results = run("faiss_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir, top_k=3)
        assert len(results) == len(embedded["queries"])

    def test_hits_carry_document_identity(self, embedded, temp_db_dir):
        results = run("faiss_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir, top_k=3)
        hits = results[0]["retrieved_chunks"]
        assert hits
        assert {h["chunkId"] for h in hits} <= {"c1", "c2", "c3"}
        assert all("docTitle" in h for h in hits)

    def test_exact_text_match_ranks_first(self, sample_chunks, temp_db_dir, fake_embedder):
        target = sample_chunks[1]
        results = run("faiss_vector_store", sample_chunks,
                      fake_embedder([c["text"] for c in sample_chunks]),
                      [{"text": target["text"]}], fake_embedder([target["text"]]),
                      temp_db_dir, top_k=3)
        assert results[0]["retrieved_chunks"][0]["chunkId"] == target["chunkId"]

    def test_top_k_is_respected(self, embedded, temp_db_dir):
        results = run("faiss_vector_store", embedded["chunks"],
                      embedded["chunk_embeddings"], embedded["queries"],
                      embedded["query_embeddings"], temp_db_dir, top_k=1)
        assert all(len(r["retrieved_chunks"]) <= 1 for r in results)

    def test_store_persists_across_calls(self, embedded, temp_db_dir):
        run("faiss_vector_store", embedded["chunks"], embedded["chunk_embeddings"],
            embedded["queries"], embedded["query_embeddings"], temp_db_dir, top_k=3)
        again = run("faiss_vector_store", embedded["chunks"],
                    embedded["chunk_embeddings"], embedded["queries"],
                    embedded["query_embeddings"], temp_db_dir, top_k=3)
        assert again[0]["retrieved_chunks"]

    def test_faiss_backend_via_embedding_router(self, embedded, temp_db_dir):
        results = run("embedding", embedded["chunks"], embedded["chunk_embeddings"],
                      embedded["queries"], embedded["query_embeddings"], temp_db_dir,
                      top_k=2, storage_backend="faiss")
        assert all(r["retrieved_chunks"] for r in results)


class TestEmbeddingRetrievalThroughEndpoint:
    """The /retrieve endpoint with embedding-based methods, no real model."""

    @pytest.fixture
    def embedding_client(self, client, fake_embedder, temp_db_dir, monkeypatch):
        monkeypatch.setattr(flask_app, "MEDIA_DIR", temp_db_dir)
        with patch.object(flask_app.EmbeddingMethodRegistry, "get_embedder",
                          return_value=fake_embedder):
            yield client

    def method(self, mid, base="lancedb_vector_store"):
        return {"id": mid, "baseMethod": base, "methodName": mid, "library": "L",
                "embeddingProvider": "sentence-transformers",
                "settings": {"top_k": 3, "metric": "cosine",
                             "embeddingModel": "fake-model"}}

    def chunks(self, sample_chunks):
        return [{"text": c["text"],
                 "fill_history": {"chunkMethod": "cm"},
                 "metavars": {"docTitle": c["docTitle"], "chunkId": c["chunkId"]}}
                for c in sample_chunks]

    def test_response_keeps_document_attribution(self, embedding_client, sample_chunks):
        resp = embedding_client.post("/retrieve", json={
            "methods": [self.method("m1")],
            "chunks": self.chunks(sample_chunks),
            "queries": [{"text": sample_chunks[0]["text"]}],
        })
        assert resp.status_code == 200, resp.get_json()
        rows = resp.get_json()
        assert rows
        assert all(r["metavars"]["chunkId"] for r in rows)
        assert all(r["metavars"]["docTitle"] for r in rows)

    def test_embedding_model_is_recorded(self, embedding_client, sample_chunks):
        resp = embedding_client.post("/retrieve", json={
            "methods": [self.method("m1")],
            "chunks": self.chunks(sample_chunks),
            "queries": [{"text": "anything"}],
        })
        assert all(r["metavars"]["embeddingModel"] == "fake-model"
                   for r in resp.get_json())

    def test_fusion_does_not_collapse_to_one_row(self, embedding_client, sample_chunks):
        """Regression: with chunkId empty, every chunk fused under one doc_id."""
        resp = embedding_client.post("/retrieve", json={
            "methods": [self.method("m1"), self.method("m2", "embedding")],
            "chunks": self.chunks(sample_chunks),
            "queries": [{"text": sample_chunks[0]["text"]}],
            "fusion_enabled": True,
            "linked_groups": [{"id": "g1", "methodKeys": ["m1", "m2"],
                               "fusionMethod": "reciprocal_rank_fusion",
                               "fusionSettings": {}}],
        })
        assert resp.status_code == 200, resp.get_json()
        fused = [r for r in resp.get_json()
                 if r["metavars"].get("retrievalMethodSignature") == "fusion:rrf"]
        assert len(fused) == len(sample_chunks)
        assert len({r["metavars"]["chunkId"] for r in fused}) == len(sample_chunks)

    def test_embedding_failure_is_reported(self, client, temp_db_dir, monkeypatch, sample_chunks):
        monkeypatch.setattr(flask_app, "MEDIA_DIR", temp_db_dir)

        def boom(*args, **kwargs):
            raise RuntimeError("no API key")

        with patch.object(flask_app.EmbeddingMethodRegistry, "get_embedder",
                          return_value=boom):
            resp = client.post("/retrieve", json={
                "methods": [self.method("m1")],
                "chunks": self.chunks(sample_chunks),
                "queries": [{"text": "q"}],
            })
        assert resp.status_code == 400
        assert "no API key" in resp.get_json()["error"]
