"""Energy on Apple silicon, from the counters macOS keeps for the CPU, GPU,
Neural Engine and memory (the IOReport "Energy Model" group, which `macmon`
and `powermetrics` also read). Needs no sudo, and nothing beyond ctypes.

IOReport is a private macOS framework: its functions are declared here as
macmon and others use them. The counters are the chip's own energy readings,
not a wall-plug measurement: the screen, fans and SSD aren't in them.
"""

import ctypes
import ctypes.util
import subprocess
import time
from typing import Dict, List, Optional

from chainforge.energy.meters.base import EnergyMeter

_CFRef = ctypes.c_void_p
_UTF8 = 0x08000100  # kCFStringEncodingUTF8

# IOReport channel names in the "Energy Model" group, by component
_CHANNELS = {
    "CPU Energy": "cpu",
    "GPU Energy": "gpu",
    "ANE": "ane",
    "DRAM": "dram",
}
_TO_JOULES = {"mJ": 1e-3, "uJ": 1e-6, "nJ": 1e-9}


def _load():
    cf = ctypes.CDLL(ctypes.util.find_library("CoreFoundation"))
    # A system library: it lives in macOS's shared cache, not as a file on disk
    ior = ctypes.CDLL("/usr/lib/libIOReport.dylib")

    def sig(fn, restype, *argtypes):
        fn.restype = restype
        fn.argtypes = list(argtypes)

    sig(cf.CFStringCreateWithCString, _CFRef, _CFRef, ctypes.c_char_p, ctypes.c_uint32)
    sig(cf.CFStringGetCString, ctypes.c_bool, _CFRef, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32)
    sig(cf.CFDictionaryGetValue, _CFRef, _CFRef, _CFRef)
    sig(cf.CFDictionaryCreateMutableCopy, _CFRef, _CFRef, ctypes.c_long, _CFRef)
    sig(cf.CFArrayGetCount, ctypes.c_long, _CFRef)
    sig(cf.CFArrayGetValueAtIndex, _CFRef, _CFRef, ctypes.c_long)
    sig(cf.CFRelease, None, _CFRef)
    sig(cf.CFArrayCreateMutable, _CFRef, _CFRef, ctypes.c_long, _CFRef)
    sig(cf.CFArrayAppendValue, None, _CFRef, _CFRef)
    sig(cf.CFDictionarySetValue, None, _CFRef, _CFRef, _CFRef)
    sig(ior.IOReportCopyChannelsInGroup, _CFRef, _CFRef, _CFRef, ctypes.c_uint64, ctypes.c_uint64, ctypes.c_uint64)
    sig(ior.IOReportCreateSubscription, _CFRef, _CFRef, _CFRef, ctypes.POINTER(_CFRef), ctypes.c_uint64, _CFRef)
    sig(ior.IOReportCreateSamples, _CFRef, _CFRef, _CFRef, _CFRef)
    sig(ior.IOReportCreateSamplesDelta, _CFRef, _CFRef, _CFRef, _CFRef)
    sig(ior.IOReportChannelGetChannelName, _CFRef, _CFRef)
    sig(ior.IOReportChannelGetUnitLabel, _CFRef, _CFRef)
    sig(ior.IOReportSimpleGetIntegerValue, ctypes.c_int64, _CFRef, ctypes.c_int32)
    return cf, ior


class AppleSiliconMeter(EnergyMeter):
    name = "Apple silicon (IOReport)"

    def __init__(self):
        self._cf, self._ior = _load()
        cf, ior = self._cf, self._ior
        group = self._cfstr("Energy Model")
        channels = ior.IOReportCopyChannelsInGroup(group, None, 0, 0, 0)
        cf.CFRelease(group)
        if not channels:
            raise RuntimeError("This Mac reports no 'Energy Model' channels.")
        desired = cf.CFDictionaryCreateMutableCopy(None, 0, channels)
        cf.CFRelease(channels)
        self._key = self._cfstr("IOReportChannels")
        # Subscribe to only the channels we read: sampling the whole group
        # (~300 channels) takes milliseconds each time
        all_channels = cf.CFDictionaryGetValue(desired, self._key)
        ours = cf.CFArrayCreateMutable(None, 0, _CFRef(ctypes.addressof(ctypes.c_char.in_dll(cf, "kCFTypeArrayCallBacks"))))
        for i in range(cf.CFArrayGetCount(all_channels) if all_channels else 0):
            ch = cf.CFArrayGetValueAtIndex(all_channels, i)
            if self._pystr(ior.IOReportChannelGetChannelName(ch)) in _CHANNELS:
                cf.CFArrayAppendValue(ours, ch)
        if cf.CFArrayGetCount(ours) == 0:
            raise RuntimeError("This Mac reports no CPU, GPU or memory energy channels.")
        cf.CFDictionarySetValue(desired, self._key, ours)
        cf.CFRelease(ours)
        self._subscribed = _CFRef()
        self._subscription = ior.IOReportCreateSubscription(None, desired, ctypes.byref(self._subscribed), 0, None)
        if not self._subscription:
            raise RuntimeError("Could not subscribe to this Mac's energy counters.")
        self._prev = ior.IOReportCreateSamples(self._subscription, self._subscribed, None)
        self._totals = {c: 0.0 for c in _CHANNELS.values()}
        # Check the channels are there and in units we know
        found = self._delta_joules(self._prev, self._prev)
        if not found:
            raise RuntimeError("This Mac's energy counters are in a form ChainForge doesn't know.")
        self._components = [c for c in _CHANNELS.values() if c in found]
        try:
            self._conditions: Optional[_MacConditions] = _MacConditions()
        except Exception:
            self._conditions = None

    def _cfstr(self, s: str):
        return self._cf.CFStringCreateWithCString(None, s.encode(), _UTF8)

    def _pystr(self, ref) -> str:
        if not ref:
            return ""
        buf = ctypes.create_string_buffer(128)
        ok = self._cf.CFStringGetCString(ref, buf, len(buf), _UTF8)
        return buf.value.decode() if ok else ""

    def _delta_joules(self, prev, cur) -> Dict[str, float]:
        """Joules per component between two samples. The subscription has
        only our few channels, so reading each one's name is cheap."""
        cf, ior = self._cf, self._ior
        delta = ior.IOReportCreateSamplesDelta(prev, cur, None)
        if not delta:
            return {}
        try:
            out: Dict[str, float] = {}
            arr = cf.CFDictionaryGetValue(delta, self._key)
            for i in range(cf.CFArrayGetCount(arr) if arr else 0):
                ch = cf.CFArrayGetValueAtIndex(arr, i)
                comp = _CHANNELS.get(self._pystr(ior.IOReportChannelGetChannelName(ch)))
                scale = _TO_JOULES.get(self._pystr(ior.IOReportChannelGetUnitLabel(ch)).strip())
                if comp and scale:
                    out[comp] = out.get(comp, 0.0) + ior.IOReportSimpleGetIntegerValue(ch, 0) * scale
            return out
        finally:
            cf.CFRelease(delta)

    def components(self) -> List[str]:
        return list(self._components)

    def conditions(self) -> Dict[str, str]:
        if self._conditions is None:
            return {}
        try:
            return self._conditions.read()
        except Exception:  # best effort: without them, energy is still measured
            return {}

    def read(self) -> Dict[str, float]:
        cur = self._ior.IOReportCreateSamples(self._subscription, self._subscribed, None)
        if cur:
            for comp, joules in self._delta_joules(self._prev, cur).items():
                if joules > 0:
                    self._totals[comp] += joules
            self._cf.CFRelease(self._prev)
            self._prev = cur
        return {c: self._totals[c] for c in self._components}


class _MacConditions:
    """Power source, power mode and thermal state, from macOS itself: IOKit
    and NSProcessInfo (microseconds), and pmset for High Power Mode, which
    nothing else reports (milliseconds, so at most every 30 s)."""

    _THERMAL = ["nominal", "fair", "serious", "critical"]
    _PMSET_EVERY_S = 30.0

    def __init__(self):
        objc = ctypes.CDLL(ctypes.util.find_library("objc"))
        ctypes.CDLL("/System/Library/Frameworks/Foundation.framework/Foundation")
        objc.objc_getClass.restype = _CFRef
        objc.objc_getClass.argtypes = [ctypes.c_char_p]
        objc.sel_registerName.restype = _CFRef
        objc.sel_registerName.argtypes = [ctypes.c_char_p]
        send = ctypes.cast(objc.objc_msgSend, _CFRef).value
        self._bool_msg = ctypes.CFUNCTYPE(ctypes.c_bool, _CFRef, _CFRef)(send)
        self._long_msg = ctypes.CFUNCTYPE(ctypes.c_long, _CFRef, _CFRef)(send)
        obj_msg = ctypes.CFUNCTYPE(_CFRef, _CFRef, _CFRef)(send)
        self._process_info = obj_msg(objc.objc_getClass(b"NSProcessInfo"), objc.sel_registerName(b"processInfo"))
        self._low_power_sel = objc.sel_registerName(b"isLowPowerModeEnabled")
        self._thermal_sel = objc.sel_registerName(b"thermalState")

        self._iokit = ctypes.CDLL("/System/Library/Frameworks/IOKit.framework/IOKit")
        self._iokit.IOPSCopyPowerSourcesInfo.restype = _CFRef
        self._iokit.IOPSGetProvidingPowerSourceType.restype = _CFRef
        self._iokit.IOPSGetProvidingPowerSourceType.argtypes = [_CFRef]
        self._cf, _ = _load()
        self._pmset_mode: Optional[str] = None
        self._pmset_at = float("-inf")

    def _power_source(self) -> str:
        info = self._iokit.IOPSCopyPowerSourcesInfo()
        if not info:
            return "unknown"
        try:
            ref = self._iokit.IOPSGetProvidingPowerSourceType(info)
            buf = ctypes.create_string_buffer(64)
            ok = ref and self._cf.CFStringGetCString(ref, buf, len(buf), _UTF8)
            kind = buf.value.decode() if ok else ""
        finally:
            self._cf.CFRelease(info)
        return {"AC Power": "AC power", "Battery Power": "battery", "UPS Power": "UPS"}.get(kind, kind or "unknown")

    def _pmset_power_mode(self, now: float) -> Optional[str]:
        """High Power Mode, from pmset's powermode (0 automatic, 1 low, 2 high)."""
        if now - self._pmset_at >= self._PMSET_EVERY_S:
            self._pmset_at = now
            try:
                out = subprocess.run(["pmset", "-g"], capture_output=True, text=True, timeout=5).stdout
                modes = {"0": "Automatic", "1": "Low Power", "2": "High Power"}
                self._pmset_mode = next(
                    (modes.get(line.split()[-1]) for line in out.splitlines()
                     if line.strip().startswith("powermode")), None)
            except (OSError, subprocess.SubprocessError, IndexError):
                self._pmset_mode = None
        return self._pmset_mode

    def read(self) -> Dict[str, str]:
        low = self._bool_msg(self._process_info, self._low_power_sel)
        thermal = self._long_msg(self._process_info, self._thermal_sel)
        mode = "Low Power" if low else (self._pmset_power_mode(time.monotonic()) or "Automatic")
        if mode == "Low Power" and not low:
            mode = "Automatic"  # pmset's setting may be for the other power source
        return {
            "power_source": self._power_source(),
            "power_mode": mode,
            "thermal": self._THERMAL[thermal] if 0 <= thermal < len(self._THERMAL) else "unknown",
        }


def try_apple_meter() -> "tuple[Optional[AppleSiliconMeter], str]":
    """The meter, or None and why not."""
    try:
        return AppleSiliconMeter(), ""
    except Exception as err:  # a private API: any failure means "not available"
        return None, f"Could not read this Mac's energy counters: {err}"
