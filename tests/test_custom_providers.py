"""Custom model providers (chainforge/providers): registering one from a script,
calling it, and what it can return besides its text (ProviderReply), which the
front end reads under the same names (responseStats.ts).
"""

import re
from fractions import Fraction
from pathlib import Path

import pytest

import chainforge.flask_app as flask_app
from chainforge.providers import ProviderRegistry
from chainforge.providers.protocol import PROVIDER_REPLY_FIELDS, check_provider_reply

SCRIPT = '''
from chainforge.providers import provider

@provider(name="TestLab", emoji="🧪", models=["small", "big"])
def lab(prompt, model=None, chat_history=None, temperature=1.0, **kwargs):
    return REPLIES.get(prompt, f"[{model} t={temperature}] {prompt} after {len(chat_history or [])} turns")
'''


@pytest.fixture
def lab(client, tmp_path, monkeypatch):
    """A provider registered from a script, as the Settings window does, whose
    reply to a prompt can be set in REPLIES."""
    monkeypatch.setattr(flask_app, "FLOWS_DIR", str(tmp_path))
    replies = {}
    monkeypatch.setitem(flask_app.__dict__, "REPLIES", replies)
    resp = client.post("/app/initCustomProvider", json={"code": SCRIPT}).get_json()
    assert [p["name"] for p in resp["providers"] if p["name"] == "TestLab"] == ["TestLab"]
    yield replies
    ProviderRegistry.remove("TestLab")


def call(client, prompt, **params):
    return client.post("/app/callCustomProvider", json={
        "name": "TestLab", "params": {"prompt": prompt, "model": "small", **params}}).get_json()


class TestCallingAProvider:
    def test_registers_saves_and_calls_it(self, client, lab, tmp_path):
        assert list((tmp_path / "provider_scripts").glob("*.py"))
        reply = call(client, "Hi", temperature=0.2, images=None,
                     chat_history=[{"role": "user", "content": "earlier"}])
        assert reply == {"response": "[small t=0.2] Hi after 1 turns"}

    def test_a_reply_with_what_the_provider_knows(self, client, lab):
        lab["Hi"] = {"text": "Hello!", "output_tokens": 3, "latency_ms": 120.5,
                     "energy": {"energy_wh": 0.08, "components_wh": {"gpu0": 0.06, "gpu1": 0.02}}}
        assert call(client, "Hi")["response"] == lab["Hi"]

    def test_a_misspelled_field_is_an_error_saying_what_can_be_returned(self, client, lab):
        lab["Hi"] = {"text": "Hello!", "output_token": 3}
        error = call(client, "Hi")["error"]
        assert "TestLab" in error and "'output_token'" in error and "output_tokens" in error


class TestCheckingReplies:
    def test_text_and_images_as_before(self):
        assert check_provider_reply("Hello") == "Hello"
        image = {"t": "img", "d": "aGVsbG8="}
        assert check_provider_reply(image) == image

    def test_everything_a_reply_can_say(self):
        reply = {
            "text": "Hello", "reasoning": "They said hi.",
            "input_tokens": 12, "output_tokens": 40, "latency_ms": 2210.5, "ttft_ms": 180,
            "decode_tokens_per_s": 31.2, "cost_usd": 0.0,
            "est_energy_wh": {"min": 0.01, "max": 0.03},
            "energy": {"energy_wh": 0.081, "noise_wh": 0.002, "components_wh": {"gpu0": 0.081},
                       "conditions": {"power_source": "AC power"}, "meter": "NVIDIA GPUs"},
        }
        assert check_provider_reply(reply) == reply

    def test_numbers_become_plain_ones(self):
        # e.g. numpy's, which JSON can't carry
        np = pytest.importorskip("numpy")
        out = check_provider_reply({"text": "x", "latency_ms": np.float32(0.5),
                                    "output_tokens": np.int64(3), "ttft_ms": Fraction(1, 4),
                                    "energy": {"energy_wh": np.float64(0.1)}})
        assert out["latency_ms"] == 0.5 and type(out["latency_ms"]) is float
        assert out["output_tokens"] == 3 and type(out["output_tokens"]) is int
        assert type(out["ttft_ms"]) is float and type(out["energy"]["energy_wh"]) is float

    @pytest.mark.parametrize("reply, says", [
        (42, "string"),
        ({"output_tokens": 3}, '"text"'),
        ({"text": 7}, '"text"'),
        ({"text": "x", "latency_ms": -1}, "latency_ms"),
        ({"text": "x", "latency_ms": float("nan")}, "latency_ms"),
        ({"text": "x", "input_tokens": "12"}, "input_tokens"),
        ({"text": "x", "est_energy_wh": 0.02}, "est_energy_wh"),
        ({"text": "x", "est_energy_wh": {"min": 0.3, "max": 0.1}}, "min"),
        ({"text": "x", "energy": {"noise_wh": 0.1}}, "energy_wh"),
        ({"text": "x", "energy": {"energy_wh": 0.1, "components_wh": {"gpu": "lots"}}}, "components_wh.gpu"),
        ({"text": "x", "reasoning": ["a"]}, "reasoning"),
    ])
    def test_says_whats_wrong(self, reply, says):
        with pytest.raises(ValueError, match=re.escape(says)):
            check_provider_reply(reply)

    def test_a_bool_isnt_a_count(self):
        with pytest.raises(ValueError, match="output_tokens"):
            check_provider_reply({"text": "x", "output_tokens": True})


def test_the_front_end_reads_the_same_fields():
    """PROVIDER_REPLY_FIELDS in responseStats.ts lists the same names."""
    src = (Path(__file__).parents[1] / "chainforge" / "react-server" / "src" / "backend"
           / "responseStats.ts").read_text(encoding="utf-8")

    def names(const):
        body = re.search(rf"export const {const} = \[(.*?)\] as const", src, re.S).group(1)
        return re.findall(r'"([a-z_]+)"', body), "..." in body

    stats, _ = names("PROVIDER_REPORTED_STATS")
    fields, spreads = names("PROVIDER_REPLY_FIELDS")
    assert spreads  # ...PROVIDER_REPORTED_STATS, after "text" and "reasoning"
    assert tuple(fields[:2] + stats + fields[2:]) == PROVIDER_REPLY_FIELDS
