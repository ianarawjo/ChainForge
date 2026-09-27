---
type: table
name: Tabular Data Node
---

# Tabular Data Node

## Purpose

A table of values that belong together by row, typed in or imported from a
file by the user. Each column is an output. A column connected to a prompt
variable fills it row by row, and variables filled from columns of the same
table are filled together: one prompt per row, not every pairing.

Every response also carries the rest of its row. A later prompt can use
another column as `{#column}`, and evaluator code reads it as
`response.meta["column"]`; the connected column itself is in `response.var`,
under the variable's name. This is how each input is checked against its own
expected answer.

## Use it when

- Each input has an expected answer, or other values that belong with it.
- A prompt has several variables whose values belong together, such as a city
  and its country.
- The user has a dataset to run through a flow.

## Don't use it for

- A handful of independent inputs. A TextFields Node is simpler.

## Inputs

None that ChainBuddy connects.

## Outputs

One per column, named after it. Each gives `values`: that column's cells, one
per row. Connect columns to a prompt's own variables.

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
columns:
  type: list
  required: true
  min: 1
  description: >
    The column names, in order. Each must differ from the others.
  of:
    type: string
rows:
  type: list
  required: true
  min: 1
  description: >
    The rows, each mapping column names to text. A column a row leaves out is
    empty in that row.
  of:
    type: object
sample:
  type: integer
  min: 0
  description: >
    Send this many rows, picked at random, instead of all of them. The pick
    stays the same from run to run until the table changes. 0 sends every
    row.
```

## Example

Questions with their expected answers. Only `question` is connected to the
Prompt Node's `{question}`; an evaluator checks each response against
`response.meta["answer"]`.

```yaml
title: Arithmetic
columns: [question, answer]
rows:
  - { question: "What is 2+2?", answer: "4" }
  - { question: "What is 7 times 6?", answer: "42" }
  - { question: "What is 100 divided by 4?", answer: "25" }
```

## Watch out for

- **Don't connect the expected-answer column to the prompt.** The model would
  be shown the answer. Leave it unconnected; it travels with each response
  anyway.
- **Columns from two different tables form every pairing**, like any two
  separate inputs. Values that belong together go in one table, connected
  straight to the prompt: through a TextFields template, the rows can come
  apart.
- **Braces in a cell are text**, never a variable, however the cell is used.
- **To rename a column, give `rows` too**, with its values under the new
  name, and reconnect whatever it fed in the same change set. A column left
  out of `columns` is removed with its values.
- **An imported table can be long.** You're shown only its first rows, and
  can't replace them. Use `sample` to keep runs small.
