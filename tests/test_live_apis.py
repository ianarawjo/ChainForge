"""Live checks against real providers' APIs, made with your own API keys.

Everything ChainForge does with these providers' replies is tested without
them: the embedders with fake clients (test_embedders.py), and the vector
stores with a fake embedder (test_vector_retrievers.py). These only check that
each provider's real API still answers as ChainForge expects. Each call costs
a tiny amount and needs the network, so they run only when asked, not merely
because a key happens to be in your environment:

    CHAINFORGE_LIVE_TESTS=1 pytest -m live_api

A provider's check also skips itself when its key isn't set.
"""

import math
import os

import pytest

from chainforge.rag.embeddings import EmbeddingMethodRegistry

pytestmark = [
    pytest.mark.live_api,
    pytest.mark.skipif(os.environ.get("CHAINFORGE_LIVE_TESTS") != "1",
                       reason="calls a paid API: set CHAINFORGE_LIVE_TESTS=1 to run"),
]

TEXTS = ["Python is a programming language.", "The sky is blue."]


def needs_key(name):
    return pytest.mark.skipif(not os.environ.get(name), reason=f"{name} not set")


def check_vectors(vectors, dim):
    assert len(vectors) == len(TEXTS)
    assert all(len(v) == dim for v in vectors)
    assert all(math.isfinite(x) for v in vectors for x in v)
    assert vectors[0] != vectors[1]


@needs_key("OPENAI_API_KEY")
def test_openai_embeddings():
    embed = EmbeddingMethodRegistry.get_embedder("openai")
    vectors = embed(TEXTS, model_name="text-embedding-3-small",
                    api_keys={"OpenAI": os.environ["OPENAI_API_KEY"]})
    check_vectors(vectors, 1536)


@needs_key("COHERE_API_KEY")
def test_cohere_embeddings():
    embed = EmbeddingMethodRegistry.get_embedder("cohere")
    vectors = embed(TEXTS, model_name="embed-english-v3.0",
                    api_keys={"Cohere": os.environ["COHERE_API_KEY"]})
    check_vectors(vectors, 1024)
