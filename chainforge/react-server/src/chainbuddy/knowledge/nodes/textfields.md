---
type: textfields
name: TextFields Node
---

# TextFields Node

## Purpose

A short list of text values, typed in by hand. Each value is sent downstream
separately, so a Prompt Node connected to it sends one prompt per value.

A value can itself contain `{variables}`. Each variable becomes an input, and
every value is filled in once for each value connected to it. This is how to
write several prompt templates in one place and fill them all from the same
inputs.

## Use it when

- Supplying a handful of inputs to a prompt: questions, texts, names.
- Writing several prompt templates to compare, when they'll be filled from
  shared inputs and sent through one Prompt Node.

## Don't use it for

- Large datasets, or rows where several columns belong together (an input and
  its expected answer). That's the Tabular Data Node, which ChainBuddy doesn't
  support yet.

## Inputs

One input per `{variable}` found in any value, named after the variable.
Each accepts `values`, such as another TextFields Node's.

## Outputs

- `values`: the enabled values, filled in if they contain variables.

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

Two prompt templates, both filled from a second TextFields Node connected to
`text`, then sent through one Prompt Node whose prompt is just `{prompt}`.

```yaml
title: Prompt templates
values:
  - "Summarize this in one sentence: {text}"
  - "Summarize this in one sentence a ten-year-old would understand: {text}"
```

## Watch out for

- **Braces make variables.** Any `{word}` in a value creates an input. Write
  `\{` and `\}` for literal braces, such as in example JSON.
- **Empty values are still sent.** An empty value becomes an empty input
  downstream. Remove it rather than leaving it blank.
- **Each value multiplies the calls downstream.** Five values into a Prompt
  Node with two models is ten calls, before responses per prompt.
- **Keep variable names unique along a chain**, ignoring case. See the Prompt
  Node's file.
- **For comparing prompt wordings**, listing prompts in the Prompt Node itself
  is usually simpler. Use templates here when the same templates are reused
  across several Prompt Nodes.
