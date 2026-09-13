/**
 * Runs everything downstream of a node, using the nodes' registered runners.
 *
 * The store-facing half of backend/runGraph.ts. That module orders and
 * sequences nodes but deliberately does not import the store, whose import
 * graph does not load under Jest; this thin layer reads the live graph and
 * hands it over.
 */

import useStore from "./store";
import { getNodeRunner } from "./backend/nodeRunnerRegistry";
import {
  NodeRunResult,
  RunInOrderOptions,
  downstreamRunOrder,
  runInOrder,
} from "./backend/runGraph";

/**
 * Re-runs every node downstream of `nodeId`, each after the nodes it reads.
 *
 * Nodes upstream are left alone -- for a chat box feeding a RAG pipeline, that
 * means the corpus is not re-chunked on every question.
 *
 * @throws If the downstream graph contains a cycle.
 */
export async function runDownstreamOf(
  nodeId: string,
  options: RunInOrderOptions = {},
): Promise<NodeRunResult[]> {
  const { nodes, edges } = useStore.getState();
  const order = downstreamRunOrder(nodeId, nodes, edges);
  return runInOrder(order, getNodeRunner, options);
}
