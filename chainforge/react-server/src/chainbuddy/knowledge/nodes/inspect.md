---
type: inspect
name: Inspect Node
---

# Inspect Node

## Purpose

Shows the responses it receives, so the user can read them. It doesn't change
or score anything. Prompt Nodes and evaluators can show their own results
too; an Inspect Node keeps them open on the canvas.

## Use it when

- The user wants to read responses, not just plot them.
- Putting the responses of several nodes in one place.

## Don't use it for

- Plotting scores, latency or cost. That's the Vis Node.
- Scoring responses. That's an evaluator.

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
    Which of the node's views to open on (listed below). Leave it unset
    unless the user asks for one; they can switch views in the node.
```

## Example

```yaml
title: Read the answers
view: table
```

## Watch out for

- **One at the end is usually enough.** Several Inspect Nodes on the same
  responses only repeat each other.
- **After an evaluator it shows the scores too**, alongside the responses,
  which is usually what the user wants.
- **It shows what the nodes before it last produced.** It shows nothing until
  they have run, and doesn't run them itself.
