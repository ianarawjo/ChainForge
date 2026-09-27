---
type: evaluator
name: JavaScript Evaluator
---

# JavaScript Evaluator

## Purpose

Scores every response it receives by running a JavaScript function,
`evaluate(response)`, once per response. The score is attached to the
response, where plots and tables can use it.

The same node type can hold Python code instead. ChainBuddy only edits
JavaScript evaluators.

## Use it when

- The check is something code can decide exactly: length, whether a word or
  pattern appears, whether the response is valid JSON, whether it contains a
  value from one of the prompt's variables.

## Don't use it for

- Judgments that need reading and interpretation, such as tone or
  helpfulness. That's the LLM Scorer, which has a model judge. Say so, rather
  than writing brittle code to approximate it.
- Changing the response text. That's a JavaScript Processor.
- Measuring speed, cost, tokens or energy. ChainForge records those while it
  runs the prompts; plot them with a Vis Node connected straight to the
  Prompt Node.

## Inputs

- `responses`: the responses to score. Accepts `responses`, such as a Prompt
  Node's.

## Outputs

- `scored_responses`: the same responses, each with its score attached.
  Connect a Vis Node to plot the scores, or an Inspect Node to read them.

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
code:
  type: code
  language: javascript
  required: true
  description: >
    Must define function evaluate(response) and return a score. See "Writing
    the code" below.
```

## Writing the code

`evaluate` receives one response at a time, with these fields:

| Field             | What it holds                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `response.text`   | The response text                                                                             |
| `response.prompt` | The exact prompt that was sent                                                                |
| `response.var`    | The variable values that filled the prompt, by name, including ones from earlier in the chain |
| `response.meta`   | Extra values carried along with the inputs, by name                                           |
| `response.llm`    | The model's nickname, as shown in the Prompt Node                                             |

Return a number, `true`/`false`, or a short string; or an object whose values
are those, such as `{ length: 12, polite: true }`. Anything else, including
returning nothing, fails the run. The function may be `async`.

Return the same kind, and for an object the same keys, for every response.
Nothing checks this: a Vis Node plots every score as the kind of the first.

## Example

Checks whether a one-sentence summary really is one sentence.

```yaml
title: Is one sentence
code: |
  function evaluate(response) {
    const sentences = response.text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    return sentences.length === 1;
  }
```

## Watch out for

- **The code runs inside ChainForge's own page** when the user runs the
  node. Write plain, readable functions, and explain what the code checks
  when proposing it.
- **No network requests, no browser storage, no imports.** Evaluator code
  should only look at the response it's given.
- **One thrown error fails the whole run.** Guard against missing values,
  such as a variable that isn't in `response.var`.
- **Exact checks are brittle.** A check for `"Yes"` misses `"yes."`. Normalize
  case, whitespace, and punctuation where it doesn't change the meaning, and
  suggest the user compare a few scores with their responses.
- **It runs only when the user runs it**, not when the prompts are run again.
  Nodes after it show nothing, or old scores, until it has run.
- **Never put the expected answer where the model will see it.** Values from
  a TextFields Node go into the prompt, so an answer written next to its
  question gives it away. Pairing each input with its answer is what a
  Tabular Data Node is for; without one, keep the answers in the evaluator's
  code, looked up by the question in `response.var`.
