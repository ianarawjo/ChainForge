"""
ChainForge energy probe: what this machine can tell us about the energy local
models use. Self-contained: Python 3.8+ and nothing else (no ChainForge, no
pip installs). Windows and Linux, with NVIDIA GPUs; runs elsewhere too.

    python energy_probe.py                      # checks, idle power, one Ollama test
    python energy_probe.py --model gemma3:27b   # choose the model to test with
    python energy_probe.py --watch 60           # then watch which programs use the GPU

Takes about 2 minutes. At the end it writes energy_probe_report.json in the
current folder: please send that file back. It records only hardware and power
readings, GPU program names, and Ollama's timings (no prompts or replies
beyond one fixed test prompt).

To test with a model you'd really use (e.g. one that spans both GPUs), run it
again with --model. For the --watch step: start an image generation in ComfyUI
(or any GPU work) while it watches, to check that ChainForge can see other
programs using the GPU.
"""

# Keep this file standalone (standard library only, no ChainForge imports): it's
# sent on its own to people checking whether their machine can be measured.

import argparse
import ctypes
import json
import os
import platform
import statistics
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
from ctypes import byref, c_char_p, c_double, c_uint, c_ulonglong, c_void_p

REPORT = {"probe_version": 1, "started": time.strftime("%Y-%m-%d %H:%M:%S"), "errors": []}
IS_WINDOWS = sys.platform == "win32"
IS_LINUX = sys.platform.startswith("linux")


def note_error(where: str, err: BaseException) -> None:
    REPORT["errors"].append({"where": where, "error": f"{type(err).__name__}: {err}",
                             "trace": traceback.format_exc(limit=3)})
    print(f"    (couldn't {where}: {err})")


def step(title: str) -> None:
    print(f"\n== {title}")


# ---------------------------------------------------------------------------
# NVIDIA: NVML, through ctypes (the library the NVIDIA driver installs)
# ---------------------------------------------------------------------------

NVML_SUCCESS, NVML_ERROR_NOT_SUPPORTED, NVML_ERROR_NO_PERMISSION = 0, 3, 4
NVML_ERROR_NOT_FOUND, NVML_ERROR_INSUFFICIENT_SIZE, NVML_ERROR_FUNCTION_NOT_FOUND = 6, 7, 13


class NvmlProcessInfo(ctypes.Structure):  # nvmlProcessInfo_t (v2/v3 layout)
    _fields_ = [("pid", c_uint), ("usedGpuMemory", c_ulonglong),
                ("gpuInstanceId", c_uint), ("computeInstanceId", c_uint)]


class NvmlProcessUtilSample(ctypes.Structure):  # nvmlProcessUtilizationSample_t
    _fields_ = [("pid", c_uint), ("timeStamp", c_ulonglong), ("smUtil", c_uint),
                ("memUtil", c_uint), ("encUtil", c_uint), ("decUtil", c_uint)]


class NvmlUtilization(ctypes.Structure):  # nvmlUtilization_t
    _fields_ = [("gpu", c_uint), ("memory", c_uint)]


class Nvml:
    def __init__(self):
        self.lib = self._load()
        self.lib.nvmlErrorString.restype = c_char_p
        self.lib.nvmlErrorString.argtypes = [ctypes.c_int]
        self.check(self.lib.nvmlInit_v2(), "nvmlInit_v2")

    @staticmethod
    def _load():
        if IS_WINDOWS:
            candidates = [
                os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "System32", "nvml.dll"),
                os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"),
                             "NVIDIA Corporation", "NVSMI", "nvml.dll"),
            ]
        else:
            candidates = ["libnvidia-ml.so.1", "libnvidia-ml.so", "/usr/lib/wsl/lib/libnvidia-ml.so.1"]
        errors = []
        for path in candidates:
            try:
                return ctypes.CDLL(path)
            except OSError as err:
                errors.append(f"{path}: {err}")
        raise OSError("NVML not found (" + "; ".join(errors) + ")")

    def error(self, code: int) -> str:
        try:
            return self.lib.nvmlErrorString(code).decode()
        except Exception:
            return f"error {code}"

    def check(self, code: int, what: str) -> None:
        if code != NVML_SUCCESS:
            raise RuntimeError(f"{what}: {self.error(code)} ({code})")

    def call(self, name: str, *args):
        """Calls an NVML function; returns its code (0 = success)."""
        try:
            fn = getattr(self.lib, name)
        except AttributeError:  # not in this driver's NVML
            return NVML_ERROR_FUNCTION_NOT_FOUND
        return fn(*args)

    def driver_version(self) -> str:
        buf = ctypes.create_string_buffer(96)
        self.check(self.call("nvmlSystemGetDriverVersion", buf, c_uint(96)), "driver version")
        return buf.value.decode()

    def devices(self):
        count = c_uint()
        self.check(self.call("nvmlDeviceGetCount_v2", byref(count)), "device count")
        handles = []
        for i in range(count.value):
            h = c_void_p()
            self.check(self.call("nvmlDeviceGetHandleByIndex_v2", c_uint(i), byref(h)), f"device {i}")
            handles.append(h)
        return handles

    def name(self, h) -> str:
        buf = ctypes.create_string_buffer(96)
        self.check(self.call("nvmlDeviceGetName", h, buf, c_uint(96)), "name")
        return buf.value.decode()

    def uint(self, fn: str, h):
        v = c_uint()
        code = self.call(fn, h, byref(v))
        return (v.value, None) if code == NVML_SUCCESS else (None, self.error(code))

    def ulonglong(self, fn: str, h):
        v = c_ulonglong()
        code = self.call(fn, h, byref(v))
        return (v.value, None) if code == NVML_SUCCESS else (None, self.error(code))

    def utilization(self, h):
        u = NvmlUtilization()
        code = self.call("nvmlDeviceGetUtilizationRates", h, byref(u))
        return ({"gpu_pct": u.gpu, "memory_pct": u.memory}, None) if code == NVML_SUCCESS else (None, self.error(code))

    def processes(self, h, kind: str):
        """Programs with the GPU open: kind "Compute" or "Graphics"."""
        for version in ("_v3", "_v2"):
            fn = f"nvmlDeviceGet{kind}RunningProcesses{version}"
            if not hasattr(self.lib, fn):
                continue
            count = c_uint(0)
            code = self.call(fn, h, byref(count), None)
            if code == NVML_SUCCESS:
                return [], None
            if code != NVML_ERROR_INSUFFICIENT_SIZE:
                return None, self.error(code)
            # Room to spare: newer drivers' entries can be larger than this layout
            infos = (NvmlProcessInfo * (count.value * 2 + 16))()
            count = c_uint(count.value + 8)
            code = self.call(fn, h, byref(count), infos)
            if code != NVML_SUCCESS:
                return None, self.error(code)
            return [{"pid": infos[i].pid, "name": process_name(infos[i].pid),
                     "memory_mb": round(infos[i].usedGpuMemory / 2**20)
                     if infos[i].usedGpuMemory < 2**63 else None}
                    for i in range(count.value)], None
        return None, "function not in this driver"

    def process_utilization(self, h, since_us: int = 0):
        """Each program's recent use of the GPU's cores (%), as NVML samples it."""
        count = c_uint(0)
        code = self.call("nvmlDeviceGetProcessUtilization", h, None, byref(count), c_ulonglong(since_us))
        if code in (NVML_SUCCESS, NVML_ERROR_NOT_FOUND):  # not found: no samples since then
            return [], None
        if code != NVML_ERROR_INSUFFICIENT_SIZE:
            return None, self.error(code)
        count = c_uint(count.value + 8)
        samples = (NvmlProcessUtilSample * count.value)()
        code = self.call("nvmlDeviceGetProcessUtilization", h, samples, byref(count), c_ulonglong(since_us))
        if code == NVML_ERROR_NOT_FOUND:
            return [], None
        if code != NVML_SUCCESS:
            return None, self.error(code)
        return [{"pid": samples[i].pid, "name": process_name(samples[i].pid), "sm_pct": samples[i].smUtil}
                for i in range(count.value)], None


# ---------------------------------------------------------------------------
# Programs: names from process ids
# ---------------------------------------------------------------------------

def process_name(pid: int) -> str:
    try:
        if IS_WINDOWS:
            from ctypes import wintypes
            k32 = ctypes.WinDLL("kernel32", use_last_error=True)
            k32.OpenProcess.restype = wintypes.HANDLE
            k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
            k32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD,
                                                       wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
            k32.CloseHandle.argtypes = [wintypes.HANDLE]
            h = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
            if not h:
                return f"pid {pid}"
            try:
                buf = ctypes.create_unicode_buffer(1024)
                size = wintypes.DWORD(1024)
                if k32.QueryFullProcessImageNameW(h, 0, buf, byref(size)):
                    return os.path.basename(buf.value)
            finally:
                k32.CloseHandle(h)
            return f"pid {pid}"
        with open(f"/proc/{pid}/comm") as f:
            return f.read().strip()
    except Exception:
        return f"pid {pid}"


# ---------------------------------------------------------------------------
# Windows: per-program GPU use (the counters Task Manager's GPU column reads)
# ---------------------------------------------------------------------------

class PdhItem(ctypes.Structure):
    class _Value(ctypes.Structure):
        class _U(ctypes.Union):
            _fields_ = [("longValue", ctypes.c_long), ("doubleValue", c_double),
                        ("largeValue", ctypes.c_longlong), ("str", c_void_p)]
        _fields_ = [("CStatus", ctypes.c_ulong), ("u", _U)]
    _fields_ = [("szName", ctypes.c_wchar_p), ("FmtValue", _Value)]


class WindowsGpuEngines:
    """Utilization of each GPU engine by each process: '\\GPU Engine(*)\\Utilization Percentage'."""
    PDH_FMT_DOUBLE = 0x00000200
    PDH_MORE_DATA = 0x800007D2

    def __init__(self):
        self.pdh = ctypes.WinDLL("pdh")
        self.query = c_void_p()
        self.counter = c_void_p()
        self._ok(self.pdh.PdhOpenQueryW(None, None, byref(self.query)), "PdhOpenQuery")
        self._ok(self.pdh.PdhAddEnglishCounterW(self.query, "\\GPU Engine(*)\\Utilization Percentage",
                                                None, byref(self.counter)), "PdhAddEnglishCounter")
        self.pdh.PdhCollectQueryData(self.query)  # a rate: needs two collections

    @staticmethod
    def _ok(status: int, what: str) -> None:
        if status != 0:
            raise RuntimeError(f"{what} failed: 0x{status & 0xFFFFFFFF:08X}")

    def sample(self):
        """{pid: {engine type: %}} since the last sample."""
        self._ok(self.pdh.PdhCollectQueryData(self.query), "PdhCollectQueryData")
        size, count = ctypes.c_ulong(0), ctypes.c_ulong(0)
        status = self.pdh.PdhGetFormattedCounterArrayW(self.counter, self.PDH_FMT_DOUBLE,
                                                       byref(size), byref(count), None)
        if (status & 0xFFFFFFFF) != self.PDH_MORE_DATA:
            if status == 0:
                return {}
            self._ok(status, "PdhGetFormattedCounterArray (size)")
        buf = (ctypes.c_byte * size.value)()
        self._ok(self.pdh.PdhGetFormattedCounterArrayW(self.counter, self.PDH_FMT_DOUBLE, byref(size),
                                                       byref(count), buf), "PdhGetFormattedCounterArray")
        items = ctypes.cast(buf, ctypes.POINTER(PdhItem))
        per_pid = {}
        for i in range(count.value):
            if items[i].FmtValue.CStatus not in (0, 1):  # PDH_CSTATUS_VALID_DATA / NEW_DATA
                continue
            name, value = items[i].szName or "", items[i].FmtValue.u.doubleValue
            # e.g. pid_1234_luid_0x00000000_0x0000D1E2_phys_0_eng_0_engtype_3D
            parts = name.split("_")
            try:
                pid = int(parts[parts.index("pid") + 1])
                luid = parts[parts.index("luid") + 2][-4:]  # tells the GPUs apart
                engtype = f"{name.split('engtype_', 1)[1] if 'engtype_' in name else '?'}@{luid}"
            except (ValueError, IndexError):
                continue
            per_pid.setdefault(pid, {})
            per_pid[pid][engtype] = per_pid[pid].get(engtype, 0.0) + value
        return per_pid


def summarize_engines(per_pid, min_pct=1.0):
    """The programs using the GPU: busiest engine type each, like Task Manager."""
    out = []
    for pid, engines in per_pid.items():
        busiest = max(engines.values()) if engines else 0.0
        if busiest >= min_pct:
            out.append({"pid": pid, "name": process_name(pid), "pct": round(busiest, 1),
                        "engines": {k: round(v, 1) for k, v in engines.items() if v >= 0.5}})
    return sorted(out, key=lambda x: -x["pct"])


# ---------------------------------------------------------------------------
# Power source and power plan / profile
# ---------------------------------------------------------------------------

def windows_power():
    from ctypes import wintypes

    class SYSTEM_POWER_STATUS(ctypes.Structure):
        _fields_ = [("ACLineStatus", ctypes.c_ubyte), ("BatteryFlag", ctypes.c_ubyte),
                    ("BatteryLifePercent", ctypes.c_ubyte), ("SystemStatusFlag", ctypes.c_ubyte),
                    ("BatteryLifeTime", wintypes.DWORD), ("BatteryFullLifeTime", wintypes.DWORD)]
    out = {}
    s = SYSTEM_POWER_STATUS()
    if ctypes.WinDLL("kernel32").GetSystemPowerStatus(byref(s)):
        out["power_source"] = {0: "battery", 1: "AC power"}.get(s.ACLineStatus, "unknown")
        out["battery_saver"] = bool(s.SystemStatusFlag)
    try:
        out["powercfg_active_scheme"] = subprocess.run(
            ["powercfg", "/getactivescheme"], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception as err:
        note_error("run powercfg", err)

    class GUID(ctypes.Structure):
        _fields_ = [("Data1", ctypes.c_ulong), ("Data2", ctypes.c_ushort),
                    ("Data3", ctypes.c_ushort), ("Data4", ctypes.c_ubyte * 8)]

        def __str__(self):
            d4 = bytes(self.Data4).hex()
            return f"{self.Data1:08x}-{self.Data2:04x}-{self.Data3:04x}-{d4[:4]}-{d4[4:]}"
    try:  # Windows 10/11's power mode slider ("best performance", ...)
        g = GUID()
        if ctypes.WinDLL("powrprof").PowerGetEffectiveOverlayScheme(byref(g)) == 0:
            overlays = {"961cc777-2547-4f9d-8174-7d86181b8a7a": "Best power efficiency",
                        "00000000-0000-0000-0000-000000000000": "Balanced",
                        "ded574b5-45a0-4f42-8737-46345c09c238": "Best performance"}
            out["power_mode_overlay"] = overlays.get(str(g), str(g))
    except Exception as err:
        note_error("read the power mode slider", err)
    return out


def linux_power():
    out = {}
    base = "/sys/class/power_supply"
    try:
        for dev in sorted(os.listdir(base)):
            p = os.path.join(base, dev)
            kind = open(os.path.join(p, "type")).read().strip()
            if kind == "Mains":
                online = open(os.path.join(p, "online")).read().strip() == "1"
                out.setdefault("power_source", "AC power" if online else "battery")
            elif kind == "Battery" and os.path.exists(os.path.join(p, "status")):
                out["battery_status"] = open(os.path.join(p, "status")).read().strip()
    except OSError:
        pass
    out.setdefault("power_source", "AC power (no battery found)")
    for path in ("/sys/firmware/acpi/platform_profile",):
        try:
            out["platform_profile"] = open(path).read().strip()
        except OSError:
            pass
    try:
        out["powerprofilesctl"] = subprocess.run(["powerprofilesctl", "get"], capture_output=True,
                                                 text=True, timeout=5).stdout.strip()
    except Exception:
        pass
    try:
        gov = "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"
        out["cpu_governor"] = open(gov).read().strip()
    except OSError:
        pass
    return out


# ---------------------------------------------------------------------------
# Linux CPU: Intel/AMD RAPL, through /sys/class/powercap
# ---------------------------------------------------------------------------

def rapl_domains(root="/sys/class/powercap"):
    domains = []
    try:
        names = sorted(os.listdir(root))
    except OSError:
        return domains
    for d in names:
        p = os.path.join(root, d)
        if not os.path.exists(os.path.join(p, "energy_uj")):
            continue
        info = {"dir": d}
        try:
            info["name"] = open(os.path.join(p, "name")).read().strip()
        except OSError:
            info["name"] = "?"
        # Only whole packages are added up: their sub-domains (core, uncore)
        # are part of them, and intel-rapl-mmio repeats them
        info["top"] = d.count(":") == 1 and d.startswith("intel-rapl:") and info["name"].startswith("package")
        try:
            info["max_energy_range_uj"] = int(open(os.path.join(p, "max_energy_range_uj")).read())
        except (OSError, ValueError):
            pass
        try:
            info["energy_uj"] = int(open(os.path.join(p, "energy_uj")).read())
            info["readable"] = True
        except PermissionError:
            info["readable"] = False
            info["why"] = "permission denied (root-only since 2020, the 'Platypus' fix)"
        except (OSError, ValueError) as err:
            info["readable"] = False
            info["why"] = str(err)
        domains.append(info)
    return domains


def read_rapl(domains, root="/sys/class/powercap"):
    out = {}
    for d in domains:
        if d.get("readable"):
            try:
                out[d["dir"]] = int(open(os.path.join(root, d["dir"], "energy_uj")).read())
            except (OSError, ValueError):
                pass
    return out


# ---------------------------------------------------------------------------
# nvidia-smi, as an independent check of NVML's readings
# ---------------------------------------------------------------------------

class NvidiaSmiSampler(threading.Thread):
    """Samples each GPU's power draw from nvidia-smi every `interval` s."""

    def __init__(self, interval=0.5):
        super().__init__(daemon=True)
        self.interval, self.samples, self.stop_flag = interval, [], False
        self.fields = "index,power.draw,power.draw.instant"

    def run(self):
        while not self.stop_flag:
            try:
                out = subprocess.run(["nvidia-smi", f"--query-gpu={self.fields}", "--format=csv,noheader,nounits"],
                                     capture_output=True, text=True, timeout=10)
                if out.returncode != 0 and "instant" in self.fields:
                    self.fields = "index,power.draw"  # older drivers
                    continue
                t = time.monotonic()
                for line in out.stdout.strip().splitlines():
                    cols = [c.strip() for c in line.split(",")]
                    row = {"t": t, "gpu": int(cols[0]), "power_draw_w": to_float(cols[1])}
                    if len(cols) > 2:
                        row["power_draw_instant_w"] = to_float(cols[2])
                    self.samples.append(row)
            except Exception as err:
                self.samples.append({"error": str(err)})
                return
            time.sleep(self.interval)

    def mean_power(self, t0, t1, key="power_draw_w"):
        per_gpu = {}
        for s in self.samples:
            if "t" in s and t0 <= s["t"] <= t1 and s.get(key) is not None:
                per_gpu.setdefault(s["gpu"], []).append(s[key])
        return {g: round(statistics.mean(v), 1) for g, v in per_gpu.items()}


def to_float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# The probe
# ---------------------------------------------------------------------------

def energy_reader(nvml, handles, rapl):
    """A function returning (time, {part: joules}) from what's available."""
    use_counter = {}
    for i, h in enumerate(handles):
        v, _ = nvml.ulonglong("nvmlDeviceGetTotalEnergyConsumption", h)
        use_counter[i] = v is not None
    last_power = {}
    integrated = {}
    rapl_last, rapl_total = {}, {}
    rapl_range = {d["dir"]: d.get("max_energy_range_uj") for d in rapl}

    def read():
        t = time.monotonic()
        out = {}
        for i, h in enumerate(handles):
            if use_counter[i]:
                v, _ = nvml.ulonglong("nvmlDeviceGetTotalEnergyConsumption", h)
                if v is not None:
                    out[f"gpu{i}"] = v / 1000.0
            else:  # add up power readings over time instead
                mw, _ = nvml.uint("nvmlDeviceGetPowerUsage", h)
                if mw is not None:
                    if i in last_power:
                        t0, w0 = last_power[i]
                        integrated[i] = integrated.get(i, 0.0) + (w0 + mw / 1000.0) / 2 * (t - t0)
                    last_power[i] = (t, mw / 1000.0)
                    out[f"gpu{i}"] = integrated.get(i, 0.0)
        for d, uj in (read_rapl(rapl) if rapl else {}).items():
            if d in rapl_last:
                delta = uj - rapl_last[d]
                if delta < 0:  # the counter wrapped around
                    delta += rapl_range.get(d) or 0
                rapl_total[d] = rapl_total.get(d, 0) + max(delta, 0)
            rapl_last[d] = uj
            out[f"cpu:{d}"] = rapl_total.get(d, 0) / 1e6
        return t, out
    return read, use_counter


def counted(part: str, rapl) -> bool:
    """Whether a part adds to the total (not a CPU sub-domain of another)."""
    if not part.startswith("cpu:"):
        return True
    return any(d["dir"] == part[4:] and d.get("top") for d in rapl)


def counter_behavior(read, seconds=2.0):
    """How often each counter changes, and how long a reading takes."""
    times, values = [], {}
    end = time.monotonic() + seconds
    costs = []
    while time.monotonic() < end:
        a = time.perf_counter()
        t, e = read()
        costs.append(time.perf_counter() - a)
        times.append(t)
        for k, v in e.items():
            values.setdefault(k, []).append(v)
        time.sleep(0.005)
    out = {"read_ms_median": round(statistics.median(costs) * 1000, 2),
           "read_ms_max": round(max(costs) * 1000, 2), "updates_per_s": {}}
    for k, vs in values.items():
        changes = sum(1 for a, b in zip(vs, vs[1:]) if b != a)
        out["updates_per_s"][k] = round(changes / (times[-1] - times[0]), 1)
    return out


def sample_for(read, seconds, interval):
    samples = []
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        samples.append(read())
        time.sleep(interval)
    samples.append(read())
    return samples


def powers(samples):
    """Watts per part for each interval: [(t0, t1, {part: W})]."""
    out = []
    for (t0, e0), (t1, e1) in zip(samples, samples[1:]):
        if t1 > t0:
            out.append((t0, t1, {k: (e1[k] - e0[k]) / (t1 - t0) for k in e1 if k in e0}))
    return out


def energy_between(samples, t0, t1):
    joules = {}
    for a, b, w in powers(samples):
        overlap = min(b, t1) - max(a, t0)
        if overlap > 0:
            for k, v in w.items():
                joules[k] = joules.get(k, 0.0) + v * overlap
    return joules


OUT = os.path.abspath("energy_probe_report.json")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ollama", default="http://localhost:11434", help="Ollama's URL")
    ap.add_argument("--model", help="model to test with (default: the smallest installed)")
    ap.add_argument("--idle", type=float, default=20.0, help="seconds to measure idle power")
    ap.add_argument("--watch", type=float, default=0.0, help="then watch GPU programs for this many seconds")
    ap.add_argument("--out", default=OUT, help="where to write the report")
    args = ap.parse_args()
    main.args = args  # for writing the report if stopped early

    step("This machine")
    REPORT["system"] = {"os": platform.platform(), "python": sys.version.split()[0],
                        "machine": platform.machine(), "processor": platform.processor()}
    print("   ", REPORT["system"])

    # --- NVIDIA ---
    step("NVIDIA GPUs (NVML)")
    nvml, handles = None, []
    try:
        nvml = Nvml()
        handles = nvml.devices()
        REPORT["nvml"] = {"driver": nvml.driver_version(), "gpus": []}
        print("    driver", REPORT["nvml"]["driver"])
        for i, h in enumerate(handles):
            g = {"index": i, "name": nvml.name(h)}
            e1, err = nvml.ulonglong("nvmlDeviceGetTotalEnergyConsumption", h)
            g["energy_counter"] = "supported" if e1 is not None else f"not supported: {err}"
            p, err = nvml.uint("nvmlDeviceGetPowerUsage", h)
            g["power_w"] = p / 1000 if p is not None else f"unavailable: {err}"
            lim, err = nvml.uint("nvmlDeviceGetEnforcedPowerLimit", h)
            g["power_limit_w"] = lim / 1000 if lim is not None else f"unavailable: {err}"
            reasons, err = nvml.ulonglong("nvmlDeviceGetCurrentClocksThrottleReasons", h)
            g["throttle_reasons"] = hex(reasons) if reasons is not None else f"unavailable: {err}"
            g["utilization"], err = nvml.utilization(h)
            for kind in ("Compute", "Graphics"):
                procs, err = nvml.processes(h, kind)
                g[f"{kind.lower()}_processes"] = procs if procs is not None else f"unavailable: {err}"
            util, err = nvml.process_utilization(h)
            g["process_utilization"] = util if util is not None else f"unavailable: {err}"
            REPORT["nvml"]["gpus"].append(g)
            print(f"    GPU {i}: {g['name']}; energy counter {g['energy_counter']}; power {g['power_w']} W; "
                  f"limit {g['power_limit_w']} W")
    except Exception as err:
        note_error("use NVML", err)
        REPORT["nvml"] = {"error": str(err)}

    # --- Per-program GPU use ---
    engines = None
    if IS_WINDOWS:
        step("Programs using the GPU (Windows performance counters)")
        try:
            engines = WindowsGpuEngines()
            time.sleep(1.0)
            seen = summarize_engines(engines.sample(), min_pct=0.0)
            REPORT["windows_gpu_engines"] = seen[:30]
            for p in seen[:10]:
                print(f"    {p['name']} (pid {p['pid']}): {p['pct']}% {p['engines']}")
            if not seen:
                print("    (none right now)")
        except Exception as err:
            note_error("read the GPU Engine counters", err)

    # --- Power settings ---
    step("Power source and settings")
    try:
        REPORT["power"] = windows_power() if IS_WINDOWS else linux_power() if IS_LINUX else {}
        print("   ", REPORT["power"])
    except Exception as err:
        note_error("read the power settings", err)

    # --- CPU (Linux) ---
    rapl = []
    if IS_LINUX:
        step("CPU energy (RAPL)")
        rapl = rapl_domains()
        REPORT["rapl"] = rapl
        for d in rapl:
            print(f"    {d['dir']} ({d['name']}): {'readable' if d['readable'] else d.get('why')}")
        if not rapl:
            print("    none found")
    elif IS_WINDOWS:
        REPORT["rapl"] = "Windows has no user-level CPU energy counters"

    if not handles and not any(d.get("readable") for d in rapl):
        print("\nNo energy counters to measure with here.")
        finish(args)
        return

    read, use_counter = energy_reader(nvml, handles, rapl)
    REPORT["gpu_energy_source"] = {f"gpu{i}": "energy counter" if c else "power readings"
                                   for i, c in use_counter.items()}
    step("How often the counters update, and what a reading costs")
    try:
        REPORT["counters"] = counter_behavior(read)
        print("   ", REPORT["counters"])
    except Exception as err:
        note_error("time the counters", err)

    # --- Idle ---
    step(f"Idle power ({args.idle:.0f} s: please leave the machine alone)")
    smi = NvidiaSmiSampler() if handles else None
    if smi:
        smi.start()
    t0 = time.monotonic()
    idle = sample_for(read, args.idle, 0.5)
    t1 = time.monotonic()
    idle_w = {}
    for _, _, w in powers(idle):
        for k, v in w.items():
            idle_w.setdefault(k, []).append(v)
    REPORT["idle"] = {k: {"median_w": round(statistics.median(v), 2),
                          "p10_w": round(sorted(v)[len(v) // 10], 2),
                          "p90_w": round(sorted(v)[(len(v) * 9) // 10], 2)} for k, v in idle_w.items()}
    if smi:
        REPORT["idle"]["nvidia_smi_mean_w"] = smi.mean_power(t0, t1)
    for k, v in REPORT["idle"].items():
        print(f"    {k}: {v}")

    # --- One Ollama request ---
    step(f"Generating with Ollama ({args.ollama})")
    try:
        tags = json.load(urllib.request.urlopen(f"{args.ollama}/api/tags", timeout=5))
        models = sorted(tags.get("models", []), key=lambda m: m.get("size", 0))
        # Embedding models can't generate text
        models = [m for m in models if "embed" not in m["name"] and "bert" not in m["name"]]
        REPORT["ollama_models"] = [{"name": m["name"], "gb": round(m.get("size", 0) / 1e9, 1)} for m in models]
        model = args.model or (models[0]["name"] if models else None)
        if not model:
            raise RuntimeError("no models installed")
        print(f"    model {model}")
        runs = []
        for attempt in range(2):  # the first may include loading the model
            stop = threading.Event()
            fast = []

            def fast_read():
                while not stop.is_set():
                    fast.append(read())
                    time.sleep(0.1)
            th = threading.Thread(target=fast_read, daemon=True)
            th.start()
            body = json.dumps({"model": model, "prompt": "In five sentences, why is the sky blue?",
                               "stream": False, "options": {"temperature": 0, "seed": 1, "num_predict": 400}}).encode()
            began = time.monotonic()
            r = json.load(urllib.request.urlopen(urllib.request.Request(
                f"{args.ollama}/api/generate", data=body, headers={"Content-Type": "application/json"}), timeout=600))
            replied = time.monotonic()
            time.sleep(0.3)
            stop.set()
            th.join()
            ns = 1e9
            gen_s = (r.get("prompt_eval_duration", 0) + r.get("eval_duration", 0)) / ns
            window = (replied - gen_s, replied)
            joules = energy_between(fast, *window)
            above = {k: round(v - REPORT["idle"].get(k, {}).get("median_w", 0) * gen_s, 2)
                     for k, v in joules.items()}
            run = {"tokens": r.get("eval_count"), "load_s": round(r.get("load_duration", 0) / ns, 2),
                   "generation_s": round(gen_s, 2), "total_s": round(r.get("total_duration", 0) / ns, 2),
                   "request_s": round(replied - began, 2), "energy_j": {k: round(v, 2) for k, v in joules.items()},
                   "energy_above_idle_j": above,
                   "energy_above_idle_mwh": round(sum(v for k, v in above.items() if counted(k, rapl)) / 3.6, 2),
                   "mean_w": {k: round(v / gen_s, 1) for k, v in joules.items()} if gen_s > 0 else {}}
            if smi:
                run["nvidia_smi_mean_w"] = smi.mean_power(*window)
                run["nvidia_smi_instant_mean_w"] = smi.mean_power(*window, key="power_draw_instant_w")
            if engines:
                try:
                    run["windows_gpu_engines"] = summarize_engines(engines.sample())[:10]
                except Exception as err:
                    note_error("read the GPU Engine counters", err)
            if nvml:
                run["nvml_process_utilization"] = {
                    i: nvml.process_utilization(h, int((time.time() - (replied - began) - 2) * 1e6))[0]
                    for i, h in enumerate(handles)}
            runs.append(run)
            print(f"    run {attempt + 1}: {run['tokens']} tokens in {run['generation_s']} s "
                  f"(load {run['load_s']} s): {run['energy_above_idle_mwh']} mWh above idle; "
                  f"mean W {run['mean_w']}; nvidia-smi {run.get('nvidia_smi_mean_w')}")
            time.sleep(3)
        REPORT["ollama_runs"] = runs
    except Exception as err:
        note_error("run a test with Ollama", err)
    if smi:
        smi.stop_flag = True

    # --- Other programs on the GPU ---
    if args.watch > 0:
        step(f"Watching which programs use the GPU for {args.watch:.0f} s "
             "(start an image generation in ComfyUI now)")
        watch = []
        end = time.monotonic() + args.watch
        last_us = int(time.time() * 1e6)
        while time.monotonic() < end:
            time.sleep(1.0)
            entry = {"t": round(args.watch - (end - time.monotonic()), 1)}
            if engines:
                try:
                    entry["windows"] = summarize_engines(engines.sample(), min_pct=2.0)
                except Exception as err:
                    entry["windows_error"] = str(err)
            if nvml:
                entry["nvml"] = {i: nvml.process_utilization(h, last_us)[0] for i, h in enumerate(handles)}
                last_us = int(time.time() * 1e6) - 1_000_000
            if nvml:
                entry["gpu_w"] = {i: (nvml.uint("nvmlDeviceGetPowerUsage", h)[0] or 0) / 1000
                                  for i, h in enumerate(handles)}
            watch.append(entry)
            busy = ", ".join(f"{p['name']} {p['pct']}%" for p in entry.get("windows", [])) or \
                ", ".join(f"{p['name']} {p['sm_pct']}%" for g in (entry.get("nvml") or {}).values() for p in (g or []))
            print(f"    {entry['t']:5.1f} s  GPU W {entry.get('gpu_w')}  {busy or '(nothing busy)'}")
        REPORT["watch"] = watch

    finish(args)


def finish(args):
    REPORT["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(REPORT, f, indent=2, default=str)
        print(f"\nDone. Please send back: {args.out}")
    except OSError as err:
        print(f"\nCouldn't write the report ({err}). Here it is instead:\n")
        print(json.dumps(REPORT, indent=2, default=str))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
        REPORT["errors"].append({"where": "main", "error": "stopped by the user"})
        finish(getattr(main, "args", argparse.Namespace(out=OUT)))
