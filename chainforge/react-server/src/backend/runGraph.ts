/**
 * Running part of a flow programmatically.
 *
 * ChainForge nodes only ever ran when someone clicked their run button: each
 * node's run logic is a closure inside its component, and the store's
 * `pingOutputNodes` merely marks downstream nodes stale. That rules out any
 * feature that needs to push a new input through an existing flow -- a chat
 * box over a RAG pipeline, or a "run all" button.
 *
 * This module is the ordering and sequencing half of that, kept free of React
 * and of the store so it can be tested directly (the store's import graph does
 * not load under Jest). Nodes supply their runners through
 * nodeRunnerRegistry.ts.
 */

/** How one node's run ended. */
export type RunOutcome =
  /** Finished and produced output that downstream nodes can read. */
  | "ok"
  /** Could not produce output -- an error, or it refused to start. */
  | "failed"
  /** Stopped by the user, or the run was abandoned partway. */
  | "cancelled"
  /** Has no runner; nothing was done. Display-only nodes land here. */
  | "skipped";

export interface NodeRunResult {
  nodeId: string;
  outcome: RunOutcome;
  error?: string;
}

/** How a node's run ended, with the reason when it failed. */
export interface RunReport {
  outcome: RunOutcome;
  error?: string;
}

/** Runs one node and reports how it ended. Must not resolve before the node's
 * output is in the store, or the next node would read stale data. */
export type NodeRunner = () => Promise<RunOutcome | RunReport>;

export interface GraphNode {
  id: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

/**
 * Every node downstream of `startId`, ordered so each comes after all of the
 * downstream nodes it reads from.
 *
 * The start node itself is excluded: it is where new input enters, not
 * something to re-run. Upstream nodes are excluded too -- a chunker feeding a
 * retriever has already done its work, and re-running it per query would be
 * pure waste.
 *
 * Ties are broken by position in `nodes`, so the order is stable across calls.
 *
 * @throws If the downstream subgraph contains a cycle, which has no valid order.
 */
export function downstreamRunOrder(
  startId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): string[] {
  // Only edges between nodes that still exist; a dangling edge is not a
  // dependency on anything.
  const known = new Set(nodes.map((n) => n.id));
  const outgoing = new Map<string, Set<string>>();
  for (const { source, target } of edges) {
    if (!known.has(source) || !known.has(target)) continue;
    if (!outgoing.has(source)) outgoing.set(source, new Set());
    // A Set, because two handles joining the same pair of nodes are still one
    // dependency.
    (outgoing.get(source) as Set<string>).add(target);
  }

  // Everything reachable from the start.
  const reachable = new Set<string>();
  const frontier = [...(outgoing.get(startId) ?? [])];
  while (frontier.length > 0) {
    const id = frontier.pop() as string;
    if (id === startId || reachable.has(id)) continue;
    reachable.add(id);
    for (const next of outgoing.get(id) ?? []) frontier.push(next);
  }

  // Kahn's algorithm over the reachable subgraph. In-degree counts only edges
  // from other reachable nodes: the start node is the input, and anything
  // upstream is already computed.
  const indegree = new Map<string, number>();
  for (const id of reachable) indegree.set(id, 0);
  for (const id of reachable)
    for (const next of outgoing.get(id) ?? [])
      if (reachable.has(next))
        indegree.set(next, (indegree.get(next) as number) + 1);

  const position = new Map(nodes.map((n, i) => [n.id, i]));
  const byPosition = (a: string, b: string) =>
    (position.get(a) as number) - (position.get(b) as number);

  const ready = [...reachable].filter((id) => indegree.get(id) === 0);
  ready.sort(byPosition);
  const order: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    const released: string[] = [];
    for (const next of outgoing.get(id) ?? []) {
      if (!reachable.has(next)) continue;
      const remaining = (indegree.get(next) as number) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) released.push(next);
    }
    ready.push(...released);
    ready.sort(byPosition);
  }

  if (order.length !== reachable.size) {
    const stuck = [...reachable].filter((id) => !order.includes(id));
    throw new Error(
      `Cannot run this flow: nodes ${stuck.join(", ")} form a cycle, so no ` +
        `order exists in which each runs after the nodes it depends on.`,
    );
  }
  return order;
}

export interface RunInOrderOptions {
  /** Polled before each node; returning true stops the run. */
  shouldCancel?: () => boolean;
  onNodeStart?: (nodeId: string) => void;
  onNodeFinish?: (result: NodeRunResult) => void;
}

/**
 * Runs nodes one at a time, in the given order.
 *
 * Stops at the first node that fails or is cancelled. Continuing would run
 * the rest of the flow on missing or stale inputs, which is worse than
 * stopping: a chat answer built on the previous query's retrieval would look
 * plausible and be wrong.
 *
 * Nodes without a runner are skipped rather than treated as failures, so
 * display-only nodes (inspectors, plots) downstream of the pipeline do not
 * block it.
 *
 * Resolves with one result per node reached; nodes after a stop are omitted.
 */
export async function runInOrder(
  order: string[],
  getRunner: (nodeId: string) => NodeRunner | undefined,
  options: RunInOrderOptions = {},
): Promise<NodeRunResult[]> {
  const results: NodeRunResult[] = [];

  for (const nodeId of order) {
    if (options.shouldCancel?.()) {
      const result: NodeRunResult = { nodeId, outcome: "cancelled" };
      results.push(result);
      options.onNodeFinish?.(result);
      break;
    }

    const runner = getRunner(nodeId);
    if (!runner) {
      const result: NodeRunResult = { nodeId, outcome: "skipped" };
      results.push(result);
      options.onNodeFinish?.(result);
      continue;
    }

    options.onNodeStart?.(nodeId);
    let result: NodeRunResult;
    try {
      const report = await runner();
      if (typeof report === "string") result = { nodeId, outcome: report };
      else if (report.error)
        result = { nodeId, outcome: report.outcome, error: report.error };
      else result = { nodeId, outcome: report.outcome };
    } catch (err) {
      result = {
        nodeId,
        outcome: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
    results.push(result);
    options.onNodeFinish?.(result);

    if (result.outcome === "failed" || result.outcome === "cancelled") break;
  }

  return results;
}

/**
 * Maps a node's status after its run function returns onto an outcome.
 *
 * Node run functions report failure by setting an error status rather than
 * throwing, and return early without any status change when they refuse to
 * start. A runner should therefore reset its tracked status to "none" before
 * calling the run function, then pass the final status here: "none" afterwards
 * means the run never began, which is a failure, not success carried over
 * from a previous run.
 *
 * Takes the status as a plain string so this module stays free of the
 * component that defines the Status enum; its values are these strings.
 */
export function outcomeFromStatus(status: string): RunOutcome {
  switch (status) {
    case "ready":
      return "ok";
    case "loading":
      // Returned while still loading: the run was stopped or abandoned.
      return "cancelled";
    case "error":
    case "none":
    case "warning":
    default:
      return "failed";
  }
}
