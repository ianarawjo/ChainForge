"""Measuring energy on Windows and Linux PCs (chainforge/energy/meters: nvidia,
rapl, system, pc).

The hardware is faked (NVML, /sys, Windows' GPU counters), so these run on any
machine; the tests against real NVIDIA GPUs or RAPL counters skip themselves
where there are none.
"""

import os
import sys
import time

import pytest

from chainforge.energy.meters.base import EnergyMeter
from chainforge.energy.meters.nvidia import NvidiaMeter, THROTTLE_THERMAL
from chainforge.energy.meters.pc import PcMeter
from chainforge.energy.meters.rapl import RaplMeter, try_rapl_meter
from chainforge.energy.meters.system import (
    LinuxPower, other_programs, parse_gpu_engines, process_name, windows_power_mode,
)
from chainforge.energy.monitor import OTHER_USE_EVERY_S, EnergyMonitor

from test_energy import FakeClock, FakeMeter, idle_then, run_monitor_until


# ---------------------------------------------------------------------------
# NVIDIA
# ---------------------------------------------------------------------------

class FakeNvml:
    """GPUs whose energy counters (mJ) and power readings (mW) the test sets."""

    def __init__(self, n=2, counters=True, indices=None, total=None):
        self.indices = indices if indices is not None else list(range(n))
        self.n_total = total if total is not None else n
        self.violation = [None] * n
        self.energy = [10_000_000] * n if counters else [None] * n
        self.power = [50_000] * n
        self.limit = [450_000] * n
        self.default_limit = [450_000] * n
        self.throttle = [0] * n
        self.procs = [{} for _ in range(n)]
        self.since = []

    def count(self):
        return len(self.power)

    def total(self):
        return self.n_total

    def index(self, i):
        return self.indices[i]

    def thermal_violation_ns(self, i):
        return self.violation[i]

    def name(self, i):
        return "NVIDIA GeForce RTX 4090"

    def energy_mj(self, i):
        return self.energy[i]

    def power_mw(self, i):
        return self.power[i]

    def power_limit_mw(self, i):
        return self.limit[i]

    def default_power_limit_mw(self, i):
        return self.default_limit[i]

    def throttle_reasons(self, i):
        return self.throttle[i]

    def process_utilization(self, i, since_us):
        self.since.append(since_us)
        return self.procs[i]


class TestNvidiaMeter:
    def test_one_component_per_gpu(self):
        assert NvidiaMeter(FakeNvml(n=2)).components() == ["gpu0", "gpu1"]
        assert NvidiaMeter(FakeNvml(n=1)).components() == ["gpu"]

    def test_names_the_gpus(self):
        assert NvidiaMeter(FakeNvml(n=2)).name == (
            "NVIDIA GPUs (NVIDIA GeForce RTX 4090, NVIDIA GeForce RTX 4090; NVML)")

    def test_no_gpus_is_no_meter(self):
        with pytest.raises(RuntimeError):
            NvidiaMeter(FakeNvml(n=0))

    def test_reads_the_energy_counters_since_it_started(self):
        nvml = FakeNvml(n=2)
        meter = NvidiaMeter(nvml)
        assert meter.read() == {"gpu0": 0.0, "gpu1": 0.0}
        nvml.energy[0] += 2500  # mJ
        nvml.energy[1] += 400_000
        assert meter.read() == pytest.approx({"gpu0": 2.5, "gpu1": 400.0})

    def test_without_counters_adds_up_power_readings(self):
        clock = FakeClock()
        nvml = FakeNvml(n=1, counters=False)
        meter = NvidiaMeter(nvml, clock=clock)
        assert "from power readings" in meter.name
        meter.read()
        clock.now += 1.0
        nvml.power[0] = 150_000  # 50 W to 150 W over a second: 100 J
        assert meter.read()["gpu"] == pytest.approx(100.0)
        clock.now += 2.0
        assert meter.read()["gpu"] == pytest.approx(400.0)

    def test_a_counter_that_restarts_loses_only_that_moment(self):
        nvml = FakeNvml(n=1)
        meter = NvidiaMeter(nvml)
        nvml.energy[0] += 5000
        assert meter.read()["gpu"] == pytest.approx(5.0)
        nvml.energy[0] = 2000  # the driver reloaded: counting again from 0
        assert meter.read()["gpu"] == pytest.approx(7.0)
        nvml.energy[0] = 3000
        assert meter.read()["gpu"] == pytest.approx(8.0)

    def test_gpus_keep_the_drivers_numbers(self):
        # GPU 0 couldn't be read: GPU 1 is still GPU 1
        nvml = FakeNvml(n=1, indices=[1], total=2)
        nvml.limit[0] = 300_000
        meter = NvidiaMeter(nvml)
        assert meter.components() == ["gpu1"]
        assert meter.conditions()["gpu_power_limit"] == "GPU 1 limited to 300 W (default 450 W)"

    def test_heat_since_the_last_check_counts_though_its_over(self):
        nvml = FakeNvml(n=2)
        nvml.violation = [0, 0]
        meter = NvidiaMeter(nvml)
        assert meter.conditions()["thermal"] == "nominal"
        nvml.violation[1] = 250_000_000  # slowed for a quarter second, then cooled
        assert meter.conditions()["thermal"] == "the GPU was slowed by heat"
        assert meter.conditions()["thermal"] == "nominal"

    def test_a_counter_that_fails_falls_back_to_power(self):
        clock = FakeClock()
        nvml = FakeNvml(n=1)
        meter = NvidiaMeter(nvml, clock=clock)
        nvml.energy[0] = None
        meter.read()
        clock.now += 1.0
        assert meter.read()["gpu"] == pytest.approx(50.0)

    def test_conditions_report_lowered_power_limits_and_heat(self):
        nvml = FakeNvml(n=2)
        meter = NvidiaMeter(nvml)
        assert meter.conditions() == {"gpu_power_limit": "default", "thermal": "nominal"}
        nvml.limit[1] = 300_000
        nvml.throttle[0] = THROTTLE_THERMAL
        assert meter.conditions() == {
            "gpu_power_limit": "GPU 1 limited to 300 W (default 450 W)",
            "thermal": "the GPU was slowed by heat",
        }

    def test_power_capping_alone_isnt_heat(self):
        nvml = FakeNvml(n=1)
        nvml.throttle[0] = 0x4  # SW power cap: normal under load
        assert NvidiaMeter(nvml).conditions()["thermal"] == "nominal"

    def test_programs_using_any_gpu(self):
        nvml = FakeNvml(n=2)
        nvml.procs = [{10: 3, 11: 80}, {11: 90, 12: 40}]
        assert NvidiaMeter(nvml).gpu_processes(123) == {10: 3.0, 11: 90.0, 12: 40.0}

    def test_programs_unknown_if_any_gpu_cant_tell(self):
        nvml = FakeNvml(n=2)
        nvml.procs[1] = None
        assert NvidiaMeter(nvml).gpu_processes(123) is None


# ---------------------------------------------------------------------------
# RAPL (Linux CPUs)
# ---------------------------------------------------------------------------

def make_powercap(root, domains):
    """domains: {dir: (name, energy_uj, max_energy_range_uj)}"""
    for d, (name, uj, max_uj) in domains.items():
        p = root / d
        p.mkdir()
        (p / "name").write_text(name + "\n", encoding="utf-8")
        (p / "energy_uj").write_text(f"{uj}\n", encoding="utf-8")
        (p / "max_energy_range_uj").write_text(f"{max_uj}\n", encoding="utf-8")
    return str(root)


def set_uj(root, d, uj):
    (root / d / "energy_uj").write_text(f"{uj}\n", encoding="utf-8")


@pytest.mark.skipif(sys.platform == "win32", reason="RAPL is Linux's (its folder names can't exist on Windows)")
class TestRapl:
    def test_packages_and_dram_but_not_their_sub_domains(self, tmp_path):
        root = make_powercap(tmp_path, {
            "intel-rapl:0": ("package-0", 1_000_000, 2**32),
            "intel-rapl:0:0": ("core", 500_000, 2**32),
            "intel-rapl:0:1": ("dram", 100_000, 2**32),
            "intel-rapl:1": ("package-1", 2_000_000, 2**32),
            "intel-rapl:2": ("psys", 9_000_000, 2**32),
            "intel-rapl-mmio:0": ("package-0", 1_000_000, 2**32),
        })
        meter = RaplMeter(root)
        assert meter.components() == ["cpu", "dram"]
        assert meter.read() == {"cpu": 0.0, "dram": 0.0}
        set_uj(tmp_path, "intel-rapl:0", 3_000_000)  # +2 J
        set_uj(tmp_path, "intel-rapl:1", 2_500_000)  # +0.5 J
        set_uj(tmp_path, "intel-rapl:0:0", 9_000_000)  # a part of package 0: not added
        set_uj(tmp_path, "intel-rapl:0:1", 350_000)
        set_uj(tmp_path, "intel-rapl-mmio:0", 9_000_000)  # the same package again
        assert meter.read() == pytest.approx({"cpu": 2.5, "dram": 0.25})

    def test_undoes_wraparound(self, tmp_path):
        root = make_powercap(tmp_path, {"intel-rapl:0": ("package-0", 900, 1000)})
        meter = RaplMeter(root)
        set_uj(tmp_path, "intel-rapl:0", 100)  # 900 -> 1000 -> 100: 200 uJ
        assert meter.read()["cpu"] == pytest.approx(200e-6)
        set_uj(tmp_path, "intel-rapl:0", 400)
        assert meter.read()["cpu"] == pytest.approx(500e-6)

    @pytest.mark.skipif(sys.platform == "win32" or (hasattr(os, "geteuid") and os.geteuid() == 0),
                        reason="needs file permissions that apply (not root)")
    def test_unreadable_counters_say_how_to_allow_them(self, tmp_path):
        root = make_powercap(tmp_path, {"intel-rapl:0": ("package-0", 1, 2**32)})
        os.chmod(tmp_path / "intel-rapl:0" / "energy_uj", 0o200)
        meter, why = try_rapl_meter(root)
        assert meter is None
        assert "only by root" in why and "README" in why

    def test_none_found(self, tmp_path):
        assert try_rapl_meter(str(tmp_path / "missing"))[0] is None
        assert try_rapl_meter(str(tmp_path))[0] is None


# ---------------------------------------------------------------------------
# Other programs using the GPU
# ---------------------------------------------------------------------------

class TestOtherPrograms:
    def test_windows_gpu_engine_counters(self):
        per_pid = parse_gpu_engines([
            ("pid_100_luid_0x00000000_0x0000D1E2_phys_0_eng_0_engtype_3D", 30.0),
            ("pid_100_luid_0x00000000_0x0000D1E2_phys_0_eng_1_engtype_Compute_0", 60.0),
            # The same engine on another GPU: its own engine, not added
            ("pid_100_luid_0x00000000_0x0000F00D_phys_0_eng_0_engtype_3D", 50.0),
            ("pid_200_luid_0x00000000_0x0000D1E2_phys_0_eng_3_engtype_VideoDecode", 90.0),
            ("pid_200_luid_0x00000000_0x0000D1E2_phys_0_eng_0_engtype_3D", 1.5),
            ("not an instance name", 99.0),
        ])
        assert per_pid == {100: 60.0, 200: 1.5}

    def test_leaves_out_the_model_server_chainforge_and_the_desktop(self):
        names = {1: "python", 2: "ollama", 3: "ollama_llama_se", 4: "System", 5: "dwm",
                 6: "llama-server", 7: "ComfyUI", 8: "me", 9: "Ollama"}
        per_pid = {pid: 50.0 for pid in names}
        assert other_programs(per_pid, names.get, own_pid=8) == ["ComfyUI", "python"]

    def test_light_use_isnt_counted(self):
        assert other_programs({1: 4.9, 2: 5.0}, {1: "Discord", 2: "game"}.get, own_pid=0) == ["game"]

    def test_a_browser_drawing_chainforge_isnt_counted_but_heavy_use_is(self):
        names = {1: "chrome", 2: "firefox"}
        assert other_programs({1: 12.0, 2: 45.0}, names.get, own_pid=0) == ["firefox"]

    def test_processes_without_a_readable_name_arent_counted(self):
        # e.g. Ollama in another container, whose process ids aren't this one's
        assert other_programs({1234: 95.0}, lambda pid: None, own_pid=0) == []
        assert process_name(2**22 + 12345) is None  # no such process


class FakeEngines:
    def __init__(self):
        self.per_pid = {}

    def sample(self):
        return dict(self.per_pid)


class OtherUseMeter(FakeMeter):
    """A fake meter that can also tell which programs use the GPU: those
    using it now, and, like Windows' counters, those that used it since the
    last check but have stopped."""

    def __init__(self, clock, power_at):
        super().__init__(clock, power_at)
        self.others = []
        self.since_last_check = []

    def other_gpu_use(self):
        used = sorted(set(self.others) | set(self.since_last_check))
        self.since_last_check = []
        return used


def run_checking(monitor, clock, t, step=0.1):
    """Like the sampler thread: readings, and checks for other programs."""
    while clock.now < t - 1e-9:
        clock.now = round(clock.now + step, 6)
        monitor._check_other_use(OTHER_USE_EVERY_S)
        monitor.sample()


class TestOtherUseInTheMonitor:
    def make(self, busy_spans):
        clock = FakeClock()
        spans = [(1000 + a, 1000 + b) for a, b in busy_spans]
        meter = OtherUseMeter(clock, idle_then({"cpu": 10.0, "gpu": 49.0}, spans))
        monitor = EnergyMonitor(meter, clock=clock)
        monitor.sample()
        return monitor, clock, meter

    def test_a_request_while_another_program_uses_the_gpu_is_flagged(self):
        monitor, clock, meter = self.make([(20.0, 25.0)])
        run_checking(monitor, clock, 1019.9)
        req = monitor.begin()
        meter.others = ["ComfyUI"]
        run_checking(monitor, clock, 1025.0)
        result = monitor.end(req, 0.0, 0.0, 5.0, 5.0)
        assert result["other_gpu_use"] == ["ComfyUI"]

    def test_otherwise_none_are_listed(self):
        monitor, clock, meter = self.make([(20.0, 25.0)])
        run_checking(monitor, clock, 1019.9)
        req = monitor.begin()
        run_checking(monitor, clock, 1025.0)
        assert monitor.end(req, 0.0, 0.0, 5.0, 5.0)["other_gpu_use"] == []

    def test_use_before_the_request_isnt_its(self):
        monitor, clock, meter = self.make([(20.0, 25.0)])
        meter.others = ["game"]
        run_checking(monitor, clock, 1010.0)
        meter.others = []
        run_checking(monitor, clock, 1019.9)
        req = monitor.begin()
        run_checking(monitor, clock, 1025.0)
        assert monitor.end(req, 0.0, 0.0, 5.0, 5.0)["other_gpu_use"] == []

    def test_use_that_ended_since_the_last_check_isnt_the_requests(self):
        # Dormant: the last check was long ago, and a program used the GPU
        # since, but stopped before the request began
        monitor, clock, meter = self.make([(20.0, 25.0)])
        run_checking(monitor, clock, 1010.0)
        run_monitor_until(monitor, clock, 1019.9)  # readings, no checks
        meter.since_last_check = ["game"]
        req = monitor.begin()
        run_checking(monitor, clock, 1025.0)
        # Generating from just after it began, before the first check during it
        assert monitor.end(req, 0.0, 0.0, 5.05, 5.05)["other_gpu_use"] == []

    def test_unknown_where_the_meter_cant_tell(self):
        clock = FakeClock()
        monitor = EnergyMonitor(FakeMeter(clock, idle_then({"gpu": 49.0}, [(1020, 1025)])), clock=clock)
        monitor.sample()
        run_checking(monitor, clock, 1019.9)
        req = monitor.begin()
        run_checking(monitor, clock, 1025.0)
        assert monitor.end(req, 0.0, 0.0, 5.0, 5.0)["other_gpu_use"] is None

    def test_other_programs_time_isnt_idle_power(self):
        # Idle at 1 W; a game draws 100 W from 10 to 20 s, and is flagged
        clock = FakeClock()
        game = [(1010.0, 1020.0)]
        meter = OtherUseMeter(clock, lambda t: (
            {"gpu": 49.0} if 1025 <= t < 1030 else
            {"gpu": 100.0} if any(a <= t < b for a, b in game) else {"cpu": 0.5, "gpu": 0.5}))
        monitor = EnergyMonitor(meter, clock=clock)
        monitor.sample()
        run_checking(monitor, clock, 1010.0)
        meter.others = ["game"]
        run_checking(monitor, clock, 1020.0)
        meter.others = []
        run_checking(monitor, clock, 1024.9)
        req = monitor.begin()
        run_checking(monitor, clock, 1030.0)
        result = monitor.end(req, 0.0, 0.0, 5.0, 5.0)
        assert result["idle_w"] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Power settings
# ---------------------------------------------------------------------------

class TestWindowsPowerMode:
    def test_plan_and_slider(self):
        assert windows_power_mode("Balanced", None, False) == "Balanced power plan"
        assert windows_power_mode("Balanced", "Best performance", False) == \
            "Balanced power plan, Best performance"

    def test_battery_saver_overrides(self):
        assert windows_power_mode("High performance", None, True) == "Battery saver"

    def test_unknown(self):
        assert windows_power_mode(None, None, False) is None


def make_sys(root, supplies=(), profile=None):
    """supplies: [(name, type, {file: value})]"""
    for name, kind, files in supplies:
        p = root / "class" / "power_supply" / name
        p.mkdir(parents=True)
        (p / "type").write_text(kind + "\n", encoding="utf-8")
        for f, v in files.items():
            (p / f).write_text(v + "\n", encoding="utf-8")
    if profile:
        p = root / "firmware" / "acpi"
        p.mkdir(parents=True)
        (p / "platform_profile").write_text(profile + "\n", encoding="utf-8")
    return str(root)


class TestLinuxPower:
    def test_a_desktop_is_on_ac_power(self, tmp_path):
        assert LinuxPower(make_sys(tmp_path)).conditions() == {"power_source": "AC power"}

    def test_a_laptop_plugged_in_or_not(self, tmp_path):
        root = make_sys(tmp_path, [("AC", "Mains", {"online": "0"}),
                                   ("BAT0", "Battery", {"status": "Discharging"})])
        assert LinuxPower(root).conditions()["power_source"] == "battery"
        (tmp_path / "class" / "power_supply" / "AC" / "online").write_text("1\n", encoding="utf-8")
        assert LinuxPower(root).conditions()["power_source"] == "AC power"

    def test_a_ups_or_peripheral_battery_without_mains_isnt_battery_power(self, tmp_path):
        root = make_sys(tmp_path, [("hidpp_battery_0", "Battery", {"status": "Charging"})])
        assert LinuxPower(root).conditions()["power_source"] == "AC power"

    def test_a_usb_c_charger_is_ac_power(self, tmp_path):
        root = make_sys(tmp_path, [("ADP1", "Mains", {"online": "0"}),
                                   # Really "ucsi-source-psy-USBC000:001", but Windows
                                   # (where the tests also run) can't name a folder with ":"
                                   ("ucsi-source-psy-USBC000-001", "USB", {"online": "1"}),
                                   ("BAT0", "Battery", {"status": "Charging"})])
        assert LinuxPower(root).conditions()["power_source"] == "AC power"

    def test_a_mouses_battery_isnt_the_machines(self, tmp_path):
        root = make_sys(tmp_path, [("AC", "Mains", {"online": "0"}),
                                   ("hidpp_battery_0", "Battery", {"status": "Discharging", "scope": "Device"})])
        assert LinuxPower(root).conditions()["power_source"] == "AC power"

    def test_power_profiles_daemon_from_its_state_file(self, tmp_path):
        state = tmp_path / "state.ini"
        state.write_text("[State]\nDriver=intel_pstate\nProfile=power-saver\n", encoding="utf-8")
        power = LinuxPower(make_sys(tmp_path / "sys"), daemon_state=str(state))
        power.refresh()
        assert power.conditions()["power_mode"] == "power-saver power profile"

    def test_asks_powerprofilesctl_only_now_and_then(self, tmp_path, monkeypatch):
        import subprocess
        import chainforge.energy.meters.system as system
        calls = []
        monkeypatch.setattr(system.shutil, "which", lambda name: "/usr/bin/" + name)
        monkeypatch.setattr(system.subprocess, "run", lambda *a, **k: calls.append(a) or
                            subprocess.CompletedProcess(a, 0, stdout="balanced\n"))
        clock = FakeClock()
        power = LinuxPower(make_sys(tmp_path / "sys"), daemon_state=str(tmp_path / "none"), clock=clock)
        power.refresh()
        clock.now += 30
        power.refresh()
        assert len(calls) == 1
        assert power.conditions()["power_mode"] == "balanced power profile"
        clock.now += LinuxPower.DAEMON_ASK_EVERY_S
        power.refresh()
        assert len(calls) == 2

    def test_platform_profile(self, tmp_path):
        root = make_sys(tmp_path, profile="low-power")
        assert LinuxPower(root).conditions()["power_mode"] == "low-power power profile"


# ---------------------------------------------------------------------------
# The PC meter, altogether
# ---------------------------------------------------------------------------

class StaticMeter(EnergyMeter):
    def __init__(self, name, totals, conditions=None):
        self.name, self.totals, self.cond = name, totals, conditions or {}

    def components(self):
        return list(self.totals)

    def read(self):
        return dict(self.totals)

    def conditions(self):
        return dict(self.cond)


class FakePower:
    def __init__(self):
        self.refreshed = 0

    def conditions(self):
        return {"power_source": "AC power", "power_mode": "Balanced power plan"}

    def refresh(self):
        self.refreshed += 1


class TestPcMeter:
    def test_combines_meters_and_power_settings(self):
        power = FakePower()
        meter = PcMeter([
            StaticMeter("NVIDIA GPUs", {"gpu0": 1.0, "gpu1": 2.0}, {"thermal": "nominal"}),
            StaticMeter("CPU (RAPL)", {"cpu": 3.0}),
        ], power=power)
        assert meter.name == "NVIDIA GPUs + CPU (RAPL)"
        assert meter.components() == ["gpu0", "gpu1", "cpu"]
        assert meter.read() == {"gpu0": 1.0, "gpu1": 2.0, "cpu": 3.0}
        assert meter.conditions() == {
            "power_source": "AC power", "power_mode": "Balanced power plan", "thermal": "nominal"}
        meter.refresh_conditions()
        assert power.refreshed == 1

    def test_other_programs_from_windows_counters(self):
        engines = FakeEngines()
        meter = PcMeter([StaticMeter("GPU", {"gpu": 0.0})], gpu_engines=engines)
        engines.per_pid = {os.getpid(): 90.0}
        assert meter.other_gpu_use() == []

    def test_other_programs_from_nvml_since_the_last_check(self, monkeypatch):
        import chainforge.energy.meters.pc as pc
        now = iter(range(100, 200))
        monkeypatch.setattr(pc.time, "time", lambda: next(now))
        nvml = FakeNvml(n=1)
        nvidia = NvidiaMeter(nvml)
        meter = PcMeter([nvidia], nvidia=nvidia)
        nvml.procs[0] = {os.getpid(): 90}
        assert meter.other_gpu_use() == []
        assert meter.other_gpu_use() == []
        # From when it was made, then from the first check
        assert nvml.since == [100_000_000, 101_000_000]

    def test_other_programs_unknown_without_a_way_to_tell(self):
        assert PcMeter([StaticMeter("CPU", {"cpu": 0.0})]).other_gpu_use() is None


def test_find_pc_meter_with_only_a_gpu(monkeypatch):
    from chainforge.energy.meters import find_pc_meter
    import chainforge.energy.meters.nvidia as nvidia
    import chainforge.energy.meters.rapl as rapl
    monkeypatch.setattr(nvidia, "try_nvidia_meter", lambda: (NvidiaMeter(FakeNvml(n=2)), ""))
    monkeypatch.setattr(rapl, "try_rapl_meter", lambda: (None, "The CPU isn't measured: ..."))
    meter, why = find_pc_meter()
    assert why == ""
    assert meter.components() == ["gpu0", "gpu1"]


def test_find_pc_meter_with_nothing(monkeypatch):
    from chainforge.energy.meters import find_pc_meter
    import chainforge.energy.meters.nvidia as nvidia
    import chainforge.energy.meters.rapl as rapl
    monkeypatch.setattr(nvidia, "try_nvidia_meter", lambda: (None, "No NVIDIA GPU to measure (none)."))
    monkeypatch.setattr(rapl, "try_rapl_meter", lambda: (None, "The CPU isn't measured: none."))
    meter, why = find_pc_meter()
    assert meter is None
    assert "No NVIDIA GPU" in why


# ---------------------------------------------------------------------------
# Real hardware, where there is some
# ---------------------------------------------------------------------------

def _real_nvidia():
    try:
        from chainforge.energy.meters.nvidia import Nvml
        return Nvml() if Nvml().count() else None
    except Exception:
        return None


@pytest.mark.skipif(_real_nvidia() is None, reason="needs an NVIDIA GPU")
def test_nvidia_meter_reads_energy():
    meter = NvidiaMeter(_real_nvidia())
    first = meter.read()
    time.sleep(0.5)
    second = meter.read()
    assert set(first) == set(meter.components())
    assert all(second[c] >= first[c] >= 0 for c in first)
    assert meter.conditions()["gpu_power_limit"]


@pytest.mark.skipif(try_rapl_meter()[0] is None, reason="needs readable RAPL counters (Linux)")
def test_rapl_meter_reads_energy():
    meter = try_rapl_meter()[0]
    first = meter.read()
    time.sleep(0.5)
    assert meter.read()["cpu"] > first["cpu"]


@pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
def test_windows_power_settings():
    from chainforge.energy.meters.system import WindowsPower
    conditions = WindowsPower().conditions()
    assert conditions.get("power_source") in ("AC power", "battery")
    assert conditions.get("power_mode")  # some power plan is always active


@pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
def test_windows_gpu_counters_work_or_fail_cleanly():
    from chainforge.energy.meters.system import WindowsGpuEngines
    try:
        engines = WindowsGpuEngines()
    except OSError:
        pytest.skip("no GPU performance counters here")
    time.sleep(0.2)
    assert isinstance(engines.sample(), dict)


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="Linux only")
def test_linux_power_settings():
    assert LinuxPower().conditions()["power_source"] in ("AC power", "battery")


def test_finding_a_meter_never_fails():
    from chainforge.energy.meters import find_meter
    meter, why = find_meter()
    assert meter is not None or why


class TestHeatDuringARequest:
    """A GPU heats up while it generates, not before: heat seen by any check
    during a request is recorded with it."""

    def test_heat_during_a_request_is_recorded_though_it_ended_cool(self):
        clock = FakeClock()
        meter = FakeMeter(clock, idle_then({"gpu": 300.0}, [(1020, 1045)], idle={"gpu": 30.0}),
                          conditions={"power_source": "AC power", "thermal": "nominal"})
        monitor = EnergyMonitor(meter, clock=clock)
        monitor.sample()
        run_monitor_until(monitor, clock, 1019.9)
        req = monitor.begin()
        other = monitor.begin()  # e.g. another request, queued behind it
        run_monitor_until(monitor, clock, 1030.0)
        meter.cond["thermal"] = "the GPU was slowed by heat"
        run_monitor_until(monitor, clock, 1041.0)  # a check every 10 s sees it
        meter.cond["thermal"] = "nominal"
        run_monitor_until(monitor, clock, 1045.0)
        result = monitor.end(req, 0.0, 0.0, 25.0, 25.0)
        assert result["conditions"]["thermal"] == "the GPU was slowed by heat"
        assert monitor.status()["conditions"]["thermal"] == "nominal"  # not the machine's now
        monitor.cancel(other)

    def test_a_cool_request_stays_cool(self):
        clock = FakeClock()
        meter = FakeMeter(clock, idle_then({"gpu": 300.0}, [(1020, 1025)], idle={"gpu": 30.0}),
                          conditions={"thermal": "nominal"})
        monitor = EnergyMonitor(meter, clock=clock)
        monitor.sample()
        run_monitor_until(monitor, clock, 1019.9)
        req = monitor.begin()
        run_monitor_until(monitor, clock, 1025.0)
        assert monitor.end(req, 0.0, 0.0, 5.0, 5.0)["conditions"]["thermal"] == "nominal"
