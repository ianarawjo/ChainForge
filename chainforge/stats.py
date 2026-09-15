"""Statistical comparison of evaluation results, for the Vis Node.

Backed by the optional `evalstats` package (`pip install chainforge[stats]`).

ChainForge always uses evalstats' paired design, the one that fits AI
evaluations: every item is scored for every group being compared (and every
run). Items missing any of those scores are dropped with
`evalstats.complete_items()` before comparing, and reported back so the page
can say which were left out.
"""

import itertools
import math
import threading
import warnings
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Dict, List, Optional

MIN_EVALSTATS_VERSION = (0, 3, 2)

ALPHA = 0.05

# How many excluded items to name in a response. The count is always exact.
MAX_EXCLUDED_LABELS = 50

# evalstats still wraps some scipy calls in warnings.catch_warnings, which isn't
# thread-safe, so one comparison at a time.
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

    Reads package metadata only, so ChainForge doesn't import evalstats at startup.
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

    Returns ``{"ok": True, ...}`` with per-group means, confidence intervals,
    rank bands and verdicts, pairwise differences, and the methods evalstats
    ran; or ``{"ok": False, "message": ...}`` when the results can't support
    statistics. Either way it reports how many items were analysed and which
    were excluded. Raises StatsInputError for rows that are malformed or can't
    be paired.
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

    n_runs = int(df["run"].nunique())
    report = {"alpha": ALPHA, "n_items": int(df["item"].nunique()), "n_runs": n_runs,
              "n_excluded": 0, "excluded_items": []}

    # A grouping with a single value isn't compared; its value is kept on each entity.
    factor_cols = [c for c in ("group", "group2") if df[c].nunique() > 1]
    if not factor_cols:
        return {**report, "ok": False, "reason": "too_few_groups", "message": _TOO_FEW_GROUPS}
    constant = {c: str(df[c].iloc[0]) for c in ("group", "group2")
                if c not in factor_cols and (c == "group" or has_group2)}

    # Groups (or combinations of them) without a single score leave no item
    # complete; they're named rather than just reported as missing results.
    scored = df[df["score"].notna()]
    has_scores = set(zip(scored["group"], scored["group2"]))
    empty_groups = [(g, g2) for g in dict.fromkeys(df["group"]) for g2 in dict.fromkeys(df["group2"])
                    if (g, g2) not in has_scores]

    es_factor = dict(zip(factor_cols, ("model", "prompt")))
    frame = pd.DataFrame({es_factor[c]: df[c] for c in factor_cols})
    frame["item"] = df["item"]
    frame["score"] = df["score"].astype(float)
    if n_runs > 1:
        frame["run"] = df["run"]
    factors = [es_factor[c] for c in factor_cols]
    factors_arg = factors[0] if len(factors) == 1 else factors

    import evalstats as es

    with _LOCK, warnings.catch_warnings():
        # evalstats returns its warnings as result.notes; keep them out of the server log.
        warnings.simplefilter("ignore")
        try:
            evaldata, completeness = es.complete_items(es.load_from(frame), factors_arg)
            excluded = completeness.excluded_items
            report.update(
                n_items=completeness.n_items,
                n_excluded=completeness.n_excluded,
                excluded_items=[item_labels.get(i, i) for i in excluded[:MAX_EXCLUDED_LABELS]],
            )
            if completeness.n_items < es.MIN_ITEMS:
                if empty_groups:
                    return {**report, "ok": False, "reason": "missing_results",
                            "message": _no_results_for(empty_groups, factor_cols)}
                return {**report, "ok": False, "reason": "too_few_items",
                        "message": _too_few_items(completeness.n_items, bool(excluded), es.MIN_ITEMS, n_runs)}
            result = es.compare(evaldata, factors=factors_arg, design="paired", alpha=ALPHA)
            summary = _summarize(result.to_dict(), factor_cols, constant)
        except es.InsufficientItemsError as e:
            return {**report, "ok": False, "reason": "too_few_items",
                    "message": _too_few_items(e.n_items, report["n_excluded"] > 0, e.min_items, n_runs)}
        except es.TooFewGroupsError:
            return {**report, "ok": False, "reason": "too_few_groups", "message": _TOO_FEW_GROUPS}
        except es.MissingCellsError:
            return {**report, "ok": False, "reason": "missing_results",
                    "message": "Statistics can't be calculated because some results are missing."}
        except es.AmbiguousLabelsError:
            return {**report, "ok": False, "reason": "ambiguous_labels",
                    "message": "Statistics can't tell some groups apart: different combinations of "
                               "names read the same once joined with \" / \". Rename values that "
                               "contain \" / \"."}
        except ValueError as e:  # includes evalstats' EvalLoadError
            return {**report, "ok": False, "reason": "analysis_failed",
                    "message": f"evalstats couldn't analyse these results: {e}"}

    return {**report, "ok": True, "factors": factor_cols, **summary}


_TOO_FEW_GROUPS = "Statistics need at least two groups to compare."


def _no_results_for(groups: List[tuple], factor_cols: List[str]) -> str:
    """Names the (group, group2) combinations with no scores, by the groupings compared."""
    names = [" · ".join(level for level, col in zip(pair, ("group", "group2")) if col in factor_cols)
             for pair in groups]
    listed = ", ".join(names[:3]) + (f" and {len(names) - 3} more" if len(names) > 3 else "")
    verb = "has" if len(names) == 1 else "have"
    return f"Statistics need results for every group, but {listed} {verb} none."


def _too_few_items(n_items: int, some_excluded: bool, min_items: int, n_runs: int) -> str:
    if some_excluded:
        have = f"Only {n_items} {'input has' if n_items == 1 else 'inputs have'} them."
    else:
        have = f"This eval has {n_items} {'input' if n_items == 1 else 'inputs'}."
    runs = " Repeated responses to the same input count as one." if n_runs > 1 else ""
    return f"Statistics need at least {min_items} inputs with results for every group. {have}{runs}"


def _summarize(result: Dict[str, Any], factor_cols: List[str],
               constant: Dict[str, str]) -> Dict[str, Any]:
    """Entities best-first and pairwise differences, from evalstats' ``to_dict()``."""
    col_of = dict(zip(("model", "prompt"), factor_cols))

    entities, index_of = [], {}
    for label in result["order"]:
        e = result["entities"][label]
        entity = dict(constant)
        for factor, level in e["levels"].items():
            entity[col_of[factor]] = level
        entity.update(mean=e["mean"], ci_low=e["ci_low"], ci_high=e["ci_high"],
                      band=e["band"], verdict=e["verdict"])
        index_of[label] = len(entities)
        entities.append(entity)

    pairwise = [{
        "a": index_of[p["a"]],
        "b": index_of[p["b"]],
        "diff": p["diff"],
        "ci_low": p["ci_low"],
        "ci_high": p["ci_high"],
        "p_value": p.get("p_value"),
        "significant": p["significant"],
    } for p in result["pairwise"]]

    return {
        "entities": entities,
        "pairwise": pairwise,
        "methods": _methods_lines(result["methods"], n_pairs=len(pairwise)),
        "notes": [n["message"] for n in result["notes"]],
    }


def _format_p(p: float) -> str:
    """"< 0.001" or "= 0.042", to follow a "p"."""
    return "< 0.001" if p < 0.001 else f"= {p:.3f}"


_RANK_BAND_CRITERIA = {
    "simultaneous_ci_excludes_zero": "groups are tied when their pairwise CI includes 0",
    "corrected_p_below_alpha": "groups are tied when their corrected p ≥ {alpha:g}",
}


def _methods_lines(methods: Dict[str, Any], *, n_pairs: int) -> List[Dict[str, str]]:
    """evalstats' ``methods()`` record, as the label/value lines the panel lists."""
    alpha = methods["alpha"]
    ci = f"{100 * (1 - alpha):g}%"

    design = methods["design"]
    runs = ""
    if design["n_runs"] > 1:
        runs = f"; {design['n_runs']} runs per item"
        if design.get("runs_averaged"):
            runs += ", averaged"

    kind = methods["data_kind"]
    scores = kind["name"] or kind["code"]
    if kind.get("score_range"):
        low, high = kind["score_range"]
        scores += f", from {low:g} to {high:g}"

    pairwise_ci = methods["pairwise_ci"]
    diff_ci = pairwise_ci["name"] or pairwise_ci["code"]
    simultaneous = pairwise_ci.get("simultaneous") or {}
    if simultaneous.get("code") not in (None, "single"):
        diff_ci += f", simultaneous ({simultaneous['name']})"

    lines = [
        {"label": "Design", "value": f"paired: every group scored on the same {design['n_items']} items{runs}"},
        {"label": "Scores", "value": scores},
        {"label": f"Mean CIs ({ci})", "value": methods["mean_ci"]["name"] or methods["mean_ci"]["code"]},
        {"label": f"Pairwise difference CIs ({ci})", "value": diff_ci},
    ]

    p_values = methods["p_values"]
    if p_values["shown"]:
        correction = p_values["correction"]
        if correction["code"] in (None, "none"):
            corrected = "no correction needed for one comparison" if n_pairs == 1 else "uncorrected"
        else:
            corrected = f"{correction['name']} correction"
        lines.append({"label": "p-values", "value": f"{p_values['test']['name']}, {corrected}"})

    omnibus = methods.get("omnibus")
    if omnibus and omnibus.get("statistic") is not None and omnibus.get("p_value") is not None:
        test = "Friedman" if omnibus["test"] == "friedman" else omnibus["test"]
        lines.append({"label": "Omnibus test",
                      "value": f"{test} χ²({omnibus['df']}) = {omnibus['statistic']:.2f}, "
                               f"p {_format_p(omnibus['p_value'])}"})

    criterion = methods["rank_bands"]["criterion"]
    lines.append({"label": "Rank bands",
                  "value": _RANK_BAND_CRITERIA.get(criterion, criterion).format(alpha=alpha)})

    resampling = methods.get("resampling") or {}
    if resampling.get("n_bootstrap"):
        seed = resampling.get("rng_seed")
        lines.append({"label": "Resampling",
                      "value": f"{resampling['n_bootstrap']:,} bootstrap resamples"
                               + (f", seed {seed}" if seed is not None else "")})

    lines.append({"label": "evalstats", "value": methods["evalstats_version"]})
    return lines
