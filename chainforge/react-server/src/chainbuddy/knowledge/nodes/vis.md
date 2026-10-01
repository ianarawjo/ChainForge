---
type: vis
name: Vis Node
---

# Vis Node

## Purpose

Plots one measure of the responses from one node, grouped by model or by a
variable. The measure can be an evaluator's score, or something ChainForge
recorded while running the prompts, such as latency or cost.

## Use it when

- Showing how models or prompts compare on an evaluator's scores.
- Comparing models or prompts on speed, cost, tokens or energy, with no
  evaluator in the flow at all.

## Don't use it for

- Reading the responses themselves. That's the Inspect Node.
- Working out a score. A Vis Node only plots what it's given.

## Inputs

- `responses`: what to plot. Accepts `responses` and `scored_responses`, from
  one node only; for two sources, use two Vis Nodes. Scores come from an
  evaluator. The measures ChainForge records are on a Prompt Node's own
  responses only, so plotting one means connecting straight to the Prompt
  Node.

## Outputs

None. Nothing can be connected after a Vis Node.

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
metric:
  type: string
  description: >
    What to plot: "score" for an evaluator's score, one of the measures
    ChainForge records while running prompts (listed below), or one of an
    evaluator's own keys when it returns an object.
chart:
  type: string
  description: >
    How to draw numbers: "bar" (the default), or a chart that shows how the
    values spread, from those listed below. A violin or density gradient
    needs many values per group; with few, it's drawn as a box plot.
```

## Example

Comparing how long each model took, with no evaluator in the flow.

```yaml
title: Speed by model
metric: latency
chart: box
```

## Watch out for

- **Plot what the user asked about.** "Which model is best" usually needs an
  evaluator and `score`; "which is cheapest or fastest" needs `cost` or
  `latency` and no evaluator.
- **Some measures are recorded for some models only**, energy especially.
  When the responses lack the chosen measure, the node plots one they have
  instead.
- **Scores that aren't numbers** (true/false, or short strings) are drawn as
  bars, whatever `chart` says.
- **The user can change the axes and grouping in the node.** Don't promise a
  particular layout.
