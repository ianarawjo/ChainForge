# /// script
# requires-python = ">=3.10"
# dependencies = ["rumps>=0.4"]
# ///
"""ChainForge in the macOS menu bar, running only while it is being used.

Launching it starts `chainforge serve` on this machine only, opens ChainForge
in the default browser, and puts a ChainForge icon in the menu bar with Open,
Update, Show Log and Quit. Quitting stops the server. The server is started
with --idle-shutdown, so it also stops by itself once no ChainForge tab has
been open for a while -- including if this app is force-quit.

It never updates ChainForge by itself: once a day it checks for a newer
version and says so, and Update ChainForge installs it when chosen.

Built into ChainForge.app by build_app.sh, which runs it with `uv run`.
"""

import atexit
import queue
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import launcher_core as core  # noqa: E402

CONFIG_PATH = HERE / "launcher.json"
ICON_PATH = HERE / "menubar-icon.png"
LOG_PATH = core.LOG_DIR / "chainforge.log"
UPDATE_CHECK_PATH = core.SUPPORT_DIR / "update-check.json"


def open_in_browser(url: str) -> None:
    subprocess.run(["open", url], check=False)


def notify(message: str) -> None:
    """A macOS notification. Works without this app being a signed bundle."""
    script = f"display notification {message!r} with title \"ChainForge\""
    subprocess.run(["osascript", "-e", script.replace("'", '"')], check=False)


def run_menu_bar(config: core.LauncherConfig, lock: core.SingleInstance) -> None:
    import rumps
    from AppKit import NSApplication, NSApplicationActivationPolicyAccessory

    class ChainForgeMenuBar(rumps.App):
        def __init__(self):
            super().__init__(
                "ChainForge",
                icon=str(ICON_PATH) if ICON_PATH.exists() else None,
                title=None if ICON_PATH.exists() else "CF",
                quit_button=None,
            )
            self.process = None
            self.state = "starting"
            self.started_at = time.monotonic()
            self.status = rumps.MenuItem("Starting ChainForge…")
            # Results of work done off the main thread (checking for and
            # installing updates), for tick() to act on: rumps menus and
            # alerts only work on the main thread
            self.events = queue.Queue()
            self.installed = None  # this ChainForge's version, once known
            self.available = None  # a newer version on PyPI, once known
            self.checking = False
            self.updated_to = None  # the version just installed, to say so once it's up
            self.update_item = rumps.MenuItem("Update ChainForge…", callback=self.update_chainforge)
            items = [
                self.status,
                None,
                rumps.MenuItem("Open ChainForge", callback=self.open_chainforge),
            ]
            if config.uv:  # an app built before updates were added has no uv
                items.append(self.update_item)
            items += [
                rumps.MenuItem("Show Log", callback=self.show_log),
                None,
                rumps.MenuItem("Quit ChainForge", callback=self.quit_chainforge),
            ]
            self.menu = items
            self.timer = rumps.Timer(self.tick, 1)

        def begin(self):
            if core.port_in_use(config.host, config.port):
                rumps.alert(
                    title="ChainForge can't start",
                    message=f"Something is already using port {config.port}. "
                    "If ChainForge is already running in a terminal, stop it first.",
                )
                self.finish()
                return
            self.process = core.start_server(config, LOG_PATH)
            atexit.register(self.stop_server)
            self.timer.start()
            if config.uv:
                self.check_for_update(chosen=False)

        # --- updates ---------------------------------------------------

        def check_for_update(self, chosen: bool):
            """Looks up the installed and newest versions, off the main thread.
            Unless someone chose to, at most once a day."""
            if self.checking:
                return
            record = core.UpdateCheck(UPDATE_CHECK_PATH)
            if not chosen and not record.due():
                # Still worth knowing the version, for the menu
                threading.Thread(target=self._find_installed, daemon=True).start()
                return
            self.checking = True

            def work():
                installed = core.installed_version(config.uv)
                latest = core.latest_version()
                if latest is not None:
                    record.checked()
                self.events.put(("checked", chosen, installed, latest))

            threading.Thread(target=work, daemon=True).start()

        def _find_installed(self):
            self.events.put(("checked", False, core.installed_version(config.uv), None))

        def on_checked(self, chosen, installed, latest):
            self.checking = False
            self.installed = installed or self.installed
            if self.state == "running" and self.installed:
                self.status.title = f"ChainForge {self.installed} is running"
            if core.is_newer(latest, self.installed):
                self.available = latest
                self.update_item.title = f"Update to ChainForge {latest}…"
                record = core.UpdateCheck(UPDATE_CHECK_PATH)
                if not chosen and record.should_announce(latest):
                    record.announced(latest)
                    notify(f"ChainForge {latest} is available. "
                           "Choose Update in the ChainForge menu-bar menu to install it.")
            if not chosen:
                return
            if latest is None:
                rumps.alert(title="Couldn't check for updates",
                            message="PyPI, where ChainForge is published, didn't answer. "
                                    "Check the internet connection and try again.")
            elif self.installed is None:
                rumps.alert(title="Can't update ChainForge from here",
                            message="This ChainForge wasn't installed with uv, so update it the "
                                    "way it was installed. The newest version is " + latest + ".")
            elif not core.is_newer(latest, self.installed):
                rumps.alert(title="ChainForge is up to date",
                            message=f"You have the newest version, {self.installed}.")
            else:
                answer = rumps.alert(
                    title=f"Update to ChainForge {latest}?",
                    message=f"You have {self.installed}. Updating restarts ChainForge, "
                            "which stops anything running in it. Your flows are kept.",
                    ok="Update", cancel="Not Now")
                if answer == 1:
                    self.install_update(latest)

        def update_chainforge(self, _item):
            if self.state == "running":
                self.check_for_update(chosen=True)

        def install_update(self, version):
            """Stops ChainForge, updates it with uv off the main thread, and
            starts it again (the old version, if the update failed)."""
            self.state = "updating"
            self.status.title = f"Updating to ChainForge {version}…"
            self.stop_server()

            def work():
                self.events.put(("updated", version, core.upgrade(config.uv, LOG_PATH)))

            threading.Thread(target=work, daemon=True).start()

        def on_updated(self, version, ok):
            if ok:
                self.installed, self.available = version, None
                self.update_item.title = "Update ChainForge…"
            else:
                rumps.alert(title="ChainForge wasn't updated",
                            message="The update didn't work, so ChainForge will start as it was. "
                                    "See the log for details: " + str(LOG_PATH))
            self.status.title = "Starting ChainForge…"
            self.state = "starting"
            self.started_at = time.monotonic()
            self.updated_to = version if ok else None
            self.process = core.start_server(config, LOG_PATH)

        # --- the server --------------------------------------------------

        def tick(self, _timer):
            while not self.events.empty():
                event, *args = self.events.get()
                if event == "checked":
                    self.on_checked(*args)
                elif event == "updated":
                    self.on_updated(*args)
            if self.state in ("stopping", "updating"):
                return
            exited = self.process.poll() is not None
            if self.state == "starting":
                if exited:
                    rumps.alert(
                        title="ChainForge didn't start",
                        message="See the log for details: " + str(LOG_PATH),
                    )
                    self.finish()
                elif core.server_responds(config.url, timeout=0.5):
                    self.state = "running"
                    self.status.title = (f"ChainForge {self.installed} is running"
                                         if self.installed else "ChainForge is running")
                    open_in_browser(config.url)
                    if self.updated_to:
                        # The restarted server doesn't know tabs opened before it
                        notify(f"ChainForge is updated to {self.updated_to}. "
                               "Close any ChainForge tabs opened before the update.")
                        self.updated_to = None
                elif time.monotonic() - self.started_at > 180:
                    rumps.alert(
                        title="ChainForge is taking too long to start",
                        message="See the log for details: " + str(LOG_PATH),
                    )
                    self.quit_chainforge(None)
            elif exited:
                if core.why_it_stopped(LOG_PATH) == "idle":
                    minutes = config.idle_shutdown_minutes
                    notify(
                        "ChainForge stopped because no ChainForge tab was open for "
                        f"{minutes:g} minute{'' if minutes == 1 else 's'}."
                    )
                else:
                    notify("ChainForge stopped unexpectedly. Choose Show Log for details.")
                self.finish()

        def open_chainforge(self, _item):
            if self.state == "running":
                open_in_browser(config.url)

        def show_log(self, _item):
            LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            LOG_PATH.touch()
            subprocess.run(["open", str(LOG_PATH)], check=False)

        def stop_server(self):
            if self.process is not None:
                core.stop_server(self.process)

        def quit_chainforge(self, _item):
            self.state = "stopping"
            self.status.title = "Stopping ChainForge…"
            self.stop_server()
            self.finish()

        def finish(self):
            self.state = "stopping"
            self.timer.stop()
            lock.release()
            rumps.quit_application()

    # A menu-bar app, not a Dock app.
    NSApplication.sharedApplication().setActivationPolicy_(
        NSApplicationActivationPolicyAccessory
    )
    app = ChainForgeMenuBar()

    # Logging out or `kill` sends SIGTERM: stop the server on the way out.
    def on_terminate(_signum, _frame):
        app.quit_chainforge(None)

    signal.signal(signal.SIGTERM, on_terminate)
    app.begin()
    app.run()


def main() -> None:
    config = core.LauncherConfig.load(CONFIG_PATH)
    if "--check" in sys.argv:
        # Used by build_app.sh: proves the dependencies and settings load.
        import rumps  # noqa: F401
        print(f"OK: will run {' '.join(core.server_command(config))}")
        return

    lock = core.SingleInstance(core.SUPPORT_DIR / "launcher.lock")
    if not lock.acquire():
        # Already running: just open another ChainForge tab once it answers.
        if core.wait_until_ready(config.url, timeout=120):
            open_in_browser(config.url)
        return
    run_menu_bar(config, lock)


if __name__ == "__main__":
    main()
