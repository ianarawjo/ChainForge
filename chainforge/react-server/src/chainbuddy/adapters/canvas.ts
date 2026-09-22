/**
 * The canvas, as the Flow API reaches it: reads the store, and shows change
 * sets on it for the user to accept or reject.
 *
 * Proposed nodes and connections are real nodes and edges, drawn dashed, so
 * the user sees exactly what they'd get. Edits to existing nodes and removals
 * wait until the user accepts; the nodes they touch are outlined meanwhile.
 * The exception is an unfinished node, such as the blank ones a new flow
 * starts with: an edit to one is shown filled in, since there is little to
 * lose, and the node keeps its old data (ORIGINAL_KEY) to go back to.
 */

import { Edge, MarkerType, Node } from "reactflow";
import { v4 as uuid } from "uuid";
import { Dict } from "../../backend/typing";
import useStore from "../../store";
import { ChangeLine, describeChanges } from "../flowApi/describe";
import {
  CanvasPort,
  Change,
  ChangeSet,
  ConnectionView,
  FlowView,
  ModelInfo,
  NodeView,
  ProposalReceipt,
} from "../flowApi/types";
import { inputsOf, kindOf, supportOf } from "../nodes";
import { listModels, modelResolver } from "./models";

export const PENDING_CLASS = {
  add: "chainbuddy-pending-add",
  update: "chainbuddy-pending-update",
  remove: "chainbuddy-pending-remove",
  fill: "chainbuddy-pending-fill",
};

/**
 * Where a node shown filled in keeps its data from before, so a reload while
 * the proposal waits can still put it back.
 */
export const ORIGINAL_KEY = "chainbuddyOriginal";

/** A node's data as the flow has it, ignoring a proposal shown filled in. */
const flowData = (node: Node): Dict =>
  node.data?.[ORIGINAL_KEY] ?? node.data ?? {};

export type ProposalStatus =
  | "pending"
  /** Being applied after the user accepted it. */
  | "applying"
  | "accepted"
  | "rejected"
  | "replaced"
  | "failed";

export interface Proposal {
  id: string;
  summary: string;
  lines: ChangeLine[];
  status: ProposalStatus;
  error?: string;
}

interface ProposalState extends Proposal {
  changes: Change[];
  /** Ref or id → the node's id on the canvas. */
  ids: Map<string, string>;
  addedNodes: string[];
  addedEdges: string[];
  /** Connections to inputs that only exist once an edit is applied. */
  deferred: Extract<Change, { op: "connect" }>[];
  /** Existing nodes this proposal outlines, and the class each had before. */
  outlined: Map<string, string | undefined>;
  /** Existing nodes shown filled in with their edit. */
  filled: string[];
}

const TICK_MS = 20;

/**
 * How long the canvas must be still before leftover proposed nodes are
 * removed. Loading a flow counts as finished (and saving resumes) only once
 * its nodes render exactly as loaded (see backend/flowLoadGuard.ts), so
 * removing nodes straight away would keep saves refused for the session.
 */
export const ORPHAN_SETTLE_MS = 1000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CanvasEvents {
  /** A proposal appeared or changed status. */
  onProposal?: (proposal: Proposal) => void;
  /** Nodes the user should look at. */
  onFocus?: (nodeIds: string[]) => void;
}

/** The canvas backed by ChainForge's store. One per chat panel. */
export class StoreCanvas implements CanvasPort {
  private proposals = new Map<string, ProposalState>();
  /**
   * Redrawing a node takes a tick, so redraws run one after another, and
   * accepting waits for them.
   */
  private redraws: Promise<void> = Promise.resolve();

  private readonly events: CanvasEvents;

  constructor(events: CanvasEvents = {}) {
    this.events = events;
  }

  readFlow(): FlowView {
    const { nodes, edges } = useStore.getState();
    // Proposed nodes aren't part of the flow until accepted.
    const hidden = new Set<string>();
    const hiddenEdges = new Set<string>();
    for (const p of Array.from(this.proposals.values()))
      if (p.status === "pending") {
        p.addedNodes.forEach((id) => hidden.add(id));
        p.addedEdges.forEach((id) => hiddenEdges.add(id));
      }
    const shown = nodes.filter((n) => !hidden.has(n.id));
    const types = new Map(shown.map((n) => [n.id, n.type]));
    const liveEdges = edges.filter(
      (e) =>
        !hiddenEdges.has(e.id) && types.has(e.source) && types.has(e.target),
    );

    const views: NodeView[] = shown.map((n) => {
      const data = flowData(n);
      const support = supportOf(n.type, data);
      const title = data.title ?? n.type ?? "Node";
      if (support === "not-supported" || !n.type)
        return {
          id: n.id,
          type: n.type ?? "unknown",
          title,
          support,
          inputs: uniq(
            liveEdges
              .filter((e) => e.target === n.id)
              .map((e) => e.targetHandle),
          ),
          outputs: uniq(
            liveEdges
              .filter((e) => e.source === n.id)
              .map((e) => e.sourceHandle),
          ),
        };
      const settings = settingsOf(n.type, data);
      return {
        id: n.id,
        type: n.type,
        title: String(settings.title ?? title),
        support,
        settings,
        inputs: inputsOf(n.type, settings),
        outputs: [kindOf(n.type)?.output ?? ""],
      };
    });

    const connections: ConnectionView[] = liveEdges.map((e) => ({
      from: {
        node: e.source,
        output: outputName(types.get(e.source), e.sourceHandle),
      },
      to: {
        node: e.target,
        input: inputName(types.get(e.target), e.targetHandle),
      },
    }));
    return { nodes: views, connections };
  }

  listModels(): ModelInfo[] {
    return listModels();
  }

  propose(changeSet: ChangeSet): ProposalReceipt {
    let replaced: string | undefined;
    for (const p of Array.from(this.proposals.values()))
      if (p.status === "pending") {
        this.clear(p);
        this.setStatus(p, "replaced");
        replaced = p.id;
      }

    const flow = this.readFlow();
    const state: ProposalState = {
      // Unique across canvases, since the chat panel may outlive this one.
      id: `change-set-${uuid().slice(0, 8)}`,
      summary: changeSet.summary,
      lines: describeChanges(flow, changeSet),
      status: "pending",
      changes: changeSet.changes,
      ids: new Map(flow.nodes.map((n) => [n.id, n.id])),
      addedNodes: [],
      addedEdges: [],
      deferred: [],
      outlined: new Map(),
      filled: [],
    };
    this.proposals.set(state.id, state);

    const store = useStore.getState();
    const positions = layout(changeSet.changes, store.nodes);
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const typeOf = (id: string) =>
      newNodes.find((n) => n.id === id)?.type ??
      store.nodes.find((n) => n.id === id)?.type ??
      "";
    // Inputs each node has on the canvas right now.
    const inputsNow = new Map(flow.nodes.map((n) => [n.id, n.inputs]));
    // Unfinished nodes shown filled in → their proposed data.
    const fills = new Map<string, Dict>();

    for (const change of changeSet.changes) {
      if (change.op === "add_node") {
        const id = `${change.type}Node-${uuid()}`;
        state.ids.set(change.ref, id);
        const data = dataWithSettings(change.type, change.settings, undefined);
        newNodes.push({
          id,
          type: change.type,
          data,
          position: positions.get(change.ref) ?? { x: 0, y: 0 },
          className: PENDING_CLASS.add,
        });
        inputsNow.set(id, inputsOf(change.type, change.settings));
        state.addedNodes.push(id);
      } else if (change.op === "update_node" || change.op === "remove_node") {
        const id = state.ids.get(change.node) ?? change.node;
        const added = newNodes.find((n) => n.id === id);
        const node = store.nodes.find((n) => n.id === id);
        if (
          !added &&
          change.op === "update_node" &&
          node?.type &&
          (fills.has(id) || isUnfinished(node))
        ) {
          const data = dataWithSettings(
            node.type,
            change.settings,
            fills.get(id) ?? flowData(node),
          );
          fills.set(id, data);
          inputsNow.set(id, inputsOf(node.type, settingsOf(node.type, data)));
          this.outline(state, id, "fill");
        } else if (!added)
          this.outline(
            state,
            id,
            change.op === "update_node" ? "update" : "remove",
          );
        // A node this same change set adds is simply built as it ends up.
        else if (change.op === "update_node" && added.type) {
          added.data = dataWithSettings(
            added.type,
            change.settings,
            added.data,
          );
          inputsNow.set(
            id,
            inputsOf(added.type, settingsOf(added.type, added.data)),
          );
        } else {
          newNodes.splice(newNodes.indexOf(added), 1);
          state.addedNodes = state.addedNodes.filter((n) => n !== id);
          for (const e of newEdges.filter(
            (e) => e.source === id || e.target === id,
          ))
            newEdges.splice(newEdges.indexOf(e), 1);
          state.addedEdges = newEdges.map((e) => e.id);
        }
      } else if (change.op === "connect") {
        const source = state.ids.get(change.from.node) ?? change.from.node;
        const target = state.ids.get(change.to.node) ?? change.to.node;
        // An input an edit creates doesn't exist on the canvas yet.
        if (!(inputsNow.get(target) ?? []).includes(change.to.input)) {
          state.deferred.push(change);
          continue;
        }
        const edge = makeEdge(
          source,
          target,
          typeOf(source),
          typeOf(target),
          change.to.input,
        );
        edge.className = PENDING_CLASS.add;
        newEdges.push(edge);
        state.addedEdges.push(edge.id);
      }
    }

    // Connections to filled-in nodes wait until they're redrawn.
    const touchesFill = (e: Edge) => fills.has(e.source) || fills.has(e.target);
    useStore.setState((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...s.edges, ...newEdges.filter((e) => !touchesFill(e))],
    }));
    state.filled = Array.from(fills.keys());
    for (const [nodeId, data] of Array.from(fills.entries())) {
      const node = store.nodes.find((n) => n.id === nodeId) as Node;
      const withOriginal = { ...data, [ORIGINAL_KEY]: flowData(node) };
      // Each connection comes back with the node it goes into, or with the
      // node it comes from when that's the only one filled in.
      const edges = newEdges.filter(
        (e) =>
          e.target === nodeId || (e.source === nodeId && !fills.has(e.target)),
      );
      this.redraw(nodeId, withOriginal, edges);
    }
    this.events.onProposal?.(publicView(state));
    this.events.onFocus?.([
      ...state.addedNodes,
      ...Array.from(state.outlined.keys()),
    ]);
    return { id: state.id, replaced };
  }

  /** Applies a proposal. Edited nodes are rebuilt, so they pick up their new data. */
  async accept(id: string): Promise<void> {
    const state = this.proposals.get(id);
    if (!state || state.status !== "pending") return;
    // Applying takes a few ticks. Marking it now stops a second click on
    // Accept, or a Reject, from working on it at the same time.
    this.setStatus(state, "applying");
    await this.redraws;

    // Check everything is still there before changing anything, so a node
    // deleted since the proposal can't leave it half-applied.
    if (this.missingNodes(state).length > 0) {
      this.clear(state);
      state.error =
        "A node this proposal changes or connects was deleted after it was proposed, so nothing was changed. Ask ChainBuddy again.";
      this.setStatus(state, "failed");
      return;
    }

    try {
      const store = useStore.getState();
      // Proposed nodes and edges become ordinary ones.
      const added = new Set([...state.addedNodes, ...state.addedEdges]);
      // Filled-in nodes already have their new data.
      const filled = new Set(state.filled);
      useStore.setState((s) => ({
        nodes: s.nodes.map((n) => {
          if (added.has(n.id)) return { ...n, className: undefined };
          if (!filled.has(n.id)) return n;
          const { [ORIGINAL_KEY]: _, ...data } = n.data ?? {};
          return { ...n, data };
        }),
        edges: s.edges.map((e) =>
          added.has(e.id) ? { ...e, className: undefined } : e,
        ),
      }));
      this.restoreOutlines(state);

      for (const change of state.changes) {
        if (change.op === "remove_node") {
          const nodeId = state.ids.get(change.node) ?? change.node;
          useStore.setState((s) => ({
            nodes: s.nodes.filter((n) => n.id !== nodeId),
            edges: s.edges.filter(
              (e) => e.source !== nodeId && e.target !== nodeId,
            ),
          }));
        } else if (change.op === "update_node") {
          // Existing nodes map to themselves; refs map to nodes this proposal
          // added, which were already built with their final settings.
          const isExisting = state.ids.get(change.node) === change.node;
          if (isExisting && !filled.has(change.node))
            await this.rebuild(change.node, change.settings);
        }
      }

      const typeOf = (nodeId: string) =>
        useStore.getState().nodes.find((n) => n.id === nodeId)?.type ?? "";
      const deferred = state.deferred.map((c) => {
        const source = state.ids.get(c.from.node) ?? c.from.node;
        const target = state.ids.get(c.to.node) ?? c.to.node;
        return makeEdge(
          source,
          target,
          typeOf(source),
          typeOf(target),
          c.to.input,
        );
      });
      if (deferred.length > 0) {
        // Let rebuilt nodes draw their new inputs before connecting to them.
        await wait(TICK_MS);
        useStore.setState((s) => ({ edges: [...s.edges, ...deferred] }));
      }

      // Existing nodes with new inputs have out-of-date results now.
      const touched = new Set(
        [
          ...useStore.getState().edges.filter((e) => added.has(e.id)),
          ...deferred,
        ].map((e) => e.target),
      );
      for (const nodeId of Array.from(touched))
        if (!state.addedNodes.includes(nodeId))
          store.setDataPropsForNode(nodeId, { refresh: true });

      this.setStatus(state, "accepted");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      state.error = `${message} Some of the changes may already have been applied; check the canvas.`;
      this.setStatus(state, "failed");
    }
  }

  /** Nodes a proposal needs that are no longer on the canvas. */
  private missingNodes(state: ProposalState): string[] {
    const present = new Set(useStore.getState().nodes.map((n) => n.id));
    const resolve = (ref: string) => state.ids.get(ref) ?? ref;
    const removedEarlier = new Set<string>();
    const needed = new Set<string>(state.addedNodes);
    for (const change of state.changes) {
      if (change.op === "update_node" || change.op === "remove_node") {
        const id = resolve(change.node);
        if (!removedEarlier.has(id)) needed.add(id);
        if (change.op === "remove_node") removedEarlier.add(id);
      } else if (change.op === "connect") {
        needed.add(resolve(change.from.node));
        needed.add(resolve(change.to.node));
      }
    }
    return Array.from(needed).filter((id) => !present.has(id));
  }

  /**
   * Removes proposed nodes and outlines no live proposal owns. They appear
   * when a flow was saved while a proposal waited, then reloaded: the card to
   * accept or reject them is gone, so they were never accepted. Waits until
   * the canvas has been still for `settleMs`, so a loading flow finishes
   * first. Returns a function that stops watching.
   */
  removeOrphans(settleMs = ORPHAN_SETTLE_MS): () => void {
    const clean = () => {
      const owned = new Set<string>();
      const outlined = new Set<string>();
      for (const p of Array.from(this.proposals.values()))
        if (p.status === "pending" || p.status === "applying") {
          [...p.addedNodes, ...p.addedEdges].forEach((id) => owned.add(id));
          p.outlined.forEach((_, id) => outlined.add(id));
        }
      const { nodes, edges } = useStore.getState();
      // Filled-in nodes go back to how they were.
      for (const n of nodes)
        if (n.data?.[ORIGINAL_KEY] && !outlined.has(n.id))
          this.redraw(n.id, n.data[ORIGINAL_KEY]);
      const isPending = (cls: string | undefined) =>
        !!cls && Object.values(PENDING_CLASS).includes(cls);
      const orphanNodes = new Set(
        nodes
          .filter((n) => n.className === PENDING_CLASS.add && !owned.has(n.id))
          .map((n) => n.id),
      );
      const staleOutlines = nodes.some(
        (n) =>
          isPending(n.className) &&
          n.className !== PENDING_CLASS.add &&
          !outlined.has(n.id),
      );
      const orphanEdges = edges.some(
        (e) =>
          (e.className === PENDING_CLASS.add && !owned.has(e.id)) ||
          orphanNodes.has(e.source) ||
          orphanNodes.has(e.target),
      );
      if (orphanNodes.size === 0 && !staleOutlines && !orphanEdges) return;
      useStore.setState((s) => ({
        nodes: s.nodes
          .filter((n) => !orphanNodes.has(n.id))
          .map((n) =>
            isPending(n.className) && !outlined.has(n.id) && !owned.has(n.id)
              ? { ...n, className: undefined }
              : n,
          ),
        edges: s.edges.filter(
          (e) =>
            !(e.className === PENDING_CLASS.add && !owned.has(e.id)) &&
            !orphanNodes.has(e.source) &&
            !orphanNodes.has(e.target),
        ),
      }));
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanWhenSettled = () => {
      clearTimeout(timer);
      timer = setTimeout(clean, settleMs);
    };
    cleanWhenSettled();
    // Also after a flow loads later on.
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.nodes !== prev.nodes) cleanWhenSettled();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }

  /**
   * Calls `onSwitch` when another flow replaces the one on the canvas: a
   * change that leaves none of the last nodes. New Flow replaces every node
   * at once; loading a flow empties the canvas first, so empty canvases are
   * skipped. Returns a function that stops watching.
   */
  watchForFlowSwitch(onSwitch: () => void): () => void {
    let last = new Set(useStore.getState().nodes.map((n) => n.id));
    return useStore.subscribe((state, prev) => {
      if (state.nodes === prev.nodes || state.nodes.length === 0) return;
      const ids = state.nodes.map((n) => n.id);
      const switched = last.size > 0 && !ids.some((id) => last.has(id));
      // Recorded before calling onSwitch, which may change the store and
      // bring us straight back here.
      last = new Set(ids);
      if (switched) onSwitch();
    });
  }

  reject(id: string): void {
    const state = this.proposals.get(id);
    if (!state || state.status !== "pending") return;
    this.clear(state);
    this.setStatus(state, "rejected");
  }

  /** Takes a proposal off the canvas, leaving the flow as it was. */
  private clear(state: ProposalState) {
    const proposed = new Set(state.addedEdges);
    for (const nodeId of state.filled)
      this.redraw(nodeId, undefined, [], proposed);
    const nodes = new Set(state.addedNodes);
    const edges = new Set(state.addedEdges);
    useStore.setState((s) => ({
      nodes: s.nodes.filter((n) => !nodes.has(n.id)),
      edges: s.edges.filter(
        (e) => !edges.has(e.id) && !nodes.has(e.source) && !nodes.has(e.target),
      ),
    }));
    this.restoreOutlines(state);
  }

  private outline(
    state: ProposalState,
    nodeId: string,
    kind: "update" | "remove" | "fill",
  ) {
    const node = useStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (!state.outlined.has(nodeId)) state.outlined.set(nodeId, node.className);
    useStore.setState((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, className: PENDING_CLASS[kind] } : n,
      ),
    }));
  }

  private restoreOutlines(state: ProposalState) {
    useStore.setState((s) => ({
      nodes: s.nodes.map((n) =>
        state.outlined.has(n.id)
          ? { ...n, className: state.outlined.get(n.id) }
          : n,
      ),
    }));
    state.outlined.clear();
  }

  /** Applies an edit to a node, redrawing it (see redrawNow). */
  private async rebuild(nodeId: string, settings: Record<string, unknown>) {
    const node = useStore.getState().nodes.find((n) => n.id === nodeId);
    if (!node || !node.type) throw new Error(`The node ${nodeId} is gone.`);
    await this.redrawNow(
      nodeId,
      dataWithSettings(node.type, settings, node.data),
    );
  }

  /**
   * Queues a redraw (see redrawNow). With no data, the node goes back to the
   * data it kept under ORIGINAL_KEY, if it's still shown filled in by then.
   */
  private redraw(
    nodeId: string,
    data?: Dict,
    addEdges: Edge[] = [],
    dropEdges = new Set<string>(),
  ) {
    this.redraws = this.redraws.then(async () => {
      const node = useStore.getState().nodes.find((n) => n.id === nodeId);
      const next = data ?? node?.data?.[ORIGINAL_KEY];
      if (node && next)
        await this.redrawNow(nodeId, next, addEdges, dropEdges).catch((err) =>
          console.error("ChainBuddy couldn't redraw a node:", err),
        );
    });
  }

  /**
   * Replaces a node's data and redraws it from scratch. Most nodes copy their
   * data into their own state when they first appear, so changing the data
   * of a node already on screen wouldn't show, or be used when it runs.
   * Everything that can fail happens before the node is taken off, so a
   * failure leaves it as it was rather than gone.
   */
  private async redrawNow(
    nodeId: string,
    data: Dict,
    addEdges: Edge[] = [],
    dropEdges = new Set<string>(),
  ) {
    const { nodes, edges } = useStore.getState();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !node.type) throw new Error(`The node ${nodeId} is gone.`);
    const itsEdges = edges.filter(
      (e) => e.source === nodeId || e.target === nodeId,
    );
    const inputs = inputsOf(node.type, settingsOf(node.type, data));
    const redrawn = { ...node, data: { ...data, refresh: true } };
    // Connections to inputs the new data removed go with them.
    const keptEdges = itsEdges.filter(
      (e) =>
        !dropEdges.has(e.id) &&
        (e.target !== nodeId ||
          inputs.includes(inputName(node.type, e.targetHandle))),
    );

    useStore.setState((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => !itsEdges.includes(e)),
    }));
    await wait(TICK_MS);
    useStore.setState((s) => ({
      nodes: [...s.nodes, redrawn],
      edges: [...s.edges, ...keptEdges, ...addEdges],
    }));
  }

  private setStatus(state: ProposalState, status: ProposalStatus) {
    state.status = status;
    this.events.onProposal?.(publicView(state));
  }
}

function publicView(state: ProposalState): Proposal {
  const { id, summary, lines, status, error } = state;
  return { id, summary, lines, status, error };
}

// Translating between ChainForge's nodes and ChainBuddy's view of them.

/** ChainBuddy's settings for a node, from its data. */
function settingsOf(type: string, data: Dict): Record<string, unknown> {
  return (
    kindOf(type)?.read(data, modelResolver) ?? { title: data.title ?? type }
  );
}

/** Node data with settings applied (see NodeKind.write). */
function dataWithSettings(
  type: string,
  settings: Record<string, unknown>,
  base: Dict | undefined,
): Dict {
  const kind = kindOf(type);
  if (!kind) throw new Error(`ChainBuddy can't edit ${type} nodes.`);
  return kind.write(settings, base, modelResolver);
}

/** ChainBuddy's name for the start of an edge. */
function outputName(
  type: string | undefined,
  handle: string | null | undefined,
) {
  return kindOf(type)?.output ?? handle ?? "";
}

/** ChainBuddy's name for the end of an edge. */
function inputName(
  type: string | undefined,
  handle: string | null | undefined,
) {
  const renamed = Object.entries(kindOf(type)?.handles.inputs ?? {}).find(
    ([, id]) => id === handle,
  );
  return renamed?.[0] ?? handle ?? "";
}

/** The handle ids for a ChainBuddy connection. */
function handlesFor(sourceType: string, targetType: string, input: string) {
  const source = kindOf(sourceType);
  const target = kindOf(targetType);
  if (!source || !target)
    throw new Error(`ChainBuddy can't connect ${sourceType} to ${targetType}.`);
  return {
    sourceHandle: source.handles.output,
    targetHandle: target.handles.inputs?.[input] ?? input,
  };
}

function makeEdge(
  source: string,
  target: string,
  sourceType: string,
  targetType: string,
  input: string,
): Edge {
  const { sourceHandle, targetHandle } = handlesFor(
    sourceType,
    targetType,
    input,
  );
  // Styled as the store's onConnect styles edges people draw.
  return {
    id: `chainbuddy-edge-${uuid()}`,
    source,
    sourceHandle,
    target,
    targetHandle,
    interactionWidth: 40,
    animated: true,
    markerEnd: { type: MarkerType.Arrow, width: 22, height: 22 },
    type: "default",
  };
}

/**
 * Places new nodes in columns to the right of the flow, each column after
 * the nodes that feed it.
 */
function layout(changes: Change[], existing: Node[]) {
  const refs = changes.flatMap((c) => (c.op === "add_node" ? [c.ref] : []));
  const feeds = changes.flatMap((c) => (c.op === "connect" ? [c] : []));
  const column = new Map<string, number>(refs.map((r) => [r, 0]));
  // Longest chain of new nodes leading into each one.
  for (let pass = 0; pass < refs.length; pass++)
    for (const c of feeds)
      if (column.has(c.from.node) && column.has(c.to.node))
        column.set(
          c.to.node,
          Math.max(
            column.get(c.to.node) ?? 0,
            (column.get(c.from.node) ?? 0) + 1,
          ),
        );

  const right = existing.length
    ? Math.max(...existing.map((n) => n.position.x + (n.width ?? 400))) + 120
    : 100;
  const top = existing.length
    ? Math.min(...existing.map((n) => n.position.y))
    : 100;
  const rows = new Map<number, number>();
  const positions = new Map<string, { x: number; y: number }>();
  for (const ref of refs) {
    const col = column.get(ref) ?? 0;
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    positions.set(ref, { x: right + col * 480, y: top + row * 320 });
  }
  return positions;
}

/** Whether a node isn't finished yet, such as a blank Prompt Node. */
function isUnfinished(node: Node): boolean {
  const type = node.type ?? "";
  const kind = kindOf(type);
  const data = flowData(node);
  if (!kind?.missing || supportOf(type, data) !== "editable") return false;
  return !!kind.missing(settingsOf(type, data));
}

function uniq(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v)));
}
