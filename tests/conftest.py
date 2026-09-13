"""Shared fixtures for the ChainForge test suite.

The important one here is `fake_embedder`: a deterministic, dependency-free
stand-in for a real embedding model. Loading sentence-transformers costs ~1.8s
per test, which is fine when the embedder itself is what's under test and pure
waste when it isn't (retrieval ranking, vector-store plumbing, endpoint shapes).
"""

import hashlib
import math
import os
import shutil
import tempfile

import pytest


# --------------------------------------------------------------------------
# Skip helpers, so the reason for a skip reads the same everywhere.
# --------------------------------------------------------------------------

def requires_env(*names):
    """Skip unless every named environment variable is set."""
    missing = [n for n in names if not os.environ.get(n)]
    return pytest.mark.skipif(
        bool(missing),
        reason=f"{', '.join(missing)} not set",
    )


def faiss_installed() -> bool:
    """Whether faiss is importable -- checked WITHOUT importing it.

    faiss-cpu ships its own OpenMP runtime (faiss/.dylibs/libomp.dylib). Having
    a second libomp in the process alongside torch's segfaults on macOS, so we
    avoid pulling faiss in during collection.
    """
    from importlib.util import find_spec
    try:
        return find_spec("faiss") is not None
    except (ImportError, ValueError):
        return False


def needs_faiss(obj):
    """Mark a test as requiring faiss.

    Adds the `needs_faiss` marker so these can be selected with
    `-m needs_faiss` and, importantly, EXCLUDED with `-m "not needs_faiss"`.
    They have to run in their own process: with faiss-cpu installed, loading
    and running a torch model in the same interpreter segfaults (duplicate
    OpenMP runtimes). That is why CI installs faiss only for a separate,
    dedicated pytest invocation, and why nothing marked `needs_faiss` should
    also be marked `slow` -- keep these tests on `fake_embedder`.
    """
    obj = pytest.mark.needs_faiss(obj)
    return pytest.mark.skipif(
        not faiss_installed(),
        reason="faiss not installed (pip install faiss-cpu)",
    )(obj)


# --------------------------------------------------------------------------
# Fast, deterministic embedder
# --------------------------------------------------------------------------

_EMBED_DIM = 16


def _embed_one(text: str, dim: int = _EMBED_DIM):
    """Hash a string into a unit-length vector.

    Deterministic across runs and processes (unlike `hash()`), and similar
    strings do NOT get similar vectors -- so tests must not assume semantic
    behaviour from it. What it does guarantee: identical text embeds
    identically, and different text embeds differently.
    """
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    # Stretch the digest to `dim` floats in [-1, 1].
    raw = [(digest[i % len(digest)] / 127.5) - 1.0 for i in range(dim)]
    norm = math.sqrt(sum(v * v for v in raw)) or 1.0
    return [v / norm for v in raw]


@pytest.fixture
def fake_embedder():
    """An embedding function with the registry's calling convention.

    Real embedders are called as `embedder(texts, model_name, path, api_keys)`
    from flask_app, and as `embedder(texts, model_name=...)` from tests, so
    accept both without caring about the values.
    """
    def _embed(texts, model_name=None, path=None, api_keys=None, **kwargs):
        return [_embed_one(t) for t in texts]

    return _embed


@pytest.fixture
def embedding_dim():
    return _EMBED_DIM


# --------------------------------------------------------------------------
# Temp directories
# --------------------------------------------------------------------------

@pytest.fixture
def temp_db_dir():
    """A scratch directory for on-disk vector stores."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Windows may still hold handles open (LanceDB); never fail a test on cleanup.
    shutil.rmtree(temp_dir, ignore_errors=True)


# --------------------------------------------------------------------------
# Sample corpus, shared by retriever and endpoint tests
# --------------------------------------------------------------------------

@pytest.fixture
def sample_chunks():
    """Chunks in the shape the retrieval handlers expect."""
    return [
        {
            "text": "Python is an interpreted high-level programming language "
                    "that emphasizes code readability.",
            "docTitle": "languages.md",
            "chunkId": "c1",
            "chunkMethod": "test_chunker",
            "chunkLibrary": "test",
        },
        {
            "text": "JavaScript runs in the browser and conforms to the "
                    "ECMAScript specification.",
            "docTitle": "languages.md",
            "chunkId": "c2",
            "chunkMethod": "test_chunker",
            "chunkLibrary": "test",
        },
        {
            "text": "Rust is a systems programming language focused on memory "
                    "safety without a garbage collector.",
            "docTitle": "languages.md",
            "chunkId": "c3",
            "chunkMethod": "test_chunker",
            "chunkLibrary": "test",
        },
    ]


@pytest.fixture
def sample_queries():
    return [
        {"text": "Which language emphasizes readability?"},
        {"text": "What runs in the browser?"},
    ]


@pytest.fixture
def client():
    """Flask test client for the RAG endpoints."""
    from chainforge.flask_app import app

    app.config.update(TESTING=True)
    with app.test_client() as c:
        yield c
