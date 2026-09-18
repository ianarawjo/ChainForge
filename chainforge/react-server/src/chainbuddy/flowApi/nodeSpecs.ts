/**
 * What ChainBuddy may do with each editable node type: its settings, its
 * output, and what it connects to.
 *
 * This restates the Settings and Connects to sections of knowledge/nodes/.
 * A test (nodeSpecs.test.ts) checks the two agree. Later these should be
 * generated from those files instead.
 */

import { isPlainObject } from "../runtime/tools";

export interface NodeSpec {
  type: string;
  editable: string[];
  readOnly: string[];
  /** Settings a new node must be given. */
  required: string[];
  output: string;
  /** Node types this node's output may connect to. */
  connectsTo: string[];
  /** A problem with one setting's value, or undefined if it's fine. */
  checkSetting(key: string, value: unknown): string | undefined;
}

const title = (value: unknown) =>
  typeof value === "string" ? undefined : "title should be text.";

export const NODE_SPECS: Record<string, NodeSpec> = {
  prompt: {
    type: "prompt",
    editable: ["title", "prompts", "models", "responses_per_prompt"],
    readOnly: [],
    required: ["prompts", "models"],
    output: "responses",
    connectsTo: ["prompt", "evaluator"],
    checkSetting(key, value) {
      if (key === "title") return title(value);
      if (key === "prompts") {
        if (!Array.isArray(value) || value.length === 0)
          return "prompts should be a list of at least one { label, text }.";
        if (
          !value.every(
            (p) =>
              isPlainObject(p) &&
              typeof p.text === "string" &&
              p.text.trim() !== "" &&
              (p.label === undefined || typeof p.label === "string"),
          )
        )
          return "each prompt should be { label, text }, with text that isn't empty.";
      }
      if (key === "models") {
        if (!Array.isArray(value) || value.length === 0)
          return "models should be a list of at least one { model }.";
        if (
          !value.every((m) => isPlainObject(m) && typeof m.model === "string")
        )
          return "each model should be { model }, with a model ID from list_models.";
      }
      if (key === "responses_per_prompt")
        if (
          !Number.isInteger(value) ||
          (value as number) < 1 ||
          (value as number) > 999
        )
          return "responses_per_prompt should be a whole number from 1 to 999.";
      return undefined;
    },
  },
  textfields: {
    type: "textfields",
    editable: ["title", "values"],
    readOnly: ["disabled_values"],
    required: ["values"],
    output: "values",
    connectsTo: ["prompt", "textfields"],
    checkSetting(key, value) {
      if (key === "title") return title(value);
      if (key === "values") {
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          !value.every((v) => typeof v === "string")
        )
          return "values should be a list of at least one piece of text.";
        if (value.some((v) => v.trim() === ""))
          return "values shouldn't include empty text; empty values are still sent downstream.";
      }
      return undefined;
    },
  },
  evaluator: {
    type: "evaluator",
    editable: ["title", "code"],
    readOnly: [],
    required: ["code"],
    output: "scored_responses",
    connectsTo: [],
    checkSetting(key, value) {
      if (key === "title") return title(value);
      if (key === "code") {
        if (typeof value !== "string") return "code should be JavaScript text.";
        if (!/function\s+evaluate\s*\(/.test(value))
          return "code should define function evaluate(response).";
      }
      return undefined;
    },
  },
};

/** Node types ChainBuddy can add and edit. */
export const EDITABLE_TYPES = Object.keys(NODE_SPECS);

/** The one input an Evaluator Node has. */
export const EVALUATOR_INPUT = "responses";

/**
 * {name} template variables in some text, the way the stand-in canvas and
 * checks see them: not \{escaped\} braces, and not {#name} references. The
 * app's canvas uses ChainForge's own template parser instead.
 */
export function templateVariables(texts: string[]): string[] {
  const vars = new Set<string>();
  const pattern = /(^|[^\\])\{([^{}#\\][^{}\\]*)\}/g;
  for (const text of texts) {
    let m;
    while ((m = pattern.exec(text)) !== null) vars.add(m[2]);
  }
  return Array.from(vars);
}

/** The inputs a node would have with these settings, by the rules above. */
export function simpleInputsFor(
  type: string,
  settings: Record<string, unknown>,
): string[] {
  if (type === "evaluator") return [EVALUATOR_INPUT];
  if (type === "prompt")
    return templateVariables(
      (Array.isArray(settings.prompts) ? settings.prompts : []).map((p) =>
        isPlainObject(p) ? String(p.text ?? "") : "",
      ),
    );
  if (type === "textfields")
    return templateVariables(
      [
        ...(Array.isArray(settings.values) ? settings.values : []),
        ...(Array.isArray(settings.disabled_values)
          ? settings.disabled_values
          : []),
      ].map(String),
    );
  return [];
}
