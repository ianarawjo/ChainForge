"""The Python evaluator route, as the front-end calls it with the sandbox off.

The front-end sends text for every field an evaluator reads (see
`resolveForFlask` in backend.ts); Flask has no string table to look them up in.
These tests pin what the evaluator then sees, which is what the docs promise:
`response.text`, `.prompt`, `.var`, `.meta` and `.llm`.
"""

import json


def response_object(**overrides):
    obj = {
        "uid": "u1",
        "prompt": "What is the capital of France?",
        "vars": {"country": "France"},
        "metavars": {"topic": "geography"},
        "llm": "GPT-4o",
        "responses": ["Paris", "Lyon"],
    }
    obj.update(overrides)
    return obj


def run(client, code, responses, process_type="evaluator"):
    resp = client.post("/app/executepy", json={
        "id": "x", "code": code, "responses": responses,
        "scope": "response", "process_type": process_type,
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert "error" not in body, body.get("error")
    return body


def test_the_evaluator_gets_the_documented_fields(client):
    code = (
        "import json\n"
        "def evaluate(response):\n"
        "    return json.dumps([response.text, response.prompt, response.var,\n"
        "                       response.meta, response.llm])\n"
    )
    body = run(client, code, [response_object()])
    items = body["responses"][0]["eval_res"]["items"]
    assert [json.loads(i) for i in items] == [
        ["Paris", "What is the capital of France?", {"country": "France"}, {"topic": "geography"}, "GPT-4o"],
        ["Lyon", "What is the capital of France?", {"country": "France"}, {"topic": "geography"}, "GPT-4o"],
    ]


def test_response_text_works_as_a_string(client):
    code = "def evaluate(response):\n    return len(response.text) + len(str(response))\n"
    body = run(client, code, [response_object()])
    assert body["responses"][0]["eval_res"]["items"] == [10, 8]


def test_the_reasoning_of_each_response_is_in_its_meta(client):
    code = "def evaluate(response):\n    return response.meta.get('reasoning', 'none')\n"
    body = run(client, code, [response_object(reasoning=["because", None])])
    assert body["responses"][0]["eval_res"]["items"] == ["because", "none"]


def test_a_processor_replaces_the_response_texts(client):
    code = "def process(response):\n    return response.text.upper()\n"
    body = run(client, code, [response_object()], process_type="processor")
    assert body["responses"][0]["responses"] == ["PARIS", "LYON"]
