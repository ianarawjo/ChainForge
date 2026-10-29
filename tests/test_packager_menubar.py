"""Tests for the menu-bar launcher's update flow (packager/chainforge_menubar.py).

rumps and AppKit are replaced with stand-ins that record alerts and menu
titles, and the server and uv with fakes, so the app's logic runs anywhere:
checking for a newer ChainForge, saying so, and updating when chosen.
"""

import importlib.util
import sys
import time
import types
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    sys.platform == "win32", reason="the launcher is for macOS (POSIX process groups)"
)

LAUNCHER_DIR = Path(__file__).resolve().parent.parent / "packager"


class FakeRumps(types.ModuleType):
    def __init__(self):
        super().__init__("rumps")
        self.apps, self.alerts, self.answer = [], [], 1
        fake = self

        class MenuItem:
            def __init__(self, title, callback=None):
                self.title, self.callback = title, callback

        class App:
            def __init__(self, name, icon=None, title=None, quit_button=None):
                self.menu = []
                fake.apps.append(self)

            def run(self):
                pass

        class Timer:
            def __init__(self, callback, interval):
                pass

            def start(self):
                pass

            def stop(self):
                pass

        self.MenuItem, self.App, self.Timer = MenuItem, App, Timer

    def alert(self, title, message, ok=None, cancel=None):
        self.alerts.append(title)
        return self.answer

    def quit_application(self):
        pass


class FakeProcess:
    def __init__(self):
        self.pid, self.stopped = 12345, False

    def poll(self):
        return 0 if self.stopped else None


@pytest.fixture
def launcher(monkeypatch, tmp_path):
    rumps = FakeRumps()
    appkit = types.ModuleType("AppKit")
    appkit.NSApplicationActivationPolicyAccessory = 1
    appkit.NSApplication = types.SimpleNamespace(
        sharedApplication=lambda: types.SimpleNamespace(setActivationPolicy_=lambda p: None))
    monkeypatch.setitem(sys.modules, "rumps", rumps)
    monkeypatch.setitem(sys.modules, "AppKit", appkit)

    spec = importlib.util.spec_from_file_location("chainforge_menubar", LAUNCHER_DIR / "chainforge_menubar.py")
    menubar = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(menubar)
    core = menubar.core

    state = types.SimpleNamespace(
        rumps=rumps, notes=[], opened=[], processes=[], upgrades=[],
        installed="0.3.7.7", latest="0.3.7.8", upgrade_works=True)

    def start_server(config, log_path):
        state.processes.append(FakeProcess())
        return state.processes[-1]

    def stop_server(process, grace_seconds=10.0):
        process.stopped = True

    def upgrade(uv, log_path):
        state.upgrades.append(uv)
        if state.upgrade_works:
            state.installed = state.latest
        return state.upgrade_works

    monkeypatch.setattr(core, "start_server", start_server)
    monkeypatch.setattr(core, "stop_server", stop_server)
    monkeypatch.setattr(core, "port_in_use", lambda host, port: False)
    monkeypatch.setattr(core, "server_responds", lambda url, timeout=1.0: True)
    monkeypatch.setattr(core, "installed_version", lambda uv: state.installed)
    monkeypatch.setattr(core, "latest_version", lambda: state.latest)
    monkeypatch.setattr(core, "upgrade", upgrade)
    monkeypatch.setattr(menubar, "UPDATE_CHECK_PATH", tmp_path / "update-check.json")
    monkeypatch.setattr(menubar, "LOG_PATH", tmp_path / "chainforge.log")
    monkeypatch.setattr(menubar, "notify", state.notes.append)
    monkeypatch.setattr(menubar, "open_in_browser", state.opened.append)
    monkeypatch.setattr(menubar.atexit, "register", lambda f: None)
    # Not this test process's SIGTERM handler
    monkeypatch.setattr(menubar.signal, "signal", lambda *args: None)

    def launch(uv="/x/uv"):
        config = core.LauncherConfig(chainforge="/x/chainforge", uv=uv)
        lock = types.SimpleNamespace(release=lambda: None)
        menubar.run_menu_bar(config, lock)
        return rumps.apps[-1]

    state.launch = launch
    return state


def settle(app, until, seconds=5.0):
    """Runs the app's timer ticks until `until()` holds (work happens on threads)."""
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        app.tick(None)
        if until():
            return
        time.sleep(0.01)
    raise AssertionError("timed out waiting for the launcher")


def titles(app):
    return [item.title for item in app.menu if item is not None]


def test_says_once_when_a_newer_version_is_out(launcher):
    app = launcher.launch()
    settle(app, lambda: app.state == "running" and launcher.notes)
    assert launcher.notes == [
        "ChainForge 0.3.7.8 is available. Choose Update in the ChainForge menu-bar menu to install it."]
    assert "Update to ChainForge 0.3.7.8…" in titles(app)
    assert app.status.title == "ChainForge 0.3.7.7 is running"
    assert launcher.upgrades == []  # never updates by itself

    # Started again the same day: no second notice, but the menu still knows
    app.quit_chainforge(None)
    launcher.notes.clear()
    again = launcher.launch()
    settle(again, lambda: again.state == "running" and again.installed)
    assert launcher.notes == []


def test_updates_when_chosen_and_restarts(launcher):
    app = launcher.launch()
    settle(app, lambda: app.state == "running" and app.available)
    launcher.rumps.answer = 1  # "Update"
    app.update_chainforge(None)
    settle(app, lambda: launcher.upgrades and app.state == "running")
    assert launcher.rumps.alerts == ["Update to ChainForge 0.3.7.8?"]
    assert launcher.upgrades == ["/x/uv"]
    first, second = launcher.processes
    assert first.stopped and not second.stopped  # stopped, updated, started again
    assert app.status.title == "ChainForge 0.3.7.8 is running"
    assert "Update ChainForge…" in titles(app)
    assert launcher.notes[-1] == (
        "ChainForge is updated to 0.3.7.8. Close any ChainForge tabs opened before the update.")


def test_not_now_leaves_it_running(launcher):
    app = launcher.launch()
    settle(app, lambda: app.state == "running" and app.available)
    launcher.rumps.answer = 0  # "Not Now"
    app.update_chainforge(None)
    settle(app, lambda: launcher.rumps.alerts)
    assert launcher.upgrades == [] and len(launcher.processes) == 1


def test_a_failed_update_starts_the_old_version_again(launcher):
    launcher.upgrade_works = False
    app = launcher.launch()
    settle(app, lambda: app.state == "running" and app.available)
    app.update_chainforge(None)
    settle(app, lambda: launcher.upgrades and app.state == "running")
    assert launcher.rumps.alerts[-1] == "ChainForge wasn't updated"
    assert app.status.title == "ChainForge 0.3.7.7 is running"
    assert len(launcher.processes) == 2


def test_up_to_date(launcher):
    launcher.latest = "0.3.7.7"
    app = launcher.launch()
    settle(app, lambda: app.state == "running" and app.installed)
    app.update_chainforge(None)
    settle(app, lambda: launcher.rumps.alerts)
    assert launcher.rumps.alerts == ["ChainForge is up to date"]
    assert launcher.notes == []


def test_offline(launcher):
    launcher.latest = None
    app = launcher.launch()
    settle(app, lambda: app.state == "running" and app.installed)
    app.update_chainforge(None)
    settle(app, lambda: launcher.rumps.alerts)
    assert launcher.rumps.alerts == ["Couldn't check for updates"]


def test_an_app_built_before_updates_has_no_update_item(launcher):
    app = launcher.launch(uv=None)
    settle(app, lambda: app.state == "running")
    assert not any("Update" in t for t in titles(app))
    assert app.status.title == "ChainForge is running"
