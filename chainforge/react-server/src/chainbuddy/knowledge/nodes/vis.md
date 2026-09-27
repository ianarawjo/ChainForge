---
type: vis
name: Vis Node
---

# Vis Node

## Purpose

Plots one measure of the responses it receives, grouped by model or by a
variable. The measure can be an evaluator's score, or something ChainForge
recorded while running the prompts, such as latency or cost.

## Use it when

- Showing how models compare on an evaluator's scores.
- Comparing models or prompts on speed, cost, tokens or energy, with no
  evaluator in the flow at all.

## Don't use it for

- Reading the responses themselves. That's the Inspect Node.
- Working out a score. A Vis Node only plots what it's given.

## Inputs

- `responses`: what to plot. Accepts `responses` and `scored_responses`.
  Scores come from an evaluator; the run measures come with any responses.

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
    What to plot. Either "score" (the evaluator's score), or one of the
    measures ChainForge records: "latency", "time_before_output",
    "input_tokens", "output_tokens", "speed", "decoding_speed", "cost",
    "energy_measured", "energy_estimated". An evaluator that returns an
    object may also be plotted by one of its keys, given as that key.
chart:
  type: string
  description: >
    "bar" for a bar chart of means, or "box" for a box plot showing the
    spread. Default "bar". A box plot needs several responses per prompt to
    say anything.
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
- **A measure the responses don't have is dropped**, and the node plots
  whatever it does have instead. `energy_measured` exists only for local
  Ollama models on Apple silicon, and `energy_estimated` only for models
  ChainForge has estimates for.
- **A box plot of one response per prompt** shows a flat line. Raise the
  Prompt Node's responses per prompt first, which costs that many more calls.
- **The node picks its own grouping**, and the user can change the axes and
  the grouping in the node. Don't promise a particular layout.
- **Scores that aren't numbers** (true/false, or short strings) are always
  drawn as bars, whatever `chart` says.
