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
        self._handles = []
        for i in range(count.value):
            h = c_void_p()
            if self._call("nvmlDeviceGetHandleByIndex_v2", c_uint(i), byref(h)) == NVML_SUCCESS:
                self._handles.append(h)

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
        return len(self._handles)

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
        self._parts = ["gpu"] if n == 1 else [f"gpu{i}" for i in range(n)]
        # Each GPU's energy counter at the start, or None to use power readings
        self._start: List[Optional[int]] = [nvml.energy_mj(i) for i in range(n)]
        self._last_power: List[Optional[Tuple[float, float]]] = [None] * n  # (time, watts)
        self._integrated = [0.0] * n
        names = [nvml.name(i) for i in range(n)]
        counted = "" if all(s is not None for s in self._start) else ", from power readings"
        self.name = f"NVIDIA GPU{'s' if n > 1 else ''} ({', '.join(names)}; NVML{counted})"

    def components(self) -> List[str]:
        return list(self._parts)

    def read(self) -> Dict[str, float]:
        out: Dict[str, float] = {}
        for i, part in enumerate(self._parts):
            if self._start[i] is not None:
                mj = self._nvml.energy_mj(i)
                if mj is not None:
                    out[part] = max(mj - self._start[i], 0) / 1000
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
        take longer), and whether they're being slowed down by heat."""
        limits, hot = [], False
        for i in range(len(self._parts)):
            limit, default = self._nvml.power_limit_mw(i), self._nvml.default_power_limit_mw(i)
            if limit is not None and default is not None and abs(limit - default) >= 1000:
                label = "the GPU" if len(self._parts) == 1 else f"GPU {i}"
                limits.append(f"{label} limited to {limit / 1000:.0f} W (default {default / 1000:.0f} W)")
            reasons = self._nvml.throttle_reasons(i)
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
