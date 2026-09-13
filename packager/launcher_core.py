"""The parts of the ChainForge menu-bar launcher that need no GUI.

Kept free of rumps and AppKit, so they can be tested anywhere POSIX. See
chainforge_menubar.py for the app, and README.md for what it is for.
"""

import fcntl
import json
import os
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import IO, Callable, List, Optional

SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "ChainForge Launcher"
LOG_DIR = Path.home() / "Library" / "Logs" / "ChainForge Launcher"

# Printed by chainforge/idle_shutdown.py when the server stops itself.
IDLE_SHUTDOWN_MARKER = "No ChainForge page has been open for"


@dataclass
class LauncherConfig:
    """Settings written into the app by build_app.sh."""

    chainforge: str
    host: str = "127.0.0.1"
    # Fixed rather than "any free port": the browser keeps ChainForge's saved
    # state per address, so a different port would look like a fresh install.
    port: int = 8000
    idle_shutdown_minutes: float = 20
    flows_dir: Optional[str] = None

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}/"

    @classmethod
    def load(cls, path: Path) -> "LauncherConfig":
        data = json.loads(Path(path).read_text())
        if not data.get("chainforge"):
            raise ValueError(f"{path} does not say where the chainforge command is")
        known = {"chainforge", "host", "port", "idle_shutdown_minutes", "flows_dir"}
        config = cls(**{k: v for k, v in data.items() if k in known})
        if config.idle_shutdown_minutes <= 0:
            raise ValueError("idle_shutdown_minutes must be positive")
        return config


class SingleInstance:
    """A lock held while a launcher runs, so a second copy never starts.

    The operating system releases it if the launcher dies, however it dies,
    so a crash can never leave ChainForge unlaunchable.
    """

    def __init__(self, path: Path):
        self.path = Path(path)
        self._file: Optional[IO[str]] = None

    def acquire(self) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        handle = open(self.path, "w")
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            handle.close()
            return False
        handle.write(str(os.getpid()))
        handle.flush()
        self._file = handle
        return True

    def release(self) -> None:
        if self._file is not None:
            fcntl.flock(self._file, fcntl.LOCK_UN)
            self._file.close()
            self._file = None


def port_in_use(host: str, port: int) -> bool:
    """Whether something is already listening on host:port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def server_command(config: LauncherConfig) -> List[str]:
    command = [
        config.chainforge,
        "serve",
        "--host", config.host,
        "--port", str(config.port),
        "--idle-shutdown", f"{config.idle_shutdown_minutes:g}",
    ]
    if config.flows_dir:
        command += ["--dir", config.flows_dir]
    return command


def start_server(config: LauncherConfig, log_path: Path) -> subprocess.Popen:
    """Starts `chainforge serve` in its own process group, logging to a file.

    Its own group, so stopping it also stops anything it started.
    """
    log_path = Path(log_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log = open(log_path, "a")
    log.write(f"\n--- {time.strftime('%Y-%m-%d %H:%M:%S')} starting: "
              f"{' '.join(server_command(config))}\n")
    log.flush()
    env = dict(os.environ, PYTHONUNBUFFERED="1")
    try:
        return subprocess.Popen(
            server_command(config),
            stdout=log,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
            env=env,
        )
    finally:
        log.close()


def server_responds(url: str, timeout: float = 1.0) -> bool:
    """Whether a web server answers at url, with any response."""
    try:
        with urllib.request.urlopen(url, timeout=timeout):
            return True
    except urllib.error.HTTPError:
        return True
    except (urllib.error.URLError, OSError):
        return False


def wait_until_ready(
    url: str,
    process: Optional[subprocess.Popen] = None,
    timeout: float = 120.0,
    poll_interval: float = 0.5,
    responds: Callable[[str], bool] = server_responds,
) -> bool:
    """Waits for the server to answer. False if it exits first or never answers.

    The first start after installing can take a minute: RAG libraries are slow
    to import.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            return False
        if responds(url):
            return True
        time.sleep(poll_interval)
    return False


def stop_server(process: subprocess.Popen, grace_seconds: float = 10.0) -> None:
    """Stops the server and everything it started: politely, then by force."""
    if process.poll() is not None:
        return
    for sig, wait in ((signal.SIGTERM, grace_seconds), (signal.SIGKILL, 5.0)):
        try:
            os.killpg(process.pid, sig)
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=wait)
            return
        except subprocess.TimeoutExpired:
            continue


def why_it_stopped(log_path: Path) -> str:
    """"idle" if the server stopped itself for lack of open pages, else "exited"."""
    try:
        with open(log_path, "rb") as log:
            log.seek(0, os.SEEK_END)
            log.seek(max(0, log.tell() - 4000))
            tail = log.read().decode("utf-8", errors="replace")
    except OSError:
        return "exited"
    last_start = tail.rfind("--- ")
    return "idle" if IDLE_SHUTDOWN_MARKER in tail[last_start:] else "exited"
