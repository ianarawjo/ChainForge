"""Guards against text files being read with the platform's default encoding.

Windows defaults to cp1252, not UTF-8, so a text-mode ``open`` or
``Path.read_text`` without an explicit encoding decodes differently there than
on Linux and macOS. The difference is invisible until a file contains a
non-ASCII byte, at which point CI fails on Windows alone -- which is exactly
what happened to the keyword retrieval fixture and its 170 non-ASCII bytes,
while ten other jobs passed.

The scan uses the AST rather than a regex: these calls nest (``open(os.path
.join(...), "w", encoding="utf-8")``) and span lines, and a regex either misses
them or flags its own source.
"""

import ast
import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCANNED_PACKAGES = ("tests", "chainforge")
FIXTURES = sorted((REPO_ROOT / "tests" / "fixtures").glob("*.json"))


def python_sources():
    for base in SCANNED_PACKAGES:
        for path in sorted((REPO_ROOT / base).rglob("*.py")):
            if "__pycache__" in path.parts:
                continue
            yield path


def _is_binary_mode(call: ast.Call) -> bool:
    """Binary reads hand back bytes and never guess a codec, so they are fine."""
    mode = None
    if len(call.args) >= 2 and isinstance(call.args[1], ast.Constant):
        mode = call.args[1].value
    for kw in call.keywords:
        if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
            mode = kw.value.value
    return isinstance(mode, str) and "b" in mode


def _takes_encoding(call: ast.Call) -> bool:
    return any(kw.arg == "encoding" for kw in call.keywords)


def encoding_naive_reads(path: Path):
    """Yields "file:line call" for every text read that guesses an encoding."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        func = node.func
        is_open = isinstance(func, ast.Name) and func.id == "open"
        is_path_text = isinstance(func, ast.Attribute) and func.attr in (
            "read_text",
            "write_text",
        )
        if not (is_open or is_path_text):
            continue
        if is_open and _is_binary_mode(node):
            continue
        if _takes_encoding(node):
            continue

        name = func.id if is_open else func.attr
        yield f"{path.relative_to(REPO_ROOT)}:{node.lineno} {name}(...)"


def test_the_scan_actually_reads_sources():
    # Without this, a broken glob would make the guard below pass vacuously.
    assert len(list(python_sources())) > 10


def test_fixtures_exist():
    assert FIXTURES, "no fixtures found -- the check below would be vacuous"


@pytest.mark.parametrize("path", FIXTURES, ids=lambda p: p.name)
def test_fixture_is_valid_utf8_json(path):
    json.loads(path.read_text(encoding="utf-8"))


def test_no_text_read_relies_on_the_platform_encoding():
    offenders = [
        offender for path in python_sources() for offender in encoding_naive_reads(path)
    ]
    assert offenders == [], (
        "These reads use the platform's default encoding, which is cp1252 on "
        'Windows and UTF-8 elsewhere. Pass encoding="utf-8":\n  '
        + "\n  ".join(offenders)
    )
