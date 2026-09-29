/**
 * ChainBuddy's tools: the only ways it can reach the canvas. See the actions
 * table in knowledge/README.md.
 */

import { AgentTool } from "../runtime/tools";
import { editableTypes, kindOf, NODE_KINDS } from "../nodes";
import { ProposalReview, Reviewer } from "./review";
import { CanvasPort, Change, FlowView } from "./types";
import { checkChanges, LIST_LIMIT } from "./validate";

/** A proposal touching this many nodes needs its approach shared first. */
export const APPROACH_AT = 3;
/** The longest approach, in characters: a sentence or two. */
export const APPROACH_MAX = 400;

export interface FlowToolsOptions {
  canvas: CanvasPort;
  /** Node type → its guide. Defaults to each NodeKind's doc. */
  nodeDocs?: Record<string, string>;
  /** Checks each proposal before the user sees it. None: proposals go straight to the canvas. */
  review?: Reviewer;
  /** Shows the user the approach ChainBuddy shares before a larger proposal. */
  showApproach?: (approach: string) => void;
}

export interface FlowTools {
  tools: AgentTool[];
  /**
   * Call when the user sends a message, with what they've asked for so far
   * (their messages), which a review of a proposal checks against. The canvas
   * may have changed since ChainBuddy last looked, so propose_changes refuses
   * until get_flow has been called again, and a larger proposal until the
   * approach has been shared again.
   */
  startTurn(request?: string): void;
}

export function createFlowTools({
  canvas,
  nodeDocs = Object.fromEntries(NODE_KINDS.map((k) => [k.type, k.doc])),
  review,
  showApproach,
}: FlowToolsOptions): FlowTools {
  const types = editableTypes();
  let readThisTurn = false;
  let request = "";
  // The approach shared this turn, which a larger proposal needs.
  let approach: string | undefined;
  // Problems a review sent back this turn. Only the first review's go back
  // to the model; later ones are shown to the user on the card.
  let sentBack: string[] | undefined;
  const guide = (type: string) => (nodeDocs[type] ?? "") + settingValues(type);
  const tools: AgentTool[] = [
    {
      name: "get_flow",
      description:
        "Reads the flow on the canvas: its nodes with their settings, inputs and outputs, and the connections between them. Nodes ChainBuddy doesn't support show only their type and title. Call it at the start of every request: the canvas may have changed.",
      parameters: { type: "object", properties: {} },
      run: () => {
        readThisTurn = true;
        return shortened(canvas.readFlow());
      },
    },
    {
      name: "describe_node",
      description:
        "Reads the guide for one node type: what it's for, its inputs and outputs, what it connects to, and the settings you may change.",
      parameters: {
        type: "object",
        required: ["type"],
        properties: { type: { type: "string", enum: types } },
      },
      run: (args) => {
        if (!nodeDocs[args.type as string])
          throw new Error(`There's no guide for "${args.type}".`);
        return guide(args.type as string);
      },
    },
    {
      name: "list_models",
      description:
        "Lists the models a Prompt Node or an LLM Scorer can use right now, from the providers the user has set up, with the IDs to put in their settings. Also names the providers that aren't set up.",
      parameters: { type: "object", properties: {} },
      run: () => {
        const all = canvas.listModels();
        // Judge-only models are listed apart, for LLM Scorers.
        const judgesOnly = all.filter((m) => m.judgeOnly && m.ready);
        const defaultJudge = judgesOnly.find((m) => m.defaultJudge);
        const models = all.filter((m) => !m.judgeOnly);
        const ready = models.filter((m) => m.ready);
        // Small in-browser models only when there's nothing else.
        const preferred = ready.filter((m) => !m.fallback);
        const offered = preferred.length > 0 ? preferred : ready;
        const setUp = new Set(ready.map((m) => m.provider));
        const notSetUp = Array.from(
          new Set(
            models.filter((m) => !setUp.has(m.provider)).map((m) => m.provider),
          ),
        );
        // Named, though not offered, so they can be used when asked for.
        const inBrowser = ready.filter(
          (m) => m.fallback && !offered.includes(m),
        );
        return {
          models: offered.map(({ id, name, provider }) => ({
            id,
            name,
            provider,
          })),
          ...(inBrowser.length > 0
            ? {
                in_browser: inBrowser.map(({ id, name }) => ({ id, name })),
              }
            : {}),
          ...(judgesOnly.length > 0
            ? {
                judges_only: judgesOnly.map(({ id, name }) => ({ id, name })),
              }
            : {}),
          ...(defaultJudge ? { default_judge: defaultJudge.id } : {}),
          not_set_up: notSetUp,
          note:
            offered.length === 0
              ? "No models are set up. Ask the user to add an API key in Settings, or to start Ollama."
              : preferred.length === 0
                ? "Only small models that run in the browser are set up. Say so, and that adding an API key in Settings gives more capable ones."
                : `Use these. in_browser lists small models that run in the browser: use one only if the user asks for it.${judgesOnly.length > 0 ? ` judges_only lists models that only judge responses, as an LLM Scorer's judges${defaultJudge ? "; a new LLM Scorer given no judges gets default_judge" : ""}.` : ""} If the user asks for a provider in not_set_up, say it needs its API key added in Settings, rather than substituting another.`,
        };
      },
    },
    {
      name: "share_approach",
      description: `Tells the user the approach you'll take, in a sentence or two of plain language: the idea of what you'll build, not its details. The user sees it as a note in the chat, so don't also write it out. Required before proposing changes to ${APPROACH_AT} or more nodes, such as a new flow. It doesn't end your turn: go on and build it.`,
      parameters: {
        type: "object",
        required: ["approach"],
        properties: {
          approach: {
            type: "string",
            description:
              "One or two short sentences in plain words, without node IDs, setting names or code.",
          },
        },
      },
      run: (args) => {
        const text = String(args.approach).trim();
        if (!text) throw new Error("The approach is empty.");
        if (text.length > APPROACH_MAX)
          throw new Error(
            `Keep the approach to a sentence or two, at most ${APPROACH_MAX} characters; it has ${text.length}.`,
          );
        approach = text;
        showApproach?.(text);
        return "Shown to the user. Now build it: propose the changes that carry it out.";
      },
    },
    {
      name: "propose_changes",
      description:
        "Proposes changes to the flow as one change set. The user sees them on the canvas and accepts or rejects them; nothing changes until they accept. A new proposal replaces one still waiting.",
      parameters: {
        type: "object",
        required: ["summary", "changes"],
        properties: {
          summary: {
            type: "string",
            description:
              "One or two sentences for the user: what these changes do and why.",
          },
          changes: {
            type: "array",
            description: "The changes, applied in order.",
            items: {
              type: "object",
              required: ["op"],
              properties: {
                op: {
                  type: "string",
                  enum: ["add_node", "update_node", "connect", "remove_node"],
                },
                ref: {
                  type: "string",
                  description:
                    "add_node only: a short name for the new node, which later changes in this list use in place of an id.",
                },
                type: {
                  type: "string",
                  enum: types,
                  description: "add_node only: the node type.",
                },
                node: {
                  type: "string",
                  description:
                    "update_node and remove_node: the node's id, or the ref of a node added earlier in this list.",
                },
                settings: {
                  type: "object",
                  description:
                    "add_node and update_node: settings, as describe_node lists them. update_node changes only the settings given.",
                },
                from: {
                  type: "object",
                  description: "connect only: the node and its output.",
                  required: ["node", "output"],
                  properties: {
                    node: { type: "string" },
                    output: { type: "string" },
                  },
                },
                to: {
                  type: "object",
                  description: "connect only: the node and its input.",
                  required: ["node", "input"],
                  properties: {
                    node: { type: "string" },
                    input: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      run: (args, { signal }) => {
        if (!readThisTurn)
          return {
            status: "invalid",
            problems: [
              "Call get_flow first. The canvas may have changed since you last read it, for example if the user opened another flow or edited it.",
            ],
            note: "Nothing was shown to the user.",
          };
        const flow = canvas.readFlow();
        const raw = args.changes as Record<string, unknown>[];
        const { problems, changes } = checkChanges(
          flow,
          raw,
          canvas.listModels(),
        );
        const touched = nodesTouched(raw);
        if (approach === undefined && touched >= APPROACH_AT)
          problems.push(
            `These changes touch ${touched} nodes, so first call share_approach to tell the user, in a sentence or two, the approach you'll take.`,
          );
        if (problems.length > 0)
          return {
            status: "invalid",
            problems,
            note: "Nothing was shown to the user. Fix the problems and call propose_changes again with the full list.",
          };
        const changeSet = { summary: args.summary as string, changes };

        const show = (checked?: ProposalReview) => {
          const receipt = canvas.propose(changeSet, checked);
          return {
            status: "awaiting_approval",
            change_set_id: receipt.id,
            ...(receipt.replaced ? { replaced: receipt.replaced } : {}),
            note: "Shown to the user on the canvas. Nothing has changed yet, and nothing will run.",
          };
        };
        if (!review) return show();

        // A second look, before the user sees it.
        return (async () => {
          let found: string[] | undefined;
          try {
            found = await review(
              {
                request,
                approach,
                flow: shortened(flow),
                changeSet,
                guides: Object.fromEntries(
                  typesIn(flow, changes).map((t) => [t, guide(t)]),
                ),
              },
              signal,
            );
          } catch (err) {
            if (signal?.aborted) throw err;
          }
          if (found && found.length > 0 && sentBack === undefined) {
            sentBack = found;
            return {
              status: "needs_changes",
              problems: found,
              note: "A second look at your proposal, before the user saw it, found these problems. Nothing was shown to the user. Fix them and call propose_changes again with the full list. If you're sure one is mistaken, leave it and say why in your reply.",
            };
          }
          return show({
            fixed: sentBack ?? [],
            unresolved: found ?? [],
            ...(found === undefined ? { failed: true } : {}),
          });
        })();
      },
    },
  ];
  return {
    tools,
    startTurn: (userRequest = "") => {
      readThisTurn = false;
      request = userRequest;
      approach = undefined;
      sentBack = undefined;
    },
  };
}

/**
 * The values settings may take, from the node kind rather than its guide, so
 * a list ChainForge grows (such as the measures a Vis Node can plot) reaches
 * the model without anyone editing a guide.
 */
function settingValues(type: string): string {
  const lines = Object.entries(kindOf(type)?.settings ?? {}).flatMap(
    ([name, spec]) =>
      spec.values ? [`- ${name}: ${spec.values().join(", ")}`] : [],
  );
  return lines.length
    ? `\n\n## Values settings take\n\nFrom ChainForge itself, so always current:\n\n${lines.join("\n")}\n`
    : "";
}

/**
 * The flow with long lists cut to their first LIST_LIMIT items, saying how
 * many there are, so a table imported from a file doesn't fill the model's
 * context. Such lists can't be changed (see LIST_LIMIT).
 */
function shortened(flow: FlowView) {
  return {
    ...flow,
    nodes: flow.nodes.map((node) => {
      const long = Object.entries(node.settings ?? {}).filter(
        ([, value]) => Array.isArray(value) && value.length > LIST_LIMIT,
      );
      if (long.length === 0) return node;
      return {
        ...node,
        settings: {
          ...node.settings,
          ...Object.fromEntries(
            long.map(([key, value]) => [
              key,
              (value as unknown[]).slice(0, LIST_LIMIT),
            ]),
          ),
        },
        note: long
          .map(
            ([key, value]) =>
              `${key}: showing the first ${LIST_LIMIT} of ${(value as unknown[]).length}; too long to change.`,
          )
          .join(" "),
      };
    }),
  };
}

/** How many nodes the changes add, update or remove, before they're checked. */
function nodesTouched(changes: Record<string, unknown>[]): number {
  const nodes = new Set<unknown>();
  for (const change of Array.isArray(changes) ? changes : []) {
    if (change?.op === "add_node") nodes.add(change.ref ?? change);
    else if (change?.op === "update_node" || change?.op === "remove_node")
      nodes.add(change.node ?? change);
  }
  return nodes.size;
}

/** The node types a change set adds or touches. */
function typesIn(flow: FlowView, changes: Change[]): string[] {
  const types = new Map(flow.nodes.map((n) => [n.id, n.type]));
  const found = new Set<string>();
  const note = (id: string) => {
    const type = types.get(id);
    if (type) found.add(type);
  };
  for (const change of changes) {
    if (change.op === "add_node") {
      types.set(change.ref, change.type);
      found.add(change.type);
    } else if (change.op === "connect") {
      note(change.from.node);
      note(change.to.node);
    } else note(change.node);
  }
  return Array.from(found).filter((t) => kindOf(t));
}
