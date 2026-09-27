/**
 * ChainBuddy's tools: the only ways it can reach the canvas. See the actions
 * table in knowledge/README.md.
 */

import { AgentTool } from "../runtime/tools";
import { editableTypes, kindOf, NODE_KINDS } from "../nodes";
import { CanvasPort, FlowView } from "./types";
import { checkChanges, LIST_LIMIT } from "./validate";

export interface FlowToolsOptions {
  canvas: CanvasPort;
  /** Node type → its guide. Defaults to each NodeKind's doc. */
  nodeDocs?: Record<string, string>;
}

export interface FlowTools {
  tools: AgentTool[];
  /**
   * Call when the user sends a message. The canvas may have changed since
   * ChainBuddy last looked, so propose_changes refuses until get_flow has
   * been called again.
   */
  startTurn(): void;
}

export function createFlowTools({
  canvas,
  nodeDocs = Object.fromEntries(NODE_KINDS.map((k) => [k.type, k.doc])),
}: FlowToolsOptions): FlowTools {
  const types = editableTypes();
  let readThisTurn = false;
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
        const doc = nodeDocs[args.type as string];
        if (!doc) throw new Error(`There's no guide for "${args.type}".`);
        return doc + settingValues(args.type as string);
      },
    },
    {
      name: "list_models",
      description:
        "Lists the models a Prompt Node can use right now, from the providers the user has set up, with the IDs to put in its models setting. Also names the providers that aren't set up.",
      parameters: { type: "object", properties: {} },
      run: () => {
        const models = canvas.listModels();
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
        return {
          models: offered.map(({ id, name, provider }) => ({
            id,
            name,
            provider,
          })),
          not_set_up: notSetUp,
          note:
            offered.length === 0
              ? "No models are set up. Ask the user to add an API key in Settings, or to start Ollama."
              : preferred.length === 0
                ? "Only small models that run in the browser are set up. Say so, and that adding an API key in Settings gives more capable ones."
                : "Use these. If the user asks for a provider in not_set_up, say it needs its API key added in Settings, rather than substituting another.",
        };
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
      run: (args) => {
        if (!readThisTurn)
          return {
            status: "invalid",
            problems: [
              "Call get_flow first. The canvas may have changed since you last read it, for example if the user opened another flow or edited it.",
            ],
            note: "Nothing was shown to the user.",
          };
        const { problems, changes } = checkChanges(
          canvas.readFlow(),
          args.changes as Record<string, unknown>[],
          canvas.listModels(),
        );
        if (problems.length > 0)
          return {
            status: "invalid",
            problems,
            note: "Nothing was shown to the user. Fix the problems and call propose_changes again with the full list.",
          };
        const receipt = canvas.propose({
          summary: args.summary as string,
          changes,
        });
        return {
          status: "awaiting_approval",
          change_set_id: receipt.id,
          ...(receipt.replaced ? { replaced: receipt.replaced } : {}),
          note: "Shown to the user on the canvas. Nothing has changed yet, and nothing will run.",
        };
      },
    },
  ];
  return {
    tools,
    startTurn: () => {
      readThisTurn = false;
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
