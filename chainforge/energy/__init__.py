"""Measures the energy local models use on this machine (see monitor.py and
attribution.py). Everything specific to a kind of hardware or OS is in
`meters/`: so far, Apple silicon Macs, and Windows and Linux PCs with
NVIDIA GPUs (plus, on Linux, Intel and AMD CPUs).
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

    The server calls this when it starts, so idle power is known by the
    first request. Unused, the monitor reads the meter only every few seconds
    (see monitor.py); on a machine without a meter, it does nothing.
    """
    global _monitor, _unavailable_reason, _looked
    with _lock:
        if not _looked:
            _looked = True
            try:
                from chainforge.energy.meters import find_meter
                meter, _unavailable_reason = find_meter()
                if meter is not None:
                    _monitor = EnergyMonitor(meter)
            except Exception as err:  # a missing meter is never an error
                meter, _monitor = None, None
                _unavailable_reason = f"Could not start measuring energy: {err}"
        if _monitor is not None:
            _monitor.start()
        return _monitor, _unavailable_reason
