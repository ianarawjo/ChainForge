"""Parity between the Python keyword retrievers and their TypeScript ports.

bm25, boolean and overlap each have two implementations: the Python handlers in
chainforge/rag/retrievers.py, and ports in
chainforge/react-server/src/backend/browserRetrievers.ts that the frontend runs
so retrieval works without a local server. The two must agree, or a flow
retrieves differently depending on how ChainForge was started.

Cases live in tests/fixtures/keyword_retrieval_cases.json and are read by both
suites, so a divergence on either side fails a build.
"""

import json
import pathlib

import pytest

from chainforge.rag.retrievers import RetrievalMethodRegistry
from chainforge.rag.simple_preprocess import simple_preprocess

FIXTURE = (
    pathlib.Path(__file__).parent / "fixtures" / "keyword_retrieval_cases.json"
)


def _fixture():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


PORTED_METHODS = ["bm25", "boolean", "overlap"]


class TestFixtureIsMeaningful:
    """A fixture of empty results would agree with almost any implementation."""

    def test_fixture_exists_and_covers_every_ported_method(self):
        data = _fixture()
        assert len(data["cases"]) > 0
        for method in PORTED_METHODS:
            assert any(c["method"] == method for c in data["cases"]), method

    def test_most_cases_return_hits(self):
        cases = _fixture()["cases"]
        with_hits = [c for c in cases if c["hits"]]
        assert len(with_hits) > len(cases) / 2

    def test_some_case_exercises_bm25s_negative_idf_floor(self):
        # BM25's epsilon floor only applies to a term appearing in more than
        # half the corpus. Without such a query the floor can be deleted
        # without any test noticing -- which is exactly what happened before
        # these queries were added.
        import math

        data = _fixture()
        corpus = data["corpus"]
        n = len(corpus)
        doc_freq = {}
        for chunk in corpus:
            for token in set(simple_preprocess(chunk["text"])):
                doc_freq[token] = doc_freq.get(token, 0) + 1
        negative = {
            t
            for t, f in doc_freq.items()
            if math.log(n - f + 0.5) - math.log(f + 0.5) < 0
        }
        assert negative, "corpus has no term frequent enough for negative idf"

        queried = set()
        for case in data["cases"]:
            queried.update(simple_preprocess(case["query"]))
        assert negative & queried, (
            "no query contains a negative-idf term, so BM25's epsilon floor "
            "is untested"
        )


class TestTokenizerParity:
    def test_shared_tokenizer_cases(self):
        for case in _fixture()["tokenizer"]:
            assert simple_preprocess(case["input"]) == case["tokens"], (
                f"simple_preprocess diverged from the shared fixture on "
                f"{case['input']!r}"
            )


class TestRetrievalParity:
    @pytest.mark.parametrize("method", PORTED_METHODS)
    def test_shared_retrieval_cases(self, method):
        data = _fixture()
        corpus = data["corpus"]
        cases = [c for c in data["cases"] if c["method"] == method]
        assert cases, method

        handler = RetrievalMethodRegistry.get_handler(method)
        for case in cases:
            results = handler(
                corpus, [{"text": case["query"]}], dict(case["settings"])
            )
            actual = [
                {
                    "chunkId": hit["chunkId"],
                    "docTitle": hit["docTitle"],
                    "similarity": round(float(hit["similarity"]), 10),
                }
                for hit in results[0]["retrieved_chunks"]
            ]
            assert actual == case["hits"], (
                f"{method} diverged from the shared fixture for query "
                f"{case['query']!r} with settings {case['settings']}"
            )
