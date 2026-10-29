# Running the tests

```bash
pip install -e '.[rag]' pytest
pytest
```

Run from the repo root — `pytest.ini` sets `pythonpath = .` so `chainforge` is
importable.

## Day-to-day: skip the slow ones

```bash
pytest -m "not slow"
```

Roughly 4 seconds instead of 30. The `slow` marker covers the tests that load a
real ML model (sentence-transformers, HuggingFace `AutoModel`, cross-encoder
rerankers). Everything else — chunking, keyword retrieval, rank fusion, the
vector stores, and the HTTP endpoints — uses `fake_embedder` from
`conftest.py`, a deterministic hash-based stand-in.

Because `fake_embedder` hashes the text, querying with a chunk's exact text
yields an identical vector, which is what makes ranking assertions meaningful
without a model. It carries **no** semantic meaning: similar strings do not get
similar vectors, so don't write tests that assume otherwise.

## Markers

| Marker | Meaning |
| --- | --- |
| `slow` | Loads a real ML model or hits the network |
| `live_api` | Calls a real provider's API with your key (`test_live_apis.py`) |
| `needs_faiss` | Needs the optional `faiss-cpu` package |

No test calls a paid API unless asked. The few live checks of real providers'
APIs (`test_live_apis.py`, marked `live_api`) run only with
`CHAINFORGE_LIVE_TESTS=1`, and each skips itself without its key
(`OPENAI_API_KEY`, `COHERE_API_KEY`). So a plain `pytest` stays free, even with
keys in your environment. Everything else about those providers is tested with
fakes: the embedders in `test_embedders.py`, the vector stores in
`test_vector_retrievers.py`.

```bash
CHAINFORGE_LIVE_TESTS=1 pytest -m live_api
```

## FAISS tests run separately

```bash
pip install faiss-cpu
pytest -m "needs_faiss and not slow"
```

**`faiss-cpu` cannot share an interpreter with a loaded torch model.** It ships
its own OpenMP runtime (`faiss/.dylibs/libomp.dylib`), and with two libomps
present the embedding tests segfault — reproducibly, and even when faiss is
never imported. Merely having it installed is enough.

So faiss is not part of `[rag]`, and CI installs it only for a second,
dedicated pytest invocation after the main run has finished. If you install it
into your normal dev environment, expect `pytest` to crash; use
`-m "not needs_faiss"` there, or keep faiss in a separate virtualenv.

When adding a FAISS test, use the `needs_faiss` decorator from `conftest.py`
(it applies both the marker and the skip) and keep it on `fake_embedder` — do
not also mark it `slow`.

## Layout

| File | Covers |
| --- | --- |
| `test_chunking.py` | Chunkers: chonkie, tiktoken, NLTK, TextTiling, markdown headers |
| `test_keyword_retrievers.py` | bm25 / tfidf / boolean / overlap, and `simple_preprocess` |
| `test_vector_retrievers.py` | LanceDB + FAISS handlers, fast (`fake_embedder`) |
| `test_retrievers.py` | The same handlers with real embedding models (`slow`) |
| `test_vector_store.py` | `LancedbVectorStore` CRUD |
| `test_fusion.py` | `rrf_fuse` / `weighted_avg_fuse` and the `/retrieve` fusion branch |
| `test_rerankers.py` | Cross-encoder and Cohere reranking |
| `test_endpoints.py` | `/chunk`, `/rerank`, `/getRetrieveProgress`, the RAG-unavailable guard |
| `test_regressions.py` | Previously-shipped bugs, so they stay fixed |
