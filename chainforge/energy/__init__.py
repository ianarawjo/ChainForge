"""Measures the energy local models use on this machine (see monitor.py and
attribution.py). Everything specific to a kind of hardware or OS is in
`meters/`; so far there is a meter for Apple silicon Macs.
"""

import threading
from typing import Optional, Tuple

from chainforge.energy.monitor import EnergyMonitor

_monitor: Optional[EnergyMonitor] = None
_unavailable_reason = ""
_lock = threading.Lock()
_looked = False


def get_monitor() -> Tuple[Optional[EnergyMonitor], str]:
    """This machine's energy monitor, started, or None and why not.

    Nothing is read until the first call, so a ChainForge that never runs a
    local model never reads the meter.
    """
    global _monitor, _unavailable_reason, _looked
    with _lock:
        if not _looked:
            _looked = True
            from chainforge.energy.meters import find_meter
            meter, _unavailable_reason = find_meter()
            if meter is not None:
                _monitor = EnergyMonitor(meter)
                _monitor.start()
        return _monitor, _unavailable_reason
