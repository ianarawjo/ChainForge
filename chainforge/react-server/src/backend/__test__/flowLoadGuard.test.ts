import { describe, expect, test } from "@jest/globals";
import { FlowLoadGuard } from "../flowLoadGuard";

type N = { id: string };

/**
 * Stands in for App.tsx: a canvas whose renders report the nodes to the
 * guard (the effect on `nodes`), a saveFlow that writes the canvas to
 * "chainforge-flow" unless a load is under way, and the steps of
 * importFlowFromJSON and loadFlow in the order they run.
 */
const app = (initial: N[]) => {
  const guard = new FlowLoadGuard();
  const storage = new Map<string, N[]>([["chainforge-flow", initial]]);
  let canvas = initial;
  const render = (nodes: N[]) => {
    canvas = nodes;
    guard.nodesRendered(nodes);
  };
  const saveFlow = () => {
    if (guard.isLoading) return;
    storage.set("chainforge-flow", canvas);
  };
  // Running locally: the flow is captured now, but written to localStorage
  // only after the filesystem save fails, i.e. later. Returns that write.
  const saveFlowLocally = () => {
    if (guard.isLoading) return () => undefined;
    const flow = canvas;
    const generation = guard.generation;
    return () => {
      if (guard.generation !== generation) return;
      storage.set("chainforge-flow", flow);
    };
  };
  const importFlowFromJSON = () => guard.begin();
  // importFlowFromJSON's catch: end the load unless loadFlow already started.
  const importThrew = (importGeneration: number) => {
    if (guard.generation === importGeneration) guard.cancel();
  };
  // loadFlow up to its setTimeout: clears the canvas, loaded nodes pending.
  const loadFlowStart = (flowNodes: N[]) => {
    guard.awaitNodes(flowNodes);
    render([]);
  };
  // loadFlow's setTimeout, then the render that puts the nodes on the canvas.
  const loadFlowFinish = (flowNodes: N[]) => render(flowNodes);
  return {
    guard,
    saved: () => storage.get("chainforge-flow"),
    render,
    saveFlow,
    saveFlowLocally,
    importFlowFromJSON,
    importThrew,
    loadFlowStart,
    loadFlowFinish,
  };
};

const flow = [{ id: "prompt-1" }, { id: "textfields-2" }];

describe("saving while a flow loads", () => {
  test("pagehide between clearing the canvas and setting nodes keeps the autosave", () => {
    const a = app(flow);
    a.loadFlowStart(flow);
    a.saveFlow(); // pagehide: the canvas is empty right now
    expect(a.saved()).toEqual(flow);
    a.loadFlowFinish(flow);
    expect(a.guard.isLoading).toBe(false);
  });

  test("an importing flow blocks saves before loadFlow even runs", () => {
    const old = [{ id: "old" }];
    const a = app(old);
    a.importFlowFromJSON(); // cache being replaced, old nodes still on canvas
    a.render([{ id: "old" }]); // e.g. React Flow measuring the old node
    a.saveFlow();
    a.loadFlowStart(flow);
    a.saveFlow();
    expect(a.saved()).toEqual(old);
    a.loadFlowFinish(flow);
    a.saveFlow();
    expect(a.saved()).toEqual(flow);
  });

  test("saves resume once the loaded nodes are on the canvas", () => {
    const a = app([]);
    a.loadFlowStart(flow);
    a.loadFlowFinish(flow);
    a.render([...flow, { id: "new" }]);
    a.saveFlow();
    expect(a.saved()).toEqual([...flow, { id: "new" }]);
  });

  test("nodes React Flow has copied still end the load", () => {
    const a = app([]);
    a.loadFlowStart(flow);
    a.loadFlowFinish(flow.map((n) => ({ ...n, width: 100 })));
    expect(a.guard.isLoading).toBe(false);
  });

  test("a flow still loading when another load starts waits for the second", () => {
    const second = [{ id: "second" }];
    const a = app(flow);
    a.loadFlowStart(flow);
    a.loadFlowStart(second);
    a.loadFlowFinish(flow);
    expect(a.guard.isLoading).toBe(true);
    a.loadFlowFinish(second);
    expect(a.guard.isLoading).toBe(false);
  });

  test("loading an empty flow finishes and can be saved", () => {
    const a = app(flow);
    a.loadFlowStart([]);
    a.loadFlowFinish([]);
    a.saveFlow();
    expect(a.saved()).toEqual([]);
  });

  test("a user emptying the canvas themselves is saved", () => {
    // The New Flow / delete-everything case: no load, so nothing is refused.
    const a = app(flow);
    a.render([]);
    a.saveFlow();
    expect(a.saved()).toEqual([]);
  });

  test("a local save captured before a load doesn't land over the loaded flow", () => {
    const old = [{ id: "old" }];
    const a = app(old);
    const fallbackWrite = a.saveFlowLocally(); // server request in flight
    a.importFlowFromJSON();
    a.loadFlowStart(flow);
    a.loadFlowFinish(flow);
    a.saveFlow();
    fallbackWrite(); // the server request fails; fall back to localStorage
    expect(a.saved()).toEqual(flow);
  });

  test("a local save with no load in between still lands", () => {
    const a = app([]);
    a.render(flow);
    const fallbackWrite = a.saveFlowLocally();
    fallbackWrite();
    expect(a.saved()).toEqual(flow);
  });

  test("an import that throws before loadFlow re-enables saving", () => {
    const a = app(flow);
    a.importFlowFromJSON();
    a.importThrew(a.guard.generation); // e.g. flowJSON was null
    a.render([...flow, { id: "new" }]);
    a.saveFlow();
    expect(a.saved()).toEqual([...flow, { id: "new" }]);
  });

  test("an import that throws after loadFlow started keeps saves refused", () => {
    const a = app(flow);
    a.importFlowFromJSON();
    const importGeneration = a.guard.generation;
    a.loadFlowStart([{ id: "loaded" }]); // canvas now empty
    a.importThrew(importGeneration);
    a.saveFlow();
    expect(a.saved()).toEqual(flow);
  });

  test("an abandoned load re-enables saving", () => {
    const a = app(flow);
    a.importFlowFromJSON();
    a.guard.cancel(); // loadFlow was handed no flow
    expect(a.guard.isLoading).toBe(false);
  });
});
