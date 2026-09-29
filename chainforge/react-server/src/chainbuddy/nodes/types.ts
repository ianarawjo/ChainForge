/**
 * Everything ChainBuddy knows about one node type, in one object. The Flow
 * API, the canvas adapter and the proposal card all read node types from
 * here, so adding a node type means writing one NodeKind (plus its guide in
 * knowledge/nodes/) and listing it in nodes/index.ts. Other kinds don't
 * change: what connects to what follows from `output` and `accepts`.
 *
 * A NodeKind doesn't touch the store: the user's models, the one thing it
 * needs from the app, are passed in (see adapters/models.ts).
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

/** Turns model IDs (as list_models gives them) into LLMSpecs, and back. */
export interface ModelResolver {
  idOf(llm: LLMSpec): string;
  /** A new LLMSpec for a model, named so it doesn't clash with `takenNames`. */
  toSpec(id: string, takenNames: string[]): LLMSpec | undefined;
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
  /**
   * The values it may take, which describe_node lists after the guide. Read
   * when asked, from ChainForge's own code where it has the list, so a guide
   * never has to repeat a list ChainForge will grow.
   */
  values?(): string[];
  /**
   * For a list of { model } by list_models ID: whether the models respond to
   * prompts, or judge responses. A judge-only model can only be a judge.
   */
  models?: "respond" | "judge";
}

export interface NodeKind {
  /** ChainForge's node type, e.g. "prompt". */
  type: string;
  /** Shown to people and the model, and the title of an untitled node. */
  name: string;
  /** The node's guide (knowledge/nodes/<type>.md), as describe_node returns it. */
  doc: string;
  settings: Record<string, SettingSpec>;
  /** What its output gives, named after it; sinks have none. */
  output?: DataType;
  /**
   * For a node with one output per something in its settings, such as a
   * table's columns: their names. Each gives `output`, and each one's handle
   * id is its name.
   */
  outputNames?(settings: Record<string, unknown>): string[];
  /** What its inputs accept. */
  accepts: DataType[];
  /**
   * A problem with connecting something that gives `gives` to it, when that
   * depends on its settings: a Vis Node plotting latency needs a Prompt
   * Node's own responses, say. Checked on the flow as a change set leaves it.
   */
  checkSource?(
    gives: DataType,
    settings: Record<string, unknown>,
  ): string | undefined;
  /** Each input takes one connection; ChainForge would ignore the rest. */
  oneSource?: boolean;
  /**
   * A problem with its settings taken together, as a change leaves them
   * (`settings`), given the ones the change sets (`given`): a table row
   * naming a column the table doesn't have, say.
   */
  checkAll?(
    settings: Record<string, unknown>,
    given: Record<string, unknown>,
  ): string | undefined;
  /** The inputs a node with these settings has. */
  inputs(settings: Record<string, unknown>): string[];
  /** What a node with these settings lacks to be usable, e.g. "has no values yet". */
  missing?(settings: Record<string, unknown>): string | undefined;
  /** Added when an input of a new node isn't connected; defaults to advice about {variables}. */
  unconnectedHint?: string;

  // ChainForge's side: its node data and handles.

  /** Whether ChainBuddy supports this particular node, e.g. only JavaScript evaluators. */
  supports?(data: Dict): boolean;
  handles: {
    /** Left out by a node with no output. */
    output?: string;
    /** Inputs whose handle id differs from their name. */
    inputs?: Record<string, string>;
  };
  /** ChainBuddy's settings for a node, from its data. */
  read(data: Dict, models: ModelResolver): Record<string, unknown>;
  /**
   * Node data with settings applied: over `base` for an existing node, or
   * from scratch for a new one. Settings not given are left as they are.
   */
  write(
    settings: Record<string, unknown>,
    base: Dict | undefined,
    models: ModelResolver,
  ): Dict;
}
