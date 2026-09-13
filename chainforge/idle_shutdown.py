"""Stop the ChainForge server when nobody is using it.

ChainForge can run Python code from flows and read local files, so it should
not stay up on a machine nobody is sitting at. With
`chainforge serve --idle-shutdown MINUTES`, any request to the server counts
as use. An open ChainForge page sends a heartbeat every few minutes (see
react-server/src/backend/serverHeartbeat.ts), so the server stays up while a
tab is open, and stops once none has been open for that long.
"""

import os
import signal
import threading
import time
from typing import Callable, Optional


class IdleWatchdog:
    """Calls `on_idle`, once, after `timeout_seconds` with no activity.

    Activity is recorded with `touch()`. `check()` does the deciding and can be
    called directly (as the tests do, with a fake clock); `start()` calls it
    from a background thread every `check_interval_seconds`.
    """

    def __init__(
        self,
        timeout_seconds: float,
        on_idle: Callable[[], None],
        clock: Callable[[], float] = time.monotonic,
        check_interval_seconds: float = 30.0,
        suspend_gap_seconds: float = 300.0,
    ):
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self.timeout_seconds = timeout_seconds
        self._on_idle = on_idle
        self._clock = clock
        self._check_interval = check_interval_seconds
        self._suspend_gap = suspend_gap_seconds
        self._lock = threading.Lock()
        self._last_activity = clock()
        self._last_check: Optional[float] = None
        self._fired = False
        self._stopped = threading.Event()

    def touch(self) -> None:
        """Records activity now."""
        with self._lock:
            self._last_activity = self._clock()

    def seconds_idle(self) -> float:
        with self._lock:
            return max(0.0, self._clock() - self._last_activity)

    def check(self) -> bool:
        """Calls `on_idle` if idle for the whole timeout. Returns whether it has."""
        now = self._clock()
        with self._lock:
            if self._fired:
                return True
            if (
                self._last_check is not None
                and now - self._last_check > self._suspend_gap
            ):
                # Far longer than a check interval passed between checks, so the
                # process was suspended -- the machine slept. Open pages could not
                # send heartbeats meanwhile, so start the idle period again
                # instead of shutting down the moment the machine wakes.
                self._last_activity = now
            self._last_check = now
            if now - self._last_activity < self.timeout_seconds:
                return False
            self._fired = True
        self._on_idle()
        return True

    def start(self) -> None:
        """Checks in a background daemon thread until idle or `stop()`."""

        def run():
            while not self._stopped.wait(self._check_interval):
                if self.check():
                    return

        threading.Thread(target=run, name="idle-shutdown", daemon=True).start()

    def stop(self) -> None:
        self._stopped.set()


def stop_this_server(message: str) -> None:
    """Stops the running server process, as if interrupted from the terminal.

    SIGINT makes the Flask server's main loop return, so `chainforge serve`
    exits normally. Should it not, a daemon timer forces the exit.
    """
    print(message, flush=True)
    fallback = threading.Timer(15.0, lambda: os._exit(0))
    fallback.daemon = True
    fallback.start()
    os.kill(os.getpid(), signal.SIGINT)


def idle_shutdown_message(minutes: float) -> str:
    """The line printed when stopping; the macOS launcher looks for it."""
    unit = "minute" if minutes == 1 else "minutes"
    return (
        f"No ChainForge page has been open for {minutes:g} {unit}. "
        "Stopping the server."
    )
