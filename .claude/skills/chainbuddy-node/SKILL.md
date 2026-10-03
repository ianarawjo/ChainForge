---
name: chainbuddy-node
description: Add a ChainForge node type to ChainBuddy, or update one after ChainForge changes that node. Use when writing or changing a NodeKind in chainforge/react-server/src/chainbuddy/nodes/, or a node guide in chainforge/react-server/src/chainbuddy/knowledge/nodes/.
---

# Adding or updating a ChainBuddy node type

ChainBuddy knows a node type through two files: a `NodeKind` (code:
settings, checks, how settings map to the node's data) and a guide (Markdown
the model reads through `describe_node`). Read
`chainforge/react-server/src/chainbuddy/knowledge/README.md` first. It sets
out the guide's layout and **what goes in a guide**; this skill doesn't
repeat them.

The goal is a guide specific enough to build correct flows and general
enough to stay true as ChainForge changes. Most mistakes come from writing
about a node from memory, or from one reading of its component.

## 1. Investigate the node in ChainForge's source

Don't rely on what the node looks like in the UI. Find, and note with
file:line:

- **Its data:** the fields it keeps in node data, which ones the user sets
  through the UI, and which the node **recomputes, overwrites or clears**
  itself (look for effects and "reset" routines that call
  `setDataPropsForNode`). Only fields the user sets and the node leaves
  alone can be settings.
- **Its handles:** the target and source handle ids. A node with no source
  handle has no output.
- **What connecting does:** what `onConnect` in `store.tsx` does for its type
  (ChainBuddy connects through it), and whether it reads one input or all.
- **What it needs to show anything:** what must run upstream first, and what
  survives passing through it (variables, scores, recorded measures).

An Explore agent is a good fit for this. Give it these questions.

## 2. Decide how it connects

- `output`: the `DataType` it gives, or none. `accepts`: the ones its inputs
  take. Add a `DataType` only if the new node carries something different in
  kind from the existing ones.
- `oneSource`, if the node would ignore a second connection.
- `checkSource`, if what it can take depends on a setting.

## 3. Decide its settings

- Expose what a user would ask for, from the fields found in step 1.
- Name settings and their values in ChainBuddy's terms, never the node's
  internal keys (`latency`, not `__stat_latency_s`), and translate in
  `read`/`write`.
- If a setting takes one of a list ChainForge grows, supply it with
  `values()`, read from ChainForge's own code where it has the list. The
  guide then describes the kind of value, and never lists them.
- Leave out fields that hold code the node would run or that replace its
  normal behaviour, unless that is the point.

## 4. Write the NodeKind and register it

Write it in `nodes/<type>.ts`, using the existing kinds as templates, and add
it to `NODE_KINDS` in `nodes/index.ts`. `read` then `write` must leave the
node's data as it was.

## 5. Write the guide

Write it in `knowledge/nodes/<type>.md`, laid out as the README says. Test
every sentence against the README's two questions. Be exact about the
contract (syntax, fields, what it accepts and gives), and general about
everything ChainForge will change. Never say whether ChainBuddy supports
another node type.

## 6. Fact-check the guide

Run the `chainbuddy-guide-checker` agent on the guide. Fix every claim it
marks FALSE or PARTLY TRUE. For each behaviour it says is missing, apply the
two questions before adding it; many are real but too specific to belong.

## 7. Test

- `__test__/knowledge.test.ts` checks the guide against the kind with no
  changes needed.
- In `__test__/kindData.test.ts`, add the node's managed data fields to
  `MANAGED`. The round-trip test then runs over every such node in
  `chainforge/examples/`. Add a test for any translation of names.
- In `__test__/flowApi.test.ts`, add a test for any `oneSource` or
  `checkSource`.
- Add a scenario to `__test__/liveAgent.test.ts` where the model should
  choose this node without being told to, and run it:
  `CHAINBUDDY_LIVE=openrouter:anthropic/claude-haiku-4.5 npx craco test --watchAll=false liveAgent`.
  Read the transcript, not just the result: live runs are how a flow that
  validates but is wrong (an answer leaked into the prompt, a node the model
  shouldn't have needed) gets found.

## 8. Check it in the app

Propose, accept and reject the node in the running app. After accepting, it
should behave as if the user had built it by hand.

Finally, add the node to the tables in `knowledge/README.md`.

## When ChainForge changes a node ChainBuddy supports

Repeat step 1 for what changed, run the checker on its guide, and run the
tests. The round-trip test fails when the node's data changes shape.
