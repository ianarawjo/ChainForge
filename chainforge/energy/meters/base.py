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
