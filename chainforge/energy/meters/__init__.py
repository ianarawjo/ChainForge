"""Finds an energy meter for this machine's hardware, if ChainForge has one."""

import platform
import subprocess
import sys
from typing import Optional, Tuple

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
    return None, (
        "ChainForge can measure energy on Apple silicon Macs so far; "
        f"not yet on this machine ({sys.platform}, {platform.machine()})."
    )
