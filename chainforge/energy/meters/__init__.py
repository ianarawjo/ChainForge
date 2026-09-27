"""Finds an energy meter for this machine's hardware, if ChainForge has one."""

import platform
import sys
from typing import Optional, Tuple

from chainforge.energy.meters.base import EnergyMeter


def find_meter() -> Tuple[Optional[EnergyMeter], str]:
    """This machine's meter, or None and why there isn't one."""
    if sys.platform == "darwin" and platform.machine() == "arm64":
        from chainforge.energy.meters.apple import try_apple_meter
        return try_apple_meter()
    return None, (
        "ChainForge can measure energy on Apple silicon Macs so far; "
        f"not yet on this machine ({sys.platform}, {platform.machine()})."
    )
