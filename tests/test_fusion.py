"""Tests for retrieval rank fusion.

Covers the two fuse helpers directly, plus the /retrieve endpoint's fusion
branch. These are pure-dict operations, so the whole module runs in
milliseconds.
"""

import pytest

from chainforge.rag.rerankers import fusion_doc_key, rrf_fuse, weighted_avg_fuse


def item(doc_id, rank, score, text=None):
    """One entry in the per-method staging list built by /retrieve."""
    return {
        "doc_id": doc_id,
        "rank": rank,
        "score": score,
        "obj": {"text": text or f"chunk {doc_id}", "metavars": {"chunkId": doc_id}},
    }


class TestWeightedAverageFuse:

    def test_sums_each_methods_scaled_scores(self):
        # Each method's scores are min-max scaled to [0, 1] before summing.
        fused = weighted_avg_fuse({
            "m1": [item("a", 1, 0.9), item("b", 2, 0.5), item("c", 3, 0.7)],
            "m2": [item("a", 1, 0.7), item("b", 2, 0.1), item("c", 3, 0.1)],
        })
        scores = {doc_id: score for doc_id, score, _ in fused}
        assert scores == pytest.approx({"a": 2.0, "b": 0.0, "c": 0.5})

    def test_a_method_scoring_on_a_larger_scale_does_not_dominate(self):
        """Regression: raw scores were summed, so an unbounded scorer decided alone."""
        fused = weighted_avg_fuse({
            "cosine": [item("a", 1, 0.9), item("b", 2, 0.8)],
            "unbounded": [item("b", 1, 30.0), item("a", 2, 10.0)],
        })
        scores = {doc_id: score for doc_id, score, _ in fused}
        assert scores["a"] == pytest.approx(scores["b"])

    def test_tied_or_single_scores_scale_to_one(self):
        fused = weighted_avg_fuse({"m1": [item("a", 1, 0.3), item("b", 2, 0.3)]})
        assert [score for _, score, _ in fused] == pytest.approx([1.0, 1.0])

    def test_sorted_by_descending_score(self):
        fused = weighted_avg_fuse({
            "m1": [item("low", 2, 0.1), item("high", 1, 0.9)],
        })
        assert [doc_id for doc_id, _, _ in fused] == ["high", "low"]

    def test_weights_are_applied_per_method(self):
        # m2 is weighted to zero, so only m1's ranking should count.
        fused = weighted_avg_fuse(
            {
                "m1": [item("a", 1, 0.4), item("b", 2, 0.2)],
                "m2": [item("b", 1, 100.0), item("a", 2, 0.0)],
            },
            weights_by_method={"m1": 1.0, "m2": 0.0},
        )
        assert [(d, s) for d, s, _ in fused] == [("a", pytest.approx(1.0)), ("b", pytest.approx(0.0))]

    def test_missing_weight_defaults_to_one(self):
        fused = weighted_avg_fuse(
            {"m1": [item("a", 1, 0.25), item("b", 2, 0.1)],
             "m2": [item("a", 1, 0.25), item("b", 2, 0.1)]},
            weights_by_method={"m1": 2.0},  # m2 unspecified
        )
        assert fused[0][1] == pytest.approx(2.0 * 1.0 + 1.0 * 1.0)

    def test_doc_missing_from_one_method_contributes_zero(self):
        fused = weighted_avg_fuse({
            "m1": [item("a", 1, 0.6), item("c", 2, 0.2)],
            "m2": [item("b", 1, 0.5), item("c", 2, 0.1)],
        })
        scores = {doc_id: score for doc_id, score, _ in fused}
        assert scores == pytest.approx({"a": 1.0, "b": 1.0, "c": 0.0})

    def test_object_comes_from_the_best_ranking_method(self):
        fused = weighted_avg_fuse({
            "m1": [item("a", 5, 0.9, text="from m1")],
            "m2": [item("a", 1, 0.1, text="from m2")],
        })
        _, _, obj = fused[0]
        assert obj["text"] == "from m2"

    def test_carries_through_a_response_object(self):
        fused = weighted_avg_fuse({"m1": [item("a", 1, 0.5, text="hello")]})
        _, _, obj = fused[0]
        assert obj["text"] == "hello"

    def test_empty_input(self):
        assert weighted_avg_fuse({}) == []


class TestReciprocalRankFuse:

    def test_uses_one_over_k_plus_rank(self):
        fused = rrf_fuse({"m1": [item("a", 1, 0.0), item("b", 2, 0.0)]}, k=60)
        scores = {doc_id: score for doc_id, score, _ in fused}
        assert scores["a"] == pytest.approx(1 / 61)
        assert scores["b"] == pytest.approx(1 / 62)

    def test_ignores_raw_scores_entirely(self):
        """RRF is rank-based: a huge raw score must not change the outcome."""
        by_rank = rrf_fuse({"m1": [item("a", 1, 0.01), item("b", 2, 999.0)]})
        assert [doc_id for doc_id, _, _ in by_rank] == ["a", "b"]

    def test_agreement_across_methods_wins(self):
        # "a" is ranked 2nd by both methods; "b" is 1st in one and absent elsewhere.
        fused = rrf_fuse({
            "m1": [item("b", 1, 0.0), item("a", 2, 0.0)],
            "m2": [item("c", 1, 0.0), item("a", 2, 0.0)],
        }, k=1)
        assert fused[0][0] == "a"

    def test_k_dampens_rank_differences(self):
        small_k = dict((d, s) for d, s, _ in rrf_fuse({"m1": [item("a", 1, 0.0), item("b", 10, 0.0)]}, k=1))
        large_k = dict((d, s) for d, s, _ in rrf_fuse({"m1": [item("a", 1, 0.0), item("b", 10, 0.0)]}, k=1000))
        assert small_k["a"] / small_k["b"] > large_k["a"] / large_k["b"]

    def test_weights_are_applied_per_method(self):
        fused = rrf_fuse(
            {"m1": [item("a", 1, 0.0)], "m2": [item("b", 1, 0.0)]},
            k=60,
            weights_by_method={"m1": 10.0, "m2": 1.0},
        )
        assert fused[0][0] == "a"

    def test_object_comes_from_the_best_ranking_method(self):
        fused = rrf_fuse({
            "m1": [item("a", 5, 0.0, text="from m1")],
            "m2": [item("a", 1, 0.0, text="from m2")],
        })
        _, _, obj = fused[0]
        assert obj["text"] == "from m2"

    def test_empty_input(self):
        assert rrf_fuse({}) == []


def fusion_request(fusion_method, chunks, queries):
    """A /retrieve body running bm25 + overlap in one linked fusion group."""
    methods = [
        {"id": "m1", "baseMethod": "bm25", "methodName": "BM25",
         "library": "BM25", "settings": {"top_k": 3}},
        {"id": "m2", "baseMethod": "overlap", "methodName": "Keyword Overlap",
         "library": "Overlap", "settings": {"top_k": 3}},
    ]
    group = {"id": "g1", "methodKeys": ["m1", "m2"], "fusionSettings": {}}
    if fusion_method is not None:
        group["fusionMethod"] = fusion_method
    return {
        "methods": methods,
        "chunks": chunks,
        "queries": queries,
        "fusion_enabled": True,
        "linked_groups": [group],
    }


def endpoint_chunks(sample_chunks):
    """sample_chunks re-shaped as the endpoint receives them over HTTP."""
    return [
        {
            "text": c["text"],
            "fill_history": {"chunkMethod": "test_chunker"},
            "metavars": {"docTitle": c["docTitle"], "chunkId": c["chunkId"]},
        }
        for c in sample_chunks
    ]


class TestFusionThroughEndpoint:
    """The /retrieve fusion branch, end to end with real keyword retrievers.

    The method selection here previously read
    `fmethod in ("reciprocal_rank_fusion")` -- a substring test, not tuple
    membership -- so "", "rank" and "fusion" all selected RRF instead of
    falling through to the weighted-average default.
    """

    def signatures(self, client, body):
        resp = client.post("/retrieve", json=body)
        assert resp.status_code == 200, resp.get_json()
        return {
            r["metavars"].get("retrievalMethodSignature")
            for r in resp.get_json()
        }

    def test_rrf_is_selected_by_its_exact_name(self, client, sample_chunks, sample_queries):
        sigs = self.signatures(client, fusion_request(
            "reciprocal_rank_fusion", endpoint_chunks(sample_chunks), sample_queries))
        assert "fusion:rrf" in sigs

    def test_weighted_average_is_selected_by_its_exact_name(self, client, sample_chunks, sample_queries):
        sigs = self.signatures(client, fusion_request(
            "weighted_average", endpoint_chunks(sample_chunks), sample_queries))
        assert "fusion:weighted_average" in sigs
        assert "fusion:rrf" not in sigs

    @pytest.mark.parametrize("fmethod", ["", "rank", "fusion", None, "unknown_method"])
    def test_substrings_and_unknowns_fall_through_to_weighted_average(
        self, client, sample_chunks, sample_queries, fmethod
    ):
        """Regression: any name that is not exactly RRF must not select RRF."""
        sigs = self.signatures(client, fusion_request(
            fmethod, endpoint_chunks(sample_chunks), sample_queries))
        assert "fusion:rrf" not in sigs
        assert "fusion:weighted_average" in sigs

    def test_fused_rows_are_labelled_with_their_source_methods(
        self, client, sample_chunks, sample_queries
    ):
        resp = client.post("/retrieve", json=fusion_request(
            "reciprocal_rank_fusion", endpoint_chunks(sample_chunks), sample_queries))
        fused = [r for r in resp.get_json()
                 if r["metavars"].get("retrievalMethodSignature") == "fusion:rrf"]
        assert fused, "expected at least one fused row"
        for row in fused:
            assert row["vars"]["retrievalMethod"] == "Fused (BM25 + Keyword Overlap)"
            assert row["metavars"]["methodId"] == "group:g1"

    def test_fusion_disabled_produces_no_fused_rows(
        self, client, sample_chunks, sample_queries
    ):
        body = fusion_request("reciprocal_rank_fusion",
                              endpoint_chunks(sample_chunks), sample_queries)
        body["fusion_enabled"] = False
        sigs = self.signatures(client, body)
        assert not any(str(s).startswith("fusion:") for s in sigs)

    @pytest.mark.parametrize("fmethod", ["reciprocal_rank_fusion", "weighted_average"])
    def test_chunks_sharing_an_id_across_documents_stay_separate(self, client, fmethod):
        """Regression: chunkId is a per-document index, and fusion keyed on it alone.

        So chunk 0 of one document fused with chunk 0 of another, and one of
        them vanished from the fused ranking.
        """
        chunks = [
            {"text": text, "fill_history": {"chunkMethod": "cm"},
             "metavars": {"docTitle": doc, "chunkId": "0"}}
            for doc, text in [("a.md", "cats sit on mats"), ("b.md", "dogs chase cats")]
        ]
        resp = client.post("/retrieve", json=fusion_request(fmethod, chunks, [{"text": "cats"}]))
        assert resp.status_code == 200, resp.get_json()
        fused = [r for r in resp.get_json()
                 if str(r["metavars"].get("retrievalMethodSignature")).startswith("fusion:")]
        assert sorted(r["metavars"]["docTitle"] for r in fused) == ["a.md", "b.md"]


class TestFusionDocKey:

    def test_same_chunk_id_in_different_documents_differs(self):
        assert fusion_doc_key("0", "a.md", "text") != fusion_doc_key("0", "b.md", "text")

    def test_same_chunk_from_different_methods_matches(self):
        assert fusion_doc_key("3", "a.md", "text") == fusion_doc_key("3", "a.md", "text")

    def test_missing_parts_are_empty(self):
        assert fusion_doc_key(None, None, None) == fusion_doc_key("", "", "")
