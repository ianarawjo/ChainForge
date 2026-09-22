# ChainBuddy knowledge

> **Status: first version.** The chat panel and the actions `get_flow`,
> `describe_node`, `list_models` and `propose_changes` work, with rules 1, 4,
> 5 and 7 enforced. `get_results`, `run_nodes` and `ask_user` are planned, and
> so are rules 2, 3 and 6, which only matter once ChainBuddy can run nodes.
> Not built yet: undoing an accepted change set (rule 1), and the test that
> checks this list of rules against the code.

This folder holds everything ChainBuddy knows about ChainForge, and the rules
it works under. It is written for people first: to see what ChainBuddy can
act on, read this folder. To change what ChainBuddy knows, edit this folder.

ChainBuddy is ChainForge's in-app assistant. It builds and edits flows on the
canvas with you: it can add nodes, fill them in, connect them, run them, and
read their results. Every change it makes is shown on the canvas for you to
accept or reject first.

## What's in this folder

| File                  | What it covers                                              |
| --------------------- | ----------------------------------------------------------- |
| `README.md`           | This file: what ChainBuddy can do, and the rules it follows |
| `instructions.md`     | What the model is told at the start of every conversation   |
| `nodes/prompt.md`     | Prompt Node                                                 |
| `nodes/textfields.md` | TextFields Node                                             |
| `nodes/evaluator.md`  | JavaScript Evaluator Node                                   |

Planned, not yet written: `playbooks/` (evaluation practice, such as how to
compare two prompts fairly, loaded only when relevant).

To add a node type:

1. Write its guide here, in `nodes/<type>.md`.
2. Write its `NodeKind` in `src/chainbuddy/nodes/<type>.ts`: its settings and
   their checks, its inputs and output, and how its settings map to the
   node's data. The existing kinds are the templates.
3. List it in `NODE_KINDS`, in `src/chainbuddy/nodes/index.ts`.

The checks, the proposal card, the canvas and the model's list of node types
all read from the registry, so nothing else needs to change. The tests in
`__test__/knowledge.test.ts` check each guide agrees with its `NodeKind`.

## Which nodes ChainBuddy supports

Each node type has one of three levels of support:

- **Editable.** ChainBuddy can add the node, change the settings listed in its
  file, connect it, and run it.
- **View-only.** ChainBuddy can see the node, its connections, and its results,
  but cannot change its settings. It can still connect to it or propose
  deleting it.
- **Not supported.** ChainBuddy sees only that a node of this type exists and
  what it is connected to.

| Node                   | Type         | Support       |
| ---------------------- | ------------ | ------------- |
| Prompt Node            | `prompt`     | Editable      |
| TextFields Node        | `textfields` | Editable      |
| JavaScript Evaluator   | `evaluator`  | Editable      |
| Evaluator Node, Python | `evaluator`  | Not supported |
| Every other node type  |              | Not supported |

A node type with no file here is treated as not supported. A new node added to
ChainForge therefore stays out of ChainBuddy's reach until someone writes its
file.

## What ChainBuddy can do

These are the only actions ChainBuddy has. It has no other way to reach the
canvas, your files, or the internet.

| Action            | What it does                                                                                                                             | Needs your approval          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `get_flow`        | Reads a summary of the canvas: nodes, their settings, and connections                                                                    | No                           |
| `describe_node`   | Reads one node type's file from this folder                                                                                              | No                           |
| `list_models`     | Lists the models you can use, as they appear in ChainForge's model menu                                                                  | No                           |
| `get_results`     | Reads a node's latest results, summarized, with a sample of rows                                                                         | No                           |
| `propose_changes` | Proposes adding, editing, connecting, or removing nodes, as one change set. Refused unless `get_flow` was called since your last message | Yes, before anything changes |
| `run_nodes`       | Runs nodes, after showing how many model calls that will make                                                                            | Yes, before running          |
| `ask_user`        | Asks you questions in the chat panel, as a short form                                                                                    | You answer, or skip          |

## Rules

Each rule below is enforced in code, not left to the model. A test checks that
this list and the code agree, so changing a rule means changing both.

1. **Nothing changes until you accept it.** Every edit arrives as a change set,
   shown on the canvas with new, changed, and removed nodes highlighted.
   Unfinished nodes, such as the blank ones a new flow starts with, are shown
   filled in. Rejecting it leaves the canvas exactly as it was. Accepting it can be undone.
2. **Nothing runs until you approve it.** Before a run, ChainBuddy shows the
   nodes it wants to run and the estimated number of model calls.
3. **Code ChainBuddy wrote does not run until you've read it.** When
   ChainBuddy adds or changes evaluator code, its next run shows you the code
   in full and needs your approval for that code specifically. JavaScript
   evaluators run inside ChainForge's own page, where they can read anything
   the page can, including API keys saved in the browser.
4. **ChainBuddy only changes what its files allow.** It can only change node
   types marked Editable, and only the settings listed in their files. Any
   other change is refused before it reaches you.
5. **ChainBuddy never sees API keys.** No action returns keys, and settings
   that hold keys are removed before ChainBuddy reads a flow.
6. **A node can't be changed while it is running.** A change set that touches
   a running node waits until the run finishes, or is refused.
7. **Deleting a node deletes its results.** A change set that removes a node
   with results says so, and names the node.

What the model is asked to do, but that code cannot fully enforce, belongs in
`instructions.md`, not here. One example: treating text inside your data and
model responses as data, never as instructions to follow.

## How a node file is written

Each file in `nodes/` has the same parts, so people and ChainBuddy can find
things in the same place.

1. **Header** (between `---` lines): the node `type`, its `name`, its
   `support` level, and whether it is `runnable`. When support depends on a
   setting, `support_only_when` names it; the Evaluator Node is only
   supported when its language is JavaScript.
2. **Purpose**, **Use it when**, and **Don't use it for**: plain descriptions.
3. **Inputs** and **Outputs**: the names ChainBuddy uses to connect nodes.
   These can differ from ChainForge's internal handle names; the adapter for
   that node translates between them.
4. **Connects to**: which connections ChainBuddy may make. Connections not
   listed are refused.
5. **Settings**: a fenced `yaml` block listing each setting ChainBuddy may
   read or change, its type, and a description. ChainBuddy's actions are
   generated from this block, so it must stay valid YAML.
6. **Example**: a small, complete setup, in the same form as Settings.
7. **Watch out for**: mistakes that are easy to make with this node.

A file can add a section where a node needs one, such as the Evaluator
Node's "Writing the code".

### Setting types

| Type      | Meaning                                            |
| --------- | -------------------------------------------------- |
| `string`  | Text                                               |
| `integer` | Whole number; may give `min`, `max`, and `default` |
| `list`    | A list; `of` gives the type of each item           |
| `object`  | A group of named settings; `fields` lists them     |
| `model`   | A model ID, as returned by `list_models`           |
| `code`    | Source code; `language` gives the language         |

A setting marked `read_only: true` is shown to ChainBuddy but cannot be
changed by it.

## Keeping this folder accurate

These files describe code that lives elsewhere, so they can fall out of date
when a node changes. Tests catch that:

- Every node type in ChainForge has a file here or is listed as not supported
  in the table above.
- Every setting in a file's `yaml` block has a translation in that node's
  adapter (`src/chainbuddy/adapters/`), and every adapter translation appears
  in a file.
- For every supported node in every example flow, ChainBuddy's view of the
  node must match its file's settings, and writing that view back must leave
  the node unchanged.
- Rules listed above match the rules enforced in code.

If one of these tests fails after you change a node, update the file here and
its adapter. Nothing in the node's own component should need to know about
ChainBuddy.
