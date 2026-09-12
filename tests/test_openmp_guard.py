"""Tests for the FAISS/PyTorch OpenMP guard.

The guard exists because FAISS's pip wheels bundle an OpenMP runtime that
collides with PyTorch's: on an install with both, the suite segfaults partway
through test_retrievers.py, and the identical suite passes without FAISS.

These pin the decision logic rather than the crash, which cannot be reproduced
in-process -- by the time a test runs, both runtimes are long since loaded.
"""

import importlib.resources
import os

import pytest

from chainforge import _openmp


@pytest.fixture
def clean_env(monkeypatch):
    """Runs each case with no inherited OMP_NUM_THREADS and a reset flag."""
    monkeypatch.delenv("OMP_NUM_THREADS", raising=False)
    monkeypatch.setattr(_openmp, "limited_openmp_for_faiss", False)


def fake_find_spec(present):
    """A find_spec that reports only the named modules as installed."""

    def _find_spec(name):
        return object() if name in present else None

    return _find_spec


def test_limits_when_faiss_and_torch_are_both_present(clean_env, monkeypatch):
    monkeypatch.setattr(_openmp, "find_spec", fake_find_spec({"faiss", "torch"}))
    assert _openmp.limit_openmp_if_faiss_present() is True
    assert os.environ["OMP_NUM_THREADS"] == "1"
    assert _openmp.limited_openmp_for_faiss is True


def test_does_nothing_without_faiss(clean_env, monkeypatch):
    # The overwhelmingly common install: RAG without FAISS. PyTorch keeps all
    # its threads, because there is nothing to collide with.
    monkeypatch.setattr(_openmp, "find_spec", fake_find_spec({"torch"}))
    assert _openmp.limit_openmp_if_faiss_present() is False
    assert "OMP_NUM_THREADS" not in os.environ


def test_does_nothing_without_torch(clean_env, monkeypatch):
    # FAISS alone is fine; it is the second runtime that causes the crash.
    monkeypatch.setattr(_openmp, "find_spec", fake_find_spec({"faiss"}))
    assert _openmp.limit_openmp_if_faiss_present() is False
    assert "OMP_NUM_THREADS" not in os.environ


def test_does_nothing_on_a_core_install(clean_env, monkeypatch):
    monkeypatch.setattr(_openmp, "find_spec", fake_find_spec(set()))
    assert _openmp.limit_openmp_if_faiss_present() is False
    assert "OMP_NUM_THREADS" not in os.environ


def test_defers_to_an_explicit_setting(clean_env, monkeypatch):
    # Someone who set this has already decided; do not overrule them, in
    # either direction.
    monkeypatch.setenv("OMP_NUM_THREADS", "8")
    monkeypatch.setattr(_openmp, "find_spec", fake_find_spec({"faiss", "torch"}))
    assert _openmp.limit_openmp_if_faiss_present() is False
    assert os.environ["OMP_NUM_THREADS"] == "8"


def test_survives_a_broken_distribution(clean_env, monkeypatch):
    # A half-removed package can make find_spec raise. That is not a reason to
    # stop the program from starting.
    def exploding(name):
        raise ValueError("broken distribution metadata")

    monkeypatch.setattr(_openmp, "find_spec", exploding)
    assert _openmp.limit_openmp_if_faiss_present() is False
    assert "OMP_NUM_THREADS" not in os.environ


def test_is_idempotent(clean_env, monkeypatch):
    monkeypatch.setattr(_openmp, "find_spec", fake_find_spec({"faiss", "torch"}))
    assert _openmp.limit_openmp_if_faiss_present() is True
    # The second call sees the variable it set and leaves it alone.
    assert _openmp.limit_openmp_if_faiss_present() is False
    assert os.environ["OMP_NUM_THREADS"] == "1"


def test_package_import_runs_the_guard():
    # The guard is only useful if it runs before torch or faiss are imported,
    # which means at package import. Assert it is actually wired in.
    source = (
        importlib.resources.files("chainforge")
        .joinpath("__init__.py")
        .read_text(encoding="utf-8")
    )
    assert "limit_openmp_if_faiss_present()" in source
    assert source.index("_openmp") < source.index("from .app import main")
