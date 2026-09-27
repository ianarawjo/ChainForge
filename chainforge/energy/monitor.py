"""Keeps a history of this machine's energy readings, and works out each
request's share when it finishes (see attribution.py for how).

The front end calls `begin()` just before sending a request to a local model
server (Ollama) and `end()` once it has the reply, with the server's own
timings. Between requests, the readings give the machine's idle power.

Built to run for as long as the server does, cheaply: reading the meter has a
cost (about 3 ms on Apple silicon, which would itself show up as energy used),
so it reads often only while requests run, and rarely when ChainForge isn't
running local models. The history is bounded (the last 15 minutes).
"""

import itertools
import math
import threading
import time
from typing import Callable, Dict, List, Optional, Tuple

from chainforge.energy.attribution import (
    GENERATION, LOAD, Baseline, Readings, Window, attribute, idle_baseline,
)
from chainforge.energy.meters.base import EnergyMeter

# Seconds between readings: often while a request runs, to catch when
# generation starts and stops; less often for a while after, to keep track of
# idle power; rarely once nothing has used the monitor for a while.
BUSY_INTERVAL_S = 0.1
IDLE_INTERVAL_S = 1.0
DORMANT_INTERVAL_S = 5.0
ACTIVE_FOR_S = 10 * 60
HISTORY_S = 15 * 60
# Idle power comes from the last few minutes without requests, leaving out a
# moment after each request while the hardware winds down
BASELINE_WINDOW_S = 5 * 60
WIND_DOWN_S = 1.0
# Shorter than this, a model "load" is just the server finding it already loaded
MIN_LOAD_S = 0.05
# Timings further off than this from the request's own span are rejected
TIMING_SLACK_S = 2.0


class EnergyMonitor:
    def __init__(self, meter: EnergyMeter, clock: Callable[[], float] = time.monotonic):
        self.meter = meter
        self._clock = clock
        self._lock = threading.Lock()
        self._readings = Readings(meter.components())
        self._in_flight: Dict[str, float] = {}  # request -> when it began
        self._busy: List[Tuple[float, float]] = []  # finished requests' spans
        self._windows: List[Window] = []  # finished requests' windows
        self._ids = itertools.count(1)
        self._last_used = clock()
        self._wake = threading.Event()
        self._last_baseline: Optional[Baseline] = None
        self._thread: Optional[threading.Thread] = None

    # --- Readings ---------------------------------------------------------

    def sample(self) -> None:
        """Takes a reading now."""
        with self._lock:
            self._sample_locked()

    def _sample_locked(self) -> None:
        now = self._clock()
        totals = self.meter.read()
        self._readings.append(now, tuple(totals.get(c, 0.0) for c in self._readings.components))
        cutoff = now - HISTORY_S
        self._readings.trim(cutoff)
        # A request never ended (e.g. its page closed) would otherwise count
        # as running forever, and leave no idle time to measure idle power from
        for request, began in list(self._in_flight.items()):
            if began < cutoff:
                del self._in_flight[request]
                self._busy.append((began, now))
        if self._busy and self._busy[0][1] < cutoff:
            self._busy = [s for s in self._busy if s[1] >= cutoff]
        if self._windows and self._windows[0].end < cutoff:
            self._windows = [w for w in self._windows if w.end >= cutoff]

    def _interval(self) -> float:
        with self._lock:
            if self._in_flight:
                return BUSY_INTERVAL_S
            idle_for = self._clock() - self._last_used
        return IDLE_INTERVAL_S if idle_for < ACTIVE_FOR_S else DORMANT_INTERVAL_S

    def start(self) -> None:
        """Starts taking readings in the background, if it hasn't already."""
        with self._lock:
            if self._thread is not None:
                return
            self._sample_locked()
            self._thread = threading.Thread(target=self._run, name="energy-monitor", daemon=True)
            self._thread.start()

    def _run(self) -> None:
        while True:
            # A request starting wakes this early, to read often from then on
            self._wake.wait(self._interval())
            self._wake.clear()
            try:
                self.sample()
            except Exception:  # a failed reading shouldn't stop the monitor
                pass

    # --- Requests ---------------------------------------------------------

    def begin(self) -> str:
        """Marks a request as started. Returns its id, for `end()`."""
        with self._lock:
            self._sample_locked()
            request = str(next(self._ids))
            self._in_flight[request] = self._last_used = self._clock()
        self._wake.set()
        return request

    def cancel(self, request: str) -> None:
        """A request that failed or was cancelled: counts as busy time, gets no energy."""
        with self._lock:
            began = self._in_flight.pop(request, None)
            if began is not None:
                self._busy.append((began, self._clock() + WIND_DOWN_S))

    def end(
        self,
        request: str,
        since_reply_s: float,
        load_s: float,
        generation_s: float,
        total_s: float,
    ) -> Optional[dict]:
        """A request's energy above idle, once it has finished.

        since_reply_s: how long ago the reply arrived. The server's timings
            (seconds) are counted back from then:
        load_s: loading the model (Ollama's load_duration)
        generation_s: reading the prompt and generating (prompt_eval + eval)
        total_s: all of it (total_duration)

        None if the request isn't known, its timings don't fit its span, or
        there's no idle time yet to measure idle power from.
        """
        with self._lock:
            self._sample_locked()
            now = self._last_used = self._clock()
            began = self._in_flight.pop(request, None)
            if began is None:
                return None
            replied = now - since_reply_s
            self._busy.append((began, replied + WIND_DOWN_S))
            timings = (since_reply_s, load_s, generation_s, total_s)
            if (not all(math.isfinite(x) and x >= 0 for x in timings)
                    or replied < began - TIMING_SLACK_S
                    or generation_s > total_s + TIMING_SLACK_S
                    or load_s > total_s + TIMING_SLACK_S
                    or replied - generation_s < began - TIMING_SLACK_S):
                return None

            windows = [Window(request, GENERATION, replied - generation_s, replied)]
            if load_s >= MIN_LOAD_S:
                load_start = replied - total_s
                windows.append(Window(request, LOAD, load_start, load_start + load_s))
            self._windows.extend(windows)

            baseline = self._baseline(now)
            if baseline is None:
                return None
            result = attribute(request, self._windows, self._readings, baseline)

        # Ollama counts waiting for a busy model as loading it: where the
        # "load" came to no more than idle power's swings, nothing was loaded
        load_wh = None
        if result.load is not None and result.load_total > max(result.load_noise, 0.0) + 1e-9:
            load_wh = result.load_total / 3600
        return {
            "energy_wh": result.generation_total / 3600,
            "noise_wh": result.noise / 3600,
            "components_wh": {c: j / 3600 for c, j in result.generation.items()},
            "load_energy_wh": load_wh,
            "shared": result.shared,
            "idle_w": baseline.total_watts,
            "meter": self.meter.name,
        }

    def _baseline(self, now: float) -> Optional[Baseline]:
        busy = list(self._busy)
        busy.extend((began, math.inf) for began in self._in_flight.values())
        # The last few minutes' idle time, or, during a long run with none,
        # whatever idle time is still in the history, or, for a run longer
        # than the history, the idle power measured last
        baseline = (idle_baseline(self._readings, busy, now - BASELINE_WINDOW_S)
                    or idle_baseline(self._readings, busy, now - HISTORY_S))
        if baseline is not None:
            self._last_baseline = baseline
        return baseline or self._last_baseline

    def status(self) -> dict:
        with self._lock:
            self._last_used = self._clock()
            baseline = self._baseline(self._clock())
        self._wake.set()  # back from dormant: read at the idle rate
        return {
            "available": True,
            "meter": self.meter.name,
            "components": self.meter.components(),
            "idle_w": baseline.total_watts if baseline else None,
        }
