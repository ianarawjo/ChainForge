/**
 * Translates between ChainForge's node data and ChainBuddy's settings, by
 * handing each node to its NodeKind (see nodes/) with ChainForge's own
 * template parser.
 *
 * Deliberately free of the store, so it can be tested directly.
 */

import { extractTemplateVars } from "../../backend/template";
import { Dict, LLMSpec } from "../../backend/typing";
import { Support } from "../flowApi/types";
import { kindOf } from "../nodes";
import { ModelResolver, VarsOf } from "../nodes/types";

export type { ModelResolver } from "../nodes/types";

/** Template variables the way nodes find them: ChainForge's parser, minus {#refs}. */
export const templateVars: VarsOf = (texts) => {
  const vars = new Set<string>();
  for (const text of texts)
    for (const v of extractTemplateVars(text)) if (v[0] !== "#") vars.add(v);
  return Array.from(vars);
};

/** A model's ID as list_models gives it: "ollama/<name>" for Ollama models, else its model string. */
export function modelIdOf(llm: LLMSpec): string {
  if (llm.base_model === "ollama")
    return `ollama/${llm.settings?.ollamaModel ?? llm.formData?.ollamaModel ?? ""}`;
  return llm.model;
}

export function supportOf(type: string | undefined, data: Dict): Support {
  const kind = kindOf(type);
  return kind && (!kind.supports || kind.supports(data))
    ? "editable"
    : "not-supported";
}

/** The inputs a node would have with these settings (in ChainBuddy's terms). */
export function inputsFor(
  type: string,
  settings: Record<string, unknown>,
): string[] {
  return kindOf(type)?.inputs(settings, templateVars) ?? [];
}

/** ChainBuddy's settings for a supported node, from its data. */
export function settingsOf(
  type: string,
  data: Dict,
  models: ModelResolver,
): Record<string, unknown> {
  const kind = kindOf(type);
  if (!kind) return { title: data.title ?? type };
  return kind.read(data, { models, varsOf: templateVars });
}

/** Node data with ChainBuddy's settings applied (see NodeKind.write). */
export function dataWithSettings(
  type: string,
  settings: Record<string, unknown>,
  base: Dict | undefined,
  models: ModelResolver,
): Dict {
  const kind = kindOf(type);
  if (!kind) throw new Error(`ChainBuddy can't edit ${type} nodes.`);
  return kind.write(settings, base, { models, varsOf: templateVars });
}

/** ChainBuddy's name for the start of an edge. */
export function outputName(
  type: string | undefined,
  handle: string | null | undefined,
) {
  return kindOf(type)?.output ?? handle ?? "";
}

/** ChainBuddy's name for the end of an edge. */
export function inputName(
  type: string | undefined,
  handle: string | null | undefined,
) {
  const renamed = Object.entries(kindOf(type)?.handles.inputs ?? {}).find(
    ([, id]) => id === handle,
  );
  return renamed?.[0] ?? handle ?? "";
}

/** The handle ids for a ChainBuddy connection. */
export function handlesFor(
  sourceType: string,
  targetType: string,
  input: string,
): { sourceHandle: string; targetHandle: string } {
  const source = kindOf(sourceType);
  const target = kindOf(targetType);
  if (!source || !target)
    throw new Error(`ChainBuddy can't connect ${sourceType} to ${targetType}.`);
  return {
    sourceHandle: source.handles.output,
    targetHandle: target.handles.inputs?.[input] ?? input,
  };
}
