---
type: evaluator
name: JavaScript Evaluator
support: editable
support_only_when:
  language: javascript
runnable: true
---

# JavaScript Evaluator

## Purpose

Scores every response it receives by running a JavaScript function,
`evaluate(response)`, once per response. The score is attached to the
response, where plots and tables can use it.

The same node type can hold Python code instead. ChainBuddy only supports
JavaScript evaluators, and treats Python ones as not supported.

## Use it when

- The check is something code can decide exactly: length, whether a word or
  pattern appears, whether the response is valid JSON, whether it contains a
  value from one of the prompt's variables.

## Don't use it for

- Judgments that need reading and interpretation, such as tone or
  helpfulness. That's the LLM Scorer Node, which ChainBuddy doesn't support
  yet. Say so, rather than writing brittle code to approximate it.
- Changing the response text. That's the Code Processor Node, which
  ChainBuddy doesn't support yet.

## Inputs

- `responses`: the responses to score, from a Prompt Node.

## Outputs

- `scored_responses`: the same responses, each with its score attached. People
  usually connect this to a Vis Node or Inspect Node, which ChainBuddy
  doesn't support yet; suggest the user add one.

## Connects to

| From                         | To          |
| ---------------------------- | ----------- |
| `responses` of a Prompt Node | `responses` |

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
code:
  type: code
  language: javascript
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

Return a number, `true`/`false`, or a short string, and return the same kind
for every response. The function may be `async`.

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

- **The user must approve the code before its first run.** This code runs
  inside ChainForge's own page. Write plain, readable functions, and explain
  what the code checks when proposing it.
- **No network requests, no browser storage, no imports.** Evaluator code
  should only look at the response it's given.
- **One thrown error fails the whole run.** Guard against missing values,
  such as a variable that isn't in `response.var`.
- **Keep scores simple.** Prefer one number, boolean, or string per response.
  An object such as `{ length: 12, polite: true }` also works, as long as
  every response returns the same keys with the same kinds of values. Lists
  don't work.
- **Exact checks are brittle.** A check for `"Yes"` misses `"yes."`. Normalize
  case, whitespace, and punctuation where it doesn't change the meaning, and
  check a few real responses before trusting the scores.
- **Comparing against an expected answer per input** needs each input paired
  with its answer, which TextFields can't do. That needs a Tabular Data Node,
  which ChainBuddy doesn't support yet.
