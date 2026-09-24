"""Finding the local model servers running on this machine.

Discovery looks for servers with an OpenAI-compatible API already running
(LM Studio, llama.cpp, MLX's mlx_lm.server, ...) and lists their models, so the
app can offer them without the user typing IDs. It's done here rather than in
the browser because the browser can't see servers that don't accept requests
from web pages, and logs an error for every port with nothing on it. (The
browser finds Ollama itself, which does accept them.)
"""

from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

import requests

# Where popular servers listen by default. Several use 8080, so one probe covers them.
KNOWN_OPENAI_COMPATIBLE_SERVERS = [
    ("LM Studio", "http://localhost:1234/v1"),
    ("Local server", "http://localhost:8080/v1"),  # llama-server, mlx_lm.server, LocalAI
    ("vLLM", "http://localhost:8000/v1"),
    ("Jan", "http://localhost:1337/v1"),
    ("GPT4All", "http://localhost:4891/v1"),
]

# Names for servers that say who they are in their model list
_OWNED_BY_NAMES = {"llamacpp": "llama.cpp", "vllm": "vLLM", "localai": "LocalAI"}

_PROBE_TIMEOUT = (0.4, 3)  # (connect, read) seconds: a local server answers at once, or isn't there


def _get_json(url: str, timeout=_PROBE_TIMEOUT):
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code != 200:
            return None
        return resp.json()
    except (requests.RequestException, ValueError):
        return None


def _port_of(url: str) -> Optional[int]:
    from urllib.parse import urlsplit
    try:
        return urlsplit(url).port
    except ValueError:
        return None


def probe_openai_compatible(name: str, base_url: str) -> Optional[Dict]:
    base = base_url.rstrip("/")
    data = _get_json(f"{base}/models")
    if not isinstance(data, dict) or not isinstance(data.get("data"), list):
        return None
    models, owners = [], set()
    for m in data["data"]:
        if isinstance(m, dict) and m.get("id"):
            models.append(m["id"])
            if isinstance(m.get("owned_by"), str):
                owners.add(m["owned_by"].lower())
    for owner in owners:
        if owner in _OWNED_BY_NAMES:
            name = _OWNED_BY_NAMES[owner]
            break
    return {"kind": "openai-compatible", "name": name, "base_url": base, "models": models}


def discover_local_models(own_port: Optional[int] = None) -> List[Dict]:
    """The OpenAI-compatible servers running on this machine, and their models.

    Args:
        own_port: ChainForge's own port, which is never probed as a model server.
    """
    candidates = [(n, u) for n, u in KNOWN_OPENAI_COMPATIBLE_SERVERS if _port_of(u) != own_port]
    with ThreadPoolExecutor(max_workers=len(candidates)) as pool:
        found = list(pool.map(lambda c: probe_openai_compatible(*c), candidates))
    return [server for server in found if server is not None]
