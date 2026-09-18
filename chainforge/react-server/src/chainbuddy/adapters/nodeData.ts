/**
 * Translates between ChainForge's node data and ChainBuddy's view of it (the
 * settings in knowledge/nodes/). This is the only code that knows how the
 * supported nodes store their data; when a node's data changes shape, this
 * file and its tests are what need updating.
 *
 * Deliberately free of the store, so it can be tested directly.
 */

import { extractTemplateVars } from "../../backend/template";
import { Dict, LLMSpec } from "../../backend/typing";
import { EVALUATOR_INPUT, NODE_SPECS } from "../flowApi/nodeSpecs";
import { Support } from "../flowApi/types";

/** Turns model IDs (as list_models gives them) into LLMSpecs, and back. */
export interface ModelResolver {
  idOf(llm: LLMSpec): string;
  /** A new LLMSpec for a model, named so it doesn't clash with `takenNames`. */
  toSpec(id: string, takenNames: string[]): LLMSpec | undefined;
}

/** A model's ID as list_models gives it: "ollama/<name>" for Ollama models, else its model string. */
export function modelIdOf(llm: LLMSpec): string {
  if (llm.base_model === "ollama")
    return `ollama/${llm.settings?.ollamaModel ?? llm.formData?.ollamaModel ?? ""}`;
  return llm.model;
}

/** The handles each supported node draws, by ChainBuddy's names for them. */
export const HANDLES: Record<string, { output: string; input?: string }> = {
  prompt: { output: "prompt" },
  textfields: { output: "output" },
  evaluator: { output: "output", input: "responseBatch" },
};

const DEFAULT_TITLES: Record<string, string> = {
  prompt: "Prompt Node",
  textfields: "TextFields Node",
  evaluator: "JavaScript Evaluator",
};

export function supportOf(type: string | undefined, data: Dict): Support {
  if (type === "evaluator")
    return data.language === "javascript" ? "editable" : "not-supported";
  return type !== undefined && type in NODE_SPECS
    ? "editable"
    : "not-supported";
}

/** Template variables the way nodes find them: ChainForge's parser, minus {#refs}. */
export function templateVars(texts: string[]): string[] {
  const vars = new Set<string>();
  for (const text of texts)
    for (const v of extractTemplateVars(text)) if (v[0] !== "#") vars.add(v);
  return Array.from(vars);
}

/** The inputs a node would have with these settings (in ChainBuddy's terms). */
export function inputsFor(
  type: string,
  settings: Record<string, unknown>,
): string[] {
  if (type === "evaluator") return [EVALUATOR_INPUT];
  if (type === "prompt")
    return templateVars(
      (Array.isArray(settings.prompts) ? settings.prompts : []).map((p) =>
        String((p as Dict)?.text ?? ""),
      ),
    );
  if (type === "textfields")
    return templateVars(
      [
        ...(Array.isArray(settings.values) ? settings.values : []),
        ...(Array.isArray(settings.disabled_values)
          ? settings.disabled_values
          : []),
      ].map(String),
    );
  return [];
}

/** ChainBuddy's settings for a supported node, from its data. */
export function settingsOf(
  type: string,
  data: Dict,
  models: ModelResolver,
): Record<string, unknown> {
  const title = data.title ?? DEFAULT_TITLES[type];
  if (type === "prompt") {
    const texts: string[] = Array.isArray(data.prompt)
      ? data.prompt
      : [data.prompt ?? ""];
    const labels: string[] = data.promptVariantLabel ?? [];
    return {
      title,
      prompts: texts.map((text, i) => ({
        label: labels[i] ?? `Variant ${i + 1}`,
        text,
      })),
      models: ((data.llms ?? []) as LLMSpec[]).map((llm) => ({
        model: models.idOf(llm),
        nickname: llm.name,
      })),
      responses_per_prompt: data.n ?? 1,
    };
  }
  if (type === "textfields") {
    const fields: Dict<string> = data.fields ?? {};
    const visibility: Dict<boolean> = data.fields_visibility ?? {};
    const ids = Object.keys(fields);
    return {
      title,
      values: ids
        .filter((id) => visibility[id] !== false)
        .map((id) => fields[id]),
      disabled_values: ids
        .filter((id) => visibility[id] === false)
        .map((id) => fields[id]),
    };
  }
  if (type === "evaluator") return { title, code: data.code ?? "" };
  return { title };
}

/**
 * Node data with ChainBuddy's settings applied: over `base` for an existing
 * node, or from scratch for a new one. Settings not given are left as they are.
 */
export function dataWithSettings(
  type: string,
  settings: Record<string, unknown>,
  base: Dict | undefined,
  models: ModelResolver,
): Dict {
  const out: Dict = { ...(base ?? {}) };
  if (typeof settings.title === "string") out.title = settings.title;

  if (type === "prompt") {
    if (Array.isArray(settings.prompts)) {
      const prompts = settings.prompts as { label?: string; text: string }[];
      const texts = prompts.map((p) => p.text);
      out.prompt = texts.length === 1 ? texts[0] : texts;
      out.promptVariantLabel = prompts.map(
        (p, i) => p.label?.trim() || `Variant ${i + 1}`,
      );
      out.idxPromptVariantShown = 0;
      // The node reads its inputs from here when it first appears.
      out.vars = templateVars(texts);
    }
    if (Array.isArray(settings.models)) {
      const existing: LLMSpec[] = base?.llms ?? [];
      const kept = new Set<LLMSpec>();
      const llms: LLMSpec[] = [];
      for (const { model } of settings.models as { model: string }[]) {
        // Keep a model already in the node as it is, settings and all.
        const same = existing.find(
          (l) => !kept.has(l) && models.idOf(l) === model,
        );
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
        llms.push(spec);
      }
      out.llms = llms;
    }
    if (typeof settings.responses_per_prompt === "number")
      out.n = settings.responses_per_prompt;
    if (base === undefined) {
      out.prompt ??= "";
      out.n ??= 1;
      out.llms ??= [];
    }
  } else if (type === "textfields") {
    if (Array.isArray(settings.values)) {
      const fields: Dict<string> = base?.fields ?? {};
      const visibility: Dict<boolean> = base?.fields_visibility ?? {};
      const values = [...(settings.values as string[])];
      const next: Dict<string> = {};
      // Disabled values stay where they are; enabled ones are replaced in order.
      for (const [id, text] of Object.entries(fields)) {
        if (visibility[id] === false) next[id] = text;
        else if (values.length > 0) next[id] = values.shift() as string;
      }
      // New ids continue past the highest, as the node itself numbers them.
      let n =
        1 +
        Math.max(
          0,
          ...Object.keys(fields).map((id) => parseInt(id.slice(1)) || 0),
        );
      for (const text of values) next[`f${n++}`] = text;
      out.fields = next;
      out.fields_visibility = Object.fromEntries(
        Object.entries(visibility).filter(
          ([id, v]) => v === false && id in next,
        ),
      );
      out.vars = templateVars(Object.values(next));
    }
  } else if (type === "evaluator") {
    if (typeof settings.code === "string") out.code = settings.code;
    out.language = "javascript";
  }
  return out;
}

/** ChainBuddy's name for the end of an edge. */
export function outputName(
  type: string | undefined,
  handle: string | null | undefined,
) {
  if (type && type in NODE_SPECS) return NODE_SPECS[type].output;
  return handle ?? "";
}

export function inputName(
  type: string | undefined,
  handle: string | null | undefined,
) {
  if (type === "evaluator" && handle === HANDLES.evaluator.input)
    return EVALUATOR_INPUT;
  return handle ?? "";
}

/** The handle ids for a ChainBuddy connection. */
export function handlesFor(
  sourceType: string,
  targetType: string,
  input: string,
): { sourceHandle: string; targetHandle: string } {
  return {
    sourceHandle: HANDLES[sourceType].output,
    targetHandle:
      targetType === "evaluator" ? (HANDLES.evaluator.input as string) : input,
  };
}
