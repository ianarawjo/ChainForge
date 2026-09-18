import { describe, expect, test } from "@jest/globals";
import { describeChanges } from "../flowApi/describe";
import { ModelInfo } from "../flowApi/types";
import { AgentTool } from "../runtime/tools";
import {
  createStubTools,
  EXAMPLE_FLOW,
  stubNode,
} from "../prototype/stubTools";

const MODELS: ModelInfo[] = [
  {
    id: "openrouter/anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "OpenRouter",
    ready: true,
  },
  {
    id: "openrouter/openai/gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    provider: "OpenRouter",
    ready: true,
  },
  {
    id: "ollama/qwen3.5:4b",
    name: "qwen3.5:4b",
    provider: "Ollama",
    ready: false,
  },
];

function run(tools: AgentTool[], name: string, args: object = {}) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`No tool ${name}`);
  return tool.run(args as Record<string, unknown>, {}) as Record<string, any>;
}

const propose = (tools: AgentTool[], changes: unknown[]) =>
  run(tools, "propose_changes", { summary: "test", changes });

const newFlow = [
  {
    op: "add_node",
    ref: "facts",
    type: "textfields",
    settings: { values: ["a", "b"] },
  },
  {
    op: "add_node",
    ref: "ask",
    type: "prompt",
    settings: {
      prompts: [{ label: "Plain", text: "Summarize: {fact}" }],
      models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
    },
  },
  {
    op: "add_node",
    ref: "check",
    type: "evaluator",
    settings: { code: "function evaluate(r) { return 1; }" },
  },
  {
    op: "connect",
    from: { node: "facts", output: "values" },
    to: { node: "ask", input: "fact" },
  },
  {
    op: "connect",
    from: { node: "ask", output: "responses" },
    to: { node: "check", input: "responses" },
  },
];

describe("propose_changes", () => {
  test("accepts a complete new flow built from refs", () => {
    const { tools, proposals } = createStubTools({ models: MODELS });
    expect(propose(tools, newFlow)).toMatchObject({
      status: "awaiting_approval",
      change_set_id: "change-set-1",
    });
    expect(proposals[0].changes).toHaveLength(5);
  });

  test("an input an edit adds in the same change set can be connected", () => {
    const { tools } = createStubTools({ flow: EXAMPLE_FLOW, models: MODELS });
    const out = propose(tools, [
      {
        op: "add_node",
        ref: "tone",
        type: "textfields",
        settings: { values: ["formal"] },
      },
      {
        op: "update_node",
        node: "prompt-1",
        settings: {
          prompts: [{ label: "Toned", text: "In a {tone} tone: {text}" }],
        },
      },
      {
        op: "connect",
        from: { node: "tone", output: "values" },
        to: { node: "prompt-1", input: "tone" },
      },
    ]);
    expect(out.status).toBe("awaiting_approval");
  });

  test("rejects model IDs that aren't offered or aren't set up", () => {
    const { tools } = createStubTools({ models: MODELS });
    const withModel = (model: string) =>
      newFlow.map((c) =>
        c.ref === "ask"
          ? { ...c, settings: { ...c.settings, models: [{ model }] } }
          : c,
      );
    expect(
      propose(tools, withModel("openrouter/google/gemma-7b-it")).problems,
    ).toEqual([
      'changes[1] (add_node): "openrouter/google/gemma-7b-it" isn\'t a model ChainForge offers. Call list_models and use an ID from it.',
    ]);
    expect(propose(tools, withModel("ollama/qwen3.5:4b")).problems[0]).toMatch(
      /isn't set up yet \(Ollama/,
    );
  });

  test("a model already in the flow may stay, even if it's not offered", () => {
    const { tools } = createStubTools({ flow: EXAMPLE_FLOW, models: [] });
    const out = propose(tools, [
      {
        op: "update_node",
        node: "prompt-1",
        settings: {
          models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
          responses_per_prompt: 3,
        },
      },
    ]);
    expect(out.status).toBe("awaiting_approval");
  });

  test("says when a new node's input isn't connected", () => {
    const { tools } = createStubTools({ models: MODELS });
    const out = propose(tools, newFlow.slice(0, 4)); // no connection to the evaluator
    expect(out.problems).toEqual([
      'check: nothing is connected to its "responses" input. Connect a Prompt Node\'s responses to it.',
    ]);
    const noVar = propose(
      tools,
      newFlow.filter((c) => !(c.op === "connect" && c.to?.node === "ask")),
    );
    expect(noVar.problems).toEqual([
      'ask: its input "fact" isn\'t connected. Connect a node to it, or take {fact} out of the text.',
    ]);
  });

  test("doesn't blame an edit for inputs that were already unconnected", () => {
    const flow = {
      nodes: [
        stubNode("p", "prompt", "P", {
          prompts: [{ label: "A", text: "Hi {name}" }],
          models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
        }),
      ],
      connections: [],
    };
    const { tools } = createStubTools({ flow, models: MODELS });
    const out = propose(tools, [
      { op: "update_node", node: "p", settings: { title: "Greeting" } },
    ]);
    expect(out.status).toBe("awaiting_approval");
  });

  test("checks each setting's value", () => {
    const { tools } = createStubTools({ flow: EXAMPLE_FLOW, models: MODELS });
    const out = propose(tools, [
      {
        op: "update_node",
        node: "prompt-1",
        settings: { responses_per_prompt: 0 },
      },
      {
        op: "update_node",
        node: "textfields-1",
        settings: { values: ["ok", " "] },
      },
      {
        op: "add_node",
        ref: "e",
        type: "evaluator",
        settings: { code: "return 1;" },
      },
    ]);
    expect(out.problems).toEqual([
      "changes[0] (update_node): responses_per_prompt should be a whole number from 1 to 999.",
      "changes[1] (update_node): values shouldn't include empty text; empty values are still sent downstream.",
      "changes[2] (add_node): code should define function evaluate(response).",
    ]);
  });

  test("won't touch nodes ChainBuddy doesn't support", () => {
    const flow = {
      nodes: [
        ...EXAMPLE_FLOW.nodes,
        {
          id: "vis-1",
          type: "vis",
          title: "Plot",
          support: "not-supported" as const,
          inputs: ["input"],
          outputs: [],
        },
      ],
      connections: EXAMPLE_FLOW.connections,
    };
    const { tools } = createStubTools({ flow, models: MODELS });
    const out = propose(tools, [
      { op: "update_node", node: "vis-1", settings: { title: "x" } },
      { op: "remove_node", node: "vis-1" },
      {
        op: "connect",
        from: { node: "prompt-1", output: "responses" },
        to: { node: "vis-1", input: "input" },
      },
    ]);
    expect(out.problems).toEqual([
      "changes[0] (update_node): vis-1 is a vis node, which ChainBuddy can't edit.",
      "changes[1] (remove_node): vis-1 is a vis node, which ChainBuddy can't change.",
      "changes[2] (connect): vis-1 is a vis node, which ChainBuddy can't connect yet.",
    ]);
  });

  test("a removed node can't be used later in the list", () => {
    const { tools } = createStubTools({ flow: EXAMPLE_FLOW, models: MODELS });
    const out = propose(tools, [
      { op: "remove_node", node: "textfields-1" },
      { op: "update_node", node: "textfields-1", settings: { values: ["x"] } },
    ]);
    expect(out.problems).toEqual([
      'changes[1] (update_node): there\'s no node "textfields-1".',
    ]);
  });

  test("a second proposal says it replaced the first", () => {
    const { tools } = createStubTools({ models: MODELS });
    propose(tools, newFlow);
    expect(propose(tools, newFlow)).toMatchObject({
      change_set_id: "change-set-2",
      replaced: "change-set-1",
    });
  });
});

test("list_models offers only models that are set up", () => {
  const { tools } = createStubTools({ models: MODELS });
  expect(run(tools, "list_models")).toEqual({
    models: [
      {
        id: "openrouter/anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
        provider: "OpenRouter",
      },
      {
        id: "openrouter/openai/gpt-5.4-mini",
        name: "GPT-5.4 Mini",
        provider: "OpenRouter",
      },
    ],
    note: "1 more models are in ChainForge's menu but not set up.",
  });
});

test("describe_node refuses types without a guide", () => {
  const { tools } = createStubTools({
    models: MODELS,
    nodeDocs: { prompt: "# Prompt Node" },
  });
  expect(run(tools, "describe_node", { type: "prompt" })).toBe("# Prompt Node");
  expect(() => run(tools, "describe_node", { type: "evaluator" })).toThrow(
    'There\'s no guide for "evaluator".',
  );
});

test("describeChanges shows list edits as items added and removed", () => {
  const lines = describeChanges(EXAMPLE_FLOW, {
    summary: "",
    changes: [
      {
        op: "update_node",
        node: "prompt-1",
        settings: {
          prompts: [
            { label: "Plain", text: "Summarize this in one sentence: {text}" },
            { label: "Kid", text: "Explain this to a ten-year-old: {text}" },
          ],
          // The same model, by ID: not a change.
          models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
          responses_per_prompt: 3,
          title: "Summaries",
        },
      },
      {
        op: "add_node",
        ref: "check",
        type: "evaluator",
        settings: { title: "Is short", code: "function evaluate(r) {}" },
      },
      {
        op: "connect",
        from: { node: "prompt-1", output: "responses" },
        to: { node: "check", input: "responses" },
      },
    ],
  });
  expect(lines).toEqual([
    {
      kind: "update",
      text: 'Change "Summaries"',
      edits: [
        expect.objectContaining({
          setting: "Prompts",
          added: ["Kid: Explain this to a ten-year-old: {text}"],
          removed: [],
          kept: 1,
        }),
        {
          setting: "Responses per prompt",
          before: "1",
          after: "3",
          code: undefined,
        },
      ],
    },
    {
      kind: "add",
      text: 'Add Evaluator "Is short"',
      details: [
        { setting: "Code", value: "function evaluate(r) {}", code: true },
      ],
    },
    { kind: "connect", text: 'Connect "Summaries" → "Is short"\'s responses' },
  ]);
});
