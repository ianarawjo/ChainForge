/**
 * Whether a flow is partway through loading, so saves can wait until it is on
 * the canvas.
 *
 * Loading a flow is not atomic. Importing first replaces the back-end cache
 * (async), then the canvas is emptied, so React Flow forgets the old node ids,
 * and only after a delay are the loaded nodes set. React Flow's own store,
 * which rf.toObject() reads, catches up one render later still. A save in
 * that window -- the minute-long autosave, or saving on pagehide when the
 * page reloads -- wrote an empty flow over the autosave, losing the flow.
 *
 * An empty canvas alone can't be refused: the user may have deleted every
 * node on purpose. So the load itself is tracked instead.
 */

type NodeLike = { id: string };

const LOADING = Symbol("loading");

export class FlowLoadGuard {
  // null when idle; LOADING before the flow's nodes are known; then the
  // nodes that have to reach the canvas before the load counts as done.
  private pending: typeof LOADING | readonly NodeLike[] | null = null;
  private loads = 0;

  /** A load has started. Saves are refused until it finishes. */
  begin(): void {
    this.loads++;
    this.pending = LOADING;
  }

  /** The load will finish once these nodes have rendered on the canvas. */
  awaitNodes(nodes: readonly NodeLike[]): void {
    this.loads++;
    this.pending = nodes;
  }

  /**
   * Call after each render with the canvas's nodes. Ends the load once the
   * awaited nodes are the ones on the canvas. Matched by id, not identity, in
   * case React Flow has already copied them (e.g. to record their size). The
   * empty canvas on the way only matches when the loaded flow is itself
   * empty, and then saving it loses nothing.
   */
  nodesRendered(nodes: readonly NodeLike[]): void {
    const pending = this.pending;
    if (pending === null || pending === LOADING) return;
    if (
      nodes === pending ||
      (nodes.length === pending.length &&
        nodes.every((n, i) => n.id === pending[i].id))
    )
      this.pending = null;
  }

  /** The load was abandoned; the canvas still holds the previous flow. */
  cancel(): void {
    this.pending = null;
  }

  /**
   * Changes whenever a load starts. A save that captures the flow and writes
   * it later (after an async step) checks this is unchanged before writing,
   * since a flow loaded in between would otherwise be replaced by the old one.
   */
  get generation(): number {
    return this.loads;
  }

  get isLoading(): boolean {
    return this.pending !== null;
  }
}
