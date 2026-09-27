"""Measuring the energy of local model requests (chainforge/energy).

The attribution is checked with made-up readings, so it runs on any machine;
the Apple silicon meter only on one.
"""

import platform
import sys

import pytest

from chainforge.energy.attribution import (
    GENERATION, LOAD, Window, attribute, energy_between, idle_baseline,
)
from chainforge.energy.monitor import EnergyMonitor
from chainforge.energy.meters.base import EnergyMeter


def readings(power_at, t0=0.0, t1=60.0, step=0.1):
    """Meter readings every `step` s for a machine drawing `power_at(t)` watts
    (a dict per component)."""
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
        assert energy_between(samples, 1.0, 3.0)["gpu"] == pytest.approx(20.0)

    def test_part_of_a_reading_interval(self):
        samples = [(0.0, {"gpu": 0.0}), (1.0, {"gpu": 8.0})]
        assert energy_between(samples, 0.25, 0.75)["gpu"] == pytest.approx(4.0)


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

    def __init__(self, clock, power_at):
        self._clock, self._power_at = clock, power_at
        self._t, self._totals = clock.now, {"cpu": 0.0, "gpu": 0.0}

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
        energy = client.post("/app/energyEnd", json={
            "id": req, "since_reply_ms": 0, "load_s": 0, "generation_s": 2, "total_s": 2,
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


@pytest.mark.skipif(not (sys.platform == "darwin" and platform.machine() == "arm64"),
                    reason="Apple silicon only")
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
