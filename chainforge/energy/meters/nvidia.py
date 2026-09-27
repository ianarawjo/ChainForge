"""NVIDIA GPUs, through NVML: the library the NVIDIA driver installs on Windows
and Linux (nvml.dll, libnvidia-ml.so.1), which nvidia-smi reads too. Called
through ctypes, so nothing needs installing.

Energy comes from each GPU's energy counter (Volta, 2017, and newer). On older
GPUs, it's worked out from their power readings instead, which are coarser.
"""

import ctypes
import os
import sys
import time
from ctypes import byref, c_char_p, c_uint, c_ulonglong, c_void_p
from typing import Dict, List, Optional, Tuple

from chainforge.energy.meters.base import EnergyMeter

NVML_SUCCESS = 0
NVML_ERROR_NOT_FOUND = 6
NVML_ERROR_INSUFFICIENT_SIZE = 7
NVML_ERROR_FUNCTION_NOT_FOUND = 13

# nvmlClocksThrottleReasons: slowed down to keep the GPU from overheating
THROTTLE_THERMAL = 0x20 | 0x40  # software / hardware thermal slowdown
NVML_PERF_POLICY_THERMAL = 1


class _ViolationTime(ctypes.Structure):  # nvmlViolationTime_t
    _fields_ = [("referenceTime", c_ulonglong), ("violationTime", c_ulonglong)]


class _ProcessUtilSample(ctypes.Structure):  # nvmlProcessUtilizationSample_t
    _fields_ = [("pid", c_uint), ("timeStamp", c_ulonglong), ("smUtil", c_uint),
                ("memUtil", c_uint), ("encUtil", c_uint), ("decUtil", c_uint)]


class Nvml:
    """The few NVML calls the meter needs. Each returns None where the GPU or
    driver doesn't support it."""

    def __init__(self):
        self._lib = self._load()
        self._lib.nvmlErrorString.restype = c_char_p
        code = self._lib.nvmlInit_v2()
        if code != NVML_SUCCESS:
            raise RuntimeError(f"NVML didn't start: {self._error(code)}")
        count = c_uint()
        if self._call("nvmlDeviceGetCount_v2", byref(count)) != NVML_SUCCESS:
            raise RuntimeError("NVML couldn't count the GPUs")
        self._total = count.value
        self._handles, self._indices = [], []
        for i in range(count.value):
            h = c_void_p()
            if self._call("nvmlDeviceGetHandleByIndex_v2", c_uint(i), byref(h)) == NVML_SUCCESS:
                self._handles.append(h)
                self._indices.append(i)

    @staticmethod
    def _load():
        if sys.platform == "win32":
            paths = [os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "System32", "nvml.dll"),
                     os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"),
                                  "NVIDIA Corporation", "NVSMI", "nvml.dll")]
        else:
            paths = ["libnvidia-ml.so.1", "/usr/lib/wsl/lib/libnvidia-ml.so.1"]
        for path in paths:
            try:
                return ctypes.CDLL(path)
            except OSError:
                pass
        raise OSError("no NVIDIA driver (NVML) found")

    def _error(self, code: int) -> str:
        try:
            return self._lib.nvmlErrorString(code).decode()
        except Exception:
            return f"error {code}"

    def _call(self, name: str, *args) -> int:
        fn = getattr(self._lib, name, None)
        return NVML_ERROR_FUNCTION_NOT_FOUND if fn is None else fn(*args)

    def _value(self, name: str, i: int, ctype):
        v = ctype()
        return v.value if self._call(name, self._handles[i], byref(v)) == NVML_SUCCESS else None

    def count(self) -> int:
        """How many GPUs can be read (numbered 0 to count - 1 below)."""
        return len(self._handles)

    def total(self) -> int:
        """How many GPUs the driver has, readable or not."""
        return self._total

    def index(self, i: int) -> int:
        """The driver's number for GPU i, as nvidia-smi shows it."""
        return self._indices[i]

    def name(self, i: int) -> str:
        buf = ctypes.create_string_buffer(96)
        if self._call("nvmlDeviceGetName", self._handles[i], buf, c_uint(96)) != NVML_SUCCESS:
            return f"GPU {i}"
        return buf.value.decode(errors="replace")

    def energy_mj(self, i: int) -> Optional[int]:
        """Millijoules used since the driver loaded."""
        return self._value("nvmlDeviceGetTotalEnergyConsumption", i, c_ulonglong)

    def power_mw(self, i: int) -> Optional[int]:
        return self._value("nvmlDeviceGetPowerUsage", i, c_uint)

    def power_limit_mw(self, i: int) -> Optional[int]:
        return self._value("nvmlDeviceGetEnforcedPowerLimit", i, c_uint)

    def default_power_limit_mw(self, i: int) -> Optional[int]:
        return self._value("nvmlDeviceGetPowerManagementDefaultLimit", i, c_uint)

    def throttle_reasons(self, i: int) -> Optional[int]:
        return self._value("nvmlDeviceGetCurrentClocksThrottleReasons", i, c_ulonglong)

    def thermal_violation_ns(self, i: int) -> Optional[int]:
        """Nanoseconds the GPU has been slowed by heat, in all (only some GPUs
        keep this count)."""
        v = _ViolationTime()
        code = self._call("nvmlDeviceGetViolationStatus", self._handles[i],
                          ctypes.c_int(NVML_PERF_POLICY_THERMAL), byref(v))
        return v.violationTime if code == NVML_SUCCESS else None

    def process_utilization(self, i: int, since_us: int) -> Optional[Dict[int, int]]:
        """{pid: highest % of the GPU's cores it used} in samples since
        `since_us` (microseconds since the epoch). None if unsupported (as on
        Windows, where the driver usually doesn't allow it)."""
        h, count = self._handles[i], c_uint(0)
        code = self._call("nvmlDeviceGetProcessUtilization", h, None, byref(count), c_ulonglong(since_us))
        if code in (NVML_SUCCESS, NVML_ERROR_NOT_FOUND):  # no samples since then
            return {}
        if code != NVML_ERROR_INSUFFICIENT_SIZE:
            return None
        samples = (_ProcessUtilSample * (count.value + 8))()
        count = c_uint(count.value + 8)
        code = self._call("nvmlDeviceGetProcessUtilization", h, samples, byref(count), c_ulonglong(since_us))
        if code == NVML_ERROR_NOT_FOUND:
            return {}
        if code != NVML_SUCCESS:
            return None
        out: Dict[int, int] = {}
        for s in samples[:count.value]:
            out[s.pid] = max(out.get(s.pid, 0), s.smUtil)
        return out


class NvidiaMeter(EnergyMeter):
    """The energy each NVIDIA GPU uses: component "gpu" for one GPU, or "gpu0",
    "gpu1", ... for several."""

    def __init__(self, nvml, clock=time.monotonic):
        self._nvml = nvml
        self._clock = clock
        n = nvml.count()
        if n == 0:
            raise RuntimeError("no NVIDIA GPUs found")
        # Numbered as the driver (and nvidia-smi) numbers them, even if one
        # couldn't be read
        self._labels = [f"GPU {nvml.index(i)}" for i in range(n)]
        self._parts = ["gpu"] if nvml.total() == 1 else [f"gpu{nvml.index(i)}" for i in range(n)]
        # Each GPU's energy counter when last read, or None to use power
        # readings; and the joules used since the meter began
        self._last_mj: List[Optional[int]] = [nvml.energy_mj(i) for i in range(n)]
        self._counted = [0.0] * n
        self._last_power: List[Optional[Tuple[float, float]]] = [None] * n  # (time, watts)
        self._integrated = [0.0] * n
        self._last_violation: List[Optional[int]] = [nvml.thermal_violation_ns(i) for i in range(n)]
        names = [nvml.name(i) for i in range(n)]
        counted = "" if all(s is not None for s in self._last_mj) else ", from power readings"
        self.name = f"NVIDIA GPU{'s' if n > 1 else ''} ({', '.join(names)}; NVML{counted})"

    def components(self) -> List[str]:
        return list(self._parts)

    def read(self) -> Dict[str, float]:
        out: Dict[str, float] = {}
        for i, part in enumerate(self._parts):
            if self._last_mj[i] is not None:
                mj = self._nvml.energy_mj(i)
                if mj is not None:
                    # Added up reading by reading, so a counter that restarts
                    # (the driver reloading, the GPU being reset) loses only
                    # the moment it restarted in
                    delta = mj - self._last_mj[i]
                    self._counted[i] += (delta if delta >= 0 else mj) / 1000
                    self._last_mj[i] = mj
                    out[part] = self._counted[i]
                    continue
            out[part] = self._from_power(i)
        return out

    def _from_power(self, i: int) -> float:
        """Joules, adding up power readings over time (trapezoids)."""
        mw = self._nvml.power_mw(i)
        now = self._clock()
        if mw is not None:
            watts = mw / 1000
            last = self._last_power[i]
            if last is not None:
                self._integrated[i] += (last[1] + watts) / 2 * (now - last[0])
            self._last_power[i] = (now, watts)
        return self._integrated[i]

    def conditions(self) -> Dict[str, str]:
        """The GPUs' power limits (lowered, they use less energy per token, but
        take longer), and whether they've been slowed down by heat since the
        last call: the monitor calls this during requests too, so heat during
        one is caught, not only at its start, when the GPU is cool."""
        limits, hot = [], False
        for i in range(len(self._parts)):
            limit, default = self._nvml.power_limit_mw(i), self._nvml.default_power_limit_mw(i)
            if limit is not None and default is not None and abs(limit - default) >= 1000:
                label = "the GPU" if self._parts == ["gpu"] else self._labels[i]
                limits.append(f"{label} limited to {limit / 1000:.0f} W (default {default / 1000:.0f} W)")
            violation = self._nvml.thermal_violation_ns(i)
            last, self._last_violation[i] = self._last_violation[i], violation
            if violation is not None and last is not None and violation > last:
                hot = True
            reasons = self._nvml.throttle_reasons(i)  # right now
            hot = hot or bool(reasons is not None and reasons & THROTTLE_THERMAL)
        return {
            "gpu_power_limit": "; ".join(limits) or "default",
            "thermal": "the GPU was slowed by heat" if hot else "nominal",
        }

    def gpu_processes(self, since_us: int) -> Optional[Dict[int, float]]:
        """{pid: % of a GPU's cores} for programs using any GPU since
        `since_us`, from NVML (Linux); None if it can't tell."""
        out: Dict[int, float] = {}
        for i in range(len(self._parts)):
            per_pid = self._nvml.process_utilization(i, since_us)
            if per_pid is None:
                return None
            for pid, pct in per_pid.items():
                out[pid] = max(out.get(pid, 0.0), float(pct))
        return out


def try_nvidia_meter() -> Tuple[Optional[NvidiaMeter], str]:
    try:
        return NvidiaMeter(Nvml()), ""
    except Exception as err:
        return None, f"No NVIDIA GPU to measure ({err})."
