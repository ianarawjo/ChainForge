"""Tests for the ChainForge packager's non-GUI launcher parts (packager/).

A small Python script stands in for `chainforge serve`, so starting, waiting
for and stopping a real process group is exercised without ChainForge itself.
"""

import importlib.util
import json
import os
import socket
import subprocess
import sys
import textwrap
import time
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    sys.platform == "win32", reason="the launcher is for macOS (POSIX process groups)"
)

LAUNCHER_DIR = Path(__file__).resolve().parent.parent / "packager"


@pytest.fixture(scope="module")
def core():
    spec = importlib.util.spec_from_file_location(
        "launcher_core", LAUNCHER_DIR / "launcher_core.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


FAKE_SERVER = textwrap.dedent("""\
    import argparse, http.server, os, subprocess, sys, time
    parser = argparse.ArgumentParser()
    parser.add_argument("command")
    parser.add_argument("--host")
    parser.add_argument("--port", type=int)
    parser.add_argument("--idle-shutdown")
    parser.add_argument("--dir")
    args = parser.parse_args()
    if os.environ.get("FAKE_EXIT"):
        print("failing on purpose", flush=True)
        sys.exit(3)
    # Something the server started, which stopping must also stop.
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(600)"])
    with open(os.environ["FAKE_CHILD_PID_FILE"], "w") as f:
        f.write(str(child.pid))
    time.sleep(float(os.environ.get("FAKE_START_DELAY", "0")))
    print(f"serving on {args.host}:{args.port} idle={args.idle_shutdown}", flush=True)
    http.server.HTTPServer((args.host, args.port), http.server.SimpleHTTPRequestHandler).serve_forever()
""")


@pytest.fixture
def fake_chainforge(tmp_path, monkeypatch):
    script = tmp_path / "chainforge"
    script.write_text(f"#!{sys.executable}\n" + FAKE_SERVER)
    script.chmod(0o755)
    monkeypatch.setenv("FAKE_CHILD_PID_FILE", str(tmp_path / "child.pid"))
    return script


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


class TestConfig:

    def test_loads_with_defaults(self, core, tmp_path):
        path = tmp_path / "launcher.json"
        path.write_text(json.dumps({"chainforge": "/opt/cf"}))
        config = core.LauncherConfig.load(path)
        assert config.host == "127.0.0.1"
        assert config.port == 8000
        assert config.idle_shutdown_minutes == 20
        assert config.url == "http://127.0.0.1:8000/"

    def test_requires_the_chainforge_command(self, core, tmp_path):
        path = tmp_path / "launcher.json"
        path.write_text(json.dumps({"port": 8000}))
        with pytest.raises(ValueError):
            core.LauncherConfig.load(path)

    def test_rejects_an_idle_timeout_that_is_not_positive(self, core, tmp_path):
        path = tmp_path / "launcher.json"
        path.write_text(json.dumps({"chainforge": "/opt/cf", "idle_shutdown_minutes": 0}))
        with pytest.raises(ValueError):
            core.LauncherConfig.load(path)

    def test_the_server_command_listens_locally_with_idle_shutdown(self, core):
        config = core.LauncherConfig(chainforge="/opt/cf", idle_shutdown_minutes=20)
        assert core.server_command(config) == [
            "/opt/cf", "serve", "--host", "127.0.0.1", "--port", "8000",
            "--idle-shutdown", "20",
        ]

    def test_the_server_command_passes_a_flows_folder(self, core):
        config = core.LauncherConfig(chainforge="/opt/cf", flows_dir="/data/flows")
        assert core.server_command(config)[-2:] == ["--dir", "/data/flows"]


class TestSingleInstance:

    def test_a_second_launcher_cannot_take_the_lock(self, core, tmp_path):
        first = core.SingleInstance(tmp_path / "launcher.lock")
        second = core.SingleInstance(tmp_path / "launcher.lock")
        assert first.acquire() is True
        assert second.acquire() is False
        first.release()
        assert second.acquire() is True
        second.release()

    def test_a_crashed_launcher_does_not_keep_the_lock(self, core, tmp_path):
        lock = tmp_path / "launcher.lock"
        holder = subprocess.Popen([sys.executable, "-c", textwrap.dedent(f"""\
            import fcntl, sys, time
            f = open({str(lock)!r}, "w")
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            print("locked", flush=True)
            time.sleep(600)
        """)], stdout=subprocess.PIPE, text=True)
        assert holder.stdout.readline().strip() == "locked"
        assert core.SingleInstance(lock).acquire() is False
        holder.kill()
        holder.wait()
        assert core.SingleInstance(lock).acquire() is True


def test_port_in_use(core):
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        sock.listen()
        port = sock.getsockname()[1]
        assert core.port_in_use("127.0.0.1", port) is True
    assert core.port_in_use("127.0.0.1", free_port()) is False


class TestServerLifecycle:

    def test_starts_waits_and_stops_the_whole_process_group(self, core, fake_chainforge, tmp_path):
        config = core.LauncherConfig(chainforge=str(fake_chainforge), port=free_port(),
                                     idle_shutdown_minutes=20)
        log = tmp_path / "logs" / "chainforge.log"
        process = core.start_server(config, log)
        try:
            assert core.wait_until_ready(config.url, process, timeout=20) is True
            child = int((tmp_path / "child.pid").read_text())
            assert alive(child)
        finally:
            core.stop_server(process, grace_seconds=5)
        assert process.poll() is not None
        deadline = time.monotonic() + 5
        while alive(child) and time.monotonic() < deadline:
            time.sleep(0.05)
        assert not alive(child), "stopping must also stop what the server started"
        text = log.read_text()
        assert "serve --host 127.0.0.1" in text and "--idle-shutdown 20" in text
        assert "idle=20" in text

    def test_waiting_ends_as_soon_as_the_server_exits(self, core, fake_chainforge, tmp_path, monkeypatch):
        monkeypatch.setenv("FAKE_EXIT", "1")
        config = core.LauncherConfig(chainforge=str(fake_chainforge), port=free_port())
        process = core.start_server(config, tmp_path / "chainforge.log")
        started = time.monotonic()
        assert core.wait_until_ready(config.url, process, timeout=30) is False
        assert time.monotonic() - started < 10
        assert process.returncode == 3

    def test_waiting_gives_up_after_the_timeout(self, core):
        assert core.wait_until_ready("http://127.0.0.1:1/", timeout=0.3,
                                     poll_interval=0.05, responds=lambda url: False) is False

    def test_stopping_a_server_that_already_exited_is_harmless(self, core, fake_chainforge, tmp_path, monkeypatch):
        monkeypatch.setenv("FAKE_EXIT", "1")
        config = core.LauncherConfig(chainforge=str(fake_chainforge), port=free_port())
        process = core.start_server(config, tmp_path / "chainforge.log")
        process.wait(timeout=20)
        core.stop_server(process)


class TestWhyItStopped:

    def test_an_idle_stop_is_recognised(self, core, tmp_path):
        log = tmp_path / "chainforge.log"
        log.write_text("--- start\nServing...\nNo ChainForge page has been open for 20 minutes. "
                       "Stopping the server.\n")
        assert core.why_it_stopped(log) == "idle"

    def test_an_earlier_idle_stop_does_not_explain_a_later_crash(self, core, tmp_path):
        log = tmp_path / "chainforge.log"
        log.write_text("--- start 1\nNo ChainForge page has been open for 20 minutes.\n"
                       "--- start 2\nTraceback (most recent call last):\n")
        assert core.why_it_stopped(log) == "exited"

    def test_a_missing_log_means_it_simply_exited(self, core, tmp_path):
        assert core.why_it_stopped(tmp_path / "nope.log") == "exited"
