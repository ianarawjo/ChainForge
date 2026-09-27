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
import os
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
    headers = {"User-Agent": "chainforge-ecologits-sync"}
    # Anonymous calls to GitHub's API share a small hourly limit per IP address,
    # which a CI runner's may have used up: send a token when there is one
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token and url.startswith("https://api.github.com/"):
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
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


def is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def is_value_or_range(v) -> bool:
    """A positive number, or {"min", "max"} with 0 < min <= max: what ecologits.ts reads."""
    if is_number(v):
        return v > 0
    return (
        isinstance(v, dict)
        and is_number(v.get("min"))
        and is_number(v.get("max"))
        and 0 < v["min"] <= v["max"]
    )


def check_models(models: dict) -> list[str]:
    """Anything in models.json that ecologits.ts would misread."""
    problems = []
    for m in models["models"]:
        name = f"{m.get('provider')}/{m.get('name')}"
        deployment = m.get("deployment") or {}
        ttft, tps = deployment.get("ttft"), deployment.get("tps")
        if ttft is not None and (not is_number(ttft) or not 0 <= ttft <= MAX_PLAUSIBLE_TTFT_S):
            problems.append(f"{name}: ttft {ttft} (seconds?)")
        if tps is not None and (not is_number(tps) or tps <= 0):
            problems.append(f"{name}: tps {tps}")
        # As EcoLogits reads them: by the parameters' shape (one count, a range,
        # or total and active counts), whatever the architecture's type says
        arch = m.get("architecture") or {}
        params = arch.get("parameters")
        ok = arch.get("type") in ("dense", "moe") and (
            is_value_or_range(params)
            or (
                isinstance(params, dict)
                and is_value_or_range(params.get("total"))
                and is_value_or_range(params.get("active"))
            )
        )
        if not ok:
            problems.append(f"{name}: architecture {arch}")
    names = {(m.get("provider"), m.get("name")) for m in models["models"]}
    for a in models.get("aliases") or []:
        if (a.get("provider"), a.get("alias")) not in names:
            problems.append(f"alias {a.get('name')}: no model {a.get('alias')}")
    return problems


def check_method(method: dict) -> list[str]:
    """Anything in method.json that ecologits.ts would misread."""
    problems = [
        f"constant {k}: {v}" for k, v in method["constants"].items() if not is_number(v)
    ]
    for provider, config in method["providers"].items():
        if not is_value_or_range(config.get("datacenter_pue")):
            problems.append(f"provider {provider}: datacenter_pue {config.get('datacenter_pue')}")
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
    problems = check_method(method)
    if problems:
        print("The method's constants or data centres read wrongly:")
        for p in problems:
            print("  " + p)
        sys.exit("Not updated. Check how llm.py and utils.py define them, and update sync.py.")

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
