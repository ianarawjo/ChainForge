"""A Windows or Linux PC: its NVIDIA GPUs (NVML) and, on Linux, its CPU
(RAPL), measured together, with the OS's power settings and a check for other
programs using the GPU (see system.py).
"""

import time
from typing import Dict, List, Optional, Sequence

from chainforge.energy.meters.base import EnergyMeter
from chainforge.energy.meters.system import other_programs


class PcMeter(EnergyMeter):
    def __init__(self, meters: Sequence[EnergyMeter], power=None, gpu_engines=None, nvidia=None):
        """meters: e.g. [NvidiaMeter, RaplMeter], with distinct components.
        power: a WindowsPower or LinuxPower, for the power settings.
        gpu_engines: a WindowsGpuEngines, to tell which programs use the GPU;
            else `nvidia` (an NvidiaMeter) is asked, which works on Linux."""
        self._meters = list(meters)
        self._power = power
        self._engines = gpu_engines
        self._nvidia = nvidia
        self._since_us = int(time.time() * 1e6)
        self.name = " + ".join(m.name for m in self._meters)

    def components(self) -> List[str]:
        return [c for m in self._meters for c in m.components()]

    def read(self) -> Dict[str, float]:
        out: Dict[str, float] = {}
        for m in self._meters:
            out.update(m.read())
        return out

    def conditions(self) -> Dict[str, str]:
        out: Dict[str, str] = {}
        if self._power is not None:
            try:
                out.update(self._power.conditions())
            except Exception:
                pass
        for m in self._meters:
            try:
                out.update(m.conditions())
            except Exception:
                pass
        return out

    def refresh_conditions(self) -> None:
        if self._power is not None:
            self._power.refresh()
        for m in self._meters:
            m.refresh_conditions()

    def other_gpu_use(self) -> Optional[List[str]]:
        if self._engines is not None:
            return other_programs(self._engines.sample())
        if self._nvidia is not None:
            now_us = int(time.time() * 1e6)
            per_pid = self._nvidia.gpu_processes(self._since_us)
            self._since_us = now_us
            return None if per_pid is None else other_programs(per_pid)
        return None
