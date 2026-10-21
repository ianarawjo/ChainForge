"""Every setting a Rerank node method offers must change what /rerank does.

The cross-encoder and Cohere's client are replaced with fakes that record what
they were asked for and score by shared words; the real ones download a model
or call an API. Requests are multipart forms with every setting as a string,
as RerankNode sends them, starting from the defaults its form fills in. See
settings_contract.py, and rerankingSettings.test.ts for the reranker run in the
browser.
"""

import json
import sys
import types

import pytest

from settings_contract import (
    effect_params, form_defaults, registry, server_methods, stale_effects, untested_settings,
)

from chainforge.rag import rerankers

NODE = "reranking"

QUERY = "cat mat"
DOCUMENTS = ["the cat sat", "a mat", "cat on a mat", "dogs bark", "birds sing", "fish swim"]


def overlap(query, document):
    return float(len(set(query.split()) & set(document.split())))


class Fakes:
    def __init__(self):
        self.models = []       # models loaded or requested
        self.batch_sizes = []  # cross-encoder predict batch sizes
        self.cohere_requests = []

    def sentence_transformers(self):
        fakes = self

        class CrossEncoder:
            def __init__(self, model_name, device="cpu"):
                fakes.models.append(model_name)

            def predict(self, pairs, batch_size):
                fakes.batch_sizes.append(batch_size)
                return [overlap(q, d) for q, d in pairs]

        return types.SimpleNamespace(CrossEncoder=CrossEncoder)

    def cohere(self):
        fakes = self

        class ClientV2:
            def __init__(self, api_key):
                pass

            def rerank(self, **request):
                fakes.cohere_requests.append(request)
                ranked = sorted(range(len(request["documents"])),
                                key=lambda i: -overlap(request["query"], request["documents"][i]))
                return types.SimpleNamespace(results=[
                    types.SimpleNamespace(index=i, relevance_score=overlap(request["query"], request["documents"][i]))
                    for i in ranked[:request["top_n"]]])

        return types.SimpleNamespace(ClientV2=ClientV2)


class Runner:
    def __init__(self, client, fakes):
        self.client = client
        self.fakes = fakes

    def rerank(self, method, **settings):
        # RerankNode appends each setting to the form as String(value).
        form = {key: str(value) for key, value in {**form_defaults(NODE, method), **settings}.items()}
        resp = self.client.post("/rerank", data={
            "baseMethod": method, "documents": json.dumps(DOCUMENTS), "query": QUERY,
            "api_keys": json.dumps({"Cohere": "test-key"}), **form,
        })
        assert resp.status_code == 200, resp.get_json()
        return resp.get_json()["reranked_documents"]


EFFECTS, effect = registry()


@effect("cross_encoder", "top_k")
@effect("cohere_rerank", "top_k")
def _top_k(run, method):
    return len(run.rerank(method, top_k=5)), len(run.rerank(method, top_k=2))


@effect("cross_encoder", "model")
def _cross_encoder_model(run, method):
    run.rerank(method)
    base = run.fakes.models[-1]
    run.rerank(method, model="BAAI/bge-reranker-base")
    return base, run.fakes.models[-1]


@effect("cross_encoder", "batch_size")
def _cross_encoder_batch_size(run, method):
    run.rerank(method)
    base = run.fakes.batch_sizes[-1]
    run.rerank(method, batch_size=4)
    return base, run.fakes.batch_sizes[-1]


def _cohere_request_field(run, method, setting, value):
    """What Cohere was sent for one setting, at its default and changed.

    Observe only that setting's own field: a test watching several at once
    passes while any one of them is ignored, as long as another still changes.
    """
    run.rerank(method)
    base = run.fakes.cohere_requests[-1].get(setting)
    run.rerank(method, **{setting: value})
    return base, run.fakes.cohere_requests[-1].get(setting)


@effect("cohere_rerank", "model")
def _cohere_model(run, method):
    return _cohere_request_field(run, method, "model", "rerank-multilingual-v3.0")


@effect("cohere_rerank", "max_tokens_per_doc")
def _cohere_max_tokens_per_doc(run, method):
    return _cohere_request_field(run, method, "max_tokens_per_doc", 512)


# --- The contract ---------------------------------------------------------

@pytest.mark.parametrize("method", sorted(server_methods(NODE)))
def test_every_server_setting_has_a_test_showing_it_matters(method):
    untested = untested_settings(NODE, method, EFFECTS)
    assert untested == [], (
        f"{method} offers settings with no test showing they change reranking: {untested}. "
        "Add an @effect for each, or explain in NO_EFFECT_EXPECTED why it has none.")


def test_no_effect_tests_for_settings_that_no_longer_exist():
    assert stale_effects(NODE, EFFECTS) == []


@pytest.fixture
def run(client, monkeypatch):
    fakes = Fakes()
    monkeypatch.setitem(sys.modules, "sentence_transformers", fakes.sentence_transformers())
    monkeypatch.setitem(sys.modules, "cohere", fakes.cohere())
    rerankers._load_cross_encoder.cache_clear()
    yield Runner(client, fakes)
    rerankers._load_cross_encoder.cache_clear()


@pytest.mark.parametrize("method, setting", effect_params(EFFECTS))
def test_changing_the_setting_changes_reranking(run, method, setting):
    observe, _ = EFFECTS[(method, setting)]
    base, changed = observe(run, method)
    assert base != changed, f"{method}.{setting} had no effect: {base!r}"


def test_cohere_reranks_every_document(run):
    """Regression: max_chunks_per_doc * top_k capped how many documents were even considered."""
    run.rerank("cohere_rerank", top_k=1, max_chunks_per_doc=2)
    assert run.fakes.cohere_requests[-1]["documents"] == DOCUMENTS
