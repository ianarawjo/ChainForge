"""
Updates this folder to a release of EcoLogits (https://github.com/mlco2/ecologits).

    python sync.py            # the latest release
    python sync.py 0.11.1     # a given release (or any git ref)

Copies models.json and LICENSE unchanged, reads the method's constants and each
provider's data-centre figures out of EcoLogits' Python source into method.json,
and records what was fetched in upstream.json. ecologits.ts is ported by hand:
when the formulas' source (llm.py) changes, this says so, so the port can be
checked against it.

This script is ChainForge's own (MIT), unlike the files it fetches (MPL-2.0).
Standard library only.
"""

import ast
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

REPO = "mlco2/ecologits"
HERE = Path(__file__).resolve().parent

# What's fetched, and where it comes from in the EcoLogits repo
SOURCES = {
    "models.json": "ecologits/data/models.json",
    "LICENSE": "LICENSE",
    "llm.py": "ecologits/impacts/llm.py",
    "utils.py": "ecologits/tracers/utils.py",
}

# The constants of llm.py that ecologits.ts uses
CONSTANTS = [
    "MODEL_QUANTIZATION_BITS",
    "GPU_ENERGY_ALPHA",
    "GPU_ENERGY_BETA",
    "GPU_ENERGY_GAMMA",
    "LATENCY_ALPHA",
    "LATENCY_BETA",
    "LATENCY_GAMMA",
    "GPU_MEMORY",
    "SERVER_GPUS",
    "SERVER_POWER",
    "BATCH_SIZE",
]

# A time to first token longer than this is more likely milliseconds than seconds
MAX_PLAUSIBLE_TTFT_S = 120


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "chainforge-ecologits-sync"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def latest_release() -> str:
    return json.loads(get(f"https://api.github.com/repos/{REPO}/releases/latest"))["tag_name"]


def commit_of(ref: str) -> str:
    return json.loads(get(f"https://api.github.com/repos/{REPO}/commits/{ref}"))["sha"]


def literal(node: ast.expr):
    """A number, string, or RangeValue(min=..., max=...) as {"min", "max"}."""
    if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "RangeValue":
        return {kw.arg: ast.literal_eval(kw.value) for kw in node.keywords}
    return ast.literal_eval(node)


def constants(llm_py: str) -> dict:
    found = {}
    for node in ast.parse(llm_py).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            name = getattr(node.targets[0], "id", None)
            if name in CONSTANTS:
                found[name] = ast.literal_eval(node.value)
    missing = [c for c in CONSTANTS if c not in found]
    if missing:
        sys.exit(f"llm.py no longer defines {missing}: update sync.py and ecologits.ts.")
    return {c: found[c] for c in CONSTANTS}


def providers(utils_py: str) -> dict:
    for node in ast.parse(utils_py).body:
        if (
            isinstance(node, ast.Assign)
            and getattr(node.targets[0], "id", None) == "PROVIDER_CONFIG_MAP"
        ):
            return {
                ast.literal_eval(k): {kw.arg: literal(kw.value) for kw in v.keywords}
                for k, v in zip(node.value.keys, node.value.values)
            }
    sys.exit("utils.py no longer defines PROVIDER_CONFIG_MAP: update sync.py and ecologits.ts.")


def check_models(models: dict) -> list[str]:
    """Anything in models.json that ecologits.ts would misread."""
    problems = []
    for m in models["models"]:
        ttft = (m.get("deployment") or {}).get("ttft")
        if ttft is not None and ttft > MAX_PLAUSIBLE_TTFT_S:
            problems.append(f"{m['provider']}/{m['name']}: ttft {ttft} (seconds?)")
        arch = m["architecture"]
        if arch["type"] not in ("dense", "moe"):
            problems.append(f"{m['provider']}/{m['name']}: architecture {arch['type']}")
    return problems


def main() -> None:
    ref = sys.argv[1] if len(sys.argv) > 1 else latest_release()
    commit = commit_of(ref)
    print(f"EcoLogits {ref} ({commit[:7]})")

    files = {
        name: get(f"https://raw.githubusercontent.com/{REPO}/{commit}/{path}")
        for name, path in SOURCES.items()
    }

    models = json.loads(files["models.json"])
    problems = check_models(models)
    if problems:
        print(f"models.json has {len(problems)} entries that look wrong:")
        for p in problems[:20]:
            print("  " + p)
        sys.exit("Not updated. Pick another release, or report it upstream.")

    method = {
        "constants": constants(files["llm.py"].decode("utf-8")),
        "providers": providers(files["utils.py"].decode("utf-8")),
    }

    old = HERE / "upstream.json"
    previous = json.loads(old.read_text(encoding="utf-8")) if old.exists() else {}
    upstream = {
        "repo": f"https://github.com/{REPO}",
        "ref": ref,
        "commit": commit,
        "sha256": {
            name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())
        },
    }

    (HERE / "models.json").write_bytes(files["models.json"])
    (HERE / "LICENSE").write_bytes(files["LICENSE"])
    (HERE / "method.json").write_text(json.dumps(method, indent=2) + "\n", encoding="utf-8", newline="\n")
    old.write_text(json.dumps(upstream, indent=2) + "\n", encoding="utf-8", newline="\n")

    if previous.get("sha256", {}).get("llm.py") not in (None, upstream["sha256"]["llm.py"]):
        print(
            "llm.py changed since the last sync: check ecologits.ts against "
            f"https://github.com/{REPO}/blob/{commit}/ecologits/impacts/llm.py"
        )
    readme = HERE / "README.md"
    if readme.exists():
        text = re.sub(r"EcoLogits \*\*[^*]+\*\*", f"EcoLogits **{ref}**", readme.read_text(encoding="utf-8"), count=1)
        readme.write_text(text, encoding="utf-8", newline="\n")
    print(f"Updated to {ref}: {len(models['models'])} models.")


if __name__ == "__main__":
    main()
