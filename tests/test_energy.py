"""Measuring the energy of local model requests (chainforge/energy).

The attribution is checked with made-up readings, so it runs on any machine;
the Apple silicon meter only on one.
"""

import platform
import sys

import pytest

from chainforge.energy.attribution import (
    GENERATION, LOAD, Readings, Window, attribute, idle_baseline,
)
from chainforge.energy.monitor import EnergyMonitor
from chainforge.energy.meters.base import EnergyMeter


def readings(power_at, t0=0.0, t1=60.0, step=0.1):
    """Meter readings every `step` s for a machine drawing `power_at(t)` watts
    (a dict per component)."""
    return Readings.of(raw_readings(power_at, t0, t1, step))


def raw_readings(power_at, t0=0.0, t1=60.0, step=0.1):
    samples, totals, t = [], {}, t0
    samples.append((t, dict(totals)))
    while t < t1 - 1e-9:
        watts = power_at(t + step / 2)
        for c, w in watts.items():
            totals[c] = totals.get(c, 0.0) + w * step
        t = round(t + step, 6)
        samples.append((t, dict(totals)))
    return samples


def idle_then(busy_power, busy_spans, idle=None):
    idle = idle or {"cpu": 0.5, "gpu": 0.5}
    return lambda t: busy_power if any(a <= t < b for a, b in busy_spans) else idle


class TestEnergyBetween:
    def test_constant_power(self):
        samples = readings(lambda t: {"gpu": 10.0}, t1=5)
        assert samples.energy(1.0, 3.0)["gpu"] == pytest.approx(20.0)

    def test_part_of_a_reading_interval(self):
        samples = Readings.of([(0.0, {"gpu": 0.0}), (1.0, {"gpu": 8.0})])
        assert samples.energy(0.25, 0.75)["gpu"] == pytest.approx(4.0)

    def test_trimming_keeps_the_interval_spanning_the_cutoff(self):
        samples = readings(lambda t: {"gpu": 10.0}, t1=10, step=1.0)
        samples.trim(4.5)
        assert samples.times[0] == 4.0
        assert samples.energy(4.5, 5.0)["gpu"] == pytest.approx(5.0)


class TestIdleBaseline:
    def test_leaves_out_busy_time(self):
        samples = readings(idle_then({"cpu": 20.0, "gpu": 40.0}, [(10, 20)]), t1=30)
        base = idle_baseline(samples, [(10, 20)], since=0)
        assert base.total_watts == pytest.approx(1.0)
        assert base.watts == pytest.approx({"cpu": 0.5, "gpu": 0.5})
        assert base.seconds == pytest.approx(20.0)
        assert base.spread_watts == pytest.approx(0.0)

    def test_none_without_enough_idle_time(self):
        samples = readings(lambda t: {"gpu": 1.0}, t1=1)
        assert idle_baseline(samples, [], since=0) is None

    def test_spread_reflects_how_much_idle_power_varies(self):
        samples = readings(lambda t: {"cpu": 1.0 if int(t) % 2 else 3.0}, t1=20, step=0.5)
        base = idle_baseline(samples, [], since=0)
        assert base.total_watts == pytest.approx(2.0)
        assert base.spread_watts == pytest.approx(1.0)


class TestAttribute:
    base = idle_baseline(readings(lambda t: {"cpu": 0.5, "gpu": 0.5}, t1=10), [], since=0)

    def test_generation_above_idle(self):
        samples = readings(idle_then({"cpu": 10.0, "gpu": 49.0}, [(2, 7)]), t1=10)
        result = attribute("a", [Window("a", GENERATION, 2, 7)], samples, self.base)
        # (59 W - 1 W idle) x 5 s
        assert result.generation_total == pytest.approx(290.0)
        assert result.generation == pytest.approx({"cpu": 47.5, "gpu": 242.5})
        assert result.load is None
        assert result.shared is False

    def test_load_is_kept_apart_from_generation(self):
        samples = readings(
            lambda t: {"cpu": 5.0, "gpu": 5.0} if 1 <= t < 3 else
            ({"cpu": 10.0, "gpu": 50.0} if 3 <= t < 5 else {"cpu": 0.5, "gpu": 0.5}), t1=10)
        windows = [Window("a", LOAD, 1, 3), Window("a", GENERATION, 3, 5)]
        result = attribute("a", windows, samples, self.base)
        assert sum(result.load.values()) == pytest.approx(18.0)  # (10 - 1) W x 2 s
        assert result.generation_total == pytest.approx(118.0)  # (60 - 1) W x 2 s

    def test_queued_requests_each_get_only_their_own_generation(self):
        # Three requests sent at once: Ollama loads the model once, then runs them in turn
        samples = readings(
            lambda t: {"gpu": 10.0} if t < 2 else ({"gpu": 51.0} if t < 8 else {"gpu": 1.0}), t1=10)
        base = idle_baseline(readings(lambda t: {"gpu": 1.0}, t1=10), [], since=0)
        windows = []
        for req, (g0, g1) in {"a": (2, 4), "b": (4, 6), "c": (6, 8)}.items():
            windows += [Window(req, LOAD, 0, 2), Window(req, GENERATION, g0, g1)]
        results = {r: attribute(r, windows, samples, base) for r in "abc"}
        for r in "abc":
            assert results[r].generation_total == pytest.approx(100.0)  # 50 W x 2 s each
            assert sum(results[r].load.values()) == pytest.approx(6.0)  # 9 W x 2 s, shared 3 ways
        total = sum(results[r].generation_total + sum(results[r].load.values()) for r in "abc")
        assert total == pytest.approx(318.0)  # all of it, counted once

    def test_parallel_generation_is_split_evenly(self):
        samples = readings(lambda t: {"gpu": 61.0} if 2 <= t < 6 else {"gpu": 1.0}, t1=10)
        base = idle_baseline(readings(lambda t: {"gpu": 1.0}, t1=10), [], since=0)
        windows = [Window("a", GENERATION, 2, 6), Window("b", GENERATION, 4, 6)]
        a = attribute("a", windows, samples, base)
        b = attribute("b", windows, samples, base)
        # 2 s alone at 60 W above idle, then 2 s shared
        assert a.generation_total == pytest.approx(120.0 + 60.0)
        assert b.generation_total == pytest.approx(60.0)
        assert a.shared and b.shared

    def test_generation_takes_the_energy_over_another_requests_load(self):
        samples = readings(lambda t: {"gpu": 51.0} if 2 <= t < 4 else {"gpu": 1.0}, t1=10)
        base = idle_baseline(readings(lambda t: {"gpu": 1.0}, t1=10), [], since=0)
        windows = [Window("a", GENERATION, 2, 4), Window("b", LOAD, 2, 4), Window("b", GENERATION, 4, 5)]
        assert attribute("a", windows, samples, base).generation_total == pytest.approx(100.0)
        assert sum(attribute("b", windows, samples, base).load.values()) == pytest.approx(0.0)

    def test_noise_scales_with_idle_spread_and_duration(self):
        samples = readings(lambda t: {"cpu": 1.0 if int(t) % 2 else 3.0}, t1=20, step=0.5)
        base = idle_baseline(samples, [], since=0)
        result = attribute("a", [Window("a", GENERATION, 2, 6)], samples, base)
        assert result.noise == pytest.approx(4.0)  # 1 W spread x 4 s

    def test_never_negative(self):
        samples = readings(lambda t: {"gpu": 0.2}, t1=10)
        result = attribute("a", [Window("a", GENERATION, 2, 6)], samples, self.base)
        assert result.generation_total == 0.0


class FakeMeter(EnergyMeter):
    name = "Fake meter"

    def __init__(self, clock, power_at, conditions=None):
        self._clock, self._power_at = clock, power_at
        self._t, self._totals = clock.now, {"cpu": 0.0, "gpu": 0.0}
        self.cond = conditions if conditions is not None else {}

    def conditions(self):
        return dict(self.cond)

    def components(self):
        return ["cpu", "gpu"]

    def read(self):
        # Integrate power up to now, in small steps
        while self._t < self._clock.now - 1e-9:
            step = min(0.05, self._clock.now - self._t)
            for c, w in self._power_at(self._t + step / 2).items():
                self._totals[c] += w * step
            self._t += step
        return dict(self._totals)


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def run_monitor_until(monitor, clock, t, step=0.1):
    while clock.now < t - 1e-9:
        clock.now = round(clock.now + step, 6)
        monitor.sample()


class TestMonitor:
    def make(self, busy_power=None, busy_spans=()):
        clock = FakeClock()
        power = idle_then(busy_power or {"cpu": 10.0, "gpu": 49.0}, [(1000 + a, 1000 + b) for a, b in busy_spans])
        monitor = EnergyMonitor(FakeMeter(clock, power), clock=clock)
        monitor.sample()
        return monitor, clock

    def test_a_request_gets_its_generation_above_idle(self):
        monitor, clock = self.make(busy_spans=[(10.0, 15.0)])
        run_monitor_until(monitor, clock, 1009.9)
        req = monitor.begin()
        run_monitor_until(monitor, clock, 1015.0)
        result = monitor.end(req, since_reply_s=0.0, load_s=0.0, generation_s=5.0, total_s=5.0)
        assert result["energy_wh"] * 3600 == pytest.approx(290.0, rel=0.02)
        assert result["load_energy_wh"] is None
        assert result["idle_w"] == pytest.approx(1.0)
        assert result["meter"] == "Fake meter"

    def test_no_measurement_without_idle_time_to_compare_with(self):
        monitor, clock = self.make(busy_spans=[(0.0, 100.0)])
        req = monitor.begin()
        run_monitor_until(monitor, clock, 1005.0)
        assert monitor.end(req, 0.0, 0.0, 5.0, 5.0) is None

    def test_unknown_and_cancelled_requests_get_nothing(self):
        monitor, clock = self.make()
        run_monitor_until(monitor, clock, 1005.0)
        req = monitor.begin()
        monitor.cancel(req)
        assert monitor.end(req, 0.0, 0.0, 1.0, 1.0) is None
        assert monitor.end("nope", 0.0, 0.0, 1.0, 1.0) is None

    def test_a_request_never_ended_expires(self):
        monitor, clock = self.make()
        run_monitor_until(monitor, clock, 1005.0)
        forgotten = monitor.begin()
        run_monitor_until(monitor, clock, 1005.0 + 16 * 60, step=5.0)
        assert monitor.end(forgotten, 0.0, 0.0, 1.0, 1.0) is None
        # ...and idle power can be measured again
        assert monitor.status()["idle_w"] == pytest.approx(1.0)

    def test_timings_that_dont_fit_the_request_are_rejected(self):
        monitor, clock = self.make()
        run_monitor_until(monitor, clock, 1005.0)
        for bad in [dict(load_s=float("nan"), generation_s=1.0, total_s=1.0),
                    dict(load_s=0.0, generation_s=-1.0, total_s=1.0),
                    dict(load_s=0.0, generation_s=9.0, total_s=1.0),  # more than all of it
                    dict(load_s=0.0, generation_s=60.0, total_s=60.0)]:  # began before the request
            req = monitor.begin()
            run_monitor_until(monitor, clock, clock.now + 1.0)
            assert monitor.end(req, 0.0, **bad) is None
            assert req not in monitor._in_flight

    def test_waiting_for_a_busy_model_isnt_counted_as_loading_it(self):
        # b generates 10-15; a arrives at 11, waits for the model ("load" 11-15), generates 15-17
        monitor, clock = self.make(busy_spans=[(10.0, 17.0)])
        run_monitor_until(monitor, clock, 1010.0)
        b = monitor.begin()
        run_monitor_until(monitor, clock, 1011.0)
        a = monitor.begin()
        run_monitor_until(monitor, clock, 1015.0)
        monitor.end(b, 0.0, 0.0, 5.0, 5.0)
        run_monitor_until(monitor, clock, 1017.0)
        result = monitor.end(a, 0.0, load_s=4.0, generation_s=2.0, total_s=6.0)
        assert result["load_energy_wh"] is None
        assert result["energy_wh"] * 3600 == pytest.approx(116.0, rel=0.03)  # 58 W x 2 s

    def test_reads_rarely_when_not_used(self):
        from chainforge.energy import monitor as mod
        monitor, clock = self.make()
        assert monitor._interval() == mod.IDLE_INTERVAL_S
        clock.now += mod.ACTIVE_FOR_S + 1
        assert monitor._interval() == mod.DORMANT_INTERVAL_S
        req = monitor.begin()
        assert monitor._interval() == mod.BUSY_INTERVAL_S
        monitor.cancel(req)
        assert monitor._interval() == mod.IDLE_INTERVAL_S

    def test_settling_stays_fast_with_a_full_history(self):
        import time
        from chainforge.energy import monitor as mod
        # 15 minutes of back-to-back requests, read at the busy rate
        monitor, clock = self.make(busy_spans=[(5.0, 2000.0)])
        run_monitor_until(monitor, clock, 1004.0, step=1.0)
        t = 1005.0
        while t < 1000 + mod.HISTORY_S:
            req = monitor.begin()
            run_monitor_until(monitor, clock, t + 2.0, step=mod.BUSY_INTERVAL_S)
            monitor.end(req, 0.0, 0.0, 1.8, 2.0)
            t += 2.0
        assert len(monitor._readings) > 8000
        req = monitor.begin()
        run_monitor_until(monitor, clock, t + 2.0)
        start = time.perf_counter()
        result = monitor.end(req, 0.0, 0.0, 1.8, 2.0)
        assert time.perf_counter() - start < 0.05
        assert result["energy_wh"] > 0

    def test_time_in_flight_isnt_counted_as_idle(self):
        monitor, clock = self.make(busy_spans=[(10.0, 20.0)])
        run_monitor_until(monitor, clock, 1009.9)
        first = monitor.begin()
        second = monitor.begin()
        run_monitor_until(monitor, clock, 1015.0)
        monitor.end(first, 0.0, 0.0, 5.0, 5.0)
        run_monitor_until(monitor, clock, 1020.0)
        # The first request's end didn't make its busy time idle for the second
        result = monitor.end(second, 0.0, 0.0, 5.0, 10.0)
        assert result["idle_w"] == pytest.approx(1.0)


class TestMonitorTimingAndLoads:
    def test_waiting_for_the_lock_doesnt_shift_the_windows(self):
        import threading
        clock = FakeClock()
        power = idle_then({"gpu": 11.0}, [(1010.0, 1012.0)], idle={"gpu": 1.0})
        monitor = EnergyMonitor(FakeMeter(clock, power), clock=clock)
        monitor.sample()
        run_monitor_until(monitor, clock, 1010.0)
        req = monitor.begin()
        run_monitor_until(monitor, clock, 1012.0)
        results = []
        with monitor._lock:  # e.g. another request being settled
            t = threading.Thread(target=lambda: results.append(
                monitor.end(req, 0.0, 0.0, 2.0, 2.0)))
            t.start()
            import time
            time.sleep(0.05)  # end() has read the clock, and waits for the lock
            clock.now = 1015.0  # meanwhile, 3 s pass (idle)
        t.join()
        # The reply was at 1012, not 1015: 2 s at 10 W above idle
        assert results[0]["energy_wh"] * 3600 == pytest.approx(20.0, rel=0.05)

    def _load_result(self, load_watts):
        """A request that 'loaded' for 1 s at `load_watts` above a perfectly
        steady idle, then generated for 1 s at 10 W above it."""
        clock = FakeClock()
        def power(t):
            if 1010.0 <= t < 1011.0:
                return {"gpu": 1.0 + load_watts}
            return {"gpu": 11.0 if 1011.0 <= t < 1012.0 else 1.0}
        monitor = EnergyMonitor(FakeMeter(clock, power), clock=clock)
        monitor.sample()
        run_monitor_until(monitor, clock, 1010.0)
        req = monitor.begin()
        run_monitor_until(monitor, clock, 1012.0)
        return monitor.end(req, 0.0, load_s=1.0, generation_s=1.0, total_s=2.0)

    def test_a_real_load_is_shown(self):
        result = self._load_result(load_watts=8.0)
        assert result["load_energy_wh"] * 3600 == pytest.approx(8.0, rel=0.05)

    def test_a_trickle_isnt_counted_as_a_load(self):
        # Idle power doesn't swing at all here, so only the floor tells them apart
        assert self._load_result(load_watts=0.2)["load_energy_wh"] is None


class TestSamplerThread:
    """The background readings, with a real clock and short intervals."""

    class CountingMeter(EnergyMeter):
        name = "Counting meter"

        def __init__(self, fail_on=()):
            self.reads, self.fail_on = 0, set(fail_on)

        def components(self):
            return ["gpu"]

        def read(self):
            self.reads += 1
            if self.reads in self.fail_on:
                raise OSError("a reading failed")
            return {"gpu": float(self.reads)}

    @pytest.fixture
    def fast(self, monkeypatch):
        from chainforge.energy import monitor as mod
        monkeypatch.setattr(mod, "BUSY_INTERVAL_S", 0.01)
        monkeypatch.setattr(mod, "IDLE_INTERVAL_S", 0.2)
        monkeypatch.setattr(mod, "DORMANT_INTERVAL_S", 0.5)

    def test_reads_often_once_a_request_begins(self, fast):
        import time
        meter = self.CountingMeter()
        monitor = EnergyMonitor(meter)
        monitor.start()
        try:
            time.sleep(0.1)
            idle_reads = meter.reads
            assert idle_reads <= 3  # every 0.2 s
            monitor.begin()  # wakes the thread at once
            time.sleep(0.15)
            assert meter.reads - idle_reads >= 5  # every 0.01 s
        finally:
            monitor.stop()

    def test_keeps_going_after_a_failed_reading(self, fast):
        import time
        meter = self.CountingMeter(fail_on={3})
        monitor = EnergyMonitor(meter)
        monitor.start()
        try:
            monitor.begin()
            time.sleep(0.15)
            assert meter.reads > 5
            assert monitor._thread.is_alive()
        finally:
            monitor.stop()

    def test_stops(self, fast):
        import time
        meter = self.CountingMeter()
        monitor = EnergyMonitor(meter)
        monitor.start()
        monitor.begin()
        monitor.stop()
        monitor._thread.join(timeout=1.0)
        assert not monitor._thread.is_alive()
        reads = meter.reads
        time.sleep(0.05)
        assert meter.reads == reads


class TestPowerConditions:
    """The power source and mode change idle power and the energy a request
    takes, so each measurement records them, and idle power is measured
    afresh when they change."""

    def make(self):
        clock = FakeClock()
        state = {"idle": 1.0, "busy": None}
        meter = FakeMeter(
            clock,
            lambda t: {"gpu": state["busy"] if state["busy"] is not None else state["idle"]},
            conditions={"power_source": "AC power", "power_mode": "Automatic", "thermal": "nominal"},
        )
        monitor = EnergyMonitor(meter, clock=clock)
        monitor.sample()
        return monitor, clock, meter, state

    def run_request(self, monitor, clock, state, watts=11.0, seconds=2.0):
        req = monitor.begin()
        state["busy"] = watts
        run_monitor_until(monitor, clock, clock.now + seconds)
        state["busy"] = None
        return req, monitor.end(req, 0.0, 0.0, seconds, seconds)

    def test_each_measurement_records_them(self):
        monitor, clock, meter, state = self.make()
        run_monitor_until(monitor, clock, 1010.0)
        _, result = self.run_request(monitor, clock, state)
        assert result["conditions"] == {
            "power_source": "AC power", "power_mode": "Automatic", "thermal": "nominal"}
        assert result["conditions_changed"] is False
        assert result["baseline_before_change"] is False

    def test_idle_power_is_measured_afresh_after_a_change(self):
        monitor, clock, meter, state = self.make()
        run_monitor_until(monitor, clock, 1030.0)
        # Unplugged, into Low Power Mode: idle power drops
        meter.cond.update(power_source="battery", power_mode="Low Power")
        state["idle"] = 0.5
        run_monitor_until(monitor, clock, 1060.0)
        _, result = self.run_request(monitor, clock, state, watts=5.5)
        assert result["idle_w"] == pytest.approx(0.5)
        assert result["energy_wh"] * 3600 == pytest.approx(10.0, rel=0.05)  # (5.5 - 0.5) W x 2 s
        assert result["conditions"]["power_mode"] == "Low Power"
        assert result["baseline_before_change"] is False

    def test_just_after_a_change_the_old_idle_power_is_used_and_flagged(self):
        monitor, clock, meter, state = self.make()
        run_monitor_until(monitor, clock, 1030.0)
        _, first = self.run_request(monitor, clock, state)
        run_monitor_until(monitor, clock, clock.now + 5.0)
        meter.cond.update(power_mode="Low Power")
        _, result = self.run_request(monitor, clock, state)  # no idle time since
        assert result is not None
        assert result["baseline_before_change"] is True
        assert result["idle_w"] == pytest.approx(1.0)

    def test_a_change_during_a_request_is_flagged(self):
        monitor, clock, meter, state = self.make()
        run_monitor_until(monitor, clock, 1010.0)
        req = monitor.begin()
        run_monitor_until(monitor, clock, 1011.0)
        meter.cond.update(power_source="battery")
        run_monitor_until(monitor, clock, 1012.0)
        result = monitor.end(req, 0.0, 0.0, 2.0, 2.0)
        assert result["conditions"]["power_source"] == "AC power"  # as it began
        assert result["conditions_changed"] is True

    def test_heat_is_recorded_but_keeps_idle_power(self):
        monitor, clock, meter, state = self.make()
        run_monitor_until(monitor, clock, 1010.0)
        meter.cond.update(thermal="serious")
        _, result = self.run_request(monitor, clock, state)
        assert result["conditions"]["thermal"] == "serious"
        assert result["baseline_before_change"] is False


class TestRoutes:
    @pytest.fixture
    def monitor(self, monkeypatch):
        clock = FakeClock()
        monitor = EnergyMonitor(FakeMeter(clock, lambda t: {"cpu": 0.5, "gpu": 0.5}), clock=clock)
        monitor.sample()
        run_monitor_until(monitor, clock, 1010.0)
        import chainforge.energy as energy
        monkeypatch.setattr(energy, "get_monitor", lambda: (monitor, ""))
        return monitor, clock

    def test_status_begin_and_end(self, client, monitor):
        status = client.post("/app/energyStatus", json={}).get_json()
        assert status["available"] is True and status["meter"] == "Fake meter"
        req = client.post("/app/energyBegin", json={}).get_json()["id"]
        run_monitor_until(*monitor, 1012.0)
        import time
        energy = client.post("/app/energyEnd", json={
            "id": req, "reply_epoch_ms": time.time() * 1000, "load_s": 0, "generation_s": 2, "total_s": 2,
        }).get_json()["energy"]
        assert energy["energy_wh"] == pytest.approx(0.0, abs=1e-6)  # idle all along

    def test_bad_timings_cancel_the_request(self, client, monitor):
        req = client.post("/app/energyBegin", json={}).get_json()["id"]
        assert "error" in client.post("/app/energyEnd", json={"id": req}).get_json()
        assert monitor[0].end(req, 0, 0, 1, 1) is None

    def test_only_for_a_page_on_this_machine(self, client, monitor):
        status = client.post("/app/energyStatus", json={},
                             environ_base={"REMOTE_ADDR": "192.168.1.20"}).get_json()
        assert status["available"] is False


def _real_apple_silicon():
    if not (sys.platform == "darwin" and platform.machine() == "arm64"):
        return False
    from chainforge.energy.meters import in_macos_vm
    return not in_macos_vm()  # e.g. GitHub's macOS runners, which have no counters


@pytest.mark.skipif(not _real_apple_silicon(), reason="Apple silicon, not in a virtual machine, only")
def test_apple_silicon_meter_reads_energy():
    import time
    from chainforge.energy.meters import find_meter
    meter, reason = find_meter()
    assert meter is not None, reason
    assert set(meter.components()) >= {"cpu", "gpu", "dram"}
    first = meter.read()
    time.sleep(0.5)
    second = meter.read()
    assert all(second[c] >= first[c] for c in first)
    assert sum(second.values()) > sum(first.values())
