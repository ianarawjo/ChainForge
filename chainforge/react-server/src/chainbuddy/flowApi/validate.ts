/**
 * Checks a proposed change list against the flow, as each change would leave
 * it, and says what's wrong in terms a model can act on.
 */

import { listOf } from "../nodes/common";
import { isPlainObject } from "../runtime/tools";
import { editableTypes, inputsOf, kindOf, outputsOf } from "../nodes";
import { NodeKind } from "../nodes/types";
import { Change, ConnectionView, FlowView, ModelInfo, Support } from "./types";

/**
 * The most items of a list setting get_flow shows. A longer list, such as a
 * table imported from a file, can't be changed: ChainBuddy hasn't seen all of
 * it, so replacing it would drop what it didn't see.
 */
export const LIST_LIMIT = 50;

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
  // Nodes on the canvas that aren't finished yet, such as New Flow's blanks.
  const blankBefore = new Set(
    flow.nodes
      .filter((n) => n.settings && kindOf(n.type)?.missing?.(n.settings))
      .map((n) => n.id),
  );
  // Settings of nodes on the canvas too long to have been shown in full.
  const tooLong = new Map(
    flow.nodes.map((n) => [
      n.id,
      Object.entries(n.settings ?? {}).flatMap(([key, value]) =>
        Array.isArray(value) && value.length > LIST_LIMIT
          ? [[key, value.length] as const]
          : [],
      ),
    ]),
  );
  // Nodes this change set connects to or from, and the connections it makes.
  const connected = new Set<string>();
  const added = new Set<ConnectionView>();

  // Models already in the flow may stay, even if list_models doesn't offer them.
  const knownModels = new Map(models.map((m) => [m.id, m]));
  const modelsInFlow = new Set(
    flow.nodes.flatMap((n) =>
      modelSettings(kindOf(n.type)).flatMap(([key]) =>
        listOf(n.settings?.[key]).map((m) =>
          isPlainObject(m) ? m.model : undefined,
        ),
      ),
    ),
  );
  // What a new LLM Scorer is given when it's given no judges.
  const defaultJudge = models.find((m) => m.defaultJudge && m.ready);

  raw.forEach((change, i) => {
    const at = `changes[${i}] (${String(change.op)})`;
    const before = problems.length;

    const checkSettings = (
      kind: NodeKind,
      settings: unknown,
      isNew: boolean,
    ) => {
      if (!isPlainObject(settings)) {
        problems.push(`${at}: settings should be an object.`);
        return;
      }
      for (const [key, value] of Object.entries(settings)) {
        const spec = kind.settings[key];
        if (spec?.readOnly) problems.push(`${at}: ${key} is read-only.`);
        else if (!spec)
          problems.push(
            `${at}: a ${kind.type} node has no setting "${key}". Its settings are: ${editableSettings(kind).join(", ")}.`,
          );
        else {
          const problem = spec.check?.(value);
          if (problem) problems.push(`${at}: ${problem}`);
        }
      }
      if (isNew)
        for (const [key, spec] of Object.entries(kind.settings))
          if (spec.required && settings[key] === undefined)
            problems.push(`${at}: a new ${kind.type} node needs ${key}.`);
      for (const [key, spec] of modelSettings(kind))
        for (const m of listOf(settings[key])) {
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
          else if (info?.judgeOnly && spec.models === "respond")
            problems.push(
              `${at}: ${info.name} only judges responses, in an LLM Scorer; it can't write them. Pick a model from list_models' models.`,
            );
        }
    };

    switch (change.op) {
      case "add_node": {
        const type = change.type;
        const ref = change.ref;
        if (typeof type !== "string" || !kindOf(type)) {
          problems.push(
            `${at}: type should be one of ${editableTypes().join(", ")}.`,
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
        const kind = kindOf(type) as NodeKind;
        const given = isPlainObject(change.settings)
          ? withoutUnchangedReadOnly(kind, change.settings, {})
          : change.settings ?? {};
        // Judges left out are the default judge, where there is one.
        if (isPlainObject(given))
          for (const [key, spec] of modelSettings(kind))
            if (spec.models === "judge" && given[key] === undefined) {
              if (defaultJudge) given[key] = [{ model: defaultJudge.id }];
              else
                problems.push(
                  `${at}: a new ${type} node needs ${key}. There's no default judge set up, so pick them from list_models.`,
                );
            }
        checkSettings(kind, given, true);
        if (refProblem || typeof ref !== "string") return;
        const settings = isPlainObject(given) ? { ...given } : {};
        // Known even if its settings have problems, so later changes that
        // refer to it aren't reported as problems too.
        nodes.set(ref, { type, support: "editable", settings, touched: true });
        if (problems.length === before) {
          const problem = kind.checkAll?.(settings, settings);
          if (problem) problems.push(`${at}: ${problem}`);
        }
        if (problems.length === before)
          changes.push({
            op: "add_node",
            ref,
            type,
            settings: withModelNames(kind, settings, knownModels),
          });
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
        const kind = kindOf(node.type) as NodeKind;
        const settings = withoutUnchangedReadOnly(
          kind,
          change.settings,
          node.settings,
        );
        for (const [key, length] of tooLong.get(id) ?? [])
          if (key in settings)
            problems.push(
              `${at}: ${id}'s ${key} has ${length} items, more than you were shown, so replacing it would lose the rest. Ask the user to change it, or add a new node.`,
            );
        checkSettings(kind, settings, false);
        // A blank Prompt Node starts with ChainForge's small in-browser model,
        // which list_models doesn't offer. Filling it in means choosing its
        // models, even if only to keep that one.
        const current = listOf(node.settings.models).flatMap((m) =>
          isPlainObject(m) && typeof m.model === "string"
            ? [{ id: m.model, name: String(m.nickname ?? m.model) }]
            : [],
        );
        if (
          problems.length === before &&
          kind.missing?.(node.settings) &&
          settings.models === undefined &&
          current.length > 0 &&
          current.every((m) => {
            const info = knownModels.get(m.id);
            return !info || info.fallback;
          })
        )
          problems.push(
            `${at}: ${id} still has ${current.map((m) => m.name).join(", ")}, the small in-browser model a new Prompt Node starts with. Give models: ones from list_models, or the same one to keep it if the user asked for it.`,
          );
        if (problems.length === before) {
          const problem = kind.checkAll?.(
            { ...node.settings, ...settings },
            settings,
          );
          if (problem) problems.push(`${at}: ${problem}`);
        }
        if (problems.length === before) {
          Object.assign(node.settings, settings);
          node.touched = true;
          changes.push({
            op: "update_node",
            node: id,
            settings: withModelNames(kind, settings, knownModels),
          });
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

        const spec = kindOf(source.type) as NodeKind;
        const accepts = (kindOf(target.type) as NodeKind).accepts;
        const outputs = outputsOf(source.type, source.settings);
        if (!spec.output)
          problems.push(
            `${at}: ${fromId} has no output; a ${source.type} node only receives.`,
          );
        else if (!outputs.includes(String(from.output)))
          problems.push(
            outputs.length === 1
              ? `${at}: ${fromId} has no output "${String(from.output)}"; its output is "${outputs[0]}".`
              : `${at}: ${fromId} has no output "${String(from.output)}"; its outputs are: ${outputs.join(", ") || "(none)"}.`,
          );
        else if (!accepts.includes(spec.output))
          problems.push(
            accepts.length
              ? `${at}: ${toId} takes ${accepts.join(" or ")}, and ${fromId} gives ${spec.output}.`
              : `${at}: a ${target.type} node has no inputs.`,
          );
        const inputs = inputsOf(target.type, target.settings);
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
              c.from.output === connection.from.output &&
              c.to.node === toId &&
              c.to.input === connection.to.input,
          )
        )
          problems.push(`${at}: that connection already exists.`);
        else {
          connections.push(connection);
          added.add(connection);
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
      const inputs = inputsOf(node.type, node.settings);
      for (const input of inputs) {
        if (node.inputsBefore?.includes(input)) continue;
        const fed = connections.some(
          (c) => c.to.node === id && c.to.input === input,
        );
        const hint = kindOf(node.type)?.unconnectedHint;
        if (!fed)
          problems.push(
            hint
              ? `${id}: nothing is connected to its "${input}" input. ${hint}`
              : `${id}: its input "${input}" isn't connected. Connect a node to it, or take {${input}} out of the text.`,
          );
      }
    }

  // What a node accepts can depend on its settings, and some inputs take one
  // connection only. Both are judged on the flow as the change set leaves it,
  // since a later change may set what an earlier connection depends on.
  if (problems.length === 0) {
    const crowded = new Set<string>();
    for (const c of connections) {
      const source = nodes.get(c.from.node);
      const target = nodes.get(c.to.node);
      const kind = target && kindOf(target.type);
      if (!source || !kind || (!added.has(c) && !target.touched)) continue;
      const gives = kindOf(source.type)?.output;
      const refused = gives && kind.checkSource?.(gives, target.settings);
      if (refused) problems.push(`${c.from.node} → ${c.to.node}: ${refused}`);
      const into = `${c.to.node}.${c.to.input}`;
      const feeding = connections.filter(
        (o) => o.to.node === c.to.node && o.to.input === c.to.input,
      );
      if (
        kind.oneSource &&
        added.has(c) &&
        feeding.length > 1 &&
        !crowded.has(into)
      ) {
        crowded.add(into);
        problems.push(
          `${c.to.node}: its "${c.to.input}" input takes one connection, and would have ${feeding.length} (from ${feeding.map((o) => o.from.node).join(", ")}). ChainForge would use only one. Use one ${target.type} node per source.`,
        );
      }
    }
  }

  // An edit can remove an output something is connected from, such as a
  // table column that is renamed. ChainForge would keep the connection, and
  // silently send nothing, so it must be reconnected in the same change set.
  if (problems.length === 0)
    for (const c of connections) {
      const source = nodes.get(c.from.node);
      if (!source?.touched) continue;
      if (outputsOf(source.type, source.settings).includes(c.from.output))
        continue;
      const reconnected = connections.some(
        (o) =>
          o !== c &&
          o.to.node === c.to.node &&
          o.to.input === c.to.input &&
          outputsOf(
            nodes.get(o.from.node)?.type,
            nodes.get(o.from.node)?.settings,
          ).includes(o.from.output),
      );
      if (!reconnected)
        problems.push(
          `${c.to.node}'s "${c.to.input}" input is connected from ${c.from.node}'s "${c.from.output}", which this change removes. Connect it to another output in this change set.`,
        );
    }

  // Values a change set supplies, in a node it adds or fills in, should go
  // somewhere: a TextFields Node its prompt doesn't use is wasted, and the
  // flow isn't testing what it seems to.
  if (problems.length === 0)
    for (const [id, node] of Array.from(nodes.entries())) {
      const supplied = node.inputsBefore === undefined || blankBefore.has(id);
      if (!node.touched || !supplied) continue;
      if (kindOf(node.type)?.output !== "values") continue;
      if (connections.some((c) => c.from.node === id)) continue;
      problems.push(
        `${id}: nothing uses its values. Connect it to a prompt's {variable}, or remove it.`,
      );
    }

  // Nor should it connect to a node that stays blank, such as the empty
  // Prompt Node a new flow starts with: the flow couldn't run.
  if (problems.length === 0)
    for (const id of Array.from(connected)) {
      const node = nodes.get(id);
      const blank = node && kindOf(node.type)?.missing?.(node.settings);
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
  kind: NodeKind,
  settings: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...settings };
  for (const [key, spec] of Object.entries(kind.settings))
    if (
      spec.readOnly &&
      key in out &&
      JSON.stringify(out[key]) === JSON.stringify(current[key] ?? [])
    )
      delete out[key];
  return out;
}

/**
 * Settings with each model's name added as its nickname, where it has none,
 * so the proposal card shows "Jev" rather than a model ID.
 */
function withModelNames(
  kind: NodeKind,
  settings: Record<string, unknown>,
  known: Map<string, ModelInfo>,
): Record<string, unknown> {
  const out = { ...settings };
  for (const [key] of modelSettings(kind))
    if (Array.isArray(out[key]))
      out[key] = (out[key] as unknown[]).map((m) =>
        isPlainObject(m) &&
        m.nickname === undefined &&
        typeof m.model === "string" &&
        known.has(m.model)
          ? { ...m, nickname: known.get(m.model)?.name }
          : m,
      );
  return out;
}

/** A kind's settings that hold models, as [key, spec]. */
function modelSettings(kind: NodeKind | undefined) {
  return Object.entries(kind?.settings ?? {}).filter(([, spec]) => spec.models);
}

function editableSettings(kind: NodeKind): string[] {
  return Object.entries(kind.settings)
    .filter(([, spec]) => !spec.readOnly)
    .map(([key]) => key);
}
