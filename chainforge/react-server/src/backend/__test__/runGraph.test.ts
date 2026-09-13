import { beforeEach, describe, expect, test } from "@jest/globals";
import {
  NodeRunner,
  RunOutcome,
  downstreamRunOrder,
  outcomeFromStatus,
  runInOrder,
} from "../runGraph";
import {
  clearNodeRunners,
  getNodeRunner,
  hasNodeRunner,
  registerNodeRunner,
} from "../nodeRunnerRegistry";

const nodes = (...ids: string[]) => ids.map((id) => ({ id }));
const edge = (source: string, target: string) => ({ source, target });

// The flow the chat node exists for:
//   upload -> chunk -> retrieval <- chat
//                        |
//                      rerank -> join -> prompt -> inspect
const RAG_NODES = nodes(
  "upload",
  "chunk",
  "chat",
  "retrieval",
  "rerank",
  "join",
  "prompt",
  "inspect",
);
const RAG_EDGES = [
  edge("upload", "chunk"),
  edge("chunk", "retrieval"),
  edge("chat", "retrieval"),
  edge("retrieval", "rerank"),
  edge("rerank", "join"),
  edge("join", "prompt"),
  edge("prompt", "inspect"),
];

describe("downstreamRunOrder", () => {
  test("runs the pipeline after the chat node, in dependency order", () => {
    expect(downstreamRunOrder("chat", RAG_NODES, RAG_EDGES)).toEqual([
      "retrieval",
      "rerank",
      "join",
      "prompt",
      "inspect",
    ]);
  });

  test("never re-runs upstream work such as chunking", () => {
    // Chunking feeds retrieval but is not downstream of the chat node; redoing
    // it for every question would be pure waste.
    const order = downstreamRunOrder("chat", RAG_NODES, RAG_EDGES);
    expect(order).not.toContain("upload");
    expect(order).not.toContain("chunk");
  });

  test("excludes the start node itself", () => {
    expect(downstreamRunOrder("chat", RAG_NODES, RAG_EDGES)).not.toContain(
      "chat",
    );
  });

  test("a node with nothing downstream yields an empty order", () => {
    expect(downstreamRunOrder("inspect", RAG_NODES, RAG_EDGES)).toEqual([]);
  });

  test("a join point runs only after every branch feeding it", () => {
    //        -> a ->
    //  start         merge
    //        -> b ->
    const order = downstreamRunOrder(
      "start",
      nodes("start", "merge", "a", "b"),
      [
        edge("start", "a"),
        edge("start", "b"),
        edge("a", "merge"),
        edge("b", "merge"),
      ],
    );
    expect(order.indexOf("merge")).toBeGreaterThan(order.indexOf("a"));
    expect(order.indexOf("merge")).toBeGreaterThan(order.indexOf("b"));
  });

  test("a long branch still finishes before the node it feeds", () => {
    // Order by dependency, not by distance: 'merge' is one hop from start via
    // 'short' but must wait for the three-hop branch too.
    const order = downstreamRunOrder(
      "start",
      nodes("start", "short", "l1", "l2", "l3", "merge"),
      [
        edge("start", "short"),
        edge("short", "merge"),
        edge("start", "l1"),
        edge("l1", "l2"),
        edge("l2", "l3"),
        edge("l3", "merge"),
      ],
    );
    expect(order[order.length - 1]).toBe("merge");
  });

  test("ties follow node order, so repeated calls agree", () => {
    const n = nodes("start", "zeta", "alpha");
    const e = [edge("start", "zeta"), edge("start", "alpha")];
    expect(downstreamRunOrder("start", n, e)).toEqual(["zeta", "alpha"]);
    expect(downstreamRunOrder("start", n, e)).toEqual(["zeta", "alpha"]);
  });

  test("parallel handles between the same two nodes count once", () => {
    // A node wired to another through two handles must not wait forever for
    // a second in-degree decrement.
    expect(
      downstreamRunOrder("start", nodes("start", "a", "b"), [
        edge("start", "a"),
        edge("a", "b"),
        edge("a", "b"),
      ]),
    ).toEqual(["a", "b"]);
  });

  test("edges to deleted nodes are ignored", () => {
    expect(
      downstreamRunOrder("start", nodes("start", "a"), [
        edge("start", "a"),
        edge("a", "ghost"),
      ]),
    ).toEqual(["a"]);
  });

  test("an edge back into the start node does not loop", () => {
    expect(
      downstreamRunOrder("start", nodes("start", "a"), [
        edge("start", "a"),
        edge("a", "start"),
      ]),
    ).toEqual(["a"]);
  });

  test("a downstream cycle is refused, naming the nodes involved", () => {
    expect(() =>
      downstreamRunOrder("start", nodes("start", "a", "b"), [
        edge("start", "a"),
        edge("a", "b"),
        edge("b", "a"),
      ]),
    ).toThrow(/a, b|b, a/);
  });
});

describe("runInOrder", () => {
  /** A runner that records when it ran and ends with the given outcome. */
  function recorder(log: string[], id: string, outcome: RunOutcome = "ok") {
    return async () => {
      log.push(id);
      return outcome;
    };
  }

  test("runs every node in order when all succeed", async () => {
    const log: string[] = [];
    const runners: Record<string, NodeRunner> = {
      a: recorder(log, "a"),
      b: recorder(log, "b"),
      c: recorder(log, "c"),
    };
    const results = await runInOrder(["a", "b", "c"], (id) => runners[id]);
    expect(log).toEqual(["a", "b", "c"]);
    expect(results.map((r) => r.outcome)).toEqual(["ok", "ok", "ok"]);
  });

  test("waits for each node before starting the next", async () => {
    // The whole point: the prompt node must not read the join node's output
    // before the join has finished writing it.
    const log: string[] = [];
    const slow: NodeRunner = async () => {
      await new Promise((r) => setTimeout(r, 20));
      log.push("slow finished");
      return "ok";
    };
    const fast: NodeRunner = async () => {
      log.push("fast started");
      return "ok";
    };
    await runInOrder(["slow", "fast"], (id) => (id === "slow" ? slow : fast));
    expect(log).toEqual(["slow finished", "fast started"]);
  });

  test("stops at a failure instead of running on stale inputs", async () => {
    const log: string[] = [];
    const runners: Record<string, NodeRunner> = {
      retrieval: recorder(log, "retrieval", "failed"),
      prompt: recorder(log, "prompt"),
    };
    const results = await runInOrder(
      ["retrieval", "prompt"],
      (id) => runners[id],
    );
    expect(log).toEqual(["retrieval"]);
    expect(results).toEqual([{ nodeId: "retrieval", outcome: "failed" }]);
  });

  test("stops when a node reports it was cancelled", async () => {
    const log: string[] = [];
    const runners: Record<string, NodeRunner> = {
      a: recorder(log, "a", "cancelled"),
      b: recorder(log, "b"),
    };
    await runInOrder(["a", "b"], (id) => runners[id]);
    expect(log).toEqual(["a"]);
  });

  test("a thrown error becomes a failure carrying its message", async () => {
    const results = await runInOrder(["a", "b"], (id) =>
      id === "a"
        ? async () => {
            throw new Error("model download failed");
          }
        : async () => "ok" as RunOutcome,
    );
    expect(results).toEqual([
      { nodeId: "a", outcome: "failed", error: "model download failed" },
    ]);
  });

  test("a runner can report why it failed", async () => {
    const results = await runInOrder(["retrieval", "prompt"], (id) =>
      id === "retrieval"
        ? async () => ({
            outcome: "failed" as RunOutcome,
            error: "Input 'chunks' is missing or empty.",
          })
        : async () => "ok" as RunOutcome,
    );
    expect(results).toEqual([
      {
        nodeId: "retrieval",
        outcome: "failed",
        error: "Input 'chunks' is missing or empty.",
      },
    ]);
  });

  test("a runner reporting success without an error carries no error", async () => {
    const results = await runInOrder(["a"], () => async () => ({
      outcome: "ok" as RunOutcome,
    }));
    expect(results).toEqual([{ nodeId: "a", outcome: "ok" }]);
  });

  test("nodes without a runner are skipped, not treated as failures", async () => {
    const log: string[] = [];
    const results = await runInOrder(["inspect", "b"], (id) =>
      id === "b" ? recorder(log, "b") : undefined,
    );
    expect(results.map((r) => r.outcome)).toEqual(["skipped", "ok"]);
    expect(log).toEqual(["b"]);
  });

  test("cancellation is checked before each node", async () => {
    const log: string[] = [];
    let cancel = false;
    const runners: Record<string, NodeRunner> = {
      a: async () => {
        log.push("a");
        cancel = true; // the user presses stop while 'a' runs
        return "ok";
      },
      b: recorder(log, "b"),
    };
    const results = await runInOrder(["a", "b"], (id) => runners[id], {
      shouldCancel: () => cancel,
    });
    expect(log).toEqual(["a"]);
    expect(results.map((r) => r.outcome)).toEqual(["ok", "cancelled"]);
  });

  test("reports progress for every node it reaches", async () => {
    const started: string[] = [];
    const finished: string[] = [];
    await runInOrder(["a", "b"], () => async () => "ok", {
      onNodeStart: (id) => started.push(id),
      onNodeFinish: (r) => finished.push(`${r.nodeId}:${r.outcome}`),
    });
    expect(started).toEqual(["a", "b"]);
    expect(finished).toEqual(["a:ok", "b:ok"]);
  });

  test("an empty order resolves with no results", async () => {
    expect(await runInOrder([], () => undefined)).toEqual([]);
  });
});

describe("outcomeFromStatus", () => {
  test("ready is success", () => {
    expect(outcomeFromStatus("ready")).toBe("ok");
  });

  test("error is failure", () => {
    expect(outcomeFromStatus("error")).toBe("failed");
  });

  test("still loading after returning means it was stopped", () => {
    expect(outcomeFromStatus("loading")).toBe("cancelled");
  });

  test("none afterwards means it never started", () => {
    // Node run functions return early without touching status when they
    // refuse to start. Reset to 'none' first, and a stale 'ready' from the
    // previous run can never be mistaken for this run succeeding.
    expect(outcomeFromStatus("none")).toBe("failed");
  });

  test("warning is not success", () => {
    expect(outcomeFromStatus("warning")).toBe("failed");
  });
});

describe("nodeRunnerRegistry", () => {
  beforeEach(() => clearNodeRunners());

  test("a registered runner can be looked up", () => {
    const run: NodeRunner = async () => "ok";
    registerNodeRunner("n1", run);
    expect(getNodeRunner("n1")).toBe(run);
    expect(hasNodeRunner("n1")).toBe(true);
  });

  test("cleanup removes the registration", () => {
    const undo = registerNodeRunner("n1", async () => "ok");
    undo();
    expect(hasNodeRunner("n1")).toBe(false);
  });

  test("a stale cleanup does not remove a newer registration", () => {
    // Strict mode mounts effects twice; the first cleanup must not delete the
    // second registration and leave the node silently unrunnable.
    const first: NodeRunner = async () => "ok";
    const second: NodeRunner = async () => "ok";
    const undoFirst = registerNodeRunner("n1", first);
    registerNodeRunner("n1", second);
    undoFirst();
    expect(getNodeRunner("n1")).toBe(second);
  });

  test("unknown nodes have no runner", () => {
    expect(getNodeRunner("nope")).toBeUndefined();
  });

  test("the registry and runInOrder work together", async () => {
    const log: string[] = [];
    registerNodeRunner("a", async () => {
      log.push("a");
      return "ok";
    });
    registerNodeRunner("b", async () => {
      log.push("b");
      return "ok";
    });
    const order = downstreamRunOrder("start", nodes("start", "a", "b"), [
      edge("start", "a"),
      edge("a", "b"),
    ]);
    await runInOrder(order, getNodeRunner);
    expect(log).toEqual(["a", "b"]);
  });
});
