/** Pieces several node kinds share. */

import { extractTemplateVars } from "../../backend/template";
import { LLMSpec } from "../../backend/typing";
import { isPlainObject } from "../runtime/tools";
import { ModelResolver, SettingSpec } from "./types";

export const titleSetting: SettingSpec = {
  label: "Title",
  check: (value) =>
    typeof value === "string" ? undefined : "title should be text.",
};

/**
 * Models used to other template languages write {{name}}. ChainForge reads
 * that as a variable named "{name", and sends a stray brace to the model.
 */
export function doubleBraces(setting: string, texts: string[]) {
  return texts.some((text) => /\{\{|\}\}/.test(text))
    ? `${setting} use {{...}}. ChainForge variables use single braces, like {country}; write \\{ and \\} for literal braces.`
    : undefined;
}

/** Checks a setting that may only be one of a few words. */
export function oneOf(setting: string, allowed: string[]) {
  return (value: unknown) =>
    typeof value === "string" && allowed.includes(value)
      ? undefined
      : `${setting} should be one of: ${allowed.join(", ")}.`;
}

/** Whether any item in a list has text that isn't blank. */
export function hasText(list: unknown, text: (item: unknown) => unknown) {
  return (
    Array.isArray(list) &&
    list.some((item) => String(text(item) ?? "").trim() !== "")
  );
}

/** A list setting's items, or an empty list. */
export function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A field of an item that may not be an object. */
export function field(item: unknown, key: string): unknown {
  return isPlainObject(item) ? item[key] : undefined;
}

/**
 * The {variables} in some texts, as ChainForge's nodes find them: not
 * \\{escaped\\} braces, and not {#name} references to earlier values.
 */
export function templateVars(texts: string[]): string[] {
  const vars = new Set<string>();
  for (const text of texts)
    for (const v of extractTemplateVars(text)) if (v[0] !== "#") vars.add(v);
  return Array.from(vars);
}

/** A setting listing models as { model } by list_models ID (see SettingSpec.models). */
export function modelsSetting(
  label: string,
  use: "respond" | "judge",
  setting: string,
): SettingSpec {
  return {
    label,
    models: use,
    // Compared by ID, since only models already in a node have nicknames.
    items: {
      key: (m) => String(field(m, "model")),
      label: (m) => String(field(m, "nickname") ?? field(m, "model")),
    },
    check: (value) => {
      if (!Array.isArray(value) || value.length === 0)
        return `${setting} should be a list of at least one { model }.`;
      if (!value.every((m) => isPlainObject(m) && typeof m.model === "string"))
        return `each of ${setting} should be { model }, with a model ID from list_models.`;
      return undefined;
    },
  };
}

/** A node's models as ChainBuddy lists them, from its LLMSpecs. */
export function modelsOf(llms: LLMSpec[], models: ModelResolver) {
  return llms.map((llm) => ({ model: models.idOf(llm), nickname: llm.name }));
}

/**
 * LLMSpecs for a list of { model }. A model already in the node is kept as it
 * is, settings and all; a new one is set up as the model menu would.
 */
export function modelSpecs(
  wanted: unknown[],
  existing: LLMSpec[],
  models: ModelResolver,
  setUp?: (spec: LLMSpec) => LLMSpec,
): LLMSpec[] {
  const kept = new Set<LLMSpec>();
  const llms: LLMSpec[] = [];
  for (const model of wanted.map((m) => String(field(m, "model")))) {
    const same = existing.find((l) => !kept.has(l) && models.idOf(l) === model);
    if (same) {
      kept.add(same);
      llms.push(same);
      continue;
    }
    const spec = models.toSpec(
      model,
      llms.map((l) => l.name),
    );
    if (!spec) throw new Error(`No model "${model}".`);
    llms.push(setUp ? setUp(spec) : spec);
  }
  return llms;
}
