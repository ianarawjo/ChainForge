"""What Windows and Linux can tell about the power settings, and about which
programs are using the GPU, for the NVIDIA and RAPL meters.

Power settings change how much energy the same work takes (a power-saving
plan runs the hardware at lower clocks and voltages), so each measurement
records them. Other programs using the GPU during a request (an image
generation in ComfyUI, a game) add their energy to its measurement, so the
monitor flags those requests, and leaves those times out of idle power.
"""

import ctypes
import os
import shutil
import subprocess
import sys
import time
from ctypes import byref
from typing import Callable, Dict, Iterable, List, Optional, Tuple

# A program using at least this much of a GPU (its busiest engine, on
# average between checks) counts as using it
OTHER_USE_MIN_PERCENT = 5.0
# Web browsers, though, draw ChainForge's own page (its progress animations
# run on the GPU), so count only heavy use, e.g. WebGPU or a game
BROWSER_MIN_PERCENT = 30.0
_BROWSERS = ("chrome", "msedge", "firefox", "brave", "opera", "vivaldi", "arc", "safari", "chromium")
# Not "other programs": the model server itself (Ollama's runners, whatever
# they're called in each version; Linux cuts names to 15 characters), and
# the Windows desktop's own compositor, which draws the screen
_OWN = ("ollama", "llama-server", "llama_server")
_SYSTEM = {"dwm", "csrss", "system", "idle"}


def process_name(pid: int) -> Optional[str]:
    """A program's name from its process id, e.g. "ComfyUI.exe" -> "ComfyUI";
    None if it can't be read (e.g. a process in another container, whose ids
    NVML reports from the host's point of view). Only the program's name, not
    its arguments: the names are saved with measurements, in flows people share.
    """
    try:
        if sys.platform == "win32":
            return _windows_process_name(pid)
        with open(f"/proc/{pid}/comm", encoding="utf-8") as f:
            return f.read().strip() or None
    except Exception:
        return None


_kernel32 = None


def _k32():
    """kernel32, with the signatures of the calls used here (set up once)."""
    global _kernel32
    if _kernel32 is None:
        from ctypes import wintypes
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.OpenProcess.restype = wintypes.HANDLE
        k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        k32.QueryFullProcessImageNameW.argtypes = [
            wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        k32.CloseHandle.argtypes = [wintypes.HANDLE]
        _kernel32 = k32
    return _kernel32


def _windows_process_name(pid: int) -> Optional[str]:
    from ctypes import wintypes
    k32 = _k32()
    h = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return None
    try:
        buf, size = ctypes.create_unicode_buffer(1024), wintypes.DWORD(1024)
        if k32.QueryFullProcessImageNameW(h, 0, buf, byref(size)):
            name = os.path.basename(buf.value)
            return name[:-4] if name.lower().endswith(".exe") else name
        return None
    finally:
        k32.CloseHandle(h)


def other_programs(
    per_pid: Dict[int, float],
    name_of: Callable[[int], Optional[str]] = process_name,
    own_pid: Optional[int] = None,
    min_percent: float = OTHER_USE_MIN_PERCENT,
) -> List[str]:
    """The names of programs, besides the model server, ChainForge and the
    desktop, that used the GPU at least `min_percent` (more, for browsers).

    A process whose name can't be read is left out: it can't be told apart
    from the model server (e.g. Ollama in another container).
    """
    own_pid = os.getpid() if own_pid is None else own_pid
    names = set()
    for pid, pct in per_pid.items():
        if pct < min_percent or pid in (0, 4, own_pid):
            continue
        name = name_of(pid)
        if not name:
            continue
        low = name.lower()
        if low.startswith(_OWN) or low in _SYSTEM:
            continue
        if low.startswith(_BROWSERS) and pct < BROWSER_MIN_PERCENT:
            continue
        names.add(name)
    return sorted(names)


# ---------------------------------------------------------------------------
# Windows
# ---------------------------------------------------------------------------

def parse_gpu_engines(items: Iterable[Tuple[str, float]]) -> Dict[int, float]:
    """{pid: % of its busiest GPU engine} from the "GPU Engine" counters'
    instances, e.g. ("pid_1234_luid_0x0_0xD1E2_phys_0_eng_0_engtype_3D", 37.5).

    Video encoding and decoding are left out: they're separate, low-power
    parts of the GPU (and a browser playing a video uses them all the time).
    """
    per_engine: Dict[Tuple[int, str], float] = {}
    for name, value in items:
        parts = name.split("_")
        try:
            pid = int(parts[parts.index("pid") + 1])
        except (ValueError, IndexError):
            continue
        engine = name.split("_luid_", 1)[-1]  # which GPU, and which of its engines
        if "engtype_Video" in engine:
            continue
        per_engine[(pid, engine)] = per_engine.get((pid, engine), 0.0) + value
    out: Dict[int, float] = {}
    for (pid, _), value in per_engine.items():
        out[pid] = max(out.get(pid, 0.0), value)
    return out


class WindowsGpuEngines:
    """How much each program used each GPU engine since the last call: the
    performance counters Task Manager's GPU column shows. (NVML's per-program
    readings are usually unavailable on Windows.)"""

    _PDH_MORE_DATA = 0x800007D2
    _PDH_FMT_DOUBLE = 0x00000200

    class _Item(ctypes.Structure):  # PDH_FMT_COUNTERVALUE_ITEM_W
        class _Value(ctypes.Structure):
            class _U(ctypes.Union):
                _fields_ = [("longValue", ctypes.c_long), ("doubleValue", ctypes.c_double),
                            ("largeValue", ctypes.c_longlong), ("str", ctypes.c_void_p)]
            _fields_ = [("CStatus", ctypes.c_uint32), ("u", _U)]
        _fields_ = [("szName", ctypes.c_wchar_p), ("FmtValue", _Value)]

    def __init__(self):
        self._pdh = ctypes.WinDLL("pdh")
        self._query, self._counter = ctypes.c_void_p(), ctypes.c_void_p()
        self._check(self._pdh.PdhOpenQueryW(None, None, byref(self._query)))
        self._check(self._pdh.PdhAddEnglishCounterW(
            self._query, "\\GPU Engine(*)\\Utilization Percentage", None, byref(self._counter)))
        self._pdh.PdhCollectQueryData(self._query)  # a rate: needs a first collection

    @staticmethod
    def _check(status: int) -> None:
        if status != 0:
            raise OSError(f"Windows performance counters: error 0x{status & 0xFFFFFFFF:08X}")

    def sample(self) -> Dict[int, float]:
        self._check(self._pdh.PdhCollectQueryData(self._query))
        size, count = ctypes.c_uint32(0), ctypes.c_uint32(0)
        status = self._pdh.PdhGetFormattedCounterArrayW(
            self._counter, self._PDH_FMT_DOUBLE, byref(size), byref(count), None)
        if status == 0:
            return {}
        if status & 0xFFFFFFFF != self._PDH_MORE_DATA:
            self._check(status)
        buf = (ctypes.c_byte * size.value)()
        self._check(self._pdh.PdhGetFormattedCounterArrayW(
            self._counter, self._PDH_FMT_DOUBLE, byref(size), byref(count), buf))
        items = ctypes.cast(buf, ctypes.POINTER(self._Item))
        return parse_gpu_engines(
            (items[i].szName or "", items[i].FmtValue.u.doubleValue)
            for i in range(count.value)
            if items[i].FmtValue.CStatus in (0, 1))  # valid / new data


# Windows' built-in power plans, and the power mode slider's overlays
WINDOWS_PLANS = {
    "381b4222-f694-41f0-9685-ff5bb260df2e": "Balanced",
    "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c": "High performance",
    "a1841308-3541-4fab-bc81-f71556f20b4a": "Power saver",
    "e9a42b02-d5df-448d-aa00-03f14749eb61": "Ultimate Performance",
}
WINDOWS_OVERLAYS = {
    "961cc777-2547-4f9d-8174-7d86181b8a7a": "Best power efficiency",
    "ded574b5-45a0-4f42-8737-46345c09c238": "Best performance",
}


def windows_power_mode(plan: Optional[str], overlay: Optional[str], battery_saver: bool) -> Optional[str]:
    """E.g. "Balanced power plan, Best performance", or "Battery saver"."""
    if battery_saver:
        return "Battery saver"
    if not plan:
        return None
    mode = f"{plan} power plan"
    return f"{mode}, {overlay}" if overlay else mode


class _GUID(ctypes.Structure):
    _fields_ = [("Data1", ctypes.c_uint32), ("Data2", ctypes.c_uint16),
                ("Data3", ctypes.c_uint16), ("Data4", ctypes.c_ubyte * 8)]

    def __str__(self) -> str:
        d4 = bytes(self.Data4).hex()
        return f"{self.Data1:08x}-{self.Data2:04x}-{self.Data3:04x}-{d4[:4]}-{d4[4:]}"


class _PowerStatus(ctypes.Structure):  # SYSTEM_POWER_STATUS
    _fields_ = [("ACLineStatus", ctypes.c_ubyte), ("BatteryFlag", ctypes.c_ubyte),
                ("BatteryLifePercent", ctypes.c_ubyte), ("SystemStatusFlag", ctypes.c_ubyte),
                ("BatteryLifeTime", ctypes.c_uint32), ("BatteryFullLifeTime", ctypes.c_uint32)]


class WindowsPower:
    """Power source and power plan, from Windows itself (cheap calls)."""

    def __init__(self):
        self._k32 = ctypes.WinDLL("kernel32")
        self._powrprof = ctypes.WinDLL("powrprof")
        self._k32.LocalFree.argtypes = [ctypes.c_void_p]

    def _plan(self) -> Optional[str]:
        guid = ctypes.POINTER(_GUID)()
        if self._powrprof.PowerGetActiveScheme(None, byref(guid)) != 0:
            return None
        try:
            key = str(guid.contents)
            if key in WINDOWS_PLANS:
                return WINDOWS_PLANS[key]
            size = ctypes.c_uint32(0)  # a custom plan: its own name
            self._powrprof.PowerReadFriendlyName(None, guid, None, None, None, byref(size))
            buf = ctypes.create_string_buffer(size.value or 2)
            if self._powrprof.PowerReadFriendlyName(None, guid, None, None, buf, byref(size)) == 0:
                return buf.raw.decode("utf-16-le", errors="replace").rstrip("\0") or "custom"
            return "custom"
        finally:
            self._k32.LocalFree(guid)

    def _overlay(self) -> Optional[str]:
        fn = getattr(self._powrprof, "PowerGetEffectiveOverlayScheme", None)  # Windows 10 1709+
        guid = _GUID()
        if fn is None or fn(byref(guid)) != 0:
            return None
        return WINDOWS_OVERLAYS.get(str(guid))  # none: the slider's middle (balanced)

    def conditions(self) -> Dict[str, str]:
        out: Dict[str, str] = {}
        status = _PowerStatus()
        battery_saver = False
        if self._k32.GetSystemPowerStatus(byref(status)):
            source = {0: "battery", 1: "AC power"}.get(status.ACLineStatus)
            if source:
                out["power_source"] = source
            battery_saver = status.SystemStatusFlag == 1
        mode = windows_power_mode(self._plan(), self._overlay(), battery_saver)
        if mode:
            out["power_mode"] = mode
        return out

    def refresh(self) -> None:
        pass


# ---------------------------------------------------------------------------
# Linux
# ---------------------------------------------------------------------------

class LinuxPower:
    """Power source, from /sys/class/power_supply, and power profile, from
    the firmware's platform profile or power-profiles-daemon."""

    # Where power-profiles-daemon keeps the profile it's set to
    DAEMON_STATE = "/var/lib/power-profiles-daemon/state.ini"
    # Asking the daemon instead (powerprofilesctl, a Python script) costs a
    # tenth of a second of CPU, which shows up in idle power: rarely, then
    DAEMON_ASK_EVERY_S = 300.0

    def __init__(self, sys_root: str = "/sys", daemon_state: str = DAEMON_STATE, clock=time.monotonic):
        self._root = sys_root
        self._daemon_state = daemon_state
        self._clock = clock
        self._daemon_profile: Optional[str] = None
        self._asked_at = -float("inf")
        self._has_ctl: Optional[bool] = None

    def _read(self, *path: str) -> Optional[str]:
        try:
            with open(os.path.join(self._root, *path), encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            return None

    def _power_source(self) -> str:
        base = os.path.join(self._root, "class", "power_supply")
        try:
            supplies = os.listdir(base)
        except OSError:
            supplies = []
        kind = {s: self._read("class", "power_supply", s, "type") for s in supplies}
        # Chargers: mains adapters, and USB-C chargers (which many laptops
        # list as their own supply, with the mains adapter offline)
        chargers = [s for s in supplies if kind[s] in ("Mains", "USB")]
        # The machine's own batteries, not a mouse's or keyboard's
        batteries = [s for s in supplies if kind[s] == "Battery"
                     and self._read("class", "power_supply", s, "scope") != "Device"]
        if any(self._read("class", "power_supply", s, "online") == "1" for s in chargers):
            return "AC power"
        if batteries and chargers:
            return "battery"
        if batteries:  # no charger listed: go by whether the battery's discharging
            statuses = {self._read("class", "power_supply", b, "status") for b in batteries}
            return "battery" if "Discharging" in statuses else "AC power"
        return "AC power"  # a desktop

    def conditions(self) -> Dict[str, str]:
        out = {"power_source": self._power_source()}
        profile = self._read("firmware", "acpi", "platform_profile") or self._daemon_profile
        if profile:
            out["power_mode"] = f"{profile} power profile"
        return out

    def _daemon_state_profile(self) -> Optional[str]:
        try:
            with open(self._daemon_state, encoding="utf-8") as f:
                for line in f:
                    key, _, value = line.partition("=")
                    if key.strip().lower() == "profile" and value.strip():
                        return value.strip()
        except OSError:
            pass
        return None

    def refresh(self) -> None:
        """power-profiles-daemon's profile, where the firmware has none: from
        its state file, or failing that, now and then, from powerprofilesctl."""
        if self._read("firmware", "acpi", "platform_profile"):
            return
        profile = self._daemon_state_profile()
        if profile:
            self._daemon_profile = profile
            return
        if self._has_ctl is None:
            self._has_ctl = shutil.which("powerprofilesctl") is not None
        now = self._clock()
        if not self._has_ctl or now - self._asked_at < self.DAEMON_ASK_EVERY_S:
            return
        self._asked_at = now
        try:
            out = subprocess.run(["powerprofilesctl", "get"], capture_output=True, text=True, timeout=5)
            if out.returncode == 0 and out.stdout.strip():
                self._daemon_profile = out.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            pass


def system_power():
    """This OS's power settings reader, or None."""
    try:
        if sys.platform == "win32":
            return WindowsPower()
        if sys.platform.startswith("linux"):
            return LinuxPower()
    except Exception:
        pass
    return None
