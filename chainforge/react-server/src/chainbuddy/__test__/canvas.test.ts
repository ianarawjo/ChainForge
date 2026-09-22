// The store-backed canvas, against a small real zustand store standing in for
// ChainForge's (whose import graph doesn't load under Jest).

/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock("../../store", () => {
  const { create } = require("zustand");
  const store = create((set: any, get: any) => ({
    nodes: [],
    edges: [],
    apiKeys: { OpenRouter: "sk-or-test" },
    ollamaModels: [],
    setDataPropsForNode: (id: string, props: object) =>
      set({
        nodes: get().nodes.map((n: any) =>
          n.id === id ? { ...n, data: { ...n.data, ...props } } : n,
        ),
      }),
  }));
  return {
    __esModule: true,
    default: store,
    initLLMProviders: [
      {
        name: "Claude Haiku 4.5",
        emoji: "📚",
        model: "openrouter/anthropic/claude-haiku-4.5",
        base_model: "openrouter",
        temp: 1,
      },
    ],
  };
});
jest.mock("../../ModelSettingSchemas", () => ({
  getDefaultModelSettings: () => ({}),
}));
/* eslint-enable @typescript-eslint/no-var-requires */

// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
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
