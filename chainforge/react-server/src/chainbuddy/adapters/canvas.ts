/**
 * The canvas, as the Flow API reaches it: reads the store, and shows change
 * sets on it for the user to accept or reject.
 *
 * Proposed nodes and connections are real nodes and edges, drawn dashed, so
 * the user sees exactly what they'd get. Edits to existing nodes and removals
 * wait until the user accepts; the nodes they touch are outlined meanwhile.
 */

import { Edge, MarkerType, Node } from "reactflow";
import { v4 as uuid } from "uuid";
import { getDefaultModelSettings } from "../../ModelSettingSchemas";
import { OPENROUTER_PREFIX } from "../../backend/models";
import { Dict } from "../../backend/typing";
import { ensureUniqueName } from "../../backend/utils";
import useStore, { initLLMProviders } from "../../store";
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
import { NODE_SPECS } from "../flowApi/nodeSpecs";
import {
  dataWithSettings,
  handlesFor,
  inputName,
  inputsFor,
  modelIdOf,
  ModelResolver,
  outputName,
  settingsOf,
  supportOf,
} from "./nodeData";

export const PENDING_CLASS = {
  add: "chainbuddy-pending-add",
  update: "chainbuddy-pending-update",
  remove: "chainbuddy-pending-remove",
};

export type ProposalStatus =
  | "pending"
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
}

const TICK_MS = 20;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const modelResolver: ModelResolver = {
  idOf: modelIdOf,

  toSpec(id: string, takenNames: string[]) {
    const { apiKeys } = useStore.getState();
    if (id.startsWith("ollama/")) {
      const ollamaModel = id.slice("ollama/".length);
      const name = ensureUniqueName(ollamaModel, takenNames);
      const settings: Dict = {
        ...getDefaultModelSettings("ollama", "ollama"),
        ollamaModel,
      };
      const formData: Dict = { shortname: name, model: "ollama", ollamaModel };
      if (apiKeys.Ollama_BaseURL) {
        settings.ollama_url = apiKeys.Ollama_BaseURL;
        formData.ollama_url = apiKeys.Ollama_BaseURL;
      }
      return {
        key: uuid(),
        name,
        emoji: "🦙",
        model: "ollama",
        base_model: "ollama",
        temp: 1.0,
        settings,
        formData,
      };
    }
    // As the Prompt Node's model menu builds it (LLMListComponent).
    const item = initLLMProviders.find(
      (m) => m.base_model === "openrouter" && m.model === id,
    );
    if (!item) return undefined;
    const name = ensureUniqueName(item.name, takenNames);
    const shortModel = id.slice(OPENROUTER_PREFIX.length);
    return {
      ...item,
      key: uuid(),
      name,
      formData: { shortname: name, model: shortModel },
      settings: getDefaultModelSettings(item.base_model, shortModel),
    };
  },
};

export interface CanvasEvents {
  /** A proposal appeared or changed status. */
  onProposal?: (proposal: Proposal) => void;
  /** Nodes the user should look at. */
  onFocus?: (nodeIds: string[]) => void;
}

/** The canvas backed by ChainForge's store. One per chat panel. */
export class StoreCanvas implements CanvasPort {
  private proposals = new Map<string, ProposalState>();
  private count = 0;

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
      const data = n.data ?? {};
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
      const settings = settingsOf(n.type, data, modelResolver);
      return {
        id: n.id,
        type: n.type,
        title: String(settings.title ?? title),
        support,
        settings,
        inputs: inputsFor(n.type, settings),
        outputs: [NODE_SPECS[n.type].output],
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
    const { apiKeys, ollamaModels } = useStore.getState();
    return [
      ...ollamaModels.map((name) => ({
        id: `ollama/${name}`,
        name,
        provider: "Ollama",
        ready: true,
      })),
      ...initLLMProviders
        .filter((m) => m.base_model === "openrouter")
        .map((m) => ({
          id: m.model,
          name: m.name,
          provider: "OpenRouter",
          ready: !!apiKeys.OpenRouter,
        })),
    ];
  }

  inputsFor(type: string, settings: Record<string, unknown>): string[] {
    return inputsFor(type, settings);
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
      id: `change-set-${++this.count}`,
      summary: changeSet.summary,
      lines: describeChanges(flow, changeSet),
      status: "pending",
      changes: changeSet.changes,
      ids: new Map(flow.nodes.map((n) => [n.id, n.id])),
      addedNodes: [],
      addedEdges: [],
      deferred: [],
      outlined: new Map(),
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

    for (const change of changeSet.changes) {
      if (change.op === "add_node") {
        const id = `${change.type}Node-${uuid()}`;
        state.ids.set(change.ref, id);
        const data = dataWithSettings(
          change.type,
          change.settings,
          undefined,
          modelResolver,
        );
        newNodes.push({
          id,
          type: change.type,
          data,
          position: positions.get(change.ref) ?? { x: 0, y: 0 },
          className: PENDING_CLASS.add,
        });
        inputsNow.set(id, inputsFor(change.type, change.settings));
        state.addedNodes.push(id);
      } else if (change.op === "update_node" || change.op === "remove_node") {
        const id = state.ids.get(change.node) ?? change.node;
        const added = newNodes.find((n) => n.id === id);
        if (!added)
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
            modelResolver,
          );
          inputsNow.set(
            id,
            inputsFor(
              added.type,
              settingsOf(added.type, added.data, modelResolver),
            ),
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

    useStore.setState((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...s.edges, ...newEdges],
    }));
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
    try {
      const store = useStore.getState();
      // Proposed nodes and edges become ordinary ones.
      const added = new Set([...state.addedNodes, ...state.addedEdges]);
      useStore.setState((s) => ({
        nodes: s.nodes.map((n) =>
          added.has(n.id) ? { ...n, className: undefined } : n,
        ),
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
          if (isExisting) await this.rebuild(change.node, change.settings);
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
      state.error = err instanceof Error ? err.message : String(err);
      this.setStatus(state, "failed");
    }
  }

  /**
   * Removes proposed nodes and outlines no live proposal owns. They appear
   * when a flow was saved while a proposal waited, then reloaded: the card to
   * accept or reject them is gone, so they were never accepted. Returns a
   * function that stops watching.
   */
  removeOrphans(): () => void {
    const clean = () => {
      const owned = new Set<string>();
      const outlined = new Set<string>();
      for (const p of Array.from(this.proposals.values()))
        if (p.status === "pending") {
          [...p.addedNodes, ...p.addedEdges].forEach((id) => owned.add(id));
          p.outlined.forEach((_, id) => outlined.add(id));
        }
      const { nodes, edges } = useStore.getState();
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
    clean();
    // Also after a flow loads later on.
    return useStore.subscribe((state, prev) => {
      if (state.nodes !== prev.nodes) clean();
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
    kind: "update" | "remove",
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

  /**
   * Replaces a node's data and redraws it from scratch. Most nodes copy their
   * data into their own state when they first appear, so changing the data
   * of a node already on screen wouldn't show, or be used when it runs.
   */
  private async rebuild(nodeId: string, settings: Record<string, unknown>) {
    const { nodes, edges } = useStore.getState();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !node.type) throw new Error(`The node ${nodeId} is gone.`);
    const data = dataWithSettings(
      node.type,
      settings,
      node.data,
      modelResolver,
    );
    const itsEdges = edges.filter(
      (e) => e.source === nodeId || e.target === nodeId,
    );
    useStore.setState((s) => ({
      nodes: s.nodes.filter((n) => n.id !== nodeId),
      edges: s.edges.filter((e) => !itsEdges.includes(e)),
    }));
    await wait(TICK_MS);
    const inputs = inputsFor(
      node.type,
      settingsOf(node.type, data, modelResolver),
    );
    useStore.setState((s) => ({
      nodes: [...s.nodes, { ...node, data: { ...data, refresh: true } }],
      // Connections to inputs the edit removed go with them.
      edges: [
        ...s.edges,
        ...itsEdges.filter(
          (e) =>
            e.target !== nodeId ||
            inputs.includes(inputName(node.type, e.targetHandle)),
        ),
      ],
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

function uniq(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v)));
}
