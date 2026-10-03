// The store-backed canvas, against a small real zustand store standing in for
// ChainForge's (whose import graph doesn't load under Jest).

/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock("../../store", () => {
  const { create } = require("zustand");
  // A small model menu, as ChainForge groups it, with real model names so
  // ChainForge's getProvider tells their providers apart.
  const item = (name: string, model: string, base_model: string) => ({
    name,
    emoji: "🤖",
    model,
    base_model,
    temp: 1,
  });
  const menu = [
    {
      group: "In-browser LLMs",
      emoji: "🌐",
      items: [
        item("Qwen2.5 0.5B", "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", "webllm"),
      ],
    },
    {
      group: "OpenRouter",
      emoji: "🔀",
      items: [
        item(
          "Claude Haiku 4.5",
          "openrouter/anthropic/claude-haiku-4.5",
          "openrouter",
        ),
      ],
    },
    {
      group: "OpenAI",
      emoji: "🤖",
      items: [item("GPT-5.6 Sol", "gpt-5.6-sol", "gpt-4")],
    },
    {
      group: "Claude",
      emoji: "📚",
      items: [item("Claude Sonnet", "claude-sonnet-4-5", "claude-v1")],
    },
    {
      group: "Bedrock",
      emoji: "⛰️",
      items: [
        item("Bedrock Claude", "bedrock/anthropic.claude-3-haiku", "bedrock"),
      ],
    },
    item("Azure OpenAI", "azure-openai", "azure-openai"),
  ];
  const flat = menu.flatMap((m: any) => ("group" in m ? m.items : [m]));
  const store = create((set: any, get: any) => ({
    nodes: [],
    edges: [],
    apiKeys: { OpenRouter: "sk-or-test" },
    ollamaModels: [],
    ollamaDecisionModels: [],
    AvailableLLMs: flat,
    setDataPropsForNode: (id: string, props: object) =>
      set({
        nodes: get().nodes.map((n: any) =>
          n.id === id ? { ...n, data: { ...n.data, ...props } } : n,
        ),
      }),
    // As ChainForge's own onConnect does (store.tsx): nodes that read one
    // input are told which, results are marked out of date, and the edge is
    // added with the styling edges drawn by hand get.
    onConnect: (c: any) => {
      const target = get().nodes.find((n: any) => n.id === c.target);
      if (!target) return;
      if (["vis", "inspect", "simpleval"].includes(target.type))
        get().setDataPropsForNode(target.id, { input: c.source });
      get().setDataPropsForNode(target.id, { refresh: true });
      set({
        edges: [
          ...get().edges,
          { ...c, id: `edge-${get().edges.length}`, animated: true },
        ],
      });
    },
  }));
  return {
    __esModule: true,
    default: store,
    initLLMProviderMenu: menu,
    initLLMProviders: flat,
  };
});
jest.mock("../../ModelSettingSchemas", () => ({
  getDefaultModelSettings: () => ({}),
}));
/* eslint-enable @typescript-eslint/no-var-requires */

// eslint-disable-next-line import/first
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import useStore from "../../store";
// eslint-disable-next-line import/first
import {
  ORIGINAL_KEY,
  PENDING_CLASS,
  Proposal,
  StoreCanvas,
} from "../adapters/canvas";
// eslint-disable-next-line import/first
import { ChangeSet } from "../flowApi/types";
// eslint-disable-next-line import/first
import { listModels, modelIdOf, modelResolver } from "../adapters/models";
// eslint-disable-next-line import/first
import { promptKind } from "../nodes/prompt";
// eslint-disable-next-line import/first
import { FlowLoadGuard } from "../../backend/flowLoadGuard";

const tick = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

const haiku = {
  key: "k1",
  name: "Claude Haiku 4.5",
  emoji: "📚",
  model: "openrouter/anthropic/claude-haiku-4.5",
  base_model: "openrouter",
  temp: 1,
};

beforeEach(() => {
  useStore.setState({
    nodes: [
      {
        id: "tf",
        type: "textfields",
        position: { x: 0, y: 0 },
        data: { fields: { f1: "Paris" } },
      },
      {
        id: "p",
        type: "prompt",
        position: { x: 400, y: 0 },
        data: { prompt: "Say hi", llms: [haiku], n: 1 },
      },
    ],
    edges: [],
  } as any);
});

/** Edits the prompt to add {city}, and connects the TextFields Node to it. */
const addCity: ChangeSet = {
  summary: "Add a city",
  changes: [
    {
      op: "update_node",
      node: "p",
      settings: { prompts: [{ label: "A", text: "Say hi to {city}" }] },
    },
    {
      op: "connect",
      from: { node: "tf", output: "values" },
      to: { node: "p", input: "city" },
    },
  ],
};

function setUp() {
  const statuses: Proposal[] = [];
  const canvas = new StoreCanvas({ onProposal: (p) => statuses.push(p) });
  return { canvas, statuses };
}

const nodeData = (id: string) =>
  (useStore.getState() as any).nodes.find((n: any) => n.id === id).data;

const edgesInto = (id: string) =>
  (useStore.getState() as any).edges.filter((e: any) => e.target === id);

test("accepting twice at once applies the proposal once", async () => {
  const { canvas, statuses } = setUp();
  const { id } = canvas.propose(addCity);

  await Promise.all([canvas.accept(id), canvas.accept(id)]);

  expect(edgesInto("p")).toHaveLength(1);
  expect(edgesInto("p")[0]).toMatchObject({
    source: "tf",
    sourceHandle: "output",
    targetHandle: "city",
  });
  expect(statuses.map((s) => s.status)).toEqual([
    "pending",
    "applying",
    "accepted",
  ]);
});

test("proposals from different canvases have different ids", () => {
  // The chat panel keeps its cards when its canvas is recreated, and knows
  // them by id.
  const first = setUp().canvas.propose(addCity);
  const second = setUp().canvas.propose(addCity);
  expect(first.id).not.toBe(second.id);
});

test("connections are made the way the canvas makes them", async () => {
  // Not built by hand: the store marks results out of date, and tells nodes
  // that read one input (a Vis Node, say) which node that is.
  const { canvas } = setUp();
  // Swapped in through the store: setState copies the state object, so a
  // spy put on the object itself would outlive the test.
  const real = (useStore.getState() as any).onConnect;
  const onConnect = jest.fn(real);
  useStore.setState({ onConnect } as any);
  const { id } = canvas.propose(addCity);
  await canvas.accept(id);
  useStore.setState({ onConnect: real } as any);

  expect(onConnect).toHaveBeenCalledWith({
    source: "tf",
    sourceHandle: "output",
    target: "p",
    targetHandle: "city",
  });
  expect(nodeData("p").refresh).toBe(true);
});

test("a table's column connects by its name, and a renamed one reconnects", async () => {
  const { canvas } = setUp();
  const { id } = canvas.propose({
    summary: "Ask from a table",
    changes: [
      {
        op: "add_node",
        ref: "qa",
        type: "table",
        settings: { columns: ["city"], rows: [{ city: "Oslo" }] },
      },
      {
        op: "update_node",
        node: "p",
        settings: { prompts: [{ label: "A", text: "Say hi to {city}" }] },
      },
      {
        op: "connect",
        from: { node: "qa", output: "city" },
        to: { node: "p", input: "city" },
      },
    ],
  });
  await canvas.accept(id);
  const table = (useStore.getState() as any).nodes.find(
    (n: any) => n.type === "table",
  );
  expect(edgesInto("p")).toEqual([
    expect.objectContaining({
      source: table.id,
      sourceHandle: "city",
      targetHandle: "city",
    }),
  ]);

  // Renamed and reconnected: the connection from the old name goes.
  const renamed = canvas.propose({
    summary: "Rename",
    changes: [
      {
        op: "update_node",
        node: table.id,
        settings: { columns: ["town"], rows: [{ town: "Oslo" }] },
      },
      {
        op: "connect",
        from: { node: table.id, output: "town" },
        to: { node: "p", input: "city" },
      },
    ],
  });
  await canvas.accept(renamed.id);
  expect(edgesInto("p").map((e: any) => e.sourceHandle)).toEqual(["town"]);
});

test("a new node that feeds one on the canvas goes to its left", () => {
  // A table feeding the prompt shouldn't sit right of it, with its
  // connection running backwards. The TextFields Node there is in the way,
  // so it moves down.
  const { canvas } = setUp();
  canvas.propose({
    summary: "Ask from a table",
    changes: [
      {
        op: "add_node",
        ref: "qa",
        type: "table",
        settings: { columns: ["city"], rows: [{ city: "Oslo" }] },
      },
      {
        op: "update_node",
        node: "p",
        settings: { prompts: [{ label: "A", text: "Say hi to {city}" }] },
      },
      {
        op: "connect",
        from: { node: "qa", output: "city" },
        to: { node: "p", input: "city" },
      },
    ],
  });
  const nodes = (useStore.getState() as any).nodes;
  const table = nodes.find((n: any) => n.type === "table");
  const prompt = nodes.find((n: any) => n.id === "p");
  expect(table.position.x).toBeLessThan(prompt.position.x);
  expect(table.position.y).toBeGreaterThan(0); // below the TextFields Node
});

test("rejecting while a proposal applies does nothing", async () => {
  const { canvas, statuses } = setUp();
  const { id } = canvas.propose({
    summary: "Add a node and edit the prompt",
    changes: [
      {
        op: "add_node",
        ref: "more",
        type: "textfields",
        settings: { values: ["Oslo"] },
      },
      ...addCity.changes,
    ],
  });

  // The edit makes accepting wait while the Prompt Node is rebuilt.
  const applying = canvas.accept(id);
  canvas.reject(id);
  await applying;

  expect(statuses.at(-1)?.status).toBe("accepted");
  const nodes = (useStore.getState() as any).nodes;
  expect(nodes).toHaveLength(3);
  expect(nodes.every((n: any) => n.className === undefined)).toBe(true);
  expect(edgesInto("p")).toHaveLength(1);
});

test("a node deleted since the proposal means nothing is applied", async () => {
  const { canvas, statuses } = setUp();
  const { id } = canvas.propose({
    summary: "Add a node and edit the prompt",
    changes: [
      {
        op: "add_node",
        ref: "more",
        type: "textfields",
        settings: { values: ["Oslo"] },
      },
      ...addCity.changes,
    ],
  });
  const before = (useStore.getState() as any).nodes.find(
    (n: any) => n.id === "tf",
  );
  // The user deletes the Prompt Node the proposal edits.
  useStore.setState((s: any) => ({
    nodes: s.nodes.filter((n: any) => n.id !== "p"),
  }));

  await canvas.accept(id);

  const last = statuses.at(-1);
  expect(last?.status).toBe("failed");
  expect(last?.error).toMatch(/nothing was changed/);
  const nodes = (useStore.getState() as any).nodes;
  // The proposed node is gone, and the rest is as it was.
  expect(nodes.map((n: any) => n.id)).toEqual(["tf"]);
  expect(nodes[0]).toEqual(before);
  expect((useStore.getState() as any).edges).toEqual([]);
});

test("proposed nodes no live proposal owns are removed", async () => {
  const { canvas } = setUp();
  useStore.setState((s: any) => ({
    nodes: [
      ...s.nodes.map((n: any) =>
        n.id === "p" ? { ...n, className: PENDING_CLASS.update } : n,
      ),
      {
        id: "ghost",
        type: "textfields",
        position: { x: 0, y: 300 },
        data: {},
        className: PENDING_CLASS.add,
      },
    ],
    edges: [
      {
        id: "e1",
        source: "ghost",
        target: "p",
        className: PENDING_CLASS.add,
      },
    ],
  }));

  const stop = canvas.removeOrphans(0);
  await tick();

  const { nodes, edges } = useStore.getState() as any;
  expect(nodes.map((n: any) => n.id)).toEqual(["tf", "p"]);
  expect(nodes.find((n: any) => n.id === "p").className).toBeUndefined();
  expect(edges).toEqual([]);
  stop();
});

test("a live proposal's nodes are kept while it applies", async () => {
  const { canvas, statuses } = setUp();
  const stop = canvas.removeOrphans(0);
  const { id } = canvas.propose({
    summary: "Add a node",
    changes: [
      {
        op: "add_node",
        ref: "more",
        type: "textfields",
        settings: { values: ["Oslo"] },
      },
    ],
  });

  await canvas.accept(id);

  expect(statuses.at(-1)?.status).toBe("accepted");
  expect((useStore.getState() as any).nodes).toHaveLength(3);
  stop();
});

test("a loading flow finishes before leftover nodes are removed", async () => {
  // App.tsx refuses saves until a loaded flow's nodes render exactly as
  // loaded. Removing leftovers straight away kept saves off for good.
  const { canvas } = setUp();
  const guard = new FlowLoadGuard();
  const stop = canvas.removeOrphans(20);
  const loaded = [
    ...(useStore.getState() as any).nodes,
    {
      id: "ghost",
      type: "textfields",
      position: { x: 0, y: 300 },
      data: {},
      className: PENDING_CLASS.add,
    },
  ];

  guard.awaitNodes(loaded);
  useStore.setState({ nodes: loaded } as any);
  // App.tsx reports each render's nodes to the guard.
  guard.nodesRendered((useStore.getState() as any).nodes);
  expect(guard.isLoading).toBe(false);

  await tick(40);
  expect((useStore.getState() as any).nodes.map((n: any) => n.id)).toEqual([
    "tf",
    "p",
  ]);
  stop();
});

describe("noticing another flow", () => {
  const node = (id: string) => ({
    id,
    type: "textfields",
    position: { x: 0, y: 0 },
    data: {},
  });
  const setNodes = (ids: string[]) =>
    useStore.setState({ nodes: ids.map(node) } as any);

  function watch() {
    const { canvas } = setUp();
    let switches = 0;
    const stop = canvas.watchForFlowSwitch(() => switches++);
    return { count: () => switches, stop };
  }

  test("New Flow, which replaces every node at once, is a switch", () => {
    const w = watch();
    setNodes(["new-tf", "new-p"]);
    expect(w.count()).toBe(1);
    w.stop();
  });

  test("loading a flow, which empties the canvas first, is one switch", () => {
    const w = watch();
    setNodes([]);
    setNodes(["loaded-1", "loaded-2"]);
    expect(w.count()).toBe(1);
    w.stop();
  });

  test("ordinary edits are not a switch", async () => {
    const w = watch();
    setNodes(["tf", "p", "added"]); // a node added
    setNodes(["p", "added"]); // one removed
    setNodes([]); // the only nodes rebuilt: removed, then back
    setNodes(["p", "added"]);
    expect(w.count()).toBe(0);
    w.stop();
  });

  test("a switch handler that changes the canvas runs once", () => {
    // The panel's handler rejects the waiting proposal, which changes the
    // store and re-enters the watcher; this once recursed until the stack ran out.
    const { canvas } = setUp();
    const { id } = canvas.propose({
      summary: "Add a node",
      changes: [
        {
          op: "add_node",
          ref: "more",
          type: "textfields",
          settings: { values: ["Oslo"] },
        },
      ],
    });
    let switches = 0;
    const stop = canvas.watchForFlowSwitch(() => {
      switches++;
      canvas.reject(id);
    });
    setNodes(["new-tf", "new-p"]);
    expect(switches).toBe(1);
    stop();
  });

  test("accepting a proposal that replaces every node is not a switch", async () => {
    const w = watch();
    const { canvas } = setUp();
    const { id } = canvas.propose({
      summary: "Start over",
      changes: [
        { op: "remove_node", node: "tf" },
        { op: "remove_node", node: "p" },
        {
          op: "add_node",
          ref: "fresh",
          type: "textfields",
          settings: { values: ["Oslo"] },
        },
      ],
    });
    await canvas.accept(id);
    expect((useStore.getState() as any).nodes).toHaveLength(1);
    expect(w.count()).toBe(0);
    w.stop();
  });
});

describe("unfinished nodes", () => {
  // As New Flow leaves the canvas.
  beforeEach(() => {
    useStore.setState({
      nodes: [
        {
          id: "tf",
          type: "textfields",
          position: { x: 0, y: 0 },
          data: { fields: { f1: "" } },
        },
        {
          id: "p",
          type: "prompt",
          position: { x: 400, y: 0 },
          data: { prompt: "", llms: [haiku], n: 1 },
        },
      ],
      edges: [],
    } as any);
  });

  const fillBoth: ChangeSet = {
    summary: "Ask about cities",
    changes: [
      { op: "update_node", node: "tf", settings: { values: ["Paris"] } },
      {
        op: "update_node",
        node: "p",
        settings: { prompts: [{ label: "A", text: "Describe {city}" }] },
      },
      {
        op: "connect",
        from: { node: "tf", output: "values" },
        to: { node: "p", input: "city" },
      },
      {
        op: "add_node",
        ref: "short",
        type: "evaluator",
        settings: {
          code: "function evaluate(r) { return r.text.length < 9; }",
        },
      },
      {
        op: "connect",
        from: { node: "p", output: "responses" },
        to: { node: "short", input: "responses" },
      },
    ],
  };
  const nodeById = (id: string) =>
    (useStore.getState() as any).nodes.find((n: any) => n.id === id);

  test("are shown filled in, while the flow still reads as blank", async () => {
    const { canvas } = setUp();
    canvas.propose(fillBoth);
    await tick(80);

    expect(nodeById("p").className).toBe(PENDING_CLASS.fill);
    expect(nodeById("p").data.prompt).toBe("Describe {city}");
    expect(nodeById("tf").data[ORIGINAL_KEY]).toEqual({ fields: { f1: "" } });
    expect(edgesInto("p")).toHaveLength(1);
    expect(edgesInto("p")[0].className).toBe(PENDING_CLASS.add);
    const flow = canvas.readFlow();
    expect(flow.nodes.find((n) => n.id === "p")?.settings?.prompts).toEqual([
      { label: "Variant 1", text: "" },
    ]);
    expect(flow.connections).toEqual([]);
  });

  test("go back to how they were when rejected", async () => {
    const { canvas } = setUp();
    const { id } = canvas.propose(fillBoth);
    await tick(80);
    canvas.reject(id);
    await tick(80);

    const { nodes, edges } = useStore.getState() as any;
    expect(nodes.map((n: any) => n.id).sort()).toEqual(["p", "tf"]);
    expect(nodeById("p").data.prompt).toBe("");
    expect(nodeById("p").data[ORIGINAL_KEY]).toBeUndefined();
    expect(nodeById("p").className).toBeUndefined();
    expect(edges).toEqual([]);
  });

  test("keep their new contents when accepted, and it's not a new flow", async () => {
    const { canvas } = setUp();
    let switches = 0;
    const stop = canvas.watchForFlowSwitch(() => switches++);
    const { id } = canvas.propose(fillBoth);
    await canvas.accept(id);

    expect(nodeById("p").data.prompt).toBe("Describe {city}");
    expect(nodeById("p").data[ORIGINAL_KEY]).toBeUndefined();
    expect(nodeById("p").className).toBeUndefined();
    const { edges } = useStore.getState() as any;
    expect(edges).toHaveLength(2);
    expect(edges.every((e: any) => !e.className)).toBe(true);
    expect(canvas.readFlow().connections).toHaveLength(2);
    expect(switches).toBe(0);
    stop();
  });

  test("finished nodes are only outlined", () => {
    useStore.setState((s: any) => ({
      nodes: s.nodes.map((n: any) =>
        n.id === "p" ? { ...n, data: { ...n.data, prompt: "Hi" } } : n,
      ),
    }));
    const { canvas } = setUp();
    canvas.propose(addCity);
    expect(nodeById("p").className).toBe(PENDING_CLASS.update);
    expect(nodeById("p").data.prompt).toBe("Hi");
  });

  test("stay on the canvas if going back fails", async () => {
    useStore.setState((s: any) => ({
      nodes: s.nodes.map((n: any) =>
        n.id === "p"
          ? {
              ...n,
              className: PENDING_CLASS.fill,
              data: { prompt: "Describe {city}", [ORIGINAL_KEY]: n.data },
            }
          : n,
      ),
    }));
    const read = jest.spyOn(promptKind, "read").mockImplementation(() => {
      throw new Error("broken");
    });
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});
    const { canvas } = setUp();
    const stop = canvas.removeOrphans(10);
    await tick(100);
    stop();
    expect(nodeById("p")).toBeDefined();
    expect(logged).toHaveBeenCalled();
    read.mockRestore();
    logged.mockRestore();
  });

  test("left filled in by a reload go back to how they were", async () => {
    useStore.setState((s: any) => ({
      nodes: s.nodes.map((n: any) =>
        n.id === "p"
          ? {
              ...n,
              className: PENDING_CLASS.fill,
              data: { prompt: "Describe {city}", [ORIGINAL_KEY]: n.data },
            }
          : n,
      ),
    }));
    const { canvas } = setUp();
    const stop = canvas.removeOrphans(10);
    await tick(100);
    stop();

    expect(nodeById("p").data.prompt).toBe("");
    expect(nodeById("p").data[ORIGINAL_KEY]).toBeUndefined();
    expect(nodeById("p").className).toBeUndefined();
  });
});

test("model IDs match list_models", () => {
  expect(
    modelIdOf({
      name: "q",
      emoji: "🦙",
      model: "ollama",
      base_model: "ollama",
      temp: 1,
      settings: { ollamaModel: "qwen3.5:4b" },
    }),
  ).toBe("ollama/qwen3.5:4b");
});

test("Ollama's decision models are listed by name, as judges only", () => {
  useStore.setState({ ollamaDecisionModels: ["nimble:latest"] } as any);
  try {
    const nimble = listModels().find((m) => m.name === "nimble:latest");
    expect(nimble).toMatchObject({
      id: "ollama-decision/nimble:latest",
      ready: true,
      judgeOnly: true,
    });
    expect(
      modelIdOf({
        name: "nimble:latest",
        emoji: "🦙",
        model: "ollama-decision",
        base_model: "ollama-decision",
        temp: 0,
        settings: { ollamaModel: "nimble:latest" },
      }),
    ).toBe("ollama-decision/nimble:latest");
  } finally {
    useStore.setState({ ollamaDecisionModels: [] } as any);
  }
});

describe("models from the providers set up", () => {
  const setKeys = (apiKeys: Record<string, string>) =>
    useStore.setState({ apiKeys } as any);
  const readyIds = () =>
    listModels()
      .filter((m) => m.ready)
      .map((m) => m.id);
  afterEach(() => setKeys({ OpenRouter: "sk-or-test" }));

  test("only an OpenAI key means only OpenAI's models are ready", () => {
    setKeys({ OpenAI: "sk-test" });
    expect(readyIds()).toEqual([
      "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
      "gpt-5.6-sol",
    ]);
  });

  test("an OpenRouter key brings its models, under OpenRouter", () => {
    expect(readyIds()).toContain("openrouter/anthropic/claude-haiku-4.5");
    expect(readyIds()).not.toContain("claude-sonnet-4-5");
    expect(
      listModels().find((m) => m.id === "claude-sonnet-4-5")?.provider,
    ).toBe("Claude");
  });

  test("a provider needing several keys needs them all", () => {
    setKeys({ AWS_Access_Key_ID: "a", AWS_Secret_Access_Key: "b" });
    expect(readyIds()).not.toContain("bedrock/anthropic.claude-3-haiku");
    setKeys({
      AWS_Access_Key_ID: "a",
      AWS_Secret_Access_Key: "b",
      AWS_Region: "us-east-1",
    });
    expect(readyIds()).toContain("bedrock/anthropic.claude-3-haiku");
  });

  test("in-browser models are a fallback, and Azure isn't offered", () => {
    const models = listModels();
    expect(models.find((m) => m.provider === "In-browser LLMs")).toMatchObject({
      ready: true,
      fallback: true,
    });
    expect(models.map((m) => m.id)).not.toContain("azure-openai");
  });

  test("models are built as the Prompt Node's menu builds them", () => {
    expect(modelResolver.toSpec("gpt-5.6-sol", ["GPT-5.6 Sol"])).toMatchObject({
      name: "GPT-5.6 Sol (2)",
      model: "gpt-5.6-sol",
      base_model: "gpt-4",
      formData: { shortname: "GPT-5.6 Sol (2)", model: "gpt-5.6-sol" },
    });
    // The settings form shows OpenRouter models without their prefix.
    expect(
      modelResolver.toSpec("openrouter/anthropic/claude-haiku-4.5", [])
        ?.formData,
    ).toEqual({
      shortname: "Claude Haiku 4.5",
      model: "anthropic/claude-haiku-4.5",
    });
    expect(modelResolver.toSpec("ollama/qwen3:8b", [])).toMatchObject({
      name: "qwen3:8b",
      base_model: "ollama",
      settings: { ollamaModel: "qwen3:8b" },
      formData: { ollamaModel: "qwen3:8b" },
    });
  });
});
