/**
 * A change set in words, for the card the user accepts or rejects. Edits to
 * existing nodes are shown as before → after, per setting.
 */

import { isPlainObject } from "../runtime/tools";
import { ChangeSet, FlowView } from "./types";

/**
 * One changed setting. Lists (values, prompts, models) say which items were
 * added and removed; anything else gives its whole value before and after.
 */
export interface Edit {
  setting: string;
  before: string;
  after: string;
  code?: boolean;
  added?: string[];
  removed?: string[];
  /** How many items stayed the same. */
  kept?: number;
}

export interface ChangeLine {
  kind: "add" | "update" | "connect" | "remove";
  /** One line, e.g. `Add Prompt Node "Summaries"`. */
  text: string;
  /** A new node's settings, such as the models a new Prompt Node uses. */
  details?: { setting: string; value: string; code?: boolean }[];
  /** For edits: each changed setting, before and after. */
  edits?: Edit[];
}

const LIST_SETTINGS = ["values", "prompts", "models"];

const TYPE_NAMES: Record<string, string> = {
  prompt: "Prompt Node",
  textfields: "TextFields Node",
  evaluator: "Evaluator",
};

const SETTING_NAMES: Record<string, string> = {
  title: "Title",
  prompts: "Prompts",
  models: "Models",
  responses_per_prompt: "Responses per prompt",
  values: "Values",
  code: "Code",
};

export function describeChanges(
  flow: FlowView,
  changeSet: ChangeSet,
): ChangeLine[] {
  const names = new Map(flow.nodes.map((n) => [n.id, n.title]));
  const current = new Map(flow.nodes.map((n) => [n.id, n]));
  const name = (id: string) => `"${names.get(id) ?? id}"`;

  return changeSet.changes.map((change): ChangeLine => {
    switch (change.op) {
      case "add_node": {
        const title =
          typeof change.settings.title === "string"
            ? change.settings.title
            : change.ref;
        names.set(change.ref, title);
        return {
          kind: "add",
          text: `Add ${TYPE_NAMES[change.type] ?? change.type} "${title}"`,
          details: Object.entries(change.settings)
            .filter(([key]) => key !== "title")
            .map(([key, value]) => ({
              setting: SETTING_NAMES[key] ?? key,
              value: show(key, value),
              code: key === "code" || undefined,
            })),
        };
      }
      case "update_node": {
        const node = current.get(change.node);
        // A node's title is kept on the node, not in its settings.
        const before: Record<string, unknown> = {
          title: node?.title,
          ...(node?.settings ?? {}),
        };
        const line: ChangeLine = {
          kind: "update",
          text: `Change ${name(change.node)}`,
          edits: Object.entries(change.settings)
            .map(([key, value]) => editOf(key, before[key], value))
            .filter((e): e is Edit => e !== undefined),
        };
        if (typeof change.settings.title === "string")
          names.set(change.node, change.settings.title);
        return line;
      }
      case "connect":
        return {
          kind: "connect",
          text: `Connect ${name(change.from.node)} → ${name(change.to.node)}'s ${change.to.input}`,
        };
      case "remove_node":
        return {
          kind: "remove",
          text: `Remove ${name(change.node)}, and its results`,
        };
    }
    return { kind: "update", text: "Unknown change" };
  });
}

/** How one setting changes, or undefined if it doesn't. */
function editOf(
  key: string,
  before: unknown,
  after: unknown,
): Edit | undefined {
  const setting = SETTING_NAMES[key] ?? key;
  if (LIST_SETTINGS.includes(key) && Array.isArray(after)) {
    // Models are compared by ID, since only existing ones have nicknames.
    const idOf = (item: unknown) =>
      key === "models" && isPlainObject(item)
        ? String(item.model)
        : show(key, [item]);
    const names = new Map<string, string>();
    for (const item of [...(Array.isArray(before) ? before : []), ...after])
      if (!names.has(idOf(item))) names.set(idOf(item), show(key, [item]));
    const was = Array.isArray(before) ? before.map(idOf) : [];
    const now = after.map(idOf);
    const added = now.filter((id) => !was.includes(id));
    const removed = was.filter((id) => !now.includes(id));
    if (added.length === 0 && removed.length === 0 && was.length === now.length)
      return undefined;
    const name = (id: string) => names.get(id) ?? id;
    return {
      setting,
      before: show(key, before),
      after: show(key, after),
      added: added.map(name),
      removed: removed.map(name),
      kept: now.length - added.length,
    };
  }
  const was = show(key, before);
  const now = show(key, after);
  if (was === now) return undefined;
  return {
    setting,
    before: was,
    after: now,
    code: key === "code" || undefined,
  };
}

/** A setting's value, as a short line. Code and long text are summarized. */
function show(key: string, value: unknown): string {
  if (value === undefined) return "(none)";
  if (key === "prompts" && Array.isArray(value))
    return value
      .map((p) =>
        isPlainObject(p) ? `${p.label ? `${p.label}: ` : ""}${p.text}` : "",
      )
      .join(" | ");
  if (key === "models" && Array.isArray(value))
    return value
      .map((m) => (isPlainObject(m) ? String(m.nickname ?? m.model) : ""))
      .join(", ");
  if (key === "values" && Array.isArray(value))
    return value.map((v) => `"${v}"`).join(", ");
  if (key === "code" && typeof value === "string") return value;
  return String(value);
}
