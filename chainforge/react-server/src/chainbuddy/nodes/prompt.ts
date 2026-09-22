import doc from "../knowledge/nodes/prompt.md";
import { Dict, LLMSpec } from "../../backend/typing";
import { isPlainObject } from "../runtime/tools";
import { doubleBraces, field, hasText, listOf, titleSetting } from "./common";
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
    models: {
      label: "Models",
      required: true,
      // Compared by ID, since only models already in a node have nicknames.
      items: {
        key: (m) => String(field(m, "model")),
        label: (m) => String(field(m, "nickname") ?? field(m, "model")),
      },
      check: (value) => {
        if (!Array.isArray(value) || value.length === 0)
          return "models should be a list of at least one { model }.";
        if (
          !value.every((m) => isPlainObject(m) && typeof m.model === "string")
        )
          return "each model should be { model }, with a model ID from list_models.";
        return undefined;
      },
    },
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

  inputs: (settings, varsOf) =>
    varsOf(listOf(settings.prompts).map((p) => String(field(p, "text") ?? ""))),

  missing: (settings) => {
    if (!hasText(settings.prompts, (p) => field(p, "text")))
      return "has no prompt text yet";
    if (listOf(settings.models).length === 0) return "has no models yet";
    return undefined;
  },

  read(data, { models }) {
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
      models: ((data.llms ?? []) as LLMSpec[]).map((llm) => ({
        model: models.idOf(llm),
        nickname: llm.name,
      })),
      responses_per_prompt: data.n ?? 1,
    };
  },

  write(settings, base, { models, varsOf }) {
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
      out.vars = varsOf(texts);
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
    return out;
  },
};
