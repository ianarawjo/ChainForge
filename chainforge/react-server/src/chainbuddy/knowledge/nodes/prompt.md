---
type: prompt
name: Prompt Node
support: editable
runnable: true
---

# Prompt Node

## Purpose

Sends one or more prompts to one or more models and collects the responses.
A prompt can contain `{variables}`. Each variable becomes an input, and the
node sends one prompt for every combination of the values connected to its
variables.

## Use it when

- Asking models something, over one input or many.
- Comparing models on the same prompts: list several models.
- Comparing wordings of a prompt on the same inputs: list several prompts.
- Feeding one model's responses into another prompt (chaining).

## Don't use it for

- Grading or scoring responses. Use an Evaluator Node for checks code can
  decide. Judging by a model (the LLM Scorer Node) isn't supported by
  ChainBuddy yet.
- Multi-turn conversations. That's the Chat Turn Node, which ChainBuddy
  doesn't support yet.

## Inputs

One input per `{variable}` in any of the node's prompts, named after the
variable. Inputs appear and disappear as variables are added to or removed
from the prompts. Every input must be connected before the node can run.

Two special forms don't create an input:

- `{#name}` reuses the value that filled `{name}` earlier in the chain.
- `\{` and `\}` are literal braces, not a variable.

## Outputs

- `responses`: every response the node collected. Each carries the response
  text, the exact prompt sent, the variable values used to fill it, and the
  model's nickname.

## Connects to

| From        | To                                     |
| ----------- | -------------------------------------- |
| `responses` | a variable input of a Prompt Node      |
| `responses` | `responses` input of an Evaluator Node |

Connecting `responses` to another Prompt Node's variable sends each response
on as a value to fill that variable. The variable values that produced it
travel along too, so later nodes can still read them.

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
prompts:
  type: list
  min: 1
  description: >
    The prompts to send. With one prompt, this is a plain prompt. With two or
    more, each is sent over the same inputs and models, so their responses can
    be compared.
  of:
    type: object
    fields:
      label:
        type: string
        description: Short name for this prompt, shown in results, such as "Formal".
      text:
        type: string
        description: The prompt. {name} marks a variable.
models:
  type: list
  min: 1
  description: The models to send every prompt to.
  of:
    type: object
    fields:
      model:
        type: model
        description: Which model, as returned by list_models.
      nickname:
        type: string
        read_only: true
        description: >
          The name ChainForge shows for this model, and the name evaluator
          code sees in response.llm.
responses_per_prompt:
  type: integer
  min: 1
  max: 999
  default: 1
  description: >
    How many responses to collect from each model for each prompt. More than
    one shows how much a model's answers vary from run to run.
```

## Example

Asks two models to summarize each text from a connected TextFields Node, in
two wordings, three times each.

```yaml
title: Summaries
prompts:
  - label: Plain
    text: "Summarize this in one sentence: {text}"
  - label: For a child
    text: "Summarize this in one sentence a ten-year-old would understand: {text}"
models:
  - model: openrouter/anthropic/claude-haiku-4.5
  - model: openrouter/openai/gpt-5.4-mini
responses_per_prompt: 3
```

## Watch out for

- **Running costs money.** The number of model calls is
  prompts × combinations of input values × models × responses per prompt.
  Two prompts, 10 texts, 2 models and 3 responses each is 120 calls. Estimate
  before proposing a run, and keep first runs small.
- **Every variable needs a connection.** A prompt with `{text}` and nothing
  connected to `text` won't run.
- **Variable names must be unique along a chain**, ignoring case. If an
  upstream node already fills `{Text}`, a later `{text}` causes an error.
- **Literal braces need escaping.** A prompt asking for JSON such as
  `{"answer": ...}` creates a variable unless written `\{"answer": ...\}`.
- **Changing a prompt doesn't clear old responses.** The node keeps its last
  results, marked as out of date, until it runs again. Don't read results
  from a node changed since its last run as if they came from the new
  prompts.
- **A model can only run if its provider is set up** (an API key, or Ollama
  running locally). `list_models` says which models are ready.
- **Model settings such as temperature** can't be changed by ChainBuddy yet.
  Ask the user to change them in the model's settings.
- **Variables starting with `=`**, such as `{=system_msg}`, set a model
  setting instead of filling text. ChainBuddy doesn't use them yet.
