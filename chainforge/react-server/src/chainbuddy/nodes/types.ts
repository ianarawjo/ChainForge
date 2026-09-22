/**
 * Everything ChainBuddy knows about one node type, in one object. The Flow
 * API, the canvas adapter and the proposal card all read node types from
 * here, so adding a node type means writing one NodeKind (plus its guide in
 * knowledge/nodes/) and listing it in nodes/index.ts. Other kinds don't
 * change: what connects to what follows from `output` and `accepts`.
 *
 * A NodeKind is pure: anything that depends on the app, such as ChainForge's
 * template parser or its model list, is passed in.
 */

import { Dict, LLMSpec } from "../../backend/typing";

/**
 * What travels along a connection. A node's output carries one of these, and
 * each node type's inputs accept some of them, which decides what may connect
 * to what. A new node type fits in by naming what it gives and accepts, with
 * no change to the others.
 */
export type DataType =
  /** Pieces of text, such as a TextFields Node's values. */
  | "values"
  /** Model responses, each with the prompt and variable values behind it. */
  | "responses"
  /** Responses with a score attached to each. */
  | "scored_responses";

/** Finds the {variables} in some texts. */
export type VarsOf = (texts: string[]) => string[];

/** Turns model IDs (as list_models gives them) into LLMSpecs, and back. */
export interface ModelResolver {
  idOf(llm: LLMSpec): string;
  /** A new LLMSpec for a model, named so it doesn't clash with `takenNames`. */
  toSpec(id: string, takenNames: string[]): LLMSpec | undefined;
}

/** What translating between node data and settings needs from the app. */
export interface KindContext {
  models: ModelResolver;
  varsOf: VarsOf;
}

/** One setting ChainBuddy may read, and change unless it's read-only. */
export interface SettingSpec {
  /** Shown on the proposal card, e.g. "Responses per prompt". */
  label: string;
  readOnly?: boolean;
  /** A new node must be given it. */
  required?: boolean;
  /** A problem with a value, or undefined if it's fine. */
  check?(value: unknown): string | undefined;
  /** For list settings: how items are told apart and shown on the card. */
  items?: {
    key(item: unknown): string;
    label(item: unknown): string;
    separator?: string;
  };
  /** Shown on the card as code, behind a toggle. */
  code?: boolean;
}

export interface NodeKind {
  /** ChainForge's node type, e.g. "prompt". */
  type: string;
  /** Shown to people and the model, and the title of an untitled node. */
  name: string;
  /** The node's guide (knowledge/nodes/<type>.md), as describe_node returns it. */
  doc: string;
  settings: Record<string, SettingSpec>;
  /** The node's one output, named after what it carries. */
  output: DataType;
  /** What its inputs accept. */
  accepts: DataType[];
  /** The inputs a node with these settings has. */
  inputs(settings: Record<string, unknown>, varsOf: VarsOf): string[];
  /** What a node with these settings lacks to be usable, e.g. "has no values yet". */
  missing?(settings: Record<string, unknown>): string | undefined;
  /** Added when an input of a new node isn't connected; defaults to advice about {variables}. */
  unconnectedHint?: string;

  // ChainForge's side: its node data and handles.

  /** Whether ChainBuddy supports this particular node, e.g. only JavaScript evaluators. */
  supports?(data: Dict): boolean;
  handles: {
    output: string;
    /** Inputs whose handle id differs from their name. */
    inputs?: Record<string, string>;
  };
  /** ChainBuddy's settings for a node, from its data. */
  read(data: Dict, ctx: KindContext): Record<string, unknown>;
  /**
   * Node data with settings applied: over `base` for an existing node, or
   * from scratch for a new one. Settings not given are left as they are.
   */
  write(
    settings: Record<string, unknown>,
    base: Dict | undefined,
    ctx: KindContext,
  ): Dict;
}
