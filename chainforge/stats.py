"""Statistical comparison of evaluation results, for the Vis Node.

Backed by the optional `evalstats` package (`pip install chainforge[stats]`).

ChainForge always uses evalstats' paired design, the one that fits AI
evaluations: every item is scored for every group being compared (and every
run). Items missing any of those scores are excluded here, before evalstats
sees the data, and reported back so the page can say which were left out.
"""

import itertools
import math
import os
import re
import threading
import warnings
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Dict, List, Optional

MIN_EVALSTATS_VERSION = (0, 3, 1)

# evalstats reports nothing below this many items per group, and is untested there.
MIN_ITEMS = 15

ALPHA = 0.05

# How many excluded items to name in a response. The count is always exact.
MAX_EXCLUDED_LABELS = 50

# evalstats changes global warning filters and config while it runs, so one
# comparison at a time.
_LOCK = threading.Lock()


class StatsInputError(ValueError):
    """The results can't be analysed as sent: malformed rows, or rows that can't be paired."""


def _version_tuple(v: str) -> tuple:
    parts = []
    for piece in v.split(".")[:3]:
        digits = "".join(itertools.takewhile(str.isdigit, piece))
        if not digits:
            break
        parts.append(int(digits))
    return tuple(parts)


def evalstats_unavailable_reason() -> Optional[str]:
    """Why statistics can't run, or None when a recent enough evalstats is installed.

    Reads package metadata only: importing evalstats takes most of a second and
    loads matplotlib, which ChainForge shouldn't pay for at startup.
    """
    try:
        installed = version("evalstats")
    except PackageNotFoundError:
        return ("Statistics need the optional evalstats package. Install it with "
                "`pip install chainforge[stats]` and restart ChainForge.")
    if _version_tuple(installed) < MIN_EVALSTATS_VERSION:
        minimum = ".".join(map(str, MIN_EVALSTATS_VERSION))
        return (f"Statistics need evalstats {minimum} or newer, but {installed} is installed. "
                "Upgrade it with `pip install -U chainforge[stats]` and restart ChainForge.")
    return None


def _finite(x) -> Optional[float]:
    if x is None:
        return None
    x = float(x)
    return x if math.isfinite(x) else None


def _score(value) -> Optional[float]:
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return _finite(value)
    return None


def compare_eval_results(rows: List[Dict[str, Any]],
                         item_labels: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Compare groups of evaluation scores with evalstats.

    Each row is one score: ``{"group", "group2" (optional), "item", "run", "score"}``.
    ``group`` is what's being compared (an LLM, say), ``group2`` an optional
    second factor (a prompt variable), ``item`` identifies the input, and
    ``run`` which of several responses to that input it scores. ``item_labels``
    maps item ids to readable names for the excluded-items report.

    Returns ``{"ok": True, ...}`` with per-group means, confidence intervals and
    rank bands plus pairwise differences, or ``{"ok": False, "message": ...}``
    when there is too little complete data for statistics. Either way it
    reports how many items were analysed and which were excluded.
    Raises StatsInputError for rows that are malformed or can't be paired.
    """
    import pandas as pd

    if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
        raise StatsInputError("`rows` must be a list of objects.")
    if len(rows) == 0:
        raise StatsInputError("There are no results to analyse.")
    item_labels = item_labels if isinstance(item_labels, dict) else {}

    records = []
    for r in rows:
        if r.get("group") is None or r.get("item") is None:
            raise StatsInputError("Each row needs a `group` and an `item`.")
        run = r.get("run", 0)
        if isinstance(run, bool) or not isinstance(run, int):
            raise StatsInputError("`run` must be an integer.")
        records.append({
            "group": str(r["group"]),
            "group2": None if r.get("group2") is None else str(r["group2"]),
            "item": str(r["item"]),
            "run": run,
            "score": _score(r.get("score")),
        })
    df = pd.DataFrame.from_records(records, columns=["group", "group2", "item", "run", "score"])

    has_group2 = bool(df["group2"].notna().any())
    if has_group2:
        if df["group2"].isna().any():
            raise StatsInputError("Either every row or no row should have a `group2`.")
    else:
        df["group2"] = ""
    if df.duplicated(["item", "group", "group2", "run"]).any():
        raise StatsInputError("Some results have identical inputs, so ChainForge can't tell "
                              "which results to pair up for statistics.")

    # An item is complete when it has a score for every combination of groups and runs.
    n_runs = df["run"].nunique()
    expected = df["group"].nunique() * df["group2"].nunique() * n_runs
    scored = df[df["score"].notna()]
    scores_per_item = scored.groupby("item").size()
    complete = set(scores_per_item[scores_per_item == expected].index)
    excluded = [i for i in dict.fromkeys(df["item"]) if i not in complete]
    kept = scored[scored["item"].isin(complete)]

    report = {
        "alpha": ALPHA,
        "n_items": len(complete),
        "n_runs": int(n_runs),
        "n_excluded": len(excluded),
        "excluded_items": [item_labels.get(i, i) for i in excluded[:MAX_EXCLUDED_LABELS]],
    }

    factor_cols = [c for c in ("group", "group2") if df[c].nunique() > 1]
    if not factor_cols:
        return {**report, "ok": False, "message": "Statistics need at least two groups to compare."}
    if len(complete) < MIN_ITEMS:
        have = (f"Only {len(complete)} have results for every group." if excluded
                else f"This one has {len(complete)}.")
        return {**report, "ok": False,
                "message": f"Statistics are only available for eval sets of {MIN_ITEMS} items or more. {have}"}

    # evalstats sees short ids rather than group names, so no name (one containing
    # evalstats' " / " cell separator, say) can change how it reads the data.
    es_cols = ["model", "prompt"][:len(factor_cols)]
    frame = pd.DataFrame({"item": kept["item"].values, "score": kept["score"].values})
    decode: Dict[str, Dict[str, str]] = {}
    for col, es_col in zip(factor_cols, es_cols):
        code = {level: f"{es_col[0]}{i}" for i, level in enumerate(dict.fromkeys(kept[col]))}
        frame[es_col] = kept[col].map(code).values
        decode[col] = {c: level for level, c in code.items()}
    if n_runs > 1:
        frame["run"] = kept["run"].values
    constant = {c: str(kept[c].iloc[0]) for c in ("group", "group2")
                if c not in factor_cols and (c == "group" or has_group2)}

    # evalstats imports pyplot; it must never pick a GUI backend inside the server.
    os.environ.setdefault("MPLBACKEND", "Agg")
    import evalstats as es

    with _LOCK, warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        try:
            result = es.compare(es.load_from(frame),
                                factors=es_cols[0] if len(es_cols) == 1 else es_cols,
                                design="paired", alpha=ALPHA)
        except ValueError as e:  # includes evalstats' EvalLoadError
            return {**report, "ok": False, "message": _explain_failure(e, decode)}
        summary = _summarize(result, factor_cols, decode, constant)
    notes = list(dict.fromkeys(_with_names(str(w.message), decode)[:400] for w in caught))

    return {**report, "ok": True, "factors": factor_cols, **summary, "notes": notes}


def _with_names(message: str, decode: Dict[str, Dict[str, str]]) -> str:
    """An evalstats message with the ids it was given (m0, p1) replaced by group names."""
    names = {code: level for codes in decode.values() for code, level in codes.items()}
    return re.sub(r"\b[mp]\d+\b", lambda m: names.get(m.group(0), m.group(0)), message)


def _explain_failure(e: Exception, decode: Dict[str, Dict[str, str]]) -> str:
    message = str(e)
    if "nan" in message.lower() or "missing" in message.lower():
        return "Statistics can't be calculated because some results are missing."
    return f"evalstats couldn't analyse these results: {_with_names(message, decode)}"


def _summarize(result, factor_cols: List[str], decode: Dict[str, Dict[str, str]],
               constant: Dict[str, str]) -> Dict[str, Any]:
    """Entities best-first with CIs and rank bands, and pairwise differences between them."""
    bundle = result.full_analysis
    labels = [str(label) for label in bundle.labels]
    means = [float(m) for m in bundle.robustness.mean]
    order = sorted(range(len(labels)), key=lambda i: -means[i])
    bands = _rank_bands(bundle, [labels[i] for i in order], result.alpha)
    as_dict = result.to_dict()

    entities, index_of = [], {}
    for i in order:
        label = labels[i]
        stats = as_dict["entities"][label]
        entity = dict(constant)
        for col, code in zip(factor_cols, label.split(" / ")):
            entity[col] = decode[col][code]
        entity.update(mean=_finite(stats["mean"]), ci_low=_finite(stats["ci_low"]),
                      ci_high=_finite(stats["ci_high"]), band=bands.get(label))
        index_of[label] = len(entities)
        entities.append(entity)

    pairwise = []
    for (a, b), pair in bundle.pairwise.results.items():
        p_value, _ = _display_p_value(pair)
        pairwise.append({
            "a": index_of[str(a)],
            "b": index_of[str(b)],
            "diff": _finite(pair.point_diff),
            "ci_low": _finite(pair.ci_low),
            "ci_high": _finite(pair.ci_high),
            "p_value": _finite(p_value),
        })

    return {"entities": entities, "pairwise": pairwise, "methods": _methods(result, bundle)}


def _display_p_value(pair) -> tuple:
    """The pairwise p-value evalstats' own summary shows, and the name of its test.

    That is the Wilcoxon signed-rank p-value where there is one, and otherwise
    the comparison method's own (an exact test's, say).
    """
    try:
        from evalstats.core.summary import _pairwise_display_pvalue
    except ImportError:
        return pair.p_value, pair.test_method
    return _pairwise_display_pvalue(pair)


def _format_p(p: float) -> str:
    """"p < 0.001" or "p = 0.042", less the leading p."""
    return "< 0.001" if p < 0.001 else f"= {p:.3f}"


def _methods(result, bundle) -> List[Dict[str, str]]:
    """What evalstats ran, in words, so the results can be reported.

    evalstats records these as method codes on the analysis and names them in
    its terminal summary with the private helpers used here; codes without a
    display name are shown as they are.
    """
    try:
        from evalstats.core.summary import (
            _pretty_correction, _pretty_marginal_ci_method, _pretty_simultaneous_ci,
        )
    except ImportError:
        def _pretty_marginal_ci_method(code):
            return code

        def _pretty_correction(code):
            return code or "none"
        _pretty_simultaneous_ci = _pretty_correction

    pw = bundle.pairwise
    pairs = list(pw.results.values())
    first = pairs[0]
    ci = f"{100 * (1 - result.alpha):g}%"

    kind = getattr(bundle, "resolved_data_kind", None)
    scores = {"binary": "true/false (0 or 1)", "bounded_01": "numeric, between 0 and 1",
              "unbounded": "numeric"}.get(kind, kind or "unknown")
    if first.n_runs > 1:
        scores += f"; {first.n_runs} runs per item"

    ci_method = getattr(bundle, "resolved_ci_method", None)
    diff_method = getattr(bundle, "resolved_method", None)
    diff_ci = _pretty_marginal_ci_method(diff_method) or first.test_method
    simultaneous = pw.simultaneous_ci_method
    if simultaneous and simultaneous != "single":
        diff_ci += f", simultaneous ({_pretty_simultaneous_ci(simultaneous)})"

    _, p_test = _display_p_value(first)
    if len(pairs) == 1:
        correction = "no correction needed for one comparison"
    else:
        code = pw.correction_method
        if p_test == "Wilcoxon signed-rank":
            # Mirrors evalstats: Romano-Wolf needs per-pair resampling, so it
            # corrects Wilcoxon p-values with Shaffer's method instead, or
            # Holm's when some pair has no Wilcoxon p-value.
            if code == "romano_wolf":
                code = "shaffer"
            if code == "shaffer" and any(p.wilcoxon_p is None for p in pairs):
                code = "holm"
        correction = ("uncorrected" if code in (None, "none")
                      else f"{_pretty_correction(code)} correction")

    methods = [
        {"label": "Design", "value": f"paired: every group scored on the same {first.n_inputs} items"},
        {"label": "Scores", "value": scores},
        {"label": f"Mean CIs ({ci})", "value": _pretty_marginal_ci_method(ci_method) or "unknown"},
        {"label": f"Pairwise difference CIs ({ci})", "value": diff_ci},
        {"label": "p-values", "value": f"{p_test}, {correction}"},
    ]
    if pw.friedman is not None:
        f = pw.friedman
        methods.append({"label": "Omnibus test",
                        "value": f"Friedman χ²({f.df}) = {f.statistic:.2f}, p {_format_p(f.p_value)}"})
    methods.append({"label": "Rank bands", "value": (
        "groups are tied when their pairwise CI includes 0" if simultaneous is not None
        else f"groups are tied when their corrected p ≥ {result.alpha:g}")})
    methods.append({"label": "evalstats", "value": version("evalstats")})
    return methods


def _rank_bands(bundle, labels_sorted: List[str], alpha: float) -> Dict[str, int]:
    """The rank bands of evalstats' executive summary, by label.

    Band 1 holds the top entity and everything statistically tied with it; each
    later band marks a significant drop-off. evalstats doesn't expose these
    publicly yet, so this uses its private helper and reports no bands (rather
    than failing) if that ever moves.
    """
    try:
        from evalstats.core.summary import _assign_significance_groups
    except ImportError:
        return {}
    groups = _assign_significance_groups(bundle.pairwise, labels_sorted, alpha=alpha)
    return {label: int(group.lstrip("#")) for label, group in groups.items()}
