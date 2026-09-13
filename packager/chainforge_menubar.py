# /// script
# requires-python = ">=3.10"
# dependencies = ["rumps>=0.4"]
# ///
"""ChainForge in the macOS menu bar, running only while it is being used.

Launching it starts `chainforge serve` on this machine only, opens ChainForge
in the default browser, and puts a ChainForge icon in the menu bar with Open,
Show Log and Quit. Quitting stops the server. The server is started with
--idle-shutdown, so it also stops by itself once no ChainForge tab has been
open for a while -- including if this app is force-quit.

Built into ChainForge.app by build_app.sh, which runs it with `uv run`.
"""

import atexit
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import launcher_core as core  # noqa: E402

CONFIG_PATH = HERE / "launcher.json"
ICON_PATH = HERE / "menubar-icon.png"
LOG_PATH = core.LOG_DIR / "chainforge.log"


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
            self.menu = [
                self.status,
                None,
                rumps.MenuItem("Open ChainForge", callback=self.open_chainforge),
                rumps.MenuItem("Show Log", callback=self.show_log),
                None,
                rumps.MenuItem("Quit ChainForge", callback=self.quit_chainforge),
            ]
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

        def tick(self, _timer):
            if self.state == "stopping":
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
                    self.status.title = "ChainForge is running"
                    open_in_browser(config.url)
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
