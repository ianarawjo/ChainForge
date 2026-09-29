"""Finds an energy meter for this machine's hardware, if ChainForge has one."""

import platform
import subprocess
import sys
from typing import List, Optional, Tuple

from chainforge.energy.meters.base import EnergyMeter


def in_macos_vm() -> bool:
    """Whether this Mac is a virtual machine (e.g. a CI runner)."""
    try:
        out = subprocess.run(["sysctl", "-n", "kern.hv_vmm_present"],
                             capture_output=True, text=True, timeout=5)
        return out.stdout.strip() == "1"
    except (OSError, subprocess.SubprocessError):
        return False


def find_meter() -> Tuple[Optional[EnergyMeter], str]:
    """This machine's meter, or None and why there isn't one."""
    if sys.platform == "darwin" and platform.machine() == "arm64":
        if in_macos_vm():
            return None, "macOS doesn't give virtual machines its energy counters."
        from chainforge.energy.meters.apple import try_apple_meter
        return try_apple_meter()
    if sys.platform == "win32" or sys.platform.startswith("linux"):
        return find_pc_meter()
    return None, (
        "ChainForge can measure energy on Apple silicon Macs, and on Windows and "
        f"Linux PCs with NVIDIA GPUs; not on this machine ({sys.platform}, {platform.machine()})."
    )


def find_pc_meter() -> Tuple[Optional[EnergyMeter], str]:
    """A Windows or Linux PC's meter: its NVIDIA GPUs and, on Linux, its CPU.

    Where only the CPU or the GPUs can be measured, the meter measures those
    (a model runs on one or the other, or both); the front end says which.
    """
    from chainforge.energy.meters.nvidia import try_nvidia_meter
    from chainforge.energy.meters.pc import PcMeter
    from chainforge.energy.meters.system import WindowsGpuEngines, system_power

    meters: List[EnergyMeter] = []
    reasons = []
    nvidia, why = try_nvidia_meter()
    if nvidia is not None:
        meters.append(nvidia)
    else:
        reasons.append(why)
    if sys.platform.startswith("linux"):
        from chainforge.energy.meters.rapl import try_rapl_meter
        rapl, why = try_rapl_meter()
        if rapl is not None:
            meters.append(rapl)
        else:
            reasons.append(why)
    else:
        reasons.append("Windows doesn't let programs read the CPU's energy counters.")
    if not meters:
        return None, " ".join(reasons)
    engines = None
    if sys.platform == "win32" and nvidia is not None:
        try:
            engines = WindowsGpuEngines()
        except Exception:
            pass  # then other programs using the GPU go unnoticed
    return PcMeter(meters, power=system_power(), gpu_engines=engines, nvidia=nvidia), ""
