"""Shared by the test_*_settings_matter.py modules.

Each RAG node's settings form offers settings that must each change what its
method does. tests/fixtures/rag_setting_keys.json lists them, with the default
each form fills in; the TS *Settings.test.ts files keep that list in step with
the forms. A module per node registers an @effect per server-run setting, and
the helpers here fail the build for a setting with no effect test.
"""

import json
import pathlib

import pytest

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "rag_setting_keys.json"
_NODES = json.loads(FIXTURE.read_text(encoding="utf-8"))

NO_EFFECT_EXPECTED = {
    "shortName": "The method's display name. It labels results rather than changing them.",
}


def server_methods(node):
    """A node's methods that run on the server, with their settings and defaults."""
    return {name: spec for name, spec in _NODES[node].items()
            if spec["runsIn"] in ("backend", "both")}


def form_defaults(node, method):
    """The settings a node's form sends for a method left at its defaults."""
    return {key: value for key, value in _NODES[node][method]["settings"].items()
            if value is not None}


def registry():
    """An (effects, @effect) pair for one node's effect tests."""
    effects = {}

    def effect(method, setting, marks=()):
        def register(fn):
            effects[(method, setting)] = (fn, list(marks))
            return fn
        return register

    return effects, effect


def untested_settings(node, method, effects):
    return [key for key in server_methods(node)[method]["settings"]
            if (method, key) not in effects and key not in NO_EFFECT_EXPECTED]


def stale_effects(node, effects):
    methods = server_methods(node)
    return [f"{m}.{k}" for m, k in effects
            if m not in methods or k not in methods[m]["settings"]]


def effect_params(effects):
    return [pytest.param(method, setting, marks=marks, id=f"{method}.{setting}")
            for (method, setting), (_, marks) in sorted(effects.items())]
