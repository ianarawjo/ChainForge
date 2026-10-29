---
type: textfields
name: TextFields Node
---

# TextFields Node

## Purpose

A short list of text values, typed in by hand. Each value is sent downstream
separately, so a Prompt Node connected to it sends one prompt per value.

A value can itself contain `{variables}`, which makes it a prompt template.
Each variable becomes an input, and the Prompt Node the template reaches
fills it once for each value connected there.

## Use it when

- Supplying a handful of inputs to a prompt: questions, texts, names.
- Reusing the same prompt templates across several Prompt Nodes.

## Don't use it for

- Large datasets, or rows where several columns belong together (an input and
  its expected answer). That's the Tabular Data Node.
- Comparing a few wordings of one prompt. Listing them as prompts in the
  Prompt Node itself is simpler.

## Inputs

One input per `{variable}` found in any value, named after the variable.
Each accepts `values`, such as another TextFields Node's.

## Outputs

- `values`: the enabled values, in order. Templates go out unfilled; the
  Prompt Node they reach fills them.

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
values:
  type: list
  required: true
  min: 1
  description: >
    The enabled values, in order. Each one is sent downstream on its own.
    Replacing this list leaves disabled values untouched.
  of:
    type: string
disabled_values:
  type: list
  read_only: true
  description: >
    Values the user has switched off. They stay in the node but aren't sent
    downstream.
  of:
    type: string
```

## Example

Three questions, each sent to a Prompt Node whose prompt contains `{question}`.

```yaml
title: Questions
values:
  - "What causes the seasons?"
  - "Why is the sky blue?"
  - "How do vaccines work?"
```

## Watch out for

- **Braces make variables.** Any `{word}` in a value creates an input. Write
  `\{` and `\}` for literal braces, such as in example JSON.
- **Empty values are still sent.** An empty value becomes an empty input
  downstream. Remove it rather than leaving it blank.
- **Each value multiplies the calls downstream.** Five values into a Prompt
  Node with two models is ten calls, before responses per prompt.
- **Two TextFields Nodes feeding one prompt pair every value with every
  other.** Values that belong together need a Tabular Data Node.
- **Give every variable in a flow its own name**, ignoring case, including
  variables in templates: a template's `{text}` can't share its name with the
  prompt it feeds.
