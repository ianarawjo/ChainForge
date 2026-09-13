"""Tests that only ChainForge's own pages can use its server.

Covers the checks in chainforge/local_access.py and how flask_app applies them:
the Host header (DNS rebinding), the Origin header (other sites) and the session
token (anything else that can reach localhost).
"""

import sys
from unittest.mock import patch

import pytest

import chainforge.flask_app as flask_app
from chainforge.local_access import (
    TOKEN_HEADER,
    allowed_hostnames,
    hostname_of,
    normalize_origin,
    origin_allowed,
    parse_list,
    token_valid,
)


class TestHostnames:

    @pytest.mark.parametrize("host, name", [
        ("localhost:8000", "localhost"),
        ("LOCALHOST", "localhost"),
        ("127.0.0.1:8000", "127.0.0.1"),
        ("[::1]:8000", "::1"),
        ("example.com.", "example.com"),
    ])
    def test_hostname_of(self, host, name):
        assert hostname_of(host) == name

    def test_loopback_names_are_always_allowed(self):
        assert allowed_hostnames("localhost") == {"localhost", "127.0.0.1", "::1"}

    def test_a_specific_bind_host_is_allowed(self):
        assert "192.168.1.20" in allowed_hostnames("192.168.1.20")

    def test_binding_to_every_interface_allows_no_extra_names(self):
        assert allowed_hostnames("0.0.0.0") == {"localhost", "127.0.0.1", "::1"}

    def test_extra_names(self):
        assert {"cf.example.org", "10.0.0.5"} <= allowed_hostnames("0.0.0.0", ["cf.example.org:8000", " 10.0.0.5 "])

    def test_parse_list(self):
        assert parse_list(" a, b,,c ") == ["a", "b", "c"]
        assert parse_list(None) == []


class TestOrigins:

    @pytest.mark.parametrize("origin, normalized", [
        ("http://localhost:3000", "http://localhost:3000"),
        ("HTTP://LocalHost:3000/", "http://localhost:3000"),
        ("https://example.com:443", "https://example.com"),
        ("http://[::1]:8000", "http://[::1]:8000"),
        ("null", None),
        ("file:///etc/passwd", None),
        ("", None),
    ])
    def test_normalize_origin(self, origin, normalized):
        assert normalize_origin(origin) == normalized

    def test_no_origin_header_is_allowed(self):
        assert origin_allowed(None, "http", "localhost:8000", set())

    def test_the_page_itself_is_allowed(self):
        assert origin_allowed("http://localhost:8000", "http", "localhost:8000", set())

    def test_https_page_behind_a_proxy_is_allowed(self):
        assert origin_allowed("https://cf.example.org", "http", "cf.example.org", set())

    def test_another_site_is_refused(self):
        assert not origin_allowed("https://evil.example", "http", "localhost:8000", set())

    def test_another_port_on_localhost_is_refused(self):
        # A different local server is a different site.
        assert not origin_allowed("http://localhost:3000", "http", "localhost:8000", set())

    def test_an_allowed_dev_origin(self):
        assert origin_allowed("http://localhost:3000", "http", "localhost:8000", {"http://localhost:3000"})

    def test_opaque_origins_are_refused(self):
        assert not origin_allowed("null", "http", "localhost:8000", set())


def test_token_valid():
    assert token_valid("abc", "abc")
    assert not token_valid("abd", "abc")
    assert not token_valid(None, "abc")
    assert not token_valid("", "")


@pytest.fixture
def server(monkeypatch):
    """flask_app configured as `chainforge serve` would be on localhost."""
    monkeypatch.setattr(flask_app, "SESSION_TOKEN", "test-token")
    monkeypatch.setattr(flask_app, "ALLOWED_HOSTNAMES", allowed_hostnames("localhost"))
    monkeypatch.setattr(flask_app, "DEV_ORIGINS", set())
    flask_app.app.config.update(TESTING=True)
    return flask_app.app.test_client()


TOKEN = {TOKEN_HEADER: "test-token"}

# Endpoints that must never answer without the token, with a request each.
PROTECTED = [
    ("post", "/app/executepy", {"json": {"id": "x", "code": "def evaluate(r):\n  return 1", "responses": [], "scope": "response"}}),
    ("post", "/app/fetchEnvironAPIKeys", {}),
    ("post", "/app/initCustomProvider", {"json": {"code": "@provider"}}),
    ("post", "/app/loadCachedCustomProviders", {}),
    ("post", "/app/makeFetchCall", {"json": {"url": "http://127.0.0.1:1/", "headers": {}, "body": {}}}),
    ("get", "/api/getConfig/settings", {}),
    ("post", "/api/saveConfig/settings", {"json": {}}),
    ("get", "/api/flows", {}),
    ("delete", "/api/flows/some-flow", {}),
    ("get", "/api/proxyImage?url=http://127.0.0.1:1/x.png", {}),
    ("get", "/media/anything.png", {}),
    ("post", "/upload", {}),
]


class TestSessionToken:

    @pytest.mark.parametrize("method, path, kwargs", PROTECTED)
    def test_refused_without_the_token(self, server, method, path, kwargs):
        resp = getattr(server, method)(path, **kwargs)
        assert resp.status_code == 403
        assert "session token" in resp.get_json()["error"]

    @pytest.mark.parametrize("method, path, kwargs", PROTECTED)
    def test_refused_with_a_wrong_token(self, server, method, path, kwargs):
        resp = getattr(server, method)(path, headers={TOKEN_HEADER: "guess"}, **kwargs)
        assert resp.status_code == 403

    def test_environment_api_keys_need_the_token(self, server, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-secret")
        assert "sk-secret" not in server.post("/app/fetchEnvironAPIKeys").get_data(as_text=True)
        resp = server.post("/app/fetchEnvironAPIKeys", headers=TOKEN)
        assert resp.status_code == 200
        assert resp.get_json()["OpenAI"] == "sk-secret"

    def test_python_evaluation_still_works_with_the_token(self, server):
        resp = server.post("/app/executepy", headers=TOKEN, json={
            "id": "x", "code": "def evaluate(response):\n  return len(response.text)",
            "responses": [{"responses": ["four"], "prompt": "p", "vars": {}, "llm": "m"}],
            "scope": "response",
        })
        assert resp.status_code == 200
        assert resp.get_json()["responses"][0]["eval_res"]["items"] == [4]

    def test_the_page_needs_no_token_and_carries_it(self, server):
        with patch.object(flask_app, "render_template", return_value="<!doctype html><html><head><title>CF</title></head><body></body></html>"):
            resp = server.get("/")
        assert resp.status_code == 200
        assert 'window.__CF_SESSION_TOKEN="test-token";' in resp.get_data(as_text=True)

    def test_bundled_example_flows_need_no_token(self, server):
        assert server.get("/examples/does-not-exist.cfzip").status_code == 404

    def test_unknown_paths_are_refused_rather_than_explored(self, server):
        assert server.get("/no/such/route").status_code == 403


def _example_url(rule):
    """A concrete URL for a Flask rule, with placeholder values for its variables."""
    url = rule.rule
    for name in rule.arguments:
        url = url.replace(f"<path:{name}>", "x").replace(f"<{name}>", "x")
    return url


def test_every_route_but_the_public_ones_requires_the_token(server):
    # Guards against a route added later that forgets about the token.
    checked = 0
    for rule in flask_app.app.url_map.iter_rules():
        if rule.endpoint in flask_app.PUBLIC_ENDPOINTS:
            continue
        for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            resp = server.open(_example_url(rule), method=method)
            assert resp.status_code == 403, f"{method} {rule.rule} answered {resp.status_code} without a token"
            checked += 1
    assert checked > 20


def test_the_public_routes_are_only_the_page_its_assets_examples_and_dev_token():
    assert flask_app.PUBLIC_ENDPOINTS == {"index", "static", "serve_cfzip", "session_token"}


class TestHostHeader:

    def test_dns_rebinding_is_refused_even_with_the_token(self, server):
        resp = server.get("/api/flows", headers={**TOKEN, "Host": "attacker.example:8000"})
        assert resp.status_code == 403
        assert "--allowed-hosts attacker.example" in resp.get_json()["error"]

    def test_the_page_itself_is_refused_to_a_rebound_name(self, server):
        # Otherwise a rebound page could read the token out of it.
        assert server.get("/", headers={"Host": "attacker.example"}).status_code == 403

    @pytest.mark.parametrize("host", ["localhost:8000", "127.0.0.1:8000", "[::1]:8000"])
    def test_loopback_names_are_accepted(self, server, host):
        assert server.post("/app/fetchEnvironAPIKeys", headers={**TOKEN, "Host": host}).status_code == 200

    def test_an_allowed_extra_name_is_accepted(self, server, monkeypatch):
        monkeypatch.setattr(flask_app, "ALLOWED_HOSTNAMES", allowed_hostnames("0.0.0.0", ["cf.example.org"]))
        resp = server.post("/app/fetchEnvironAPIKeys", headers={**TOKEN, "Host": "cf.example.org"})
        assert resp.status_code == 200


class TestOriginHeader:

    def test_another_site_is_refused_even_with_the_token(self, server):
        resp = server.post("/app/executepy", headers={**TOKEN, "Origin": "https://evil.example"},
                           json={"id": "x", "code": "", "responses": [], "scope": "response"})
        assert resp.status_code == 403
        assert "own pages" in resp.get_json()["error"]

    def test_a_cors_preflight_from_another_site_is_refused(self, server):
        resp = server.options("/app/executepy", headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        assert resp.status_code == 403
        assert "Access-Control-Allow-Origin" not in resp.headers

    def test_responses_carry_no_wildcard_cors_header(self, server):
        resp = server.post("/app/fetchEnvironAPIKeys", headers={**TOKEN, "Origin": "http://localhost"})
        assert resp.status_code == 200
        assert resp.headers.get("Access-Control-Allow-Origin") != "*"

    def test_the_page_itself_is_accepted(self, server):
        resp = server.post("/app/fetchEnvironAPIKeys", headers={**TOKEN, "Origin": "http://localhost"})
        assert resp.status_code == 200

    def test_another_local_server_is_refused(self, server):
        resp = server.post("/app/fetchEnvironAPIKeys", headers={**TOKEN, "Origin": "http://localhost:3000"})
        assert resp.status_code == 403


class TestDevOrigins:

    def test_the_session_token_is_refused_to_other_origins(self, server):
        assert server.get("/api/sessionToken").status_code == 403
        assert server.get("/api/sessionToken", headers={"Origin": "https://evil.example"}).status_code == 403

    def test_an_allowed_dev_origin_gets_the_token_and_can_call_the_server(self, server, monkeypatch):
        monkeypatch.setattr(flask_app, "DEV_ORIGINS", {"http://localhost:3000"})
        dev = {"Origin": "http://localhost:3000"}
        resp = server.get("/api/sessionToken", headers=dev)
        assert resp.status_code == 200
        assert resp.get_json() == {"token": "test-token"}
        assert server.post("/app/fetchEnvironAPIKeys", headers={**dev, **TOKEN}).status_code == 200
        assert server.post("/app/fetchEnvironAPIKeys", headers=dev).status_code == 403


class TestServeCommand:

    def run_main(self, *argv, env=None):
        import chainforge.app as app_module
        with patch.object(app_module, "run_server") as run_server, \
             patch.object(sys, "argv", ["chainforge", "serve", *argv]), \
             patch.dict("os.environ", env or {}, clear=False):
            app_module.main()
        return run_server.call_args.kwargs

    def test_no_extra_hosts_or_dev_origins_by_default(self, monkeypatch):
        monkeypatch.delenv("CHAINFORGE_ALLOWED_HOSTS", raising=False)
        monkeypatch.delenv("CHAINFORGE_DEV_ORIGINS", raising=False)
        kwargs = self.run_main()
        assert kwargs["allowed_hosts"] == [] and kwargs["dev_origins"] == []

    def test_allowed_hosts_from_the_flag(self):
        assert self.run_main("--allowed-hosts", "cf.example.org, 10.0.0.5")["allowed_hosts"] == ["cf.example.org", "10.0.0.5"]

    def test_allowed_hosts_from_the_environment(self):
        assert self.run_main(env={"CHAINFORGE_ALLOWED_HOSTS": "cf.example.org"})["allowed_hosts"] == ["cf.example.org"]

    def test_dev_origins_from_the_environment(self):
        kwargs = self.run_main(env={"CHAINFORGE_DEV_ORIGINS": "http://localhost:3000"})
        assert kwargs["dev_origins"] == ["http://localhost:3000"]

    def test_rejects_a_dev_origin_that_is_not_an_origin(self):
        with pytest.raises(SystemExit):
            self.run_main("--dev-origins", "localhost:3000")
