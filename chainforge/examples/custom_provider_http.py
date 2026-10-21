"""
    A custom model provider for a model server reached over HTTP with an API
    key: for example, Ollama on a lab machine, behind a gateway (e.g. a
    Cloudflare Tunnel) that checks the key. Needs nothing beyond Python itself.

    Besides each response's text, it returns what the server reports about it
    (token counts, timings), which ChainForge then shows as it does for its
    built-in providers: on the response, in the Inspector, and as values the
    Vis Node can plot. See `ProviderReply` in chainforge/providers/protocol.py
    for everything a provider can return.

    Set SERVER and API_KEY below, and MODELS to the models the server has.
"""
import json
import urllib.request

from chainforge.providers import provider

SERVER = "https://models.example.org"  # your server's address (here, Ollama's API)
API_KEY = "<YOUR_API_KEY>"
MODELS = ["gemma3:27b", "qwen3:32b"]

SETTINGS_SCHEMA = {
    "settings": {
        "temperature": {
            "type": "number",
            "title": "temperature",
            "description": "Controls the 'creativity' or randomness of the response.",
            "default": 0.7,
            "minimum": 0,
            "maximum": 2.0,
            "multipleOf": 0.01,
        },
        "max_tokens": {
            "type": "integer",
            "title": "max_tokens",
            "description": "Maximum number of tokens to generate in the response.",
            "default": 1024,
            "minimum": 1,
            "maximum": 32768,
        },
    },
    "ui": {
        "temperature": {"ui:widget": "range"},
        "max_tokens": {"ui:widget": "range"},
    },
}

NS_PER_MS = 1e6


@provider(name="Lab server",
          emoji="🧪",
          models=MODELS,
          rate_limit="sequential",  # one request at a time, as one GPU server works best
          settings_schema=SETTINGS_SCHEMA)
def lab_server(prompt, model=None, chat_history=None, temperature=0.7, max_tokens=1024, **kwargs):
    # Past turns of a chat (in OpenAI's format), then the new message
    messages = [{"role": m["role"], "content": m["content"]} for m in (chat_history or [])]
    messages.append({"role": "user", "content": prompt})

    body = json.dumps({
        "model": model or MODELS[0],
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }).encode()
    request = urllib.request.Request(f"{SERVER}/api/chat", data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    })
    with urllib.request.urlopen(request, timeout=600) as resp:
        reply = json.load(resp)

    # The response, and what the server says about it, under ChainForge's names
    out = {"text": reply["message"]["content"]}
    if reply["message"].get("thinking"):  # a reasoning model's "thinking"
        out["reasoning"] = reply["message"]["thinking"]
    if "prompt_eval_count" in reply:
        out["input_tokens"] = reply["prompt_eval_count"]
    if "eval_count" in reply:
        out["output_tokens"] = reply["eval_count"]
    if "total_duration" in reply:  # the time on the server, without the network's
        out["latency_ms"] = reply["total_duration"] / NS_PER_MS
    if "prompt_eval_duration" in reply:  # loading the model, then reading the prompt
        out["ttft_ms"] = (reply.get("load_duration", 0) + reply["prompt_eval_duration"]) / NS_PER_MS
    if reply.get("eval_count") and reply.get("eval_duration"):
        out["decode_tokens_per_s"] = reply["eval_count"] / (reply["eval_duration"] / 1e9)
    # If your server measures each request's energy, pass it on as "energy":
    # e.g. out["energy"] = {"energy_wh": ..., "components_wh": {"gpu0": ..., "gpu1": ...}}
    return out
