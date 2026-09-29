---
type: llmeval
name: LLM Scorer
---

# LLM Scorer

## Purpose

Scores every response it receives by asking one or more models, its judges,
to decide something about it: the rubric. The score is attached to the
response, where plots and tables can use it.

## Use it when

- The check needs reading and interpretation: tone, helpfulness, safety,
  whether a response follows an instruction, or whether it gives the same
  answer as an expected one, however it's worded.
- Comparing judges with each other, by giving the scorer more than one.

## Don't use it for

- Checks code can decide exactly: length, whether a word or pattern appears,
  valid JSON. That's the JavaScript Evaluator, which is exact, repeatable and
  free to run.
- Measuring what ChainForge records while running prompts, such as speed or
  cost. Plot those with a Vis Node connected straight to the Prompt Node.

## Inputs

- `responses`: what to score. Accepts `responses`, such as a Prompt Node's,
  and `values`, to score texts straight from a TextFields or Tabular Data
  Node. It scores everything connected to it.

## Outputs

- `scored_responses`: the same responses, each with its score attached.
  Connect a Vis Node to plot the scores, and an Inspect Node as well to read
  the responses beside them.

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
rubric:
  type: string
  required: true
  description: >
    What the judges decide about each response, as a question or an
    instruction. See "Writing the rubric" below.
format:
  type: string
  default: binary
  description: >
    The kind of score: binary (true/false), categorical (one of the
    categories), numeric (a level on the scale), or open-ended (free text,
    for reading rather than plotting).
categories:
  type: list
  description: For a categorical score, the categories, at least two.
  of:
    type: object
    fields:
      label:
        type: string
        description: The category's name, which becomes the score. No colons.
      description:
        type: string
        description: What belongs in it, in a few words. Optional.
scale:
  type: list
  description: >
    For a numeric score, the levels, lowest first, each described in a few
    words. The score is the level's number, from 1 for the lowest; a
    judge-only model's can fall between levels.
  of:
    type: string
judges:
  type: list
  min: 1
  description: >
    The models that score each response. Leave it out for the default judge.
    See "Choosing judges" below.
  of:
    type: object
    fields:
      model:
        type: model
        description: Which model, as returned by list_models.
      nickname:
        type: string
        read_only: true
        description: The name ChainForge shows for this judge.
```

## Writing the rubric

A text judge sees the rubric, then the response, then an instruction on how
to answer in the chosen format, which ChainForge adds; a judge-only model
gets the rubric as its question, and the response. Write the rubric about
"the response", and leave the answer format to `format`, `categories` and
`scale`.

The rubric is the same for every response, and a judge scores one response
at a time without seeing its prompt. Never list the right answer for each
input in the rubric: the judge can't tell which input a response answers.

- **Binary:** ask a yes/no question where `true` is what the user wants to
  count, such as "Does the response refuse to give a diagnosis?"
- **Categorical:** ask which category fits, and describe each category.
- **Numeric:** ask where the response falls, and describe each level.

`{#name}` puts in a value from the flow for that response: a variable that
filled its prompt, or a column of the Tabular Data Node it came from. That's
how a judge compares an answer to the expected one ("Does the response give
the same answer as {#answer}?"), or sees the question asked ("Does the
response answer {#question}?"). The name must be spelled exactly as the
variable or column is, and every scored response must have it, or the run
fails. Text straight from a TextFields Node has none.

## Choosing judges

- **The default judge**, which list_models names, is a model made only for
  judging. It sees only the response and the rubric as written, so it can't
  use `{#name}`, and it doesn't give open-ended answers.
- **Other judges** are any of list_models' models. Use one when the rubric
  needs `{#name}`, or the user asks for a particular judge.
- **More than one judge** gives each response one score per judge, under
  each judge's nickname, and shows the user where judges disagree. A Vis
  Node plots one judge's scores at a time: set its metric to that judge's
  nickname, which for a new judge is its name in list_models. With one
  judge, the metric is `score`.

## Example

Checks whether health advice sends people to a doctor rather than
diagnosing, with the default judge.

```yaml
title: Refers to a doctor
rubric: >
  Does the response avoid diagnosing the person, and suggest they see a
  doctor or other professional?
format: binary
```

## Watch out for

- **Scores are judgments, not facts.** Suggest the user compare a few scores
  with the responses before trusting them.
- **Checking answers against expected ones:** put inputs and answers in a
  Tabular Data Node, connect only the input column to the prompt, so the
  tested model never sees the answer, and use `{#answer}` (by its column
  name) in the rubric, with a judge from list_models' models.
- **Every response costs a request to every judge.** Keep the inputs few,
  and add judges only when the user wants to compare them.
- **It runs only when the user runs it**, not when the prompts are run again.
  Nodes after it show nothing, or old scores, until it has run.
