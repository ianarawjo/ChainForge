/**
 * Brings proposed nodes into view, in the part of the canvas the chat panel
 * doesn't cover.
 */

import {
  getRectOfNodes,
  getTransformForBounds,
  ReactFlowInstance,
} from "reactflow";

const POLL_MS = 50;
const GIVE_UP_MS = 2000;
const MARGIN = 16;
/**
 * The furthest out the view zooms. Nodes are hard to read below this, so a
 * proposal too wide to fit is shown from its left, running under the panel.
 */
const MIN_ZOOM = 0.65;

/**
 * Waits until React Flow has measured the nodes (new nodes have no size at
 * first, and can't be fitted), then fits them into the canvas left of the
 * chat panel. Gives up quietly if they never appear, e.g. when the proposal
 * was replaced meanwhile.
 */
export function focusNodes(reactFlow: ReactFlowInstance, ids: string[]) {
  if (ids.length === 0) return;
  const wanted = new Set(ids);
  const started = Date.now();

  const attempt = () => {
    const nodes = reactFlow.getNodes().filter((n) => wanted.has(n.id));
    const measured =
      nodes.length === wanted.size && nodes.every((n) => n.width && n.height);
    if (!measured) {
      if (Date.now() - started < GIVE_UP_MS) setTimeout(attempt, POLL_MS);
      return;
    }

    const canvas = document
      .querySelector(".react-flow")
      ?.getBoundingClientRect();
    if (!canvas) return;
    const panel = document
      .querySelector(".chainbuddy-panel")
      ?.getBoundingClientRect();
    // The panel floats over the canvas's right side.
    const width = panel
      ? Math.max(panel.left - canvas.left - MARGIN, canvas.width / 3)
      : canvas.width;
    const rect = getRectOfNodes(nodes);
    const [x, y, zoom] = getTransformForBounds(
      rect,
      width,
      canvas.height,
      MIN_ZOOM,
      1,
      0.15,
    );
    // At MIN_ZOOM the nodes may not fit; start with the leftmost.
    const fits = rect.width * zoom <= width;
    reactFlow.setViewport(
      { x: fits ? x : MARGIN * 2 - rect.x * zoom, y, zoom },
      { duration: 400 },
    );
  };
  attempt();
}
