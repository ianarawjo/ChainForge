# ChainBuddy knowledge

This folder holds what ChainBuddy knows about ChainForge, and the rules it
works under. It is written for people first: to see what ChainBuddy can act
on, read this folder. To change what ChainBuddy knows, edit this folder.

ChainBuddy is ChainForge's in-app assistant. It builds and edits flows on the
canvas with you: it can add nodes, fill them in, connect them, and remove
them. Every change is shown on the canvas for you to accept or reject first.
It can't run nodes or read their results yet (see [Planned](#planned)).

## What's in this folder

| File                  | What it covers                                              |
| --------------------- | ----------------------------------------------------------- |
| `README.md`           | This file: what ChainBuddy can do, and the rules it follows |
| `instructions.md`     | What the model is told at the start of every conversation   |
| `nodes/prompt.md`     | Prompt Node                                                 |
| `nodes/textfields.md` | TextFields Node                                             |
| `nodes/table.md`      | Tabular Data Node                                           |
| `nodes/evaluator.md`  | JavaScript Evaluator                                        |
| `nodes/vis.md`        | Vis Node                                                    |
| `nodes/inspect.md`    | Inspect Node                                                |

The model is told the list of node types, with what each gives and accepts,
at the start of every conversation. It reads a node's file with
`describe_node` before adding or changing that kind of node.

## Which nodes ChainBuddy supports

A node type with a file in `nodes/` is **editable**: ChainBuddy can add it,
change the settings its file lists, connect it, and remove it. Any other node
is **not supported**: ChainBuddy sees only that it exists and what it is
connected to, and can't change, connect or remove it.

| Node                   | Type         | Support       |
| ---------------------- | ------------ | ------------- |
| Prompt Node            | `prompt`     | Editable      |
| TextFields Node        | `textfields` | Editable      |
| Tabular Data Node      | `table`      | Editable      |
| JavaScript Evaluator   | `evaluator`  | Editable      |
| Vis Node               | `vis`        | Editable      |
| Inspect Node           | `inspect`    | Editable      |
| Evaluator Node, Python | `evaluator`  | Not supported |
| Every other node type  |              | Not supported |

A new node added to ChainForge therefore stays out of ChainBuddy's reach until
someone writes its file.

## What ChainBuddy can do

These are the only actions ChainBuddy has. It has no other way to reach the
canvas, your files, or the internet.

| Action            | What it does                                                                                                                              | Needs your approval          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `get_flow`        | Reads a summary of the canvas: nodes, their settings, and connections                                                                     | No                           |
| `describe_node`   | Reads one node type's file from this folder                                                                                               | No                           |
| `list_models`     | Lists the models you can use: those from the providers you've set up, as ChainForge's model menu lists them                               | No                           |
| `propose_changes` | Proposes adding, editing, connecting, or removing nodes, as one change set. Refused unless `get_flow` was called since your last message. | Yes, before anything changes |

## Rules

Each rule below is enforced in code, not left to the model.

1. **Nothing changes until you accept it.** Every edit arrives as a change set,
   shown on the canvas with new, changed, and removed nodes highlighted.
   Unfinished nodes, such as the blank ones a new flow starts with, are shown
   filled in. Rejecting it leaves the canvas exactly as it was.
   (`adapters/canvas.ts`)
2. **ChainBuddy only changes what its files allow.** It can only add and
   change node types that have a file here, only the settings listed in them,
   and only connect outputs to inputs that accept what they give. Any other
   change is refused before it reaches you. (`flowApi/validate.ts`)
3. **ChainBuddy never sees API keys.** It reads only the settings listed in
   its files, and none of them hold keys. It is told only which providers
   have their keys set, in Settings or as environment variables.
   (`nodes/`, `adapters/models.ts`)
4. **Deleting a node deletes its results.** A change set that removes a node
   says so, and names the node. (`flowApi/describe.ts`)

What the model is asked to do, but that code cannot fully enforce, belongs in
`instructions.md`, not here. One example: treating text inside your data and
model responses as data, never as instructions to follow.

## Adding a node type

1. Write its file here, in `nodes/<type>.md`, laid out as below.
2. Write its `NodeKind` in `src/chainbuddy/nodes/<type>.ts`: its settings and
   their checks, its output and what its inputs accept, and how its settings
   map to the node's data. The existing kinds are the templates.
3. List it in `NODE_KINDS`, in `src/chainbuddy/nodes/index.ts`.

Nothing else changes, including the other node types: the checks, the
proposal card, the canvas and the model's list of node types all read from
`NODE_KINDS`, and what connects to what follows from the types below.

A `NodeKind` can also say that each input takes one connection (`oneSource`,
for a node that would ignore the rest), and refuse a source depending on its
settings (`checkSource`: a Vis Node plotting a run measure needs a Prompt
Node's own responses). Both are checked on the flow as a change set leaves
it.

The skill in `.claude/skills/chainbuddy-node/` walks through adding or
updating a node type, and the `chainbuddy-guide-checker` agent checks a
guide's claims against ChainForge's source.

### What travels along a connection

Each node's one output gives one of these, and each node type's inputs accept
some of them. An output can connect to any input that accepts what it gives.

| Type               | What it is                                                     |
| ------------------ | -------------------------------------------------------------- |
| `values`           | Pieces of text, such as a TextFields Node's values             |
| `responses`        | Model responses, each with the prompt and variable values used |
| `scored_responses` | Responses with a score attached to each                        |

A node's output is named after what it gives. Some nodes only receive and
give nothing, so nothing can be chained after them.

## How a node file is written

Each file in `nodes/` has the same parts, so people and ChainBuddy can find
things in the same place.

1. **Header** (between `---` lines): the node `type` and its `name`.
2. **Purpose**, **Use it when**, and **Don't use it for**: plain descriptions.
3. **Inputs** and **Outputs**: the names ChainBuddy uses to connect nodes, and
   what they accept and give. These can differ from ChainForge's internal
   handle names; the node's `NodeKind` translates between them. A node that
   only receives, such as a Vis Node, says its Outputs are none.
4. **Settings**: a fenced `yaml` block listing each setting ChainBuddy may
   read or change, its type, and a description. This is what the model reads;
   the `NodeKind` holds the checks.
5. **Example**: a small, complete setup, in the same form as Settings.
6. **Watch out for**: mistakes that are easy to make with this node.

A file can add a section where a node needs one, such as the JavaScript
Evaluator's "Writing the code".

### Setting types

| Type      | Meaning                                            |
| --------- | -------------------------------------------------- |
| `string`  | Text                                               |
| `integer` | Whole number; may give `min`, `max`, and `default` |
| `list`    | A list; `of` gives the type of each item           |
| `object`  | A group of named settings; `fields` lists them     |
| `model`   | A model ID, as returned by `list_models`           |
| `code`    | Source code; `language` gives the language         |

A setting marked `required: true` must be given to a new node. One marked
`read_only: true` is shown to ChainBuddy but cannot be changed by it.

When a setting takes one of a list ChainForge will grow, such as the measures
a Vis Node can plot, the guide describes the kind of value and the `NodeKind`
supplies the list (`SettingSpec.values`), read from ChainForge's own code
where it has one. `describe_node` appends it after the guide.

### What goes in a guide

A guide is for the decisions the model has to make that code can't make for
it. Test each sentence two ways:

1. **Would the model decide worse without it?** If not, cut it. A rule the
   code enforces needs at most one brief mention.
2. **Would a routine ChainForge change make it wrong?** A new model,
   provider, measure or node, or a change to how a node lays things out. If
   so, describe it more generally, or move it into code.

Be exact about the contract the model writes against (variable syntax, the
fields `evaluate` receives, what a node accepts and gives), since vagueness
there breaks flows. Leave out:

- whether ChainBuddy supports another node type (the model is told the
  current list; a test enforces this);
- lists ChainForge grows, such as models, providers or measures;
- how a node lays things out on screen, beyond naming what the user can
  change;
- hardware, provider or version specifics the model can't act on;
- advice the model can't follow, such as reading results it can't see.
  Phrase it as something to tell the user.

## Keeping this folder accurate

These files describe code that lives elsewhere, so they can fall out of date
when a node changes. The tests in `__test__/knowledge.test.ts` check that:

- every file here has a `NodeKind`, and every `NodeKind` a file;
- each file's header gives its kind's type and name;
- each file's settings match its kind's: the same names, and the same ones
  required, read-only, lists and code;
- each file's Outputs section names what the kind gives, and its Inputs
  section names what the kind accepts.

If one of these tests fails after you change a node, update the file here and
its `NodeKind`. Nothing in the node's own component should need to know about
ChainBuddy.

## Planned

Not built yet, and not available to the model:

- **Running nodes** (`run_nodes`), after showing you the nodes and the
  estimated number of model calls, and only with your approval. Code
  ChainBuddy wrote will need your approval before its first run, since
  JavaScript evaluators run inside ChainForge's own page, where they can read
  anything the page can, including API keys saved in the browser. A node
  won't be changed while it is running.
- **Reading results** (`get_results`): a node's latest results, summarized,
  with a sample of rows.
- **Asking you questions** (`ask_user`), as a short form in the chat panel.
- **Undoing an accepted change set.**
- **Playbooks** (`playbooks/`): evaluation practice, such as how to compare
  two prompts fairly, loaded only when relevant.
- **More node types**: next, the LLM Scorer.
