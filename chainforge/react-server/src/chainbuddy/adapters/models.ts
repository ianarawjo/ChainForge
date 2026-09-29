/**
 * The user's models, as ChainBuddy names them: an ID per model (what
 * list_models offers and a Prompt Node's `models` setting holds), and the
 * LLMSpec a Prompt Node stores for it. Reads the store for the model menu,
 * which API keys are set, and Ollama's models.
 */

import {
  getProvider,
  hasAPIKeysFor,
  isDecisionModel,
  LLM,
  LLMProvider,
  OPENROUTER_PREFIX,
} from "../../backend/models";
import { LLMGroup, LLMSpec } from "../../backend/typing";
import { newModelSpec } from "../../modelSpec";
import useStore, { initLLMProviderMenu } from "../../store";
import { ModelInfo } from "../flowApi/types";
import { ModelResolver } from "../nodes/types";

/**
 * The judge a new LLM Scorer gets when ChainBuddy doesn't choose one: TypeSafe's
 * Jev, a model made for judging, when the user has an OpenRouter key.
 */
export const DEFAULT_JUDGE = `${OPENROUTER_PREFIX}~typesafe/jev-latest`;

/** A model's ID: "ollama/<name>" for Ollama models, else its model string. */
export function modelIdOf(llm: LLMSpec): string {
  if (llm.base_model === "ollama")
    return `ollama/${llm.settings?.ollamaModel ?? llm.formData?.ollamaModel ?? ""}`;
  return llm.model;
}

/**
 * Menu entries ChainBuddy leaves out: Azure OpenAI is one entry that needs a
 * deployment name set in its settings, which ChainBuddy can't do.
 */
const NEEDS_SETTING_UP = new Set(["azure-openai"]);

/** The menu group each built-in model is listed under, such as "Claude". */
function menuGroups(): Map<string, string> {
  const groups = new Map<string, string>();
  const walk = (items: (LLMSpec | LLMGroup)[], group?: string) => {
    for (const item of items)
      if ("group" in item) walk(item.items, group ?? item.group);
      else if (group) groups.set(item.model, group);
  };
  walk(initLLMProviderMenu);
  return groups;
}

/**
 * The models ChainBuddy may offer: those in ChainForge's model menu, and
 * Ollama's. A model is ready when its provider's API keys are set, in
 * Settings or as environment variables; ChainBuddy is told only which, never
 * the keys. Small in-browser models are marked as a fallback, for when
 * nothing else is set up, and models that only judge (such as Jev) as such.
 */
export function listModels(): ModelInfo[] {
  const { apiKeys, ollamaModels, AvailableLLMs } = useStore.getState();
  const groups = menuGroups();
  const models: ModelInfo[] = ollamaModels.map((name) => ({
    id: `ollama/${name}`,
    name,
    provider: "Ollama",
    ready: true,
  }));
  const seen = new Set<string>();
  for (const item of AvailableLLMs) {
    // Ollama's models come from its server; favorites repeat menu entries.
    if (item.base_model === "ollama" || NEEDS_SETTING_UP.has(item.model))
      continue;
    if (seen.has(item.model)) continue;
    seen.add(item.model);
    const provider = getProvider(item.model as LLM);
    models.push({
      id: item.model,
      name: item.name,
      provider: groups.get(item.model) ?? provider ?? "Custom",
      ready: provider !== undefined && hasAPIKeysFor(provider, apiKeys),
      ...(provider === LLMProvider.WebLLM ? { fallback: true } : {}),
      ...(isDecisionModel(item.model) ? { judgeOnly: true } : {}),
      ...(item.model === DEFAULT_JUDGE ? { defaultJudge: true } : {}),
    });
  }
  return models;
}

/** What node kinds use to read and write their models. */
export const modelResolver: ModelResolver = {
  idOf: modelIdOf,

  // Built as the Prompt Node's model menu builds them (see modelSpec.ts).
  toSpec(id: string, takenNames: string[]) {
    const { apiKeys, AvailableLLMs } = useStore.getState();
    if (id.startsWith("ollama/")) {
      const ollamaModel = id.slice("ollama/".length);
      const menuItem: LLMSpec = AvailableLLMs.find(
        (m) => m.base_model === "ollama",
      ) ?? {
        name: "Ollama",
        emoji: "🦙",
        model: "ollama",
        base_model: "ollama",
        temp: 1.0,
      };
      return newModelSpec(
        {
          ...menuItem,
          name: ollamaModel,
          settings: { ...(menuItem.settings ?? {}), ollamaModel },
        },
        takenNames,
        apiKeys.Ollama_BaseURL,
      );
    }
    const item = AvailableLLMs.find(
      (m) => m.model === id && m.base_model !== "ollama",
    );
    return item
      ? newModelSpec(item, takenNames, apiKeys.Ollama_BaseURL)
      : undefined;
  },
};
