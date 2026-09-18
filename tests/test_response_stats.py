"""Response stats (latency, token counts, speed) reach Python evaluators as metavars."""

import chainforge.flask_app as flask_app


def test_python_evaluators_see_each_responses_stats():
    seen = []

    def evaluate(response):
        seen.append(response.meta)
        return 1

    responses = [{
        "responses": ["a", "b"], "prompt": "p", "vars": {}, "llm": "m",
        "metavars": {"topic": "x"},
        "stats": [{"latency_ms": 1500, "output_tokens": 30, "tokens_per_s": 20.0, "decode_tokens_per_s": 31.5}, None],
    }]
    flask_app.run_over_responses(evaluate, responses, "response", "evaluator")
    assert seen == [
        {"topic": "x", "stat_latency_s": 1.5, "stat_output_tokens": 30, "stat_tokens_per_s": 20.0,
         "stat_decode_tokens_per_s": 31.5},
        {"topic": "x"},
    ]


def test_averages_are_marked():
    seen = []
    responses = [{"responses": ["a"], "prompt": "p", "vars": {}, "llm": "m", "metavars": {},
                  "stats": [{"output_tokens": 100, "averaged_over": 4}]}]
    flask_app.run_over_responses(lambda r: seen.append(r.meta) or 1, responses, "response", "evaluator")
    assert seen == [{"stat_output_tokens": 100, "stat_averaged_over": 4}]


def test_responses_without_stats_are_unchanged():
    seen = []
    responses = [{"responses": ["a"], "prompt": "p", "vars": {}, "llm": "m", "metavars": {"topic": "x"}}]
    flask_app.run_over_responses(lambda r: seen.append(r.meta) or 1, responses, "response", "evaluator")
    assert seen == [{"topic": "x"}]
