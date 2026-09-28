import { describe, expect, test } from "@jest/globals";
import { describeChanges } from "../flowApi/describe";
import { ReviewInput, Reviewer } from "../flowApi/review";
import { ModelInfo } from "../flowApi/types";
import { AgentTool } from "../runtime/tools";
import {
  BLANK_FLOW,
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

const APPROACH =
  "Ask a model about each fact, and score its answers with code.";

/** Reads the canvas and shares an approach, as ChainBuddy must, then proposes. */
const propose = (tools: AgentTool[], changes: unknown[]) => {
  run(tools, "get_flow");
  run(tools, "share_approach", { approach: APPROACH });
  return run(tools, "propose_changes", { summary: "test", changes });
};

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

  test("connects an output only to inputs that take what it gives", () => {
    const { tools } = createStubTools({ models: MODELS });
    const out = propose(tools, [
      ...newFlow,
      {
        op: "connect",
        from: { node: "check", output: "scored_responses" },
        to: { node: "ask", input: "fact" },
      },
      {
        op: "connect",
        from: { node: "ask", output: "responses" },
        to: { node: "facts", input: "fact" },
      },
    ]);
    expect(out.problems).toEqual([
      "changes[5] (connect): ask takes values or responses, and check gives scored_responses.",
      "changes[6] (connect): facts takes values, and ask gives responses.",
      'changes[6] (connect): facts has no input "fact". Its inputs are: (none).',
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

describe("reading the canvas first", () => {
  test("propose_changes refuses until get_flow has been called", () => {
    const { tools, proposals } = createStubTools({ models: MODELS });
    const out = run(tools, "propose_changes", {
      summary: "test",
      changes: newFlow,
    });
    expect(out.status).toBe("invalid");
    expect(out.problems[0]).toMatch(/^Call get_flow first/);
    expect(proposals).toHaveLength(0);
  });

  test("each new message needs a fresh read", () => {
    const { tools, startTurn } = createStubTools({ models: MODELS });
    expect(propose(tools, newFlow).status).toBe("awaiting_approval");
    startTurn();
    const out = run(tools, "propose_changes", {
      summary: "test",
      changes: newFlow,
    });
    expect(out.status).toBe("invalid");
  });
});

describe("sharing the approach first", () => {
  const proposeOnly = (tools: AgentTool[], changes: unknown[]) => {
    run(tools, "get_flow");
    return run(tools, "propose_changes", { summary: "test", changes });
  };

  test("a change to three or more nodes waits until the approach is shared", () => {
    const { tools, proposals, approaches } = createStubTools({
      models: MODELS,
    });
    const out = proposeOnly(tools, newFlow);
    expect(out.status).toBe("invalid");
    expect(out.problems).toEqual([
      "These changes touch 3 nodes, so first call share_approach to tell the user, in a sentence or two, the approach you'll take.",
    ]);
    expect(proposals).toHaveLength(0);

    run(tools, "share_approach", { approach: `  ${APPROACH} ` });
    expect(approaches).toEqual([APPROACH]);
    expect(proposeOnly(tools, newFlow).status).toBe("awaiting_approval");
  });

  test("a smaller change needs none", () => {
    const { tools } = createStubTools({ models: MODELS });
    const twoNodes = [newFlow[0], newFlow[1], newFlow[3]];
    expect(proposeOnly(tools, twoNodes).status).toBe("awaiting_approval");
  });

  test("each new message needs its own", () => {
    const { tools, startTurn } = createStubTools({ models: MODELS });
    expect(propose(tools, newFlow).status).toBe("awaiting_approval");
    startTurn();
    expect(proposeOnly(tools, newFlow).status).toBe("invalid");
  });

  test("an approach is a sentence or two, not the details", () => {
    const { tools, approaches } = createStubTools({ models: MODELS });
    expect(() =>
      run(tools, "share_approach", { approach: "word ".repeat(100) }),
    ).toThrow(/at most 400 characters/);
    expect(() => run(tools, "share_approach", { approach: " " })).toThrow(
      "The approach is empty.",
    );
    expect(approaches).toHaveLength(0);
  });
});

describe("blank nodes, as New Flow makes", () => {
  const evaluatorOnBlankPrompt = [
    {
      op: "add_node",
      ref: "check",
      type: "evaluator",
      settings: { code: "function evaluate(r) { return 1; }" },
    },
    {
      op: "connect",
      from: { node: "prompt-1", output: "responses" },
      to: { node: "check", input: "responses" },
    },
  ];

  test("won't connect an evaluator to a Prompt Node left blank", () => {
    const { tools } = createStubTools({ flow: BLANK_FLOW, models: MODELS });
    expect(propose(tools, evaluatorOnBlankPrompt).problems).toEqual([
      "prompt-1 has no prompt text yet. Fill it in with update_node in this change set, or connect to a different node.",
    ]);
  });

  test("filling the blank nodes in the same change set is fine", () => {
    const { tools } = createStubTools({ flow: BLANK_FLOW, models: MODELS });
    const out = propose(tools, [
      {
        op: "update_node",
        node: "textfields-1",
        settings: { values: ["What is the capital of France?"] },
      },
      {
        op: "update_node",
        node: "prompt-1",
        settings: {
          prompts: [{ label: "Ask", text: "Answer briefly: {question}" }],
          models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
        },
      },
      {
        op: "connect",
        from: { node: "textfields-1", output: "values" },
        to: { node: "prompt-1", input: "question" },
      },
      ...evaluatorOnBlankPrompt,
    ]);
    expect(out.status).toBe("awaiting_approval");
  });

  test("won't connect from a TextFields Node with no values", () => {
    const { tools } = createStubTools({ flow: BLANK_FLOW, models: MODELS });
    const out = propose(tools, [
      {
        op: "update_node",
        node: "prompt-1",
        settings: {
          prompts: [{ label: "Ask", text: "Answer: {q}" }],
          models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
        },
      },
      {
        op: "connect",
        from: { node: "textfields-1", output: "values" },
        to: { node: "prompt-1", input: "q" },
      },
    ]);
    expect(out.problems).toEqual([
      "textfields-1 has no values yet. Fill it in with update_node in this change set, or connect to a different node.",
    ]);
  });

  test("filling the blank Prompt Node means choosing its models", () => {
    // It starts with ChainForge's in-browser model, which models reliably
    // kept when only told to replace it.
    const fill = {
      op: "update_node",
      node: "prompt-1",
      settings: { prompts: [{ label: "Ask", text: "Say hello." }] },
    };
    const { tools } = createStubTools({ flow: BLANK_FLOW, models: MODELS });
    expect(propose(tools, [fill]).problems).toEqual([
      "changes[0] (update_node): prompt-1 still has Qwen2.5 0.5B, the small in-browser model a new Prompt Node starts with. Give models: ones from list_models, or the same one to keep it if the user asked for it.",
    ]);
    // Keeping it on purpose is fine.
    const keep = {
      ...fill,
      settings: {
        ...fill.settings,
        models: [{ model: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC" }],
      },
    };
    expect(propose(tools, [keep]).status).toBe("awaiting_approval");
  });
});

test("a read-only setting repeated back unchanged is ignored, not an error", () => {
  const { tools, proposals } = createStubTools({
    flow: EXAMPLE_FLOW,
    models: MODELS,
  });
  const out = propose(tools, [
    {
      op: "update_node",
      node: "textfields-1",
      settings: { values: ["one", "two"], disabled_values: [] },
    },
  ]);
  expect(out.status).toBe("awaiting_approval");
  expect(proposals[0].changes[0]).toEqual({
    op: "update_node",
    node: "textfields-1",
    settings: { values: ["one", "two"] },
  });
  // Changing it is still refused.
  expect(
    propose(tools, [
      {
        op: "update_node",
        node: "textfields-1",
        settings: { disabled_values: ["x"] },
      },
    ]).problems,
  ).toEqual(["changes[0] (update_node): disabled_values is read-only."]);
});

test("double-brace variables are refused, with ChainForge's syntax", () => {
  const { tools } = createStubTools({ flow: EXAMPLE_FLOW, models: MODELS });
  const out = propose(tools, [
    {
      op: "update_node",
      node: "prompt-1",
      settings: {
        prompts: [{ label: "A", text: "What is the capital of {{text}}?" }],
      },
    },
  ]);
  expect(out.problems).toEqual([
    "changes[0] (update_node): prompts use {{...}}. ChainForge variables use single braces, like {country}; write \\{ and \\} for literal braces.",
  ]);
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
    not_set_up: ["Ollama"],
    note: "Use these. in_browser lists small models that run in the browser: use one only if the user asks for it. If the user asks for a provider in not_set_up, say it needs its API key added in Settings, rather than substituting another.",
  });
});

test("list_models offers in-browser models only when nothing else is set up", () => {
  const inBrowser = {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen2.5 0.5B",
    provider: "In-browser LLMs",
    ready: true,
    fallback: true,
  };
  const withKey = createStubTools({ models: [...MODELS, inBrowser] });
  const listed = run(withKey.tools, "list_models");
  expect(listed.models.map((m: any) => m.id)).not.toContain(inBrowser.id);
  // Named apart, so it can be used when asked for.
  expect(listed.in_browser).toEqual([
    { id: inBrowser.id, name: inBrowser.name },
  ]);

  const noKeys = createStubTools({
    models: [...MODELS.map((m) => ({ ...m, ready: false })), inBrowser],
  });
  const out = run(noKeys.tools, "list_models");
  expect(out.models.map((m: any) => m.id)).toEqual([inBrowser.id]);
  expect(out.not_set_up).toEqual(["OpenRouter", "Ollama"]);
  expect(out.note).toMatch(/^Only small models that run in the browser/);
});

describe("nodes that only show results", () => {
  const vis = (ref: string, metric: string) => ({
    op: "add_node",
    ref,
    type: "vis",
    settings: { metric },
  });
  const plot = (from: string, output: string, to: string) => ({
    op: "connect",
    from: { node: from, output },
    to: { node: to, input: "responses" },
  });

  test("a run measure is plotted from a Prompt Node, not after an evaluator", () => {
    const { tools } = createStubTools({ models: MODELS });
    expect(
      propose(tools, [
        ...newFlow,
        vis("speed", "latency"),
        plot("ask", "responses", "speed"),
      ]).status,
    ).toBe("awaiting_approval");

    const out = propose(tools, [
      ...newFlow,
      vis("speed", "latency"),
      plot("check", "scored_responses", "speed"),
    ]);
    expect(out.problems).toEqual([
      `check → speed: it plots latency, which only a Prompt Node's own responses carry, not an evaluator's. Connect it straight to the Prompt Node, or plot "score".`,
    ]);
  });

  test("what it plots is judged as the change set leaves it", () => {
    // Connected while plotting scores, then switched to a run measure.
    const { tools } = createStubTools({ models: MODELS });
    const out = propose(tools, [
      ...newFlow,
      vis("plot", "score"),
      plot("check", "scored_responses", "plot"),
      { op: "update_node", node: "plot", settings: { metric: "cost" } },
    ]);
    expect(out.problems).toHaveLength(1);
    expect(out.problems[0]).toMatch(/^check → plot: it plots cost/);
  });

  test("a Vis Node takes one connection, since ChainForge plots only one", () => {
    const { tools } = createStubTools({ models: MODELS });
    const out = propose(tools, [
      ...newFlow,
      vis("plot", "score"),
      plot("ask", "responses", "plot"),
      plot("check", "scored_responses", "plot"),
    ]);
    expect(out.problems).toEqual([
      `plot: its "responses" input takes one connection, and would have 2 (from ask, check). ChainForge would use only one. Use one vis node per source.`,
    ]);
  });

  test("describe_node lists setting values from ChainForge, not the guide", () => {
    const { tools } = createStubTools({ models: MODELS });
    const guide = run(tools, "describe_node", {
      type: "vis",
    }) as unknown as string;
    const listed = guide.split("## Values settings take")[1];
    // Every measure ChainForge can plot, named from its label.
    expect(listed).toMatch(
      /- metric: score, latency, before_output, .*energy_estimated/,
    );
    expect(listed).toMatch(/- chart: bar, box/);
  });
});

test("long lists are shortened, and can't be replaced unseen", () => {
  // A table imported from a file shouldn't fill the model's context, and
  // copying back the part it saw would drop the rest.
  const values = Array.from({ length: 60 }, (_, i) => `value ${i}`);
  const flow = {
    nodes: [
      stubNode("tf", "textfields", "Many", { values, disabled_values: [] }),
    ],
    connections: [],
  };
  const { tools } = createStubTools({ flow, models: MODELS });
  const seen = run(tools, "get_flow");
  expect(seen.nodes[0].settings.values).toHaveLength(50);
  expect(seen.nodes[0].note).toBe(
    "values: showing the first 50 of 60; too long to change.",
  );

  const out = run(tools, "propose_changes", {
    summary: "Trim",
    changes: [
      {
        op: "update_node",
        node: "tf",
        settings: { values: values.slice(0, 50) },
      },
    ],
  });
  expect(out.problems).toEqual([
    "changes[0] (update_node): tf's values has 60 items, more than you were shown, so replacing it would lose the rest. Ask the user to change it, or add a new node.",
  ]);
  expect(
    propose(tools, [
      { op: "update_node", node: "tf", settings: { title: "Lots" } },
    ]).status,
  ).toBe("awaiting_approval");
});

describe("tables", () => {
  const qa = {
    op: "add_node",
    ref: "qa",
    type: "table",
    settings: {
      columns: ["question", "answer"],
      rows: [{ question: "What is 2+2?", answer: "4" }],
    },
  };
  const ask = {
    op: "add_node",
    ref: "ask",
    type: "prompt",
    settings: {
      prompts: [{ label: "A", text: "{question}" }],
      models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
    },
  };
  const fromColumn = (output: string) => ({
    op: "connect",
    from: { node: "qa", output },
    to: { node: "ask", input: "question" },
  });

  test("each column is an output, named after it", () => {
    const { tools } = createStubTools({ models: MODELS });
    expect(propose(tools, [qa, ask, fromColumn("question")]).status).toBe(
      "awaiting_approval",
    );
    expect(propose(tools, [qa, ask, fromColumn("values")]).problems).toEqual([
      'changes[2] (connect): qa has no output "values"; its outputs are: question, answer.',
    ]);
  });

  test("rows may only use the table's columns", () => {
    const { tools } = createStubTools({ models: MODELS });
    const out = propose(tools, [
      {
        ...qa,
        settings: { ...qa.settings, rows: [{ question: "Q", expected: "A" }] },
      },
    ]);
    expect(out.problems).toEqual([
      'changes[0] (add_node): rows use "expected", which isn\'t a column. The columns are: question, answer.',
    ]);
  });

  test("renaming a column that feeds something needs it reconnected", () => {
    const flow = {
      nodes: [
        stubNode("qa", "table", "QA", qa.settings),
        stubNode("ask", "prompt", "Ask", ask.settings),
      ],
      connections: [
        {
          from: { node: "qa", output: "question" },
          to: { node: "ask", input: "question" },
        },
      ],
    };
    const { tools } = createStubTools({ flow, models: MODELS });
    // Changing the columns alone would lose the renamed column's values.
    expect(
      propose(tools, [
        {
          op: "update_node",
          node: "qa",
          settings: { columns: ["prompt", "answer"] },
        },
      ]).problems,
    ).toEqual([
      'changes[0] (update_node): columns leaves out "question", which holds values. To rename a column, give rows too, with its values under the new name; to remove it, give rows without it.',
    ]);

    const rename = {
      op: "update_node",
      node: "qa",
      settings: {
        columns: ["prompt", "answer"],
        rows: [{ prompt: "What is 2+2?", answer: "4" }],
      },
    };
    expect(propose(tools, [rename]).problems).toEqual([
      'ask\'s "question" input is connected from qa\'s "question", which this change removes. Connect it to another output in this change set.',
    ]);
    expect(propose(tools, [rename, fromColumn("prompt")]).status).toBe(
      "awaiting_approval",
    );
  });

  test("a table can't feed a node that shows responses", () => {
    const { tools } = createStubTools({ models: MODELS });
    const out = propose(tools, [
      qa,
      { op: "add_node", ref: "look", type: "inspect", settings: {} },
      {
        op: "connect",
        from: { node: "qa", output: "question" },
        to: { node: "look", input: "responses" },
      },
    ]);
    expect(out.problems).toEqual([
      "changes[2] (connect): look takes responses or scored_responses, and qa gives values.",
    ]);
  });
});

describe("a second look before the user sees a proposal", () => {
  // Stands in for the reviewing model: answers with each list in turn, and
  // records what it was given.
  function reviewing(...answers: (string[] | Error)[]) {
    const seen: ReviewInput[] = [];
    const review: Reviewer = async (input) => {
      seen.push(input);
      const answer = answers[Math.min(seen.length, answers.length) - 1];
      if (answer instanceof Error) throw answer;
      return answer;
    };
    return { review, seen };
  }
  const proposeNow = async (tools: AgentTool[]) => {
    run(tools, "get_flow");
    run(tools, "share_approach", { approach: APPROACH });
    return (await run(tools, "propose_changes", {
      summary: "test",
      changes: newFlow,
    })) as Record<string, any>;
  };

  test("problems go back to the model, and nothing is shown until they're fixed", async () => {
    const { review, seen } = reviewing(
      ["The prompt gives the answer away."],
      [],
    );
    const { tools, startTurn, proposals, reviews } = createStubTools({
      models: MODELS,
      review,
    });
    startTurn("Check some facts.");

    const first = await proposeNow(tools);
    expect(first).toMatchObject({
      status: "needs_changes",
      problems: ["The prompt gives the answer away."],
    });
    expect(proposals).toHaveLength(0);

    expect((await proposeNow(tools)).status).toBe("awaiting_approval");
    expect(reviews[0]).toEqual({
      fixed: ["The prompt gives the answer away."],
      unresolved: [],
    });
    // It was given the request, and the guides of the types involved only.
    expect(seen[0].request).toBe("Check some facts.");
    expect(seen[0].approach).toBe(APPROACH);
    expect(Object.keys(seen[0].guides).sort()).toEqual([
      "evaluator",
      "prompt",
      "textfields",
    ]);
  });

  test("problems found again are shown to the user, not sent back twice", async () => {
    const { review } = reviewing(["First."], ["Still there."]);
    const { tools, startTurn, reviews } = createStubTools({
      models: MODELS,
      review,
    });
    startTurn("x");
    await proposeNow(tools);
    expect((await proposeNow(tools)).status).toBe("awaiting_approval");
    expect(reviews[0]).toEqual({
      fixed: ["First."],
      unresolved: ["Still there."],
    });
  });

  test("a review that fails doesn't hold the proposal back", async () => {
    const { review } = reviewing(new Error("rate limited"));
    const { tools, startTurn, reviews } = createStubTools({
      models: MODELS,
      review,
    });
    startTurn("x");
    expect((await proposeNow(tools)).status).toBe("awaiting_approval");
    expect(reviews[0]).toEqual({ fixed: [], unresolved: [], failed: true });
  });

  test("each new message gets its own first review", async () => {
    const { review } = reviewing(["A."], ["B."]);
    const { tools, startTurn } = createStubTools({ models: MODELS, review });
    startTurn("x");
    expect((await proposeNow(tools)).status).toBe("needs_changes");
    startTurn("y");
    expect((await proposeNow(tools)).status).toBe("needs_changes");
  });
});

test("evaluator code must parse, and isn't run to check it", () => {
  // A review found a missing closing brace; code can find that for certain.
  const { tools } = createStubTools({ models: MODELS });
  const ran: string[] = [];
  (globalThis as any).ranByCheck = (s: string) => ran.push(s);
  const out = propose(tools, [
    {
      op: "add_node",
      ref: "check",
      type: "evaluator",
      settings: {
        code: "ranByCheck('top level');\nfunction evaluate(r) {\n  return (1;\n}",
      },
    },
  ]);
  expect(out.problems).toEqual([
    "changes[0] (add_node): code isn't valid JavaScript: Unexpected token ';'.",
  ]);
  const ok = propose(tools, [
    {
      op: "add_node",
      ref: "check",
      type: "evaluator",
      settings: {
        code: "ranByCheck('top level');\nfunction evaluate(r) { return 1; }",
      },
    },
  ]);
  expect(ok.problems?.[0]).not.toMatch(/valid JavaScript/);
  expect(ran).toEqual([]);
  delete (globalThis as any).ranByCheck;
});

test("values a change set supplies must be used", () => {
  // Found by a review: test cases put in the TextFields Node while the prompt
  // hard-coded one of them, so the rest would never be sent.
  const { tools } = createStubTools({ flow: BLANK_FLOW, models: MODELS });
  const out = propose(tools, [
    {
      op: "update_node",
      node: "textfields-1",
      settings: { values: ["a", "b"] },
    },
    {
      op: "update_node",
      node: "prompt-1",
      settings: {
        prompts: [{ label: "A", text: "Describe a CEO." }],
        models: [{ model: "openrouter/anthropic/claude-haiku-4.5" }],
      },
    },
  ]);
  expect(out.problems).toEqual([
    "textfields-1: nothing uses its values. Connect it to a prompt's {variable}, or remove it.",
  ]);
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
      text: 'Add JavaScript Evaluator "Is short"',
      details: [
        { setting: "Code", value: "function evaluate(r) {}", code: true },
      ],
    },
    { kind: "connect", text: 'Connect "Summaries" → "Is short"\'s responses' },
  ]);
});
