/**
 * A change set in words, for the card the user accepts or rejects. Edits to
 * existing nodes are shown as before → after, per setting.
 */

import { kindOf } from "../nodes";
import { SettingSpec } from "../nodes/types";
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

export function describeChanges(
  flow: FlowView,
  changeSet: ChangeSet,
): ChangeLine[] {
  const names = new Map(flow.nodes.map((n) => [n.id, n.title]));
  const current = new Map(flow.nodes.map((n) => [n.id, n]));
  // Node types by id, and by ref for nodes this change set adds.
  const types = new Map(flow.nodes.map((n) => [n.id, n.type]));
  const settingsOf = (id: string) => kindOf(types.get(id))?.settings ?? {};
  const name = (id: string) => `"${names.get(id) ?? id}"`;

  return changeSet.changes.map((change): ChangeLine => {
    switch (change.op) {
      case "add_node": {
        const title =
          typeof change.settings.title === "string"
            ? change.settings.title
            : change.ref;
        names.set(change.ref, title);
        types.set(change.ref, change.type);
        return {
          kind: "add",
          text: `Add ${kindOf(change.type)?.name ?? change.type} "${title}"`,
          details: Object.entries(change.settings)
            .filter(([key]) => key !== "title")
            .map(([key, value]) => {
              const spec = settingsOf(change.ref)[key];
              return {
                setting: spec?.label ?? key,
                value: show(spec, value),
                code: spec?.code || undefined,
              };
            }),
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
            .map(([key, value]) =>
              editOf(settingsOf(change.node)[key], key, before[key], value),
            )
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
  spec: SettingSpec | undefined,
  key: string,
  before: unknown,
  after: unknown,
): Edit | undefined {
  const setting = spec?.label ?? key;
  const items = spec?.items;
  if (items && Array.isArray(after)) {
    const names = new Map<string, string>();
    for (const item of [...(Array.isArray(before) ? before : []), ...after])
      if (!names.has(items.key(item)))
        names.set(items.key(item), items.label(item));
    const was = Array.isArray(before) ? before.map(items.key) : [];
    const now = after.map(items.key);
    const added = now.filter((id) => !was.includes(id));
    const removed = was.filter((id) => !now.includes(id));
    if (added.length === 0 && removed.length === 0 && was.length === now.length)
      return undefined;
    const name = (id: string) => names.get(id) ?? id;
    return {
      setting,
      before: show(spec, before),
      after: show(spec, after),
      added: added.map(name),
      removed: removed.map(name),
      kept: now.length - added.length,
    };
  }
  const was = show(spec, before);
  const now = show(spec, after);
  if (was === now) return undefined;
  return { setting, before: was, after: now, code: spec?.code || undefined };
}

/** A setting's value, as a line: list items by their labels, anything else as text. */
function show(spec: SettingSpec | undefined, value: unknown): string {
  if (value === undefined) return "(none)";
  const items = spec?.items;
  if (items && Array.isArray(value))
    return value.map(items.label).join(items.separator ?? ", ");
  return String(value);
}
