"""The embedders' and rerankers' request handling, with providers faked out.

Real providers are covered by the `slow` and API-key-gated tests in
test_retrievers.py. These pin what is sent: batching, the model or deployment
name, query versus document input, and that local models load once.
"""

import pathlib
import re
import sys
import types
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from chainforge import offline_mode
from chainforge.rag import devices, embeddings, rerankers
from chainforge.rag.embeddings import instruction_prefix

BGE = "Represent this sentence for searching relevant passages: "


class TestInstructionPrefix:

    @pytest.mark.parametrize("model, input_type, expected", [
        ("BAAI/bge-large-en-v1.5", "query", BGE),
        ("BAAI/bge-large-en-v1.5", "document", ""),
        ("BAAI/bge-m3", "query", ""),
        ("intfloat/e5-base-v2", "query", "query: "),
        ("intfloat/multilingual-e5-large", "document", "passage: "),
        ("intfloat/e5-mistral-7b-instruct", "query", ""),
        ("nomic-ai/nomic-embed-text-v1.5", "query", "search_query: "),
        ("nomic-ai/nomic-embed-text-v1.5", "document", "search_document: "),
        ("Snowflake/snowflake-arctic-embed-l-v2.0", "query", "query: "),
        ("mixedbread-ai/mxbai-embed-large-v1", "query", BGE),
        ("sentence-transformers/all-MiniLM-L6-v2", "query", ""),
        ("thenlper/gte-large", "query", ""),
    ])
    def test_cases(self, model, input_type, expected):
        assert instruction_prefix(model, input_type) == expected

    def test_matches_the_browser_model_table(self):
        """The server and browser should embed a query for the same model identically."""
        source = (pathlib.Path(__file__).parents[1] /
                  "chainforge/react-server/src/backend/browserEmbeddings.ts").read_text(encoding="utf-8")
        entries = re.findall(r'id: "([^"]+)",.*?queryPrefix: "([^"]*)"', source, flags=re.S)
        assert entries, "no models found in browserEmbeddings.ts"
        for model_id, query_prefix in entries:
            assert instruction_prefix(model_id, "query") == query_prefix, model_id


def openai_style_client(calls):
    """A client whose embeddings come back out of order, as the API permits."""
    def create(input, model):
        calls.append((len(input), model))
        data = [types.SimpleNamespace(index=i, embedding=[float(text)]) for i, text in enumerate(input)]
        return types.SimpleNamespace(data=list(reversed(data)))

    client = MagicMock()
    client.embeddings.create.side_effect = create
    return client


class TestOpenAIEmbedders:

    def test_texts_are_sent_in_batches_and_kept_in_order(self):
        """Regression: one request was made per text."""
        calls = []
        texts = [str(i) for i in range(300)]
        with patch("openai.OpenAI", return_value=openai_style_client(calls)):
            result = embeddings.openai_embedder(texts, model_name="text-embedding-3-small",
                                                api_keys={"OpenAI": "k"})
        assert calls == [(256, "text-embedding-3-small"), (44, "text-embedding-3-small")]
        assert result == [[float(i)] for i in range(300)]

    def test_azure_sends_the_model_field_as_the_deployment(self):
        """Regression: the deployment came from the local-path field, usually empty."""
        calls = []
        with patch("openai.AzureOpenAI", return_value=openai_style_client(calls)):
            embeddings.azure_openai_embedder(
                ["1", "2"], "my-deployment", None,
                {"Azure_OpenAI": "k", "Azure_OpenAI_Endpoint": "https://example.invalid"})
        assert calls == [(2, "my-deployment")]

    def test_requests_stay_under_the_request_token_limit(self):
        """Regression: 256 long chunks per request could pass OpenAI's 300k-token cap.

        A token is at least one byte, so batches are bounded by UTF-8 bytes.
        """
        calls = []
        texts = ["x" * 100_000 for _ in range(5)]
        with patch("openai.OpenAI", return_value=sized_client(calls)):
            result = embeddings.openai_embedder(texts, "text-embedding-3-small",
                                                api_keys={"OpenAI": "k"})
        assert calls == [2, 2, 1]
        assert len(result) == 5

    def test_azure_sends_at_most_16_inputs_per_request(self):
        """Regression: older Azure deployments reject more than 16 inputs per request."""
        calls = []
        with patch("openai.AzureOpenAI", return_value=sized_client(calls)):
            embeddings.azure_openai_embedder(
                ["t"] * 40, "my-deployment", None,
                {"Azure_OpenAI": "k", "Azure_OpenAI_Endpoint": "https://example.invalid"})
        assert calls == [16, 16, 8]


def sized_client(calls):
    """An OpenAI-style client recording how many texts each request carried."""
    def create(input, model):
        calls.append(len(input))
        return types.SimpleNamespace(
            data=[types.SimpleNamespace(index=i, embedding=[0.0]) for i in range(len(input))])

    client = MagicMock()
    client.embeddings.create.side_effect = create
    return client


class TestCohereEmbedder:

    @pytest.mark.parametrize("input_type, cohere_input_type", [
        ("document", "search_document"),
        ("query", "search_query"),
    ])
    def test_input_type_and_batching(self, input_type, cohere_input_type):
        client = MagicMock()
        client.embed.side_effect = lambda texts, **kwargs: types.SimpleNamespace(
            embeddings=types.SimpleNamespace(float_=[[1.0] for _ in texts]))
        with patch("cohere.ClientV2", return_value=client):
            result = embeddings.cohere_embedder(["t"] * 100, "embed-english-v3.0",
                                                api_keys={"Cohere": "k"}, input_type=input_type)
        assert len(result) == 100
        sent = [call.kwargs for call in client.embed.call_args_list]
        assert [len(s["texts"]) for s in sent] == [96, 4]
        assert {s["input_type"] for s in sent} == {cohere_input_type}


@pytest.fixture
def fake_sentence_transformers(monkeypatch):
    """Stands in for sentence_transformers, so nothing loads torch."""
    monkeypatch.setenv(devices.DEVICE_ENV_VAR, "cpu")
    module = types.SimpleNamespace(SentenceTransformer=MagicMock(), CrossEncoder=MagicMock())
    monkeypatch.setitem(sys.modules, "sentence_transformers", module)
    embeddings._load_sentence_transformer.cache_clear()
    rerankers._load_cross_encoder.cache_clear()
    yield module
    embeddings._load_sentence_transformer.cache_clear()
    rerankers._load_cross_encoder.cache_clear()


class TestLocalModelsLoadOnce:

    def test_sentence_transformer(self, fake_sentence_transformers):
        model = fake_sentence_transformers.SentenceTransformer.return_value
        model.encode.side_effect = lambda texts, batch_size: np.zeros((len(texts), 2))

        embeddings.sentence_transformers_embedder(["a"], "intfloat/e5-small-v2", input_type="document")
        embeddings.sentence_transformers_embedder(["q"], "intfloat/e5-small-v2", input_type="query")

        fake_sentence_transformers.SentenceTransformer.assert_called_once_with("intfloat/e5-small-v2", device="cpu")
        assert [c.args[0] for c in model.encode.call_args_list] == [["passage: a"], ["query: q"]]

    def test_cross_encoder(self, fake_sentence_transformers):
        """Regression: the model was reloaded on every /rerank call."""
        model = fake_sentence_transformers.CrossEncoder.return_value
        model.predict.side_effect = lambda pairs, batch_size: [0.5] * len(pairs)
        rerank = rerankers.RerankingMethodRegistry.get_handler("cross_encoder")

        for _ in range(2):
            rerank(["doc one", "doc two"], "query", model="cross-encoder/x", top_k=2)

        fake_sentence_transformers.CrossEncoder.assert_called_once_with("cross-encoder/x", device="cpu")


class TestHuggingFacePooling:
    """Texts are now embedded in padded batches, which must not change their vectors."""

    @pytest.fixture
    def fake_transformers(self, monkeypatch):
        torch = pytest.importorskip("torch")
        monkeypatch.setenv(devices.DEVICE_ENV_VAR, "cpu")

        class Tokenizer:
            def __call__(self, texts, return_tensors, truncation, padding, max_length):
                # One token per word, whose id is the word's length; 0 pads.
                ids = [[len(word) for word in text.split()] for text in texts]
                width = max(len(row) for row in ids)
                return {
                    "input_ids": torch.tensor([row + [0] * (width - len(row)) for row in ids]),
                    "attention_mask": torch.tensor([[1] * len(row) + [0] * (width - len(row)) for row in ids]),
                }

        class Model:
            def eval(self):
                return self

            def __call__(self, input_ids, attention_mask):
                # Padding positions get a hidden state far from any real token's.
                hidden = input_ids.float() + 100.0 * (attention_mask == 0)
                return types.SimpleNamespace(last_hidden_state=hidden.unsqueeze(-1))

        module = types.SimpleNamespace(
            AutoTokenizer=types.SimpleNamespace(from_pretrained=lambda name: Tokenizer()),
            AutoModel=types.SimpleNamespace(from_pretrained=lambda name: Model()),
        )
        monkeypatch.setitem(sys.modules, "transformers", module)
        embeddings._load_huggingface_model.cache_clear()
        yield
        embeddings._load_huggingface_model.cache_clear()

    def test_padding_does_not_change_a_texts_embedding(self, fake_transformers):
        alone = embeddings.huggingface_embedder(["aa bbb"], "some/model")
        batched = embeddings.huggingface_embedder(["aa bbb", "aa bbb cccc ddddd eeeeee"], "some/model")
        assert alone[0] == pytest.approx([2.5])
        assert batched[0] == pytest.approx(alone[0])


class TestDevice:
    """Local models run on the fastest device there is, or the one asked for."""

    def fake_torch(self, monkeypatch, cuda=False, mps=False):
        torch = types.SimpleNamespace(
            cuda=types.SimpleNamespace(is_available=lambda: cuda),
            backends=types.SimpleNamespace(mps=types.SimpleNamespace(is_available=lambda: mps)),
        )
        monkeypatch.setitem(sys.modules, "torch", torch)
        monkeypatch.delenv(devices.DEVICE_ENV_VAR, raising=False)

    @pytest.mark.parametrize("cuda, mps, expected", [
        (True, True, "cuda"),
        (False, True, "mps"),
        (False, False, "cpu"),
    ])
    def test_prefers_a_gpu(self, monkeypatch, cuda, mps, expected):
        self.fake_torch(monkeypatch, cuda=cuda, mps=mps)
        assert devices.torch_device() == expected

    def test_can_be_chosen(self, monkeypatch):
        self.fake_torch(monkeypatch, cuda=True)
        monkeypatch.setenv(devices.DEVICE_ENV_VAR, "cpu")
        assert devices.torch_device() == "cpu"

    def test_without_torch_is_the_cpu(self, monkeypatch):
        monkeypatch.setitem(sys.modules, "torch", None)
        monkeypatch.delenv(devices.DEVICE_ENV_VAR, raising=False)
        assert devices.torch_device() == "cpu"

    def test_falls_back_to_the_cpu_when_the_gpu_fails(self, monkeypatch, fake_sentence_transformers):
        monkeypatch.setenv(devices.DEVICE_ENV_VAR, "mps")

        def model_for(name, device):
            model = MagicMock()
            if device == "mps":
                model.encode.side_effect = NotImplementedError("aten::op is not implemented for MPS")
            else:
                model.encode.side_effect = lambda texts, batch_size: np.ones((len(texts), 2))
            return model

        fake_sentence_transformers.SentenceTransformer.side_effect = model_for
        assert embeddings.sentence_transformers_embedder(["a"], "m") == [[1.0, 1.0]]
        devices_used = [c.kwargs["device"] for c in fake_sentence_transformers.SentenceTransformer.call_args_list]
        assert devices_used == ["mps", "cpu"]


class TestOllamaEmbedder:

    @pytest.fixture
    def post(self):
        def reply(url, json, **kwargs):
            return MagicMock(status_code=200, json=lambda: {"embeddings": [[0.5] * 3 for _ in json["input"]]})
        with patch("requests.post", side_effect=reply) as post:
            yield post

    def test_batches_and_prefixes(self, post):
        result = embeddings.ollama_embedder(["t"] * 70, "nomic-embed-text", input_type="query")
        assert len(result) == 70
        sent = [c.kwargs for c in post.call_args_list]
        assert [len(s["json"]["input"]) for s in sent] == [64, 6]
        assert sent[0]["json"]["model"] == "nomic-embed-text"
        assert sent[0]["json"]["input"][0] == "search_query: t"
        assert post.call_args_list[0].args[0] == "http://localhost:11434/api/embed"

    @pytest.mark.parametrize("setting, env, expected", [
        ("http://gpu-box:11434/api/", None, "http://gpu-box:11434"),
        ("", "0.0.0.0:11434", "http://localhost:11434"),
        (None, None, "http://localhost:11434"),
    ])
    def test_finds_ollama(self, monkeypatch, setting, env, expected):
        if env is None:
            monkeypatch.delenv("OLLAMA_HOST", raising=False)
        else:
            monkeypatch.setenv("OLLAMA_HOST", env)
        assert embeddings._ollama_base_url({"Ollama_BaseURL": setting}) == expected

    def test_reports_ollamas_error(self):
        resp = MagicMock(status_code=404, json=lambda: {"error": 'model "x" not found, try pulling it first'})
        with patch("requests.post", return_value=resp):
            with pytest.raises(ValueError, match="try pulling it first"):
                embeddings.ollama_embedder(["t"], "x")

    def test_respects_offline_mode(self, post, monkeypatch):
        monkeypatch.setattr(offline_mode, "_enabled", True)
        with pytest.raises(ValueError, match="Offline mode"):
            embeddings.ollama_embedder(["t"], "x", api_keys={"Ollama_BaseURL": "http://8.8.8.8:11434"})
        assert embeddings.ollama_embedder(["t"], "x") == [[0.5] * 3]
