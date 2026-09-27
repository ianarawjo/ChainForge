"""Keeps a history of this machine's energy readings, and works out each
request's share when it finishes (see attribution.py for how).

The front end calls `begin()` just before sending a request to a local model
server (Ollama) and `end()` once it has the reply, passing the server's own
timings. Between requests, the readings give the machine's idle power.
"""

import itertools
import threading
import time
from collections import deque
from typing import Callable, Deque, Dict, List, Optional, Tuple

from chainforge.energy.attribution import (
    GENERATION, LOAD, Baseline, Sample, Window, attribute, idle_baseline,
)
from chainforge.energy.meters.base import EnergyMeter

# Readings per second: often while a request runs, to catch when generation
# starts and stops; rarely otherwise, since reading the meter has a cost
# (about 3 ms on Apple silicon) that would itself show up as energy used.
BUSY_INTERVAL_S = 0.1
IDLE_INTERVAL_S = 0.5
HISTORY_S = 15 * 60
# Idle power comes from the last few minutes without requests, leaving out a
# moment after each request while the hardware winds down
BASELINE_WINDOW_S = 5 * 60
WIND_DOWN_S = 1.0
# Shorter than this, a model "load" is just the server finding it already loaded
MIN_LOAD_S = 0.05


class EnergyMonitor:
    def __init__(self, meter: EnergyMeter, clock: Callable[[], float] = time.time):
        self.meter = meter
        self._clock = clock
        self._lock = threading.Lock()
        self._samples: Deque[Sample] = deque()
        self._in_flight: Dict[str, float] = {}  # request -> when it began
        self._busy: Deque[Tuple[float, float]] = deque()  # finished requests' spans
        self._windows: Deque[Window] = deque()  # finished requests' windows
        self._ids = itertools.count(1)
        self._thread: Optional[threading.Thread] = None

    # --- Readings ---------------------------------------------------------

    def sample(self) -> None:
        """Takes a reading now."""
        with self._lock:
            self._sample_locked()

    def _sample_locked(self) -> None:
        now = self._clock()
        self._samples.append((now, self.meter.read()))
        cutoff = now - HISTORY_S
        while self._samples and self._samples[0][0] < cutoff:
            self._samples.popleft()
        while self._busy and self._busy[0][1] < cutoff:
            self._busy.popleft()
        while self._windows and self._windows[0].end < cutoff:
            self._windows.popleft()
        # A request never ended (e.g. its page closed) would otherwise count
        # as running forever, and leave no idle time to measure idle power from
        for request, began in list(self._in_flight.items()):
            if began < cutoff:
                del self._in_flight[request]
                self._busy.append((began, now))

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
            with self._lock:
                busy = bool(self._in_flight)
            time.sleep(BUSY_INTERVAL_S if busy else IDLE_INTERVAL_S)
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
            self._in_flight[request] = self._clock()
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

        since_reply_s: how long ago the reply arrived (the front end calls this
            just after). The server's timings (seconds) are counted back from then:
        load_s: loading the model (Ollama's load_duration)
        generation_s: reading the prompt and generating (prompt_eval + eval)
        total_s: all of it (total_duration)

        None if the request isn't known, or there's no idle time yet to
        measure idle power from.
        """
        with self._lock:
            self._sample_locked()
            now = self._clock()
            began = self._in_flight.pop(request, None)
            if began is None:
                return None
            replied = now - max(since_reply_s, 0.0)
            self._busy.append((began, replied + WIND_DOWN_S))

            windows = [Window(request, GENERATION, replied - generation_s, replied)]
            if load_s >= MIN_LOAD_S:
                load_start = replied - total_s
                windows.append(Window(request, LOAD, load_start, load_start + load_s))
            self._windows.extend(windows)

            baseline = self._baseline(now)
            if baseline is None:
                return None
            samples = list(self._samples)
            known = list(self._windows)

        result = attribute(request, known, samples, baseline)
        return {
            "energy_wh": result.generation_total / 3600,
            "noise_wh": result.noise / 3600,
            "components_wh": {c: j / 3600 for c, j in result.generation.items()},
            "load_energy_wh": sum(result.load.values()) / 3600 if result.load is not None else None,
            "shared": result.shared,
            "idle_w": baseline.total_watts,
            "meter": self.meter.name,
        }

    def _baseline(self, now: float) -> Optional[Baseline]:
        busy: List[Tuple[float, float]] = list(self._busy)
        busy.extend((began, float("inf")) for began in self._in_flight.values())
        samples = list(self._samples)
        # The last few minutes' idle time, or, during a long run with none,
        # whatever idle time is still in the history
        return (idle_baseline(samples, busy, now - BASELINE_WINDOW_S)
                or idle_baseline(samples, busy, now - HISTORY_S))

    def status(self) -> dict:
        with self._lock:
            baseline = self._baseline(self._clock())
        return {
            "available": True,
            "meter": self.meter.name,
            "components": self.meter.components(),
            "idle_w": baseline.total_watts if baseline else None,
        }
