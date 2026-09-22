/**
 * The user's models, as ChainBuddy names them: an ID per model (what
 * list_models offers and a Prompt Node's `models` setting holds), and the
 * LLMSpec a Prompt Node stores for it. Reads the store for API keys and
 * Ollama's models.
 */

import { v4 as uuid } from "uuid";
import { getDefaultModelSettings } from "../../ModelSettingSchemas";
import { OPENROUTER_PREFIX } from "../../backend/models";
import { Dict, LLMSpec } from "../../backend/typing";
import { ensureUniqueName } from "../../backend/utils";
import useStore, { initLLMProviders } from "../../store";
import { ModelInfo } from "../flowApi/types";
import { ModelResolver } from "../nodes/types";

/** A model's ID: "ollama/<name>" for Ollama models, else its model string. */
export function modelIdOf(llm: LLMSpec): string {
  if (llm.base_model === "ollama")
    return `ollama/${llm.settings?.ollamaModel ?? llm.formData?.ollamaModel ?? ""}`;
  return llm.model;
}

/** The models ChainBuddy may offer: Ollama's, and those in OpenRouter's menu. */
export function listModels(): ModelInfo[] {
  const { apiKeys, ollamaModels } = useStore.getState();
  return [
    ...ollamaModels.map((name) => ({
      id: `ollama/${name}`,
      name,
      provider: "Ollama",
      ready: true,
    })),
    ...initLLMProviders
      .filter((m) => m.base_model === "openrouter")
      .map((m) => ({
        id: m.model,
        name: m.name,
        provider: "OpenRouter",
        ready: !!apiKeys.OpenRouter,
      })),
  ];
}

/** What the Prompt Node's kind uses to read and write its models. */
export const modelResolver: ModelResolver = {
  idOf: modelIdOf,

  toSpec(id: string, takenNames: string[]) {
    const { apiKeys } = useStore.getState();
    if (id.startsWith("ollama/")) {
      const ollamaModel = id.slice("ollama/".length);
      const name = ensureUniqueName(ollamaModel, takenNames);
      const settings: Dict = {
        ...getDefaultModelSettings("ollama", "ollama"),
        ollamaModel,
      };
      const formData: Dict = { shortname: name, model: "ollama", ollamaModel };
      if (apiKeys.Ollama_BaseURL) {
        settings.ollama_url = apiKeys.Ollama_BaseURL;
        formData.ollama_url = apiKeys.Ollama_BaseURL;
      }
      return {
        key: uuid(),
        name,
        emoji: "🦙",
        model: "ollama",
        base_model: "ollama",
        temp: 1.0,
        settings,
        formData,
      };
    }
    // As the Prompt Node's model menu builds it (LLMListComponent).
    const item = initLLMProviders.find(
      (m) => m.base_model === "openrouter" && m.model === id,
    );
    if (!item) return undefined;
    const name = ensureUniqueName(item.name, takenNames);
    const shortModel = id.slice(OPENROUTER_PREFIX.length);
    return {
      ...item,
      key: uuid(),
      name,
      formData: { shortname: name, model: shortModel },
      settings: getDefaultModelSettings(item.base_model, shortModel),
    };
  },
};
