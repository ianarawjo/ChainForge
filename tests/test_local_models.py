"""Local models: finding servers, and the endpoint for it.

Nothing here needs a model server or a network: the probes are all faked.
"""

from unittest.mock import patch

from chainforge import local_models


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
