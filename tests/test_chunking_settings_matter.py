"""Every setting a Chunk node method offers must change what /chunk does.

The server chunkers mostly hand their settings to a library -- Chonkie, NLTK,
tiktoken, HuggingFace tokenizers -- so those libraries are replaced here with
fakes that record what they were asked for; the real ones download models. A
setting "matters" when changing it changes what the library is asked to do or,
for the chunking loops written here, the chunks that come back. Requests are
multipart forms with every setting as a string, as ChunkNode sends them,
starting from the defaults its form fills in. See settings_contract.py, and
chunkingSettings.test.ts for the chunkers run in the browser.
"""

import inspect
import io
import json
import sys
import types
from importlib.util import find_spec

import pytest

from settings_contract import (
    effect_params, form_defaults, registry, server_methods, stale_effects, untested_settings,
)

NODE = "chunking"

TEXT = "First paragraph here.\n\nSecond paragraph follows.\n\nThird and last."
TOKEN_TEXT = "abcdefghijklmnopqrstuvwxyz" * 4

# Parameters of the installed Chonkie's constructors (1.7), which the
# handlers adapt their keyword arguments to.
CHONKIE_PARAMS = {
    "TokenChunker": ["tokenizer", "chunk_size", "chunk_overlap"],
    "SentenceChunker": ["tokenizer", "chunk_size", "chunk_overlap", "min_sentences_per_chunk",
                        "min_characters_per_sentence", "approximate", "delim", "include_delim"],
    "RecursiveChunker": ["tokenizer", "chunk_size", "rules", "min_characters_per_chunk"],
    "SemanticChunker": ["embedding_model", "threshold", "chunk_size", "similarity_window",
                        "min_sentences_per_chunk", "min_characters_per_sentence", "delim",
                        "include_delim", "skip_window"],
    "LateChunker": ["embedding_model", "chunk_size", "rules", "min_characters_per_chunk"],
}


class Fakes:
    """Stand-ins for the chunking libraries, recording what they were asked for."""

    def __init__(self):
        self.constructed = []   # keyword arguments each chunker was built with
        self.tokenizers = []    # tokenizer / model names looked up

    def chonkie(self):
        fakes = self

        def chunker(name, params):
            def __init__(self, **kwargs):
                fakes.constructed.append(kwargs)

            __init__.__signature__ = inspect.Signature(
                [inspect.Parameter("self", inspect.Parameter.POSITIONAL_OR_KEYWORD)]
                + [inspect.Parameter(p, inspect.Parameter.KEYWORD_ONLY) for p in params])

            def chunk(self, text):
                return [types.SimpleNamespace(text=part) for part in text.split("\n\n") if part]

            return type(name, (), {"__init__": __init__, "chunk": chunk})

        class RecursiveRules:
            def __init__(self, source=("default",)):
                self.source = source

            @classmethod
            def from_dict(cls, data):
                return cls(("dict", json.dumps(data, sort_keys=True)))

            @classmethod
            def from_recipe(cls, name=None, lang=None):
                return cls(("recipe", name, lang))

        module = types.SimpleNamespace(RecursiveRules=RecursiveRules)
        for name, params in CHONKIE_PARAMS.items():
            setattr(module, name, chunker(name, params))
        return module

    def tiktoken(self):
        encoding = types.SimpleNamespace(encode=list, decode="".join)  # a token per character

        def encoding_for_model(name):
            self.tokenizers.append(name)
            return encoding

        return types.SimpleNamespace(encoding_for_model=encoding_for_model,
                                     get_encoding=lambda name: encoding)

    def transformers(self):
        tokenizer = types.SimpleNamespace(
            encode=lambda text, add_special_tokens: list(text),
            decode=lambda tokens, skip_special_tokens: "".join(tokens))

        def from_pretrained(name):
            self.tokenizers.append(name)
            return tokenizer

        return types.SimpleNamespace(AutoTokenizer=types.SimpleNamespace(from_pretrained=from_pretrained))

    def nltk_tokenize(self):
        fakes = self

        class TextTilingTokenizer:
            def __init__(self, **kwargs):
                fakes.constructed.append(kwargs)

            def tokenize(self, text):
                return [text]

        return types.SimpleNamespace(TextTilingTokenizer=TextTilingTokenizer)


class Runner:
    def __init__(self, client, fakes):
        self.client = client
        self.fakes = fakes

    def chunk(self, method, text=TEXT, **settings):
        # ChunkNode appends each setting to the form as String(value).
        form = {key: str(value) for key, value in {**form_defaults(NODE, method), **settings}.items()}
        resp = self.client.post("/chunk", data={
            "baseMethod": method, **form,
            "document": (io.BytesIO(text.encode("utf-8")), "document.txt"),
        }, content_type="multipart/form-data")
        assert resp.status_code == 200, resp.get_json()
        return resp.get_json()["chunks"]

    def constructed(self, method, **settings):
        self.chunk(method, **settings)
        kwargs = dict(self.fakes.constructed[-1])
        if "rules" in kwargs:
            kwargs["rules"] = kwargs["rules"].source
        kwargs.pop("stopwords", None)
        return kwargs

    def tokenizer_name(self, method, **settings):
        self.chunk(method, TOKEN_TEXT, **settings)
        return self.fakes.tokenizers[-1]


EFFECTS, effect = registry()


def _constructor_effect(setting, value):
    def observe(run, method):
        return run.constructed(method), run.constructed(method, **{setting: value})
    return observe


RECIPE = json.dumps([{"delimiters": [";"]}])

# For settings handed to a chunking library: a value different from the default.
LIBRARY_SETTINGS = {
    "chonkie_token": {"tokenizer": "character", "chunk_size": 128, "chunk_overlap": 16},
    "chonkie_sentence": {
        "tokenizer_or_token_counter": "character", "chunk_size": 256, "chunk_overlap": 8,
        "min_sentences_per_chunk": 2, "min_characters_per_sentence": 20,
        "delim": json.dumps([";"]), "include_delim": "next",
    },
    "syntax_texttiling": {"w": 30, "k": 6},
    "chonkie_recursive": {
        "tokenizer_or_token_counter": "character", "chunk_size": 128,
        "min_characters_per_chunk": 40, "use_premade_recipe": "en", "custom_recipe": RECIPE,
    },
    "chonkie_semantic": {
        "embedding_model": "other/model", "embedding_local_path": "/models/local",
        "chunk_size": 128, "threshold": 0.5, "similarity_window": 3, "min_sentences": 2,
        "min_characters_per_sentence": 20, "skip_window": 2,
    },
    "chonkie_late": {
        "embedding_model": "other/model", "embedding_local_path": "/models/local",
        "chunk_size": 128, "min_characters_per_chunk": 40, "use_premade_recipe": "en",
        "custom_recipe": RECIPE,
    },
}
for _method, _settings in LIBRARY_SETTINGS.items():
    for _setting, _value in _settings.items():
        effect(_method, _setting)(_constructor_effect(_setting, _value))


# The overlapping chunkers run their own loop over the library's tokens.
@effect("overlapping_openai_tiktoken", "model", )
def _tiktoken_model(run, method):
    return run.tokenizer_name(method), run.tokenizer_name(method, model="gpt-4o")


@effect("overlapping_huggingface_tokenizers", "tokenizer")
def _huggingface_tokenizer(run, method):
    return run.tokenizer_name(method), run.tokenizer_name(method, tokenizer="roberta-base")


@effect("overlapping_openai_tiktoken", "chunk_size")
@effect("overlapping_huggingface_tokenizers", "chunk_size")
def _overlapping_chunk_size(run, method):
    return run.chunk(method, TOKEN_TEXT), run.chunk(method, TOKEN_TEXT, chunk_size=30)


@effect("overlapping_openai_tiktoken", "chunk_overlap")
@effect("overlapping_huggingface_tokenizers", "chunk_overlap")
def _overlapping_chunk_overlap(run, method):
    return (run.chunk(method, TOKEN_TEXT, chunk_size=30, chunk_overlap=0),
            run.chunk(method, TOKEN_TEXT, chunk_size=30, chunk_overlap=10))


# --- The contract ---------------------------------------------------------

@pytest.mark.parametrize("method", sorted(server_methods(NODE)))
def test_every_server_setting_has_a_test_showing_it_matters(method):
    untested = untested_settings(NODE, method, EFFECTS)
    assert untested == [], (
        f"{method} offers settings with no test showing they change chunking: {untested}. "
        "Add an @effect for each, or explain in NO_EFFECT_EXPECTED why it has none.")


def test_no_effect_tests_for_settings_that_no_longer_exist():
    assert stale_effects(NODE, EFFECTS) == []


@pytest.fixture
def run(client, monkeypatch):
    fakes = Fakes()
    monkeypatch.setitem(sys.modules, "chonkie", fakes.chonkie())
    monkeypatch.setitem(sys.modules, "tiktoken", fakes.tiktoken())
    monkeypatch.setitem(sys.modules, "transformers", fakes.transformers())
    monkeypatch.setitem(sys.modules, "nltk.tokenize", fakes.nltk_tokenize())
    # chonkie_late adjusts SentenceTransformer.encode before building its chunker.
    monkeypatch.setitem(sys.modules, "sentence_transformers", types.SimpleNamespace(
        SentenceTransformer=type("SentenceTransformer", (), {"encode": lambda self, s, **kw: s})))
    return Runner(client, fakes)


@pytest.mark.parametrize("method, setting", effect_params(EFFECTS))
def test_changing_the_setting_changes_chunking(run, method, setting):
    observe, _ = EFFECTS[(method, setting)]
    base, changed = observe(run, method)
    assert base != changed, f"{method}.{setting} had no effect: {base!r}"


@pytest.mark.parametrize("method", ["overlapping_openai_tiktoken", "overlapping_huggingface_tokenizers"])
def test_a_chunk_size_below_the_overlap_still_finishes(run, method):
    """Regression: chunk_size 30 with the form's default overlap of 50 looped forever.

    Each window stepped back to token 0, and the loop's guard only broke once
    it had moved past 0. The overlap is now clamped below the chunk size.
    """
    chunks = run.chunk(method, TOKEN_TEXT, chunk_size=30, chunk_overlap=50)
    assert 1 < len(chunks) <= len(TOKEN_TEXT)
    assert all(len(chunk) <= 30 for chunk in chunks)


@pytest.mark.skipif(find_spec("nltk") is None, reason="nltk not installed")
def test_texttiling_runs_with_the_settings_its_form_sends(client):
    """Regression: syntax_texttiling took no settings, so its form's w and k made it raise."""
    topics = ["cats purr and nap in warm sunny windows all afternoon",
              "rockets burn fuel to climb through the thin upper atmosphere",
              "bread dough rises slowly when yeast feeds on the sugars"]
    text = "\n\n".join(" ".join([topics[i % 3]] * 6) for i in range(12))
    resp = client.post("/chunk", data={
        "baseMethod": "syntax_texttiling", "w": "20", "k": "10",
        "document": (io.BytesIO(text.encode("utf-8")), "document.txt"),
    }, content_type="multipart/form-data")
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["chunks"]
