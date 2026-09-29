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
# A model load averages at least this much above idle (loading from RAM, the
# M4 Max drew ~9 W); less, it was waiting for a busy model, which Ollama
# counts as loading, plus measurement jitter
MIN_LOAD_WATTS = 1.0
# Timings further off than this from the request's own span are rejected
TIMING_SLACK_S = 2.0
# How often to check the power source and mode, which change idle power and
# the energy a request takes (see EnergyMeter.conditions)
CONDITIONS_EVERY_S = 10.0
# And how often to refresh any that are slow to read (e.g. by running a
# command), outside the lock; also at a request's start, if this long since
REFRESH_CONDITIONS_EVERY_S = 30.0
REFRESH_AT_REQUEST_AFTER_S = 2.0
# Idle power is measured afresh when these change (heat is only recorded:
# a long run warming the chip would otherwise keep discarding it)
BASELINE_CONDITIONS = ("power_source", "power_mode", "gpu_power_limit")
# Thermal states that aren't hot
COOL = ("nominal", "unknown")
# How often to check for other programs using the GPU, where the meter can
# (see EnergyMeter.other_gpu_use): their energy would be counted as the
# request's, or as idle power
OTHER_USE_EVERY_S = 1.0


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
        self._last_baseline_since = -math.inf  # the power settings it was measured under began
        self._conditions: Dict[str, str] = {}
        self._conditions_checked = -math.inf
        self._conditions_since = -math.inf  # when the current power settings began
        self._request_conditions: Dict[str, Dict[str, str]] = {}
        self._refreshed_at = -math.inf
        # Spans in which other programs used the GPU: (start, end, their names)
        self._other_use: List[Tuple[float, float, Tuple[str, ...]]] = []
        self._other_use_lock = threading.Lock()  # the meter's check isn't reentrant
        self._other_use_checked = clock()
        self._other_use_known = False  # whether the meter can tell
        self._thread: Optional[threading.Thread] = None
        self._stopped = False

    # --- Readings ---------------------------------------------------------

    def sample(self) -> None:
        """Takes a reading now."""
        with self._lock:
            self._sample_locked()

    def _check_conditions_locked(self, now: float) -> Dict[str, str]:
        """The power settings now. When they've changed since the last check,
        idle power is measured afresh from here on."""
        self._conditions_checked = now
        try:
            read = self.meter.conditions()
        except Exception:
            read = {}
        # A value that couldn't be read isn't a change: the last one stands
        conditions = dict(self._conditions)
        conditions.update({k: v for k, v in read.items() if v and v != "unknown"})
        key = lambda c: tuple(c.get(k) for k in BASELINE_CONDITIONS)  # noqa: E731
        if key(conditions) != key(self._conditions) and self._conditions:
            self._conditions_since = now  # a change, not the first check
        self._conditions = conditions
        # Heat that builds up during a request is recorded with it, not only
        # heat at its start (when a GPU has only just started working)
        thermal = conditions.get("thermal")
        if thermal and thermal not in COOL:
            for recorded in self._request_conditions.values():
                if recorded.get("thermal") in (None,) + COOL:
                    recorded["thermal"] = thermal
        return conditions

    def _refresh_conditions(self, if_older_than: float) -> None:
        """Updates the meter's slow conditions (e.g. pmset's), outside the
        lock, so a slow command can't hold up readings or requests."""
        now = self._clock()
        if now - self._refreshed_at < if_older_than:
            return
        self._refreshed_at = now
        try:
            self.meter.refresh_conditions()
        except Exception:
            pass

    def _check_other_use(self, if_older_than: float) -> None:
        """Notes whether other programs used the GPU since the last check,
        outside the lock (on Windows, the check takes a few milliseconds)."""
        with self._other_use_lock:
            now = self._clock()
            if now - self._other_use_checked < if_older_than:
                return
            since, self._other_use_checked = self._other_use_checked, now
            try:
                others = self.meter.other_gpu_use()
            except Exception:
                others = None
            self._other_use_known = others is not None
        if others:
            with self._lock:
                self._other_use.append((since, now, tuple(others)))

    def _sample_locked(self) -> None:
        now = self._clock()
        if now - self._conditions_checked >= CONDITIONS_EVERY_S:
            self._check_conditions_locked(now)
        totals = self.meter.read()
        self._readings.append(now, tuple(totals.get(c, 0.0) for c in self._readings.components))
        cutoff = now - HISTORY_S
        self._readings.trim(cutoff)
        # A request never ended (e.g. its page closed) would otherwise count
        # as running forever, and leave no idle time to measure idle power from
        for request, began in list(self._in_flight.items()):
            if began < cutoff:
                del self._in_flight[request]
                self._request_conditions.pop(request, None)
                self._busy.append((began, now))
        if self._busy and self._busy[0][1] < cutoff:
            self._busy = [s for s in self._busy if s[1] >= cutoff]
        if self._windows and self._windows[0].end < cutoff:
            self._windows = [w for w in self._windows if w.end >= cutoff]
        if self._other_use and self._other_use[0][1] < cutoff:
            self._other_use = [u for u in self._other_use if u[1] >= cutoff]

    def _interval(self) -> float:
        with self._lock:
            if self._in_flight:
                return BUSY_INTERVAL_S
            idle_for = self._clock() - self._last_used
        return IDLE_INTERVAL_S if idle_for < ACTIVE_FOR_S else DORMANT_INTERVAL_S

    def start(self) -> None:
        """Starts taking readings in the background, if it hasn't already."""
        # Before the first reading, so it's under the right power mode
        # (rate-limited: this is called on every energy request)
        self._refresh_conditions(REFRESH_CONDITIONS_EVERY_S)
        with self._lock:
            if self._thread is not None:
                return
            self._sample_locked()
            self._thread = threading.Thread(target=self._run, name="energy-monitor", daemon=True)
            self._thread.start()

    def stop(self) -> None:
        """Stops the background readings (e.g. in tests); they don't restart."""
        self._stopped = True
        self._wake.set()

    def _run(self) -> None:
        while not self._stopped:
            # A request starting wakes this early, to read often from then on
            self._wake.wait(self._interval())
            self._wake.clear()
            if self._stopped:
                break
            self._refresh_conditions(REFRESH_CONDITIONS_EVERY_S)
            self._check_other_use(OTHER_USE_EVERY_S)
            try:
                self.sample()
            except Exception:  # a failed reading shouldn't stop the monitor
                pass

    # --- Requests ---------------------------------------------------------

    def begin(self) -> str:
        """Marks a request as started. Returns its id, for `end()`."""
        # So a power mode just switched to is what it's recorded under
        self._refresh_conditions(REFRESH_AT_REQUEST_AFTER_S)
        # So other programs' use of the GPU up to now isn't counted as during it
        self._check_other_use(0)
        with self._lock:
            self._sample_locked()
            request = str(next(self._ids))
            self._in_flight[request] = self._last_used = self._clock()
            # A copy: heat during the request is added to it
            self._request_conditions[request] = dict(self._check_conditions_locked(self._clock()))
        self._wake.set()
        return request

    def cancel(self, request: str) -> None:
        """A request that failed or was cancelled: counts as busy time, gets no energy."""
        with self._lock:
            began = self._in_flight.pop(request, None)
            self._request_conditions.pop(request, None)
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
        # The time `since_reply_s` counts back from: now, not after waiting
        # for the lock (e.g. while another request is being settled)
        now = self._clock()
        self._check_other_use(0)  # up to the end of the request
        with self._lock:
            self._sample_locked()
            self._last_used = now
            began = self._in_flight.pop(request, None)
            if began is None:
                return None
            conditions_now = self._check_conditions_locked(now)  # adds heat up to now
            conditions = self._request_conditions.pop(request, {})
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

            baseline, baseline_current = self._baseline(now)
            if baseline is None:
                return None
            result = attribute(request, self._windows, self._readings, baseline)
            start = min(w.start for w in windows)
            others = sorted({name for s, e, names in self._other_use
                             if s < replied and e > start for name in names})

        # Ollama counts waiting for a busy model as loading it: where the
        # "load" came to no more than idle power's swings, nothing was loaded
        # Also no more than a trickle of power: on a steady machine, idle
        # power barely swings, and jitter alone would pass for a load
        load_wh = None
        if result.load is not None and result.load_total > max(
                result.load_noise, MIN_LOAD_WATTS * result.load_seconds):
            load_wh = result.load_total / 3600
        return {
            "energy_wh": result.generation_total / 3600,
            "noise_wh": result.noise / 3600,
            "components_wh": {c: j / 3600 for c, j in result.generation.items()},
            "load_energy_wh": load_wh,
            "shared": result.shared,
            "idle_w": baseline.total_watts,
            "meter": self.meter.name,
            # What it ran under (at the start), for telling comparable
            # measurements apart; and whether that changed during it, or idle
            # power is from before a change (no idle time under it yet)
            "conditions": conditions,
            "conditions_changed": any(
                conditions.get(k) != conditions_now.get(k) for k in BASELINE_CONDITIONS),
            "baseline_before_change": not baseline_current,
            # Other programs that used the GPU meanwhile, whose energy is
            # counted in this; None if the meter can't tell
            "other_gpu_use": others if self._other_use_known or others else None,
        }

    def _baseline(self, now: float) -> Tuple[Optional[Baseline], bool]:
        """Idle power, and whether it's from under the current power settings."""
        busy = list(self._busy)
        busy.extend((began, math.inf) for began in self._in_flight.values())
        # Not idle, either: other programs using the GPU
        busy.extend((s, e + WIND_DOWN_S) for s, e, _ in self._other_use)
        # The last few minutes' idle time, or, during a long run with none,
        # whatever idle time is still in the history; only since the power
        # settings last changed, since they change idle power too
        since = self._conditions_since
        baseline = (idle_baseline(self._readings, busy, max(now - BASELINE_WINDOW_S, since))
                    or idle_baseline(self._readings, busy, max(now - HISTORY_S, since)))
        if baseline is not None:
            self._last_baseline, self._last_baseline_since = baseline, since
            return baseline, True
        # Just after a change, with no idle time since: idle power from
        # before it, flagged. For a run longer than the history: the idle
        # power measured last (flagged too, if from before a change).
        if since > -math.inf:
            before = (idle_baseline(self._readings, busy, now - BASELINE_WINDOW_S)
                      or idle_baseline(self._readings, busy, now - HISTORY_S))
            if before is not None:
                return before, False
        return self._last_baseline, self._last_baseline_since == since

    def status(self) -> dict:
        with self._lock:
            self._last_used = self._clock()
            baseline, _ = self._baseline(self._clock())
            conditions = self._check_conditions_locked(self._clock())
        self._wake.set()  # back from dormant: read at the idle rate
        return {
            "available": True,
            "meter": self.meter.name,
            "components": self.meter.components(),
            "idle_w": baseline.total_watts if baseline else None,
            "conditions": conditions,
        }
