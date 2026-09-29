import doc from "../knowledge/nodes/prompt.md";
import { Dict, LLMSpec } from "../../backend/typing";
import { isPlainObject } from "../runtime/tools";
import {
  doubleBraces,
  field,
  hasText,
  listOf,
  modelsOf,
  modelsSetting,
  modelSpecs,
  templateVars,
  titleSetting,
} from "./common";
import { NodeKind } from "./types";

type Prompt = { label?: string; text: string };

const promptLabel = (p: unknown) => {
  const label = field(p, "label");
  return `${label ? `${label}: ` : ""}${field(p, "text")}`;
};

export const promptKind: NodeKind = {
  type: "prompt",
  name: "Prompt Node",
  doc,
  output: "responses",
  accepts: ["values", "responses"],
  handles: { output: "prompt" },

  settings: {
    title: titleSetting,
    prompts: {
      label: "Prompts",
      required: true,
      items: { key: promptLabel, label: promptLabel, separator: " | " },
      check: (value) => {
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
        return doubleBraces(
          "prompts",
          value.map((p) => String(field(p, "text"))),
        );
      },
    },
    models: { ...modelsSetting("Models", "respond", "models"), required: true },
    responses_per_prompt: {
      label: "Responses per prompt",
      check: (value) =>
        !Number.isInteger(value) ||
        (value as number) < 1 ||
        (value as number) > 999
          ? "responses_per_prompt should be a whole number from 1 to 999."
          : undefined,
    },
  },

  inputs: (settings) =>
    templateVars(
      listOf(settings.prompts).map((p) => String(field(p, "text") ?? "")),
    ),

  missing: (settings) => {
    if (!hasText(settings.prompts, (p) => field(p, "text")))
      return "has no prompt text yet";
    if (listOf(settings.models).length === 0) return "has no models yet";
    return undefined;
  },

  read(data, models) {
    const texts: string[] = Array.isArray(data.prompt)
      ? data.prompt
      : [data.prompt ?? ""];
    const labels: string[] = data.promptVariantLabel ?? [];
    return {
      title: data.title ?? promptKind.name,
      prompts: texts.map((text, i) => ({
        label: labels[i] ?? `Variant ${i + 1}`,
        text,
      })),
      models: modelsOf((data.llms ?? []) as LLMSpec[], models),
      responses_per_prompt: data.n ?? 1,
    };
  },

  write(settings, base, models) {
    const out: Dict = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;
    if (Array.isArray(settings.prompts)) {
      const prompts = settings.prompts as Prompt[];
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
      const llms = modelSpecs(settings.models, base?.llms ?? [], models);
      out.llms = llms;
    }
    if (typeof settings.responses_per_prompt === "number")
      out.n = settings.responses_per_prompt;
    if (base === undefined) {
      out.prompt ??= "";
      out.n ??= 1;
      out.llms ??= [];
    }
    return out;
  },
};
