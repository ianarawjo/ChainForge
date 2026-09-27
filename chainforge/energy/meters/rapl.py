"""Intel and AMD CPUs on Linux, through RAPL's energy counters in
/sys/class/powercap (the "intel-rapl" domains, which AMD CPUs use too).

Since 2020, these files are readable only by root (a fix for "Platypus", an
attack that read secrets from fine-grained power readings). To measure the
CPU, make them readable once: see chainforge/energy/README.md.
"""

import os
import re
from typing import Dict, List, Optional, Tuple

from chainforge.energy.meters.base import EnergyMeter

POWERCAP = "/sys/class/powercap"
# Top-level domains: one per CPU package (intel-rapl:0, intel-rapl:1, ...).
# Their sub-domains (intel-rapl:0:0, ...) are parts of them, apart from DRAM
_TOP = re.compile(r"^intel-rapl:\d+$")
_SUB = re.compile(r"^intel-rapl:\d+:\d+$")


class _Counter:
    """One energy_uj file, with its wraparounds undone."""

    def __init__(self, path: str, max_uj: int):
        self.path, self.max_uj = path, max_uj
        self.last = self._read()
        self.total = 0

    def _read(self) -> int:
        with open(self.path) as f:
            return int(f.read())

    def joules(self) -> float:
        uj = self._read()
        delta = uj - self.last
        if delta < 0:  # wrapped around (every few minutes to hours, under load)
            delta += self.max_uj
        self.total += max(delta, 0)
        self.last = uj
        return self.total / 1e6


def _read_text(path: str) -> Optional[str]:
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return None


class RaplMeter(EnergyMeter):
    """Components "cpu" (all CPU packages) and, where the CPU reports it,
    "dram" (memory; mostly server CPUs)."""

    def __init__(self, root: str = POWERCAP):
        self._counters: Dict[str, List[_Counter]] = {}
        unreadable = []
        for d in sorted(os.listdir(root)):
            if not (_TOP.match(d) or _SUB.match(d)):
                continue
            name = _read_text(os.path.join(root, d, "name")) or ""
            if _TOP.match(d) and name.startswith("package"):
                part = "cpu"
            elif name == "dram":
                part = "dram"
            else:
                continue  # core, uncore, psys: parts of a package, or overlapping it
            path = os.path.join(root, d, "energy_uj")
            try:
                max_uj = int(_read_text(os.path.join(root, d, "max_energy_range_uj")) or 0)
                counter = _Counter(path, max_uj)
                self._counters.setdefault(part, []).append(counter)
            except PermissionError:
                unreadable.append(d)
            except (OSError, ValueError):
                continue
        if "cpu" not in self._counters:
            if unreadable:
                raise PermissionError(
                    "the CPU's energy counters are readable only by root "
                    "(see chainforge/energy/README.md to allow it)")
            raise RuntimeError("no CPU energy counters (RAPL) found")
        self._parts = [p for p in ("cpu", "dram") if p in self._counters]
        self.name = "CPU (RAPL)"

    def components(self) -> List[str]:
        return list(self._parts)

    def read(self) -> Dict[str, float]:
        out: Dict[str, float] = {}
        for part, counters in self._counters.items():
            total = 0.0
            for c in counters:
                try:
                    total += c.joules()
                except (OSError, ValueError):
                    total += c.total / 1e6
            out[part] = total
        return out


def try_rapl_meter(root: str = POWERCAP) -> Tuple[Optional[RaplMeter], str]:
    if not os.path.isdir(root):
        return None, "The CPU isn't measured: this system has no energy counters for it (RAPL)."
    try:
        return RaplMeter(root), ""
    except Exception as err:
        return None, f"The CPU isn't measured: {err}."
