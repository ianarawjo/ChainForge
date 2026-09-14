"""Tests for Vis Node statistics: chainforge/stats.py and the /app/compareEvalStats route.

evalstats is the optional [stats] extra, so tests that run a real comparison
skip without it. Everything decided before evalstats is called (pairing,
exclusions, the 15-item floor) needs only pandas.
"""

import random
from importlib.util import find_spec
from unittest.mock import patch

import pytest

import chainforge.flask_app as flask_app
from chainforge import stats

needs_pandas = pytest.mark.skipif(find_spec("pandas") is None, reason="pandas not installed")
needs_evalstats = pytest.mark.skipif(
    stats.evalstats_unavailable_reason() is not None,
    reason="evalstats not installed (pip install chainforge[stats])",
)


def make_rows(groups, n_items, group2s=None, runs=1, missing=(), seed=0):
    """One boolean score per group (x group2) x item x run, better for later groups.

    `missing` holds (group, group2, item index, run) tuples to leave out.
    """
    rng = random.Random(seed)
    rows = []
    for gi, group in enumerate(groups):
        for group2 in group2s or [None]:
            for i in range(n_items):
                for run in range(runs):
                    if (group, group2, i, run) in missing:
                        continue
                    row = {"group": group, "item": f"item{i}", "run": run,
                           "score": rng.random() < 0.3 + 0.2 * gi}
                    if group2 is not None:
                        row["group2"] = group2
                    rows.append(row)
    return rows


class TestAvailability:

    def test_missing_package(self, monkeypatch):
        def not_installed(name):
            raise stats.PackageNotFoundError(name)
        monkeypatch.setattr(stats, "version", not_installed)
        assert "chainforge[stats]" in stats.evalstats_unavailable_reason()

    def test_too_old(self, monkeypatch):
        monkeypatch.setattr(stats, "version", lambda name: "0.3.0")
        reason = stats.evalstats_unavailable_reason()
        assert "0.3.1" in reason and "0.3.0 is installed" in reason

    @pytest.mark.parametrize("installed", ["0.3.1", "0.4.0rc1", "1.0"])
    def test_recent_enough(self, monkeypatch, installed):
        monkeypatch.setattr(stats, "version", lambda name: installed)
        assert stats.evalstats_unavailable_reason() is None


@needs_pandas
class TestPairing:
    """What happens before evalstats is called, so none of these need it."""

    def test_incomplete_items_are_excluded_and_named(self):
        rows = make_rows(["a", "b"], 16, missing={("b", None, 3, 0), ("a", None, 7, 0)})
        result = stats.compare_eval_results(rows, item_labels={"item3": "Question 3"})
        assert result["ok"] is False
        assert result["n_items"] == 14
        assert result["n_excluded"] == 2
        assert result["excluded_items"] == ["Question 3", "item7"]
        assert "15 items or more" in result["message"]
        assert "Only 14" in result["message"]

    def test_fewer_than_15_items(self):
        result = stats.compare_eval_results(make_rows(["a", "b"], 14))
        assert result["ok"] is False
        assert result["n_excluded"] == 0
        assert "This one has 14" in result["message"]

    def test_a_missing_run_makes_its_item_incomplete(self):
        result = stats.compare_eval_results(make_rows(["a", "b"], 15, runs=3, missing={("a", None, 0, 2)}))
        assert (result["n_items"], result["n_runs"], result["n_excluded"]) == (14, 3, 1)

    def test_non_numeric_scores_count_as_missing(self):
        rows = make_rows(["a", "b"], 15)
        rows[0]["score"] = "yes"
        result = stats.compare_eval_results(rows)
        assert (result["n_items"], result["n_excluded"]) == (14, 1)

    def test_needs_two_groups(self):
        result = stats.compare_eval_results(make_rows(["a"], 20))
        assert result["ok"] is False
        assert "two groups" in result["message"]

    def test_duplicate_results_cannot_be_paired(self):
        with pytest.raises(stats.StatsInputError, match="identical inputs"):
            stats.compare_eval_results(make_rows(["a", "b"], 20) * 2)

    def test_group2_on_only_some_rows(self):
        rows = make_rows(["a", "b"], 20)
        rows[0]["group2"] = "p"
        with pytest.raises(stats.StatsInputError, match="group2"):
            stats.compare_eval_results(rows)

    @pytest.mark.parametrize("bad", [[], [{"item": "x", "score": 1}], [{"group": "a", "item": "x", "run": "0"}]])
    def test_malformed_rows(self, bad):
        with pytest.raises(stats.StatsInputError):
            stats.compare_eval_results(bad)


@needs_evalstats
class TestCompare:

    def test_single_factor(self):
        result = stats.compare_eval_results(make_rows(["low", "mid", "high"], 30, runs=3))
        assert result["ok"] is True
        assert result["factors"] == ["group"]
        assert (result["n_items"], result["n_runs"], result["n_excluded"]) == (30, 3, 0)

        entities = result["entities"]
        assert {e["group"] for e in entities} == {"low", "mid", "high"}
        assert all("group2" not in e for e in entities)
        means = [e["mean"] for e in entities]
        assert means == sorted(means, reverse=True)
        for e in entities:
            assert e["ci_low"] <= e["mean"] <= e["ci_high"]
        assert entities[0]["band"] == 1
        assert [e["band"] for e in entities] == sorted(e["band"] for e in entities)

        assert len(result["pairwise"]) == 3
        for pair in result["pairwise"]:
            assert {pair["a"], pair["b"]} <= {0, 1, 2} and pair["a"] != pair["b"]
            assert 0 <= pair["p_value"] <= 1

    def test_methods_say_what_ran(self):
        methods = {m["label"]: m["value"]
                   for m in stats.compare_eval_results(make_rows(["low", "mid", "high"], 30))["methods"]}
        assert methods["Design"] == "paired: every group scored on the same 30 items"
        assert methods["Scores"] == "true/false (0 or 1)"
        for label in ("Mean CIs (95%)", "Pairwise difference CIs (95%)", "p-values",
                      "Omnibus test", "Rank bands", "evalstats"):
            assert methods[label], label
        assert "correction" in methods["p-values"]

    def test_one_comparison_needs_no_correction(self):
        methods = {m["label"]: m["value"]
                   for m in stats.compare_eval_results(make_rows(["a", "b"], 20, runs=3))["methods"]}
        assert methods["p-values"].endswith("no correction needed for one comparison")
        assert methods["Scores"] == "true/false (0 or 1); 3 runs per item"

    def test_clear_winner_gets_its_own_band(self):
        rows = [{"group": g, "item": f"item{i}", "run": 0,
                 "score": (i >= 2) if g == "good" else (i < 2)}
                for g in ("good", "bad") for i in range(20)]
        entities = stats.compare_eval_results(rows)["entities"]
        assert [(e["group"], e["band"]) for e in entities] == [("good", 1), ("bad", 2)]

    @pytest.mark.parametrize("group2s", [None, ["p1", "p2"]])
    def test_always_uses_the_paired_design(self, group2s):
        import evalstats
        with patch.object(evalstats, "compare", wraps=evalstats.compare) as spy:
            stats.compare_eval_results(make_rows(["a", "b"], 20, group2s=group2s))
        assert spy.call_args.kwargs["design"] == "paired"

    def test_exclusions_are_reported_with_the_stats(self):
        result = stats.compare_eval_results(make_rows(["a", "b"], 20, missing={("a", None, 3, 0)}))
        assert result["ok"] is True
        assert (result["n_items"], result["n_excluded"], result["excluded_items"]) == (19, 1, ["item3"])

    def test_two_factors_whatever_the_names(self):
        # " / " is how evalstats labels (model, prompt) cells.
        result = stats.compare_eval_results(make_rows(["x / y", "x"], 20, group2s=["p", "y / p"]))
        assert result["ok"] is True
        assert result["factors"] == ["group", "group2"]
        assert {(e["group"], e["group2"]) for e in result["entities"]} == {
            ("x / y", "p"), ("x / y", "y / p"), ("x", "p"), ("x", "y / p")}
        assert len(result["pairwise"]) == 6

    def test_a_second_factor_with_one_level_is_dropped(self):
        result = stats.compare_eval_results(make_rows(["a", "b"], 20, group2s=["only"]))
        assert result["factors"] == ["group"]
        assert {(e["group"], e["group2"]) for e in result["entities"]} == {("a", "only"), ("b", "only")}

    def test_notes_name_groups_rather_than_evalstats_ids(self):
        # A group scoring the same on every item draws a zero-variance note.
        rows = [{"group": g, "item": f"item{i}", "run": 0,
                 "score": True if g == "always" else i % 2 == 0}
                for g in ("always", "sometimes") for i in range(20)]
        notes = stats.compare_eval_results(rows)["notes"]
        assert any("'always'" in n for n in notes)
        assert not any("'m0'" in n or "'m1'" in n for n in notes)

    def test_missing_cells_error_becomes_a_message(self):
        import evalstats
        error = ValueError("scores contain 4 NaN (missing) cell(s)")
        with patch.object(evalstats, "compare", side_effect=error):
            result = stats.compare_eval_results(make_rows(["a", "b"], 20))
        assert result["ok"] is False
        assert result["message"] == "Statistics can't be calculated because some results are missing."


class TestRoutes:

    @pytest.fixture
    def stats_disabled(self, monkeypatch):
        monkeypatch.setattr(flask_app, "EVALSTATS_AVAILABLE", False)
        monkeypatch.setattr(flask_app, "EVALSTATS_UNAVAILABLE_REASON",
                            "Install it with `pip install chainforge[stats]`.")

    @pytest.fixture
    def stats_enabled(self, monkeypatch):
        monkeypatch.setattr(flask_app, "EVALSTATS_AVAILABLE", True)
        monkeypatch.setattr(flask_app, "EVALSTATS_UNAVAILABLE_REASON", None)

    def test_compare_returns_501_without_evalstats(self, client, stats_disabled):
        resp = client.post("/app/compareEvalStats", json={"rows": make_rows(["a", "b"], 20)})
        assert resp.status_code == 501
        assert "chainforge[stats]" in resp.get_json()["error"]

    def test_check_reports_unavailable(self, client, stats_disabled):
        resp = client.post("/app/checkEvalStatsAvailable")
        assert resp.get_json() == {"available": False,
                                   "reason": "Install it with `pip install chainforge[stats]`."}

    def test_page_globals_carry_the_flag(self, stats_disabled):
        assert "window.__EVALSTATS_AVAILABLE=false;" in flask_app.page_globals_script()

    def test_rows_are_required(self, client, stats_enabled):
        assert client.post("/app/compareEvalStats", json={}).status_code == 400

    @needs_pandas
    def test_unpairable_rows_are_a_400(self, client, stats_enabled):
        resp = client.post("/app/compareEvalStats", json={"rows": make_rows(["a", "b"], 20) * 2})
        assert resp.status_code == 400
        assert "identical inputs" in resp.get_json()["error"]

    @needs_evalstats
    def test_happy_path(self, client, stats_enabled):
        resp = client.post("/app/compareEvalStats",
                           json={"rows": make_rows(["a", "b"], 20), "item_labels": {}})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["ok"] is True and len(body["entities"]) == 2
