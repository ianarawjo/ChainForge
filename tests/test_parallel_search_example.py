"""Exercise the optional example through the custom-provider loader and MCP SDK."""

import asyncio
import json
from pathlib import Path

import pytest

pytest.importorskip("mcp", reason="Install examples/requirements-parallel-search.txt")
import httpx

import chainforge.flask_app as server
from chainforge.providers import ProviderRegistry


NAME = "Parallel Web Search"
EXAMPLE = Path(__file__).resolve().parents[1] / "chainforge/examples/custom_provider_parallel.py"
EVIDENCE = {"results": [{
    "url": "https://www.python.org/downloads/",
    "title": "Download Python",
    "excerpts": ["Python release information."],
}]}


@pytest.fixture
def loaded(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "FLOWS_DIR", str(tmp_path))
    monkeypatch.setattr(ProviderRegistry, "_registry", {})
    monkeypatch.setattr(ProviderRegistry, "_last_updated", {})
    monkeypatch.setattr(ProviderRegistry, "_curr_script_id", "0")
    ProviderRegistry.register(lambda **kw: "unchanged", name="Existing", category="model")
    client = server.app.test_client()
    client.environ_base["HTTP_" + server.TOKEN_HEADER.upper().replace("-", "_")] = server.SESSION_TOKEN
    result = client.post("/app/initCustomProvider", json={"code": EXAMPLE.read_text()}).get_json()
    assert "error" not in result
    assert {p["name"] for p in result["providers"]} == {NAME, "Existing"}
    assert ProviderRegistry.get("Existing")["func"]() == "unchanged"
    assert len(list((tmp_path / "provider_scripts").glob("*.py"))) == 1
    return client, ProviderRegistry.get(NAME)["func"]


@pytest.fixture
def wire(monkeypatch):
    requests = []
    state = {"isError": False, "content": [{"type": "text", "text": json.dumps(EVIDENCE)}]}
    real_client = httpx.AsyncClient

    async def handle(request):
        assert str(request.url) == "https://search.parallel.ai/mcp"
        assert request.headers["User-Agent"] == (
            "ChainForge-Parallel-Example/1.0 (https://github.com/ianarawjo/ChainForge)"
        )
        assert "Authorization" not in request.headers
        body = json.loads(request.content)
        requests.append(body)
        method = body["method"]
        if method == "notifications/initialized":
            return httpx.Response(202)
        if method == "initialize":
            result = {"protocolVersion": body["params"]["protocolVersion"],
                      "capabilities": {"tools": {}},
                      "serverInfo": {"name": "fixture", "version": "1"}}
        elif method == "tools/list":
            result = {"tools": [{"name": "web_search", "inputSchema": {"type": "object"}}]}
        elif method == "tools/call":
            if "on_call" in state:
                await state["on_call"]()
            result = {"content": state["content"], "isError": state["isError"]}
        else:
            raise AssertionError(f"Unexpected MCP method: {method}")
        return httpx.Response(200, json={"jsonrpc": "2.0", "id": body["id"], "result": result})

    def make_client(**kwargs):
        return real_client(transport=httpx.MockTransport(handle), trust_env=False, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", make_client)
    return requests, state


def call(client, **params):
    return client.post("/app/callCustomProvider", json={
        "name": NAME,
        "params": {"prompt": "Python latest stable release features", "model": None,
                   "temperature": 1, "images": [], **params},
    }).get_json()


def test_loader_search_and_reuse_session(loaded, wire):
    client, provider = loaded
    requests, _ = wire
    for query in ("Python latest stable release features", "Python stable release security updates"):
        response = call(client, prompt=query)
        # A plain response string preserves source URLs and excerpts for the next Prompt node.
        assert json.loads(response["response"]) == EVIDENCE
    calls = [r["params"] for r in requests if r["method"] == "tools/call"]
    assert len(calls) == 2
    assert all(c["name"] == "web_search" for c in calls)
    assert calls[0]["arguments"] == {
        "objective": "Python latest stable release features",
        "search_queries": ["Python latest stable release features"],
        "session_id": provider.session_id,
    }
    assert calls[1]["arguments"]["session_id"] == provider.session_id
    assert calls[1]["arguments"]["search_queries"] == ["Python stable release security updates"]


@pytest.mark.parametrize("params", [
    {"prompt": " "}, {"prompt": None},
    {"chat_history": [{"role": "user", "content": "previous turn"}]},
    {"images": ["image-data"]},
])
def test_rejects_unsupported_input_before_network(loaded, wire, params):
    requests, _ = wire
    assert "error" in call(loaded[0], **params)
    assert requests == []


def test_tool_error_is_not_evidence_or_retried(loaded, wire):
    requests, state = wire
    state.update(isError=True, content=[{"type": "text", "text": "Rate limit exceeded"}])
    response = call(loaded[0])
    assert "Rate limit exceeded" in response["error"]
    assert "response" not in response
    assert sum(r["method"] == "tools/call" for r in requests) == 1


def test_empty_text_is_an_error(loaded, wire):
    wire[1]["content"] = []
    assert "returned no text" in call(loaded[0])["error"]


def test_timeout_cancels_inflight_request(loaded, wire):
    cancelled = []

    async def wait():
        try:
            await asyncio.sleep(10)
        finally:
            cancelled.append(True)

    loaded[1].timeout_seconds = 0.05
    wire[1]["on_call"] = wait
    response = call(loaded[0])
    assert "timed out" in response["error"]
    assert cancelled == [True]


def test_async_cancellation_propagates_and_cleans_up(loaded, wire):
    async def scenario():
        started = asyncio.Event()
        cancelled = []

        async def wait():
            started.set()
            try:
                await asyncio.sleep(10)
            finally:
                cancelled.append(True)

        wire[1]["on_call"] = wait
        task = asyncio.create_task(loaded[1]._search("Python release security updates"))
        await asyncio.wait_for(started.wait(), 2)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert cancelled == [True]

    asyncio.run(scenario())
