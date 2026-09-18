/**
 * The flow as ChainBuddy sees it, and the changes it can propose.
 *
 * These are ChainBuddy's own names (see knowledge/nodes/), not ChainForge's
 * internal node data. adapters/ translates between the two, so nothing in
 * flowApi/ depends on how nodes store their data.
 */

export type Support = "editable" | "view-only" | "not-supported";

export interface NodeView {
  id: string;
  type: string;
  title: string;
  support: Support;
  /** Only for editable and view-only nodes. */
  settings?: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
}

export interface ConnectionView {
  from: { node: string; output: string };
  to: { node: string; input: string };
}

export interface FlowView {
  nodes: NodeView[];
  connections: ConnectionView[];
}

export interface ModelInfo {
  /** What a Prompt Node's `models[].model` setting holds. */
  id: string;
  name: string;
  provider: string;
  /** Whether it can run now: its API key is set, or Ollama has it. */
  ready: boolean;
}

/** A change, after checking. Node references are ids or refs. */
export type Change =
  | {
      op: "add_node";
      ref: string;
      type: string;
      settings: Record<string, unknown>;
    }
  | { op: "update_node"; node: string; settings: Record<string, unknown> }
  | {
      op: "connect";
      from: { node: string; output: string };
      to: { node: string; input: string };
    }
  | { op: "remove_node"; node: string };

export interface ChangeSet {
  summary: string;
  changes: Change[];
}

/** What the canvas says about a change set it was shown. */
export interface ProposalReceipt {
  id: string;
  /** An earlier change set this one replaced, which is no longer shown. */
  replaced?: string;
}

/**
 * Everything the Flow API needs from a canvas. The app provides one backed
 * by its store (adapters/canvas.ts); tests and prototypes provide stand-ins.
 */
export interface CanvasPort {
  readFlow(): FlowView;
  listModels(): ModelInfo[];
  /** The inputs a node of this type would have with these settings. */
  inputsFor(type: string, settings: Record<string, unknown>): string[];
  /** Shows a checked change set for the user to accept or reject. */
  propose(changeSet: ChangeSet): ProposalReceipt;
}
