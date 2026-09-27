"""How much of the machine's energy a request used: pure functions over meter
readings, with nothing specific to any hardware or OS (see monitor.py for
where the readings come from).

A meter gives running totals for the whole machine (CPU, GPU, ...), not for
one process. So a request's energy is worked out as:

- only what's *above idle*: the machine's idle power (its median while no
  request is running) is taken off, since it would be drawn anyway;
- over the request's own windows, from the server's timings (for Ollama:
  loading the model, then generating), not over the whole time it was in
  flight, since a request may wait in a queue while others generate;
- split evenly between requests whose windows overlap, e.g. several requests
  waiting on one model load, or generating in parallel.

Generation and model loading are kept apart: a model loads once for many
requests, so its energy would otherwise skew whichever request came first.
"""

import bisect
import statistics
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

#: A meter reading: (time in seconds, joules per component since some start)
Sample = Tuple[float, Dict[str, float]]

GENERATION = "generation"
LOAD = "load"


@dataclass(frozen=True)
class Window:
    """A span of time in which a request was loading a model or generating."""
    request: str
    kind: str  # GENERATION or LOAD
    start: float
    end: float


@dataclass(frozen=True)
class Baseline:
    """The machine's power at idle, from readings while no request ran."""
    watts: Dict[str, float]  # median, per component
    total_watts: float  # median of the total
    spread_watts: float  # half the range from the 10th to the 90th percentile of the total
    seconds: float  # how much idle time it's from


def _powers(samples: Sequence[Sample], t0: float = float("-inf"), t1: float = float("inf")):
    """Each reading interval's (start, end, watts per component), for intervals
    that overlap [t0, t1]."""
    times = [t for t, _ in samples]
    lo = max(bisect.bisect_right(times, t0) - 1, 0)
    hi = min(bisect.bisect_left(times, t1) + 1, len(samples))
    for (a, ea), (b, eb) in zip(samples[lo:hi], samples[lo + 1:hi]):
        if b > a:
            yield a, b, {c: max(eb.get(c, 0.0) - ea.get(c, 0.0), 0.0) / (b - a) for c in eb}


def energy_between(samples: Sequence[Sample], t0: float, t1: float) -> Dict[str, float]:
    """Joules per component from t0 to t1, taking power as constant between readings."""
    out: Dict[str, float] = {}
    for a, b, watts in _powers(samples, t0, t1):
        overlap = min(b, t1) - max(a, t0)
        if overlap > 0:
            for c, w in watts.items():
                out[c] = out.get(c, 0.0) + w * overlap
    return out


def _percentile(sorted_vals: List[float], q: float) -> float:
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = q * (len(sorted_vals) - 1)
    i = int(pos)
    j = min(i + 1, len(sorted_vals) - 1)
    return sorted_vals[i] + (sorted_vals[j] - sorted_vals[i]) * (pos - i)


def idle_baseline(
    samples: Sequence[Sample],
    busy: Sequence[Tuple[float, float]],
    since: float,
    min_seconds: float = 2.0,
) -> Optional[Baseline]:
    """Idle power, from reading intervals after `since` that overlap none of
    the `busy` spans. None if there are fewer than `min_seconds` of them."""
    per_comp: Dict[str, List[float]] = {}
    totals: List[float] = []
    seconds = 0.0
    for a, b, watts in _powers(samples, since):
        if a < since or any(a < e and b > s for s, e in busy):
            continue
        seconds += b - a
        totals.append(sum(watts.values()))
        for c, w in watts.items():
            per_comp.setdefault(c, []).append(w)
    if seconds < min_seconds or not totals:
        return None
    totals.sort()
    return Baseline(
        watts={c: statistics.median(ws) for c, ws in per_comp.items()},
        total_watts=statistics.median(totals),
        spread_watts=(_percentile(totals, 0.9) - _percentile(totals, 0.1)) / 2,
        seconds=seconds,
    )


@dataclass
class Attribution:
    """A request's share of the energy above idle, in joules."""
    generation: Dict[str, float]  # per component
    load: Optional[Dict[str, float]]  # per component; None if it loaded no model
    noise: float  # how far idle power's usual swings could move `generation`
    shared: bool  # whether its generation overlapped another request's

    @property
    def generation_total(self) -> float:
        return sum(self.generation.values())


def attribute(
    request: str,
    windows: Sequence[Window],
    samples: Sequence[Sample],
    baseline: Baseline,
) -> Attribution:
    """The energy above idle in `request`'s windows, split evenly with any
    overlapping windows of other requests in `windows`.

    Where generation and loading overlap, generation takes the energy: loading
    is mostly memory traffic, so a model loading while another generates adds
    little of its own.
    """
    own = [w for w in windows if w.request == request]
    if not own:
        raise ValueError(f"No windows for request {request}")
    t0, t1 = min(w.start for w in own), max(w.end for w in own)
    edges = {t0, t1}
    edges.update(w.start for w in windows if t0 < w.start < t1)
    edges.update(w.end for w in windows if t0 < w.end < t1)
    edges.update(t for t, _ in samples if t0 < t < t1)
    edges_sorted = sorted(edges)

    generation: Dict[str, float] = {}
    load: Dict[str, float] = {}
    loaded = any(w.kind == LOAD for w in own)
    noise_seconds = 0.0
    shared = False
    for a, b in zip(edges_sorted, edges_sorted[1:]):
        mid = (a + b) / 2
        covering = [w for w in windows if w.start <= mid < w.end]
        gens = [w for w in covering if w.kind == GENERATION]
        mine_gen = any(w.request == request for w in gens)
        if gens:
            if not mine_gen:
                continue
            target, share = generation, 1 / len({w.request for w in gens})
            shared = shared or share < 1
            noise_seconds += (b - a) * share
        else:
            loads = [w for w in covering if w.kind == LOAD]
            if not any(w.request == request for w in loads):
                continue
            target, share = load, 1 / len({w.request for w in loads})
        for c, joules in energy_between(samples, a, b).items():
            above = joules - baseline.watts.get(c, 0.0) * (b - a)
            target[c] = target.get(c, 0.0) + above * share

    clamp = lambda d: {c: max(v, 0.0) for c, v in d.items()}  # noqa: E731
    return Attribution(
        generation=clamp(generation),
        load=clamp(load) if loaded else None,
        noise=baseline.spread_watts * noise_seconds,
        shared=shared,
    )
