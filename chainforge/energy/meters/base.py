"""What every energy meter provides: running totals of the energy the hardware
has used, per component, in joules.

Each kind of hardware (Apple silicon, NVIDIA GPUs, Intel/AMD CPUs, ...) has its
own meter. Nothing outside `meters/` needs to know which one is in use.
"""

from abc import ABC, abstractmethod
from typing import Dict, List


class EnergyMeter(ABC):
    """Reads the energy counters of this machine's hardware."""

    #: Shown to the user, e.g. "Apple silicon (IOReport)".
    name: str = ""

    @abstractmethod
    def components(self) -> List[str]:
        """The parts measured, e.g. ["cpu", "gpu", "ane", "dram"]."""

    @abstractmethod
    def read(self) -> Dict[str, float]:
        """Joules used by each component since the meter was created.

        Only ever increases. Called from one thread at a time.
        """

    def conditions(self) -> Dict[str, str]:
        """What the machine is running under that changes how much energy the
        same work takes, e.g. {"power_source": "battery", "power_mode": "Low
        Power", "thermal": "nominal"}: a lower power mode runs the chip at
        lower clock speeds and voltages, using less energy per token but
        taking longer. Empty if the meter can't tell. Must be cheap: it's
        checked every few seconds, while the monitor holds its lock."""
        return {}

    def refresh_conditions(self) -> None:
        """Updates any conditions too slow to read in `conditions()` (e.g.
        by running a command), for it to report. Called now and then, and at
        each request's start, outside the monitor's lock."""
