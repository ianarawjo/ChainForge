/**
 * Which model drives ChainBuddy, from the user's AI Support settings.
 */

import { useMemo } from "react";
import { aiModelName } from "../../backend/aiModels";
import useAIFeatures from "../../useAIFeatures";
import { OpenAICompatibleConfig } from "../model/openaiCompatible";

export interface ChainBuddyModel {
  /** Whether AI support is on at all. ChainBuddy hides when it's off. */
  enabled: boolean;
  /** Shown in the panel's header, e.g. "anthropic/claude-haiku-4.5 · OpenRouter". */
  label: string;
  /** Set when ChainBuddy can run. */
  config?: OpenAICompatibleConfig;
  /** Why it can't run, to show the user. */
  problem?: string;
}

export function useChainBuddyModel(): ChainBuddyModel {
  const ai = useAIFeatures();
  return useMemo(() => {
    const name = aiModelName(
      ai.provider,
      "smart",
      ai.overrides,
      ai.ollamaModels,
    );
    const label = `${name || "no model"} · ${ai.provider.name}`;
    if (ai.setupProblem)
      return { enabled: ai.enabled, label, problem: ai.setupProblem };
    if (ai.provider.name === "OpenRouter")
      return {
        enabled: ai.enabled,
        label,
        config: {
          provider: "openrouter",
          model: name,
          apiKey: ai.apiKeys.OpenRouter,
          reasoningEffort: "low",
        },
      };
    if (ai.provider.name === "Ollama")
      return {
        enabled: ai.enabled,
        label,
        config: {
          provider: "ollama",
          model: name,
          baseURL: `${(ai.apiKeys.Ollama_BaseURL || "http://localhost:11434").replace(/\/+$/, "")}/v1`,
        },
      };
    return {
      enabled: ai.enabled,
      label,
      problem:
        "ChainBuddy works with OpenRouter or Ollama for now. Choose one under AI Support in Settings.",
    };
  }, [ai]);
}
