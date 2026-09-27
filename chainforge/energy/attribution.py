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

Everything here looks only at the readings it needs (by binary search), so
the cost of settling a request doesn't grow with how long the server has run.
"""

import bisect
import statistics
from dataclasses import dataclass
from typing import Dict, Iterator, List, Optional, Sequence, Tuple

GENERATION = "generation"
LOAD = "load"


class Readings:
    """Meter readings, oldest first: times (seconds) and, for each, the joules
    each component had used by then. Kept as two flat lists (one tuple per
    reading), which is compact for the thousands a busy stretch produces."""

    def __init__(self, components: Sequence[str]):
        self.components: Tuple[str, ...] = tuple(components)
        self.times: List[float] = []
        self.totals: List[Tuple[float, ...]] = []

    @classmethod
    def of(cls, samples: Sequence[Tuple[float, Dict[str, float]]]) -> "Readings":
        """From (time, {component: joules}) pairs, e.g. in tests."""
        comps = sorted({c for _, d in samples for c in d})
        r = cls(comps)
        for t, d in samples:
            r.append(t, tuple(d.get(c, 0.0) for c in comps))
        return r

    def __len__(self) -> int:
        return len(self.times)

    def append(self, t: float, totals: Tuple[float, ...]) -> None:
        if self.times and t <= self.times[-1]:
            return  # out of order (shouldn't happen with a monotonic clock)
        self.times.append(t)
        self.totals.append(totals)

    def trim(self, before: float) -> None:
        """Forgets readings older than `before`, keeping one before it, so
        the interval spanning `before` can still be measured."""
        k = bisect.bisect_left(self.times, before) - 1
        if k > 0:
            del self.times[:k]
            del self.totals[:k]

    def powers(self, t0: float = float("-inf"), t1: float = float("inf")) -> Iterator[Tuple[float, float, Tuple[float, ...]]]:
        """(start, end, watts per component) for each interval between readings
        that overlaps [t0, t1]."""
        times, totals = self.times, self.totals
        lo = max(bisect.bisect_right(times, t0) - 1, 0)
        hi = min(bisect.bisect_left(times, t1) + 1, len(times))
        for i in range(lo, hi - 1):
            a, b = times[i], times[i + 1]
            if b > a:
                ea, eb = totals[i], totals[i + 1]
                yield a, b, tuple(max(y - x, 0.0) / (b - a) for x, y in zip(ea, eb))

    def energy(self, t0: float, t1: float) -> Dict[str, float]:
        """Joules per component from t0 to t1, taking power as constant between readings."""
        out = [0.0] * len(self.components)
        for a, b, watts in self.powers(t0, t1):
            overlap = min(b, t1) - max(a, t0)
            if overlap > 0:
                for i, w in enumerate(watts):
                    out[i] += w * overlap
        return dict(zip(self.components, out))


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


def merge_spans(spans: Sequence[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """The spans, sorted, with overlapping ones merged."""
    merged: List[Tuple[float, float]] = []
    for s, e in sorted(spans):
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return merged


def _percentile(sorted_vals: List[float], q: float) -> float:
    pos = q * (len(sorted_vals) - 1)
    i = int(pos)
    j = min(i + 1, len(sorted_vals) - 1)
    return sorted_vals[i] + (sorted_vals[j] - sorted_vals[i]) * (pos - i)


def idle_baseline(
    readings: Readings,
    busy: Sequence[Tuple[float, float]],
    since: float,
    min_seconds: float = 2.0,
) -> Optional[Baseline]:
    """Idle power, from reading intervals after `since` that overlap none of
    the `busy` spans. None if there are fewer than `min_seconds` of them.

    One pass over the readings and the (merged, sorted) busy spans together.
    """
    spans = merge_spans(busy)
    j = 0
    per_comp: List[List[float]] = [[] for _ in readings.components]
    totals: List[float] = []
    seconds = 0.0
    for a, b, watts in readings.powers(since):
        if a < since:
            continue
        while j < len(spans) and spans[j][1] <= a:
            j += 1  # spans that ended before this interval
        if j < len(spans) and spans[j][0] < b:
            continue  # overlaps a busy span
        seconds += b - a
        totals.append(sum(watts))
        for i, w in enumerate(watts):
            per_comp[i].append(w)
    if seconds < min_seconds or not totals:
        return None
    totals.sort()
    return Baseline(
        watts={c: statistics.median(ws) for c, ws in zip(readings.components, per_comp)},
        total_watts=statistics.median(totals),
        spread_watts=(_percentile(totals, 0.9) - _percentile(totals, 0.1)) / 2,
        seconds=seconds,
    )


@dataclass
class Attribution:
    """A request's share of the energy above idle, in joules."""
    generation: Dict[str, float]  # per component
    load: Optional[Dict[str, float]]  # per component; None if it had no load window
    noise: float  # how far idle power's usual swings could move `generation`
    load_noise: float  # ...and `load`
    shared: bool  # whether its generation overlapped another request's

    @property
    def generation_total(self) -> float:
        return sum(self.generation.values())

    @property
    def load_total(self) -> float:
        return sum(self.load.values()) if self.load else 0.0


def attribute(
    request: str,
    windows: Sequence[Window],
    readings: Readings,
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
    nearby = [w for w in windows if w.start < t1 and w.end > t0]
    edges = sorted({t0, t1} | {x for w in nearby for x in (w.start, w.end) if t0 < x < t1})
    intervals = list(readings.powers(t0, t1))  # only the readings in these windows
    base = [baseline.watts.get(c, 0.0) for c in readings.components]

    generation = [0.0] * len(readings.components)
    load = [0.0] * len(readings.components)
    had_load = any(w.kind == LOAD for w in own)
    noise_seconds = load_noise_seconds = 0.0
    shared = False
    k = 0  # first interval that could overlap the current segment
    for a, b in zip(edges, edges[1:]):
        while k < len(intervals) and intervals[k][1] <= a:
            k += 1
        mid = (a + b) / 2
        covering = [w for w in nearby if w.start <= mid < w.end]
        gens = {w.request for w in covering if w.kind == GENERATION}
        if gens:
            if request not in gens:
                continue
            target, share = generation, 1 / len(gens)
            shared = shared or share < 1
            noise_seconds += (b - a) * share
        else:
            loads = {w.request for w in covering if w.kind == LOAD}
            if request not in loads:
                continue
            target, share = load, 1 / len(loads)
            load_noise_seconds += (b - a) * share
        for ia, ib, watts in intervals[k:]:
            if ia >= b:
                break
            overlap = min(ib, b) - max(ia, a)
            if overlap > 0:
                for i, w in enumerate(watts):
                    target[i] += (w - base[i]) * overlap * share

    comps = readings.components
    clamp = lambda vals: {c: max(v, 0.0) for c, v in zip(comps, vals)}  # noqa: E731
    return Attribution(
        generation=clamp(generation),
        load=clamp(load) if had_load else None,
        noise=baseline.spread_watts * noise_seconds,
        load_noise=baseline.spread_watts * load_noise_seconds,
        shared=shared,
    )
