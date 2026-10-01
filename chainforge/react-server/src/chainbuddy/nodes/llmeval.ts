import doc from "../knowledge/nodes/llmeval.md";
import { isDecisionModel, NativeLLM } from "../../backend/models";
import { parseCategories, parseScale } from "../../backend/scorerFormat";
import { extractTemplateVars } from "../../backend/template";
import { Dict, LLMSpec } from "../../backend/typing";
import { isPlainObject } from "../runtime/tools";
import {
  doubleBraces,
  field,
  listOf,
  modelsOf,
  modelsSetting,
  modelSpecs,
  oneOf,
  titleSetting,
} from "./common";
import { NodeKind } from "./types";

/** ChainBuddy's name for each answer format → the node's own code for it. */
const FORMATS: Record<string, string> = {
  binary: "bin",
  categorical: "cat",
  numeric: "num",
  "open-ended": "open",
};
const formatName = (code: unknown) =>
  Object.keys(FORMATS).find((name) => FORMATS[name] === code) ?? "binary";

/**
 * Whether a model, by list_models ID, only judges: a decision model such as
 * Jev, or one of Ollama's ("ollama-decision/<name>", see adapters/models.ts).
 */
const isJudgeOnly = (id: string) =>
  isDecisionModel(id) || id.startsWith(`${NativeLLM.Ollama_Decision}/`);

/** How many levels a scale may have: what a judge-only model can answer on. */
const MIN_LEVELS = 2;
const MAX_LEVELS = 10;

type Category = { label: string; description?: string };

const categoriesText = (cats: Category[]) =>
  cats
    .map((c) => (c.description ? `${c.label}: ${c.description}` : c.label))
    .join("\n");

/** Text without line breaks, which the node's one-per-line lists can't hold. */
const oneLine = (v: unknown) => typeof v === "string" && !/[\r\n]/.test(v);

/** The judges a node has: several, or the one a single-judge node keeps. */
function judgesIn(data: Dict | undefined): LLMSpec[] {
  if (Array.isArray(data?.graders) && data?.graders.length) return data.graders;
  return data?.grader ? [data.grader] : [];
}

/** A new judge, scoring at temperature 0 as ChainForge's own default judge does. */
function asJudge(spec: LLMSpec): LLMSpec {
  const out = { ...spec, temp: 0 };
  if (out.settings && "temperature" in out.settings)
    out.settings = { ...out.settings, temperature: 0 };
  if (out.formData && "temperature" in out.formData)
    out.formData = { ...out.formData, temperature: 0 };
  return out;
}

export const llmevalKind: NodeKind = {
  type: "llmeval",
  name: "LLM Scorer",
  doc,
  output: "scored_responses",
  accepts: ["values", "responses"],
  handles: { output: "output", inputs: { responses: "responseBatch" } },
  unconnectedHint: "Connect what it should score to it.",

  settings: {
    title: titleSetting,
    rubric: {
      label: "Rubric",
      required: true,
      check: (value) => {
        if (typeof value !== "string" || value.trim() === "")
          return "rubric should say what to decide about each response.";
        const plain = Array.from(extractTemplateVars(value)).filter(
          (v) => v[0] !== "#",
        );
        if (plain.length > 0)
          return `rubric uses {${plain[0]}}. To use a value from the flow, write {#${plain[0]}}; for literal braces, write \\{ and \\}.`;
        return doubleBraces("rubric", [value]);
      },
    },
    format: {
      label: "Answer",
      values: () => Object.keys(FORMATS),
      check: oneOf("format", Object.keys(FORMATS)),
    },
    categories: {
      label: "Categories",
      items: {
        key: (c) => String(field(c, "label")),
        label: (c) => String(field(c, "label")),
      },
      check: (value) =>
        Array.isArray(value) &&
        value.every(
          (c) =>
            isPlainObject(c) &&
            oneLine(c.label) &&
            (c.label as string).trim() !== "" &&
            !(c.label as string).includes(":") &&
            (c.description === undefined || oneLine(c.description)),
        )
          ? undefined
          : "categories should be a list of { label, description }, each on one line, with no colon in the label.",
    },
    scale: {
      label: "Scale",
      items: { key: String, label: String, separator: " < " },
      check: (value) =>
        Array.isArray(value) &&
        value.every((l) => oneLine(l) && (l as string).trim() !== "")
          ? undefined
          : "scale should be a list of levels, lowest first, each a line of text.",
    },
    judges: modelsSetting("Judges", "judge", "judges"),
  },

  inputs: () => ["responses"],

  missing: (settings) =>
    typeof settings.rubric === "string" && settings.rubric.trim() !== ""
      ? undefined
      : "has no rubric yet",

  checkAll(settings) {
    const format = typeof settings.format === "string" ? settings.format : "";
    const levels = listOf(settings.scale).length;
    if (format === "categorical" && listOf(settings.categories).length < 2)
      return "a categorical scorer needs categories: at least two.";
    if (format === "numeric" && (levels < MIN_LEVELS || levels > MAX_LEVELS))
      return `a numeric scorer needs a scale of ${MIN_LEVELS} to ${MAX_LEVELS} levels, lowest first.`;
    // Judge-only models answer a typed question, with the rubric as written
    const judgeOnly = listOf(settings.judges)
      .map((j) => String(field(j, "model")))
      .filter(isJudgeOnly);
    if (judgeOnly.length === 0) return undefined;
    if (format === "open-ended")
      return `${judgeOnly[0]} only gives binary, categorical or numeric answers, not open-ended ones.`;
    const rubric = typeof settings.rubric === "string" ? settings.rubric : "";
    const ref = Array.from(extractTemplateVars(rubric)).find(
      (v) => v[0] === "#",
    );
    if (ref)
      return `${judgeOnly[0]} sees each response and the rubric as written, so it can't use {${ref}}. Give the scorer judges from list_models' models instead.`;
    return undefined;
  },

  read(data, models) {
    const format = formatName(data.format ?? "bin");
    const categories = parseCategories(data.categories);
    const scale = parseScale(data.scale);
    const judges = judgesIn(data);
    return {
      title: data.title ?? llmevalKind.name,
      rubric: data.prompt ?? "",
      format,
      ...(format === "categorical" && categories.length ? { categories } : {}),
      ...(format === "numeric" && scale.length ? { scale } : {}),
      ...(judges.length ? { judges: modelsOf(judges, models) } : {}),
    };
  },

  write(settings, base, models) {
    const out: Dict = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;
    if (typeof settings.rubric === "string") out.prompt = settings.rubric;
    if (typeof settings.format === "string" && FORMATS[settings.format])
      out.format = FORMATS[settings.format];
    // Lists are stored as the user types them, so text that already says the
    // same thing is kept as it is.
    if (Array.isArray(settings.categories)) {
      const cats = settings.categories as Category[];
      if (
        JSON.stringify(parseCategories(base?.categories)) !==
        JSON.stringify(parseCategories(categoriesText(cats)))
      )
        out.categories = categoriesText(cats);
    }
    if (Array.isArray(settings.scale)) {
      const scale = settings.scale as string[];
      if (JSON.stringify(parseScale(base?.scale)) !== JSON.stringify(scale))
        out.scale = scale.join("\n");
    }
    if (Array.isArray(settings.judges)) {
      const judges = modelSpecs(
        settings.judges,
        judgesIn(base),
        models,
        asJudge,
      );
      out.graders = judges;
      out.grader = judges[0];
    }
    if (base === undefined) {
      out.prompt ??= "";
      out.format ??= FORMATS.binary;
    }
    return out;
  },
};
