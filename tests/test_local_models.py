"""Local models: finding servers, offline mode, and the endpoints for them.

Nothing here needs a model server or a network: the probes and outgoing
requests are all faked.
"""

import socket
import sys
from unittest.mock import MagicMock, patch

import pytest

import chainforge.flask_app as flask_app
from chainforge import local_models, offline_mode


@pytest.fixture(autouse=True)
def offline_off():
    """Every test starts, and leaves, with offline mode off and unlocked."""
    offline_mode.lock(False)
    offline_mode.set_enabled(False)
    yield
    offline_mode.lock(False)
    offline_mode.set_enabled(False)


# --------------------------------------------------------------------------
# Offline mode
# --------------------------------------------------------------------------

class TestLocalHosts:

    @pytest.mark.parametrize("host", [
        "localhost", "app.localhost", "127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.9",
        "169.254.0.1", "100.101.102.103", "::1", "[::1]", "fd00::5", "fe80::1", "0.0.0.0",
    ])
    def test_local(self, host):
        assert offline_mode.is_local_hostname(host)

    @pytest.mark.parametrize("host", ["8.8.8.8", "2001:4860:4860::8888", "", None])
    def test_not_local(self, host):
        assert not offline_mode.is_local_hostname(host)

    def test_names_are_local_only_if_everything_they_resolve_to_is(self):
        def resolve(addresses):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (a, 0)) for a in addresses]

        with patch("socket.getaddrinfo", return_value=resolve(["192.168.1.50"])):
            assert offline_mode.is_local_hostname("labserver")
        with patch("socket.getaddrinfo", return_value=resolve(["192.168.1.50", "93.184.216.34"])):
            assert not offline_mode.is_local_hostname("sneaky.example")
        with patch("socket.getaddrinfo", side_effect=socket.gaierror):
            assert not offline_mode.is_local_hostname("nowhere.invalid")

    def test_urls(self):
        assert offline_mode.is_local_url("http://localhost:1234/v1/chat/completions")
        assert not offline_mode.is_local_url("https://8.8.8.8/")
        assert not offline_mode.is_local_url("file:///etc/passwd")


class TestOfflineMode:

    def test_off_blocks_nothing(self):
        assert offline_mode.block_reason_for_url("https://api.openai.com/v1") is None
        assert offline_mode.block_reason_for_embedding_provider("openai") is None
        assert offline_mode.block_reason_for_reranker("cohere_rerank") is None

    def test_on_blocks_online_services_only(self):
        offline_mode.set_enabled(True)
        assert "8.8.8.8" in offline_mode.block_reason_for_url("https://8.8.8.8/v1")
        assert offline_mode.block_reason_for_url("http://127.0.0.1:11434/api/embed") is None
        assert "OpenAI" in offline_mode.block_reason_for_embedding_provider("openai")
        assert offline_mode.block_reason_for_embedding_provider("ollama") is None
        assert offline_mode.block_reason_for_embedding_provider("huggingface") is None
        assert "Cohere" in offline_mode.block_reason_for_reranker("cohere_rerank")
        assert offline_mode.block_reason_for_reranker("cross_encoder") is None

    def test_locked_stays_on(self):
        offline_mode.lock()
        assert offline_mode.set_enabled(False) is True
        assert offline_mode.is_offline()


class TestOfflineEndpoints:

    def test_reports_and_sets_offline_mode(self, client):
        assert client.post("/app/offlineMode", json={}).get_json() == {"offline": False, "locked": False}
        assert client.post("/app/offlineMode", json={"on": True}).get_json()["offline"] is True
        assert offline_mode.is_offline()
        assert client.post("/app/offlineMode", json={"on": False}).get_json()["offline"] is False

    def test_locked_offline_mode_cant_be_turned_off(self, client):
        offline_mode.lock()
        resp = client.post("/app/offlineMode", json={"on": False})
        assert resp.status_code == 403
        assert offline_mode.is_offline()

    def test_page_is_told_when_offline_mode_is_locked(self):
        assert "__CF_OFFLINE_LOCKED" not in flask_app.page_globals_script()
        offline_mode.lock()
        assert "window.__CF_OFFLINE_LOCKED=true;" in flask_app.page_globals_script()

    def test_proxied_fetches_stay_local(self, client):
        offline_mode.set_enabled(True)
        with patch.object(flask_app.py_requests, "post") as post:
            resp = client.post("/app/makeFetchCall",
                               json={"url": "https://8.8.8.8/v1/chat/completions", "headers": {}, "body": {}})
            assert "Offline mode is on" in resp.get_json()["error"]
            post.assert_not_called()

            post.return_value = MagicMock(status_code=200, json=lambda: {"choices": []})
            resp = client.post("/app/makeFetchCall",
                               json={"url": "http://localhost:1234/v1/chat/completions", "headers": {}, "body": {}})
            assert resp.get_json() == {"response": {"choices": []}}

    def test_proxied_fetches_dont_follow_redirects_offline(self, client):
        with patch.object(flask_app.py_requests, "post") as post:
            post.return_value = MagicMock(status_code=200, json=lambda: {})
            request = {"url": "http://localhost:1234/v1/chat/completions", "headers": {}, "body": {}}
            client.post("/app/makeFetchCall", json=request)
            assert post.call_args.kwargs["allow_redirects"] is True
            offline_mode.set_enabled(True)
            client.post("/app/makeFetchCall", json=request)
            assert post.call_args.kwargs["allow_redirects"] is False

    def test_saved_setting_holds_across_restarts(self, client, tmp_path, monkeypatch):
        monkeypatch.setattr(flask_app, "FLOWS_DIR", str(tmp_path))
        monkeypatch.setattr(flask_app, "SECURE_MODE", "off")
        assert flask_app.saved_offline_mode() is False  # nothing saved yet

        # Saving settings puts offline mode into effect on the server...
        client.post("/api/saveConfig/settings", json={"offlineMode": True})
        assert offline_mode.is_offline()
        # ...and a restarted server reads it back before any page connects
        offline_mode.set_enabled(False)
        assert flask_app.saved_offline_mode() is True

    def test_proxied_images_stay_local(self, client):
        offline_mode.set_enabled(True)
        with patch.object(flask_app.py_requests, "get") as get:
            resp = client.get("/api/proxyImage?url=https://8.8.8.8/cat.png")
            assert resp.status_code == 403
            get.assert_not_called()

    def test_online_rerankers_are_refused(self, client):
        offline_mode.set_enabled(True)
        resp = client.post("/rerank", data={"baseMethod": "cohere_rerank", "documents": '["a"]', "query": "q"})
        assert resp.status_code == 403
        assert "Cohere" in resp.get_json()["error"]

    def test_online_embeddings_are_refused(self, client):
        offline_mode.set_enabled(True)
        body = {
            "methods": [{"id": "m1", "baseMethod": "embedding", "methodName": "OpenAI Embedding",
                         "library": "EmbeddingSimilarity", "embeddingProvider": "openai",
                         "settings": {"embeddingModel": "text-embedding-3-small"}}],
            "chunks": [{"text": "a", "fill_history": {"chunkMethod": "cm"}, "metavars": {}}],
            "queries": [{"text": "q"}],
        }
        with patch.object(flask_app.EmbeddingMethodRegistry, "get_embedder") as get_embedder:
            resp = client.post("/retrieve", json=body)
            get_embedder.assert_not_called()
        assert resp.status_code == 403
        assert "OpenAI embeddings" in resp.get_json()["error"]


# --------------------------------------------------------------------------
# Discovery
# --------------------------------------------------------------------------

class TestDiscovery:

    REPLIES = {
        "http://localhost:1234/v1/models": {"data": [{"id": "qwen3-8b", "owned_by": "organization_owner"}]},
        "http://localhost:8080/v1/models": {"data": [{"id": "model.gguf", "owned_by": "llamacpp"}]},
        "http://localhost:8000/v1/models": {"data": [{"id": "never-probed"}]},
    }

    def probe(self, url, timeout=None):
        return self.REPLIES.get(url)

    def test_finds_servers_and_their_models(self):
        with patch.object(local_models, "_get_json", side_effect=self.probe):
            servers = local_models.discover_local_models(own_port=8000)
        assert servers == [
            {"kind": "openai-compatible", "name": "LM Studio", "base_url": "http://localhost:1234/v1",
             "models": ["qwen3-8b"]},
            {"kind": "openai-compatible", "name": "llama.cpp", "base_url": "http://localhost:8080/v1",
             "models": ["model.gguf"]},
        ]

    def test_never_probes_chainforges_own_port(self):
        with patch.object(local_models, "_get_json", side_effect=self.probe) as get:
            local_models.discover_local_models(own_port=8000)
        assert "http://localhost:8000/v1/models" not in [c.args[0] for c in get.call_args_list]

    def test_endpoint(self, client):
        with patch.object(local_models, "_get_json", side_effect=self.probe):
            resp = client.post("/app/discoverLocalModels", json={})
        assert [s["name"] for s in resp.get_json()["servers"]] == ["LM Studio", "llama.cpp"]


def test_serve_offline_flag(monkeypatch):
    from chainforge import app
    monkeypatch.setattr(sys, "argv", ["chainforge", "serve", "--offline"])
    with patch("chainforge.app.run_server") as run_server:
        app.main()
    assert run_server.call_args.kwargs["offline"] is True
