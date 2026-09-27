---
type: inspect
name: Inspect Node
---

# Inspect Node

## Purpose

Shows the responses it receives, so the user can read them. It doesn't change
anything or score anything: it is how people look at what their flow produced.

## Use it when

- The user wants to read responses, not just plot them.
- A flow ends in a Prompt Node or an evaluator with nothing to view the
  results in. One Inspect Node at the end makes the flow usable.

## Don't use it for

- Plotting scores, latency or cost. That's the Vis Node.
- Scoring responses. That's the JavaScript Evaluator.

## Inputs

- `responses`: what to show. Accepts `responses` and `scored_responses`, and
  several nodes can feed the same Inspect Node.

## Outputs

None. Nothing can be connected after an Inspect Node.

## Settings

```yaml
title:
  type: string
  description: Name shown at the top of the node.
view:
  type: string
  description: >
    How responses are laid out: "grouped" (grouped by prompt and model),
    "table" (one row per response), or "grid" (side by side). Defaults to
    grouped, which suits most flows.
```

## Example

```yaml
title: Read the answers
view: table
```

## Watch out for

- **One at the end is usually enough.** Several Inspect Nodes on the same
  responses only repeat each other.
- **It shows whatever it's given.** Connecting it after an evaluator shows the
  scores alongside the responses, which is usually what the user wants.
- **The user can switch the view themselves** with the tabs in the node, so
  leave `view` alone unless they asked for a particular one.
