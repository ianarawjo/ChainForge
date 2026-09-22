/**
 * Checks a proposed change list against the flow, as each change would leave
 * it, and says what's wrong in terms a model can act on.
 */

import { isPlainObject } from "../runtime/tools";
import { EDITABLE_TYPES, NODE_SPECS } from "./nodeSpecs";
import {
  CanvasPort,
  Change,
  ConnectionView,
  FlowView,
  ModelInfo,
  Support,
} from "./types";

interface WorkingNode {
  type: string;
  support: Support;
  settings: Record<string, unknown>;
  /** Inputs before this change set, for nodes already on the canvas. */
  inputsBefore?: string[];
  /** Added or changed by this change set. */
  touched: boolean;
}

export interface CheckResult {
  problems: string[];
  changes: Change[];
}

export function checkChanges(
  flow: FlowView,
  raw: Record<string, unknown>[],
  canvas: Pick<CanvasPort, "inputsFor">,
  models: ModelInfo[],
): CheckResult {
  const problems: string[] = [];
  const changes: Change[] = [];
  const nodes = new Map<string, WorkingNode>(
    flow.nodes.map((n) => [
      n.id,
      {
        type: n.type,
        support: n.support,
        settings: { ...(n.settings ?? {}) },
        inputsBefore: n.inputs,
        touched: false,
      },
    ]),
  );
  let connections: ConnectionView[] = [...flow.connections];
  // Nodes this change set connects to or from.
  const connected = new Set<string>();

  // Models already in the flow may stay, even if list_models doesn't offer them.
  const knownModels = new Map(models.map((m) => [m.id, m]));
  const modelsInFlow = new Set(
    flow.nodes.flatMap((n) => {
      const models = n.settings?.models;
      return Array.isArray(models)
        ? models.map((m) => (isPlainObject(m) ? m.model : undefined))
        : [];
    }),
  );

  raw.forEach((change, i) => {
    const at = `changes[${i}] (${String(change.op)})`;
    const before = problems.length;

    const checkSettings = (type: string, settings: unknown, isNew: boolean) => {
      const spec = NODE_SPECS[type];
      if (!isPlainObject(settings)) {
        problems.push(`${at}: settings should be an object.`);
        return;
      }
      for (const [key, value] of Object.entries(settings)) {
        if (spec.readOnly.includes(key))
          problems.push(`${at}: ${key} is read-only.`);
        else if (!spec.editable.includes(key))
          problems.push(
            `${at}: a ${type} node has no setting "${key}". Its settings are: ${spec.editable.join(", ")}.`,
          );
        else {
          const problem = spec.checkSetting(key, value);
          if (problem) problems.push(`${at}: ${problem}`);
        }
      }
      if (isNew)
        for (const key of spec.required)
          if (settings[key] === undefined)
            problems.push(`${at}: a new ${type} node needs ${key}.`);
      if (Array.isArray(settings.models))
        for (const m of settings.models) {
          if (!isPlainObject(m) || typeof m.model !== "string") continue;
          const info = knownModels.get(m.model);
          if (!info && !modelsInFlow.has(m.model))
            problems.push(
              `${at}: "${m.model}" isn't a model ChainForge offers. Call list_models and use an ID from it.`,
            );
          else if (info && !info.ready && !modelsInFlow.has(m.model))
            problems.push(
              `${at}: "${m.model}" isn't set up yet (${info.provider} needs an API key or isn't running). Pick a model list_models marks as ready.`,
            );
        }
    };

    switch (change.op) {
      case "add_node": {
        const type = change.type;
        const ref = change.ref;
        if (typeof type !== "string" || !EDITABLE_TYPES.includes(type)) {
          problems.push(
            `${at}: type should be one of ${EDITABLE_TYPES.join(", ")}.`,
          );
          return;
        }
        if (typeof ref !== "string" || ref.trim() === "")
          problems.push(`${at}: needs a ref, a short name for the new node.`);
        else if (nodes.has(ref))
          problems.push(
            `${at}: "${ref}" is already the name of a node; pick another ref.`,
          );
        const refProblem = problems.length > before;
        const given = isPlainObject(change.settings)
          ? withoutUnchangedReadOnly(type, change.settings, {})
          : change.settings ?? {};
        checkSettings(type, given, true);
        if (refProblem || typeof ref !== "string") return;
        const settings = isPlainObject(given) ? { ...given } : {};
        // Known even if its settings have problems, so later changes that
        // refer to it aren't reported as problems too.
        nodes.set(ref, { type, support: "editable", settings, touched: true });
        if (problems.length === before)
          changes.push({ op: "add_node", ref, type, settings });
        return;
      }
      case "update_node": {
        const id = change.node;
        const node = typeof id === "string" ? nodes.get(id) : undefined;
        if (!node || typeof id !== "string") {
          problems.push(`${at}: there's no node "${String(id)}".`);
          return;
        }
        if (node.support !== "editable") {
          problems.push(
            `${at}: ${id} is a ${node.type} node, which ChainBuddy can't edit.`,
          );
          return;
        }
        if (
          !isPlainObject(change.settings) ||
          Object.keys(change.settings).length === 0
        ) {
          problems.push(`${at}: needs the settings to change.`);
          return;
        }
        const settings = withoutUnchangedReadOnly(
          node.type,
          change.settings,
          node.settings,
        );
        checkSettings(node.type, settings, false);
        if (problems.length === before) {
          Object.assign(node.settings, settings);
          node.touched = true;
          changes.push({ op: "update_node", node: id, settings });
        }
        return;
      }
      case "remove_node": {
        const id = change.node;
        const node = typeof id === "string" ? nodes.get(id) : undefined;
        if (!node || typeof id !== "string") {
          problems.push(`${at}: there's no node "${String(id)}".`);
          return;
        }
        if (node.support === "not-supported") {
          problems.push(
            `${at}: ${id} is a ${node.type} node, which ChainBuddy can't change.`,
          );
          return;
        }
        nodes.delete(id);
        connections = connections.filter(
          (c) => c.from.node !== id && c.to.node !== id,
        );
        changes.push({ op: "remove_node", node: id });
        return;
      }
      case "connect": {
        const from = isPlainObject(change.from) ? change.from : {};
        const to = isPlainObject(change.to) ? change.to : {};
        const fromId = String(from.node);
        const toId = String(to.node);
        const source = nodes.get(fromId);
        const target = nodes.get(toId);
        if (!source)
          problems.push(`${at}: there's no node "${fromId}" to connect from.`);
        if (!target)
          problems.push(`${at}: there's no node "${toId}" to connect to.`);
        if (!source || !target) return;
        for (const [id, n] of [
          [fromId, source],
          [toId, target],
        ] as const)
          if (n.support !== "editable")
            problems.push(
              `${at}: ${id} is a ${n.type} node, which ChainBuddy can't connect yet.`,
            );
        if (problems.length > before) return;

        const spec = NODE_SPECS[source.type];
        if (from.output !== spec.output)
          problems.push(
            `${at}: ${fromId} has no output "${String(from.output)}"; its output is "${spec.output}".`,
          );
        if (!spec.connectsTo.includes(target.type))
          problems.push(
            `${at}: a ${source.type} node can't connect to a ${target.type} node.`,
          );
        const inputs = canvas.inputsFor(target.type, target.settings);
        if (!inputs.includes(String(to.input)))
          problems.push(
            `${at}: ${toId} has no input "${String(to.input)}". Its inputs are: ${inputs.join(", ") || "(none)"}.`,
          );
        if (problems.length > before) return;

        const connection = {
          from: { node: fromId, output: String(from.output) },
          to: { node: toId, input: String(to.input) },
        };
        if (
          connections.some(
            (c) =>
              c.from.node === fromId &&
              c.to.node === toId &&
              c.to.input === connection.to.input,
          )
        )
          problems.push(`${at}: that connection already exists.`);
        else {
          connections.push(connection);
          connected.add(fromId);
          connected.add(toId);
          changes.push({ op: "connect", ...connection });
        }
        return;
      }
      default:
        problems.push(
          `${at}: op should be one of add_node, update_node, connect, remove_node.`,
        );
    }
  });

  // A node this change set adds or edits shouldn't be left with a new input
  // that nothing feeds: it couldn't run.
  if (problems.length === 0)
    for (const [id, node] of Array.from(nodes.entries())) {
      if (!node.touched) continue;
      const inputs = canvas.inputsFor(node.type, node.settings);
      for (const input of inputs) {
        if (node.inputsBefore?.includes(input)) continue;
        const fed = connections.some(
          (c) => c.to.node === id && c.to.input === input,
        );
        if (!fed)
          problems.push(
            node.type === "evaluator"
              ? `${id}: nothing is connected to its "responses" input. Connect a Prompt Node's responses to it.`
              : `${id}: its input "${input}" isn't connected. Connect a node to it, or take {${input}} out of the text.`,
          );
      }
    }

  // Nor should it connect to a node that stays blank, such as the empty
  // Prompt Node a new flow starts with: the flow couldn't run.
  if (problems.length === 0)
    for (const id of Array.from(connected)) {
      const node = nodes.get(id);
      const blank = node && blankness(node.type, node.settings);
      if (blank)
        problems.push(
          `${id} ${blank}. Fill it in with update_node in this change set, or connect to a different node.`,
        );
    }

  return { problems, changes };
}

/**
 * Settings without read-only ones repeated back unchanged, which models often
 * do when copying a node's settings. Changed read-only values are kept, so
 * the check can say they're read-only.
 */
function withoutUnchangedReadOnly(
  type: string,
  settings: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...settings };
  for (const key of NODE_SPECS[type].readOnly)
    if (
      key in out &&
      JSON.stringify(out[key]) === JSON.stringify(current[key] ?? [])
    )
      delete out[key];
  return out;
}

/** What a node is missing to be usable, or undefined if nothing is. */
function blankness(
  type: string,
  settings: Record<string, unknown>,
): string | undefined {
  const hasText = (list: unknown, text: (item: unknown) => unknown) =>
    Array.isArray(list) &&
    list.some((item) => String(text(item) ?? "").trim() !== "");
  if (type === "prompt") {
    if (!hasText(settings.prompts, (p) => (isPlainObject(p) ? p.text : "")))
      return "has no prompt text yet";
    if (!Array.isArray(settings.models) || settings.models.length === 0)
      return "has no models yet";
  }
  if (type === "textfields" && !hasText(settings.values, (v) => v))
    return "has no values yet";
  return undefined;
}
