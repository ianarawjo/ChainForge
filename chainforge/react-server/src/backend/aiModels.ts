/**
 * The models behind ChainForge's AI support features (the purple sparkle
 * buttons, and EvalGen).
 *
 * Users pick a provider; each provider recommends a "fast" model, for
 * generating data, and a "smart" model, for writing code and in EvalGen.
 * Either can be overridden. The result is an ordinary LLMSpec, so AI features
 * query models through queryLLM like any Prompt Node does.
 */
import { getDefaultModelSettings, ModelSettings } from "../ModelSettingSchemas";
import { OPENROUTER_PREFIX } from "./models";
import { Dict, LLMSpec } from "./typing";

export type AITier = "fast" | "smart";

export interface AIProvider {
  /** Shown to users, and saved in their settings. */
  name: string;
  emoji: string;
  /** The key of the provider's settings form in ModelSettings. */
  base_model: string;
  /** Prepended to the model name, for providers that route by prefix. */
  prefix?: string;
  /** The name of the API key the provider needs, in the API Keys settings. */
  apiKey?: string;
  /** Only offered when ChainForge is running locally. */
  localOnly?: boolean;
  /** The recommended models. Blank means the first model available (Ollama). */
  recommended: Record<AITier, string>;
  /** Settings applied over the form's defaults, for every AI call. */
  settings?: Dict;
}

/** The providers AI features can use, in the order they're offered. */
export const AI_PROVIDERS: AIProvider[] = [
  {
    name: "OpenRouter",
    emoji: "🔀",
    base_model: "openrouter",
    prefix: OPENROUTER_PREFIX,
    apiKey: "OpenRouter",
    recommended: {
      fast: "google/gemini-3.1-flash-lite",
      smart: "anthropic/claude-haiku-4.5",
    },
    settings: { reasoning_effort: "low" },
  },
  {
    name: "Ollama",
    emoji: "🦙",
    base_model: "ollama",
    localOnly: true,
    recommended: { fast: "", smart: "" },
    // The chat endpoint is the one that takes a system message; the default
    // context window (2048) is too short for EvalGen's prompts.
    settings: { model_type: "chat", num_ctx: 8192 },
  },
  {
    name: "Anthropic",
    emoji: "📚",
    base_model: "claude-v1",
    apiKey: "Anthropic",
    recommended: { fast: "claude-haiku-4-5", smart: "claude-sonnet-5" },
    settings: { max_tokens_to_sample: 8192 },
  },
  {
    name: "OpenAI",
    emoji: "🤖",
    base_model: "gpt-4",
    apiKey: "OpenAI",
    recommended: { fast: "gpt-5.4-nano", smart: "gpt-5.4-mini" },
    settings: { reasoning_effort: "low" },
  },
  {
    name: "Google",
    emoji: "♊",
    base_model: "gemini-2.5",
    apiKey: "Google",
    recommended: { fast: "gemini-3.1-flash-lite", smart: "gemini-3.8-flash" },
    settings: {
      max_output_tokens: 8192,
      thinking_level: "low",
      include_thoughts: false,
    },
  },
  {
    name: "DeepSeek",
    emoji: "🐋",
    base_model: "deepseek",
    apiKey: "DeepSeek",
    recommended: { fast: "deepseek-flash", smart: "deepseek-v4-pro" },
  },
];

/** Per-provider model overrides, as saved in settings. Blank means recommended. */
export type AIModelOverrides = Dict<Partial<Record<AITier, string>>>;

export function getAIProviders(runningLocally: boolean): AIProvider[] {
  return AI_PROVIDERS.filter((p) => runningLocally || !p.localOnly);
}

export function getAIProvider(
  name: string | undefined,
  runningLocally: boolean,
): AIProvider | undefined {
  return getAIProviders(runningLocally).find((p) => p.name === name);
}

/**
 * The provider to use when the user hasn't picked one: the first with an API
 * key set, else Ollama if it has models, else the first provider.
 */
export function autoPickAIProvider(
  apiKeys: Dict<string>,
  ollamaModels: string[],
  runningLocally: boolean,
): AIProvider {
  const providers = getAIProviders(runningLocally);
  return (
    providers.find((p) => p.apiKey && apiKeys[p.apiKey]) ??
    providers.find((p) => p.localOnly && ollamaModels.length > 0) ??
    providers[0]
  );
}

/** The model the user chose for a tier, or else the recommended one. */
export function aiModelName(
  provider: AIProvider,
  tier: AITier,
  overrides: AIModelOverrides | undefined,
  ollamaModels: string[],
): string {
  const chosen = overrides?.[provider.name]?.[tier]?.trim();
  if (chosen) return chosen;
  if (provider.recommended[tier]) return provider.recommended[tier];
  return provider.base_model === "ollama" ? ollamaModels[0] ?? "" : "";
}

/** Model names to suggest for a provider, e.g. in an autocomplete. */
export function aiModelSuggestions(
  provider: AIProvider,
  ollamaModels: string[],
): string[] {
  if (provider.base_model === "ollama") return ollamaModels;
  const names = ModelSettings[provider.base_model]?.schema?.properties?.model
    ?.enum as string[] | undefined;
  const suggestions = new Set([
    provider.recommended.fast,
    provider.recommended.smart,
    ...(names ?? []),
  ]);
  return Array.from(suggestions).filter(Boolean);
}

/**
 * What's missing before the provider can be used, as a message to show users,
 * or undefined if it's ready.
 */
export function aiSetupProblem(
  provider: AIProvider,
  apiKeys: Dict<string>,
  ollamaModels: string[],
  overrides?: AIModelOverrides,
): string | undefined {
  if (provider.apiKey && !apiKeys[provider.apiKey])
    return `Add your ${provider.name} API key in the API Keys tab of Settings, or pick a different provider for AI features.`;
  if (
    provider.base_model === "ollama" &&
    !aiModelName(provider, "fast", overrides, ollamaModels)
  )
    return "ChainForge didn't find any Ollama models. Make sure Ollama is running and you've pulled a model (e.g. `ollama pull <model>`), or pick a different provider for AI features.";
  return undefined;
}

/**
 * The LLMSpec to query for a tier, ready to pass to queryLLM.
 */
export function aiModelSpec(
  provider: AIProvider,
  tier: AITier,
  overrides: AIModelOverrides | undefined,
  apiKeys: Dict<string>,
  ollamaModels: string[],
): LLMSpec {
  const name = aiModelName(provider, tier, overrides, ollamaModels);
  const isOllama = provider.base_model === "ollama";
  const settings: Dict = {
    ...getDefaultModelSettings(provider.base_model, name),
    ...provider.settings,
  };
  if (isOllama) {
    settings.ollamaModel = name;
    if (apiKeys.Ollama_BaseURL) settings.ollama_url = apiKeys.Ollama_BaseURL;
  }

  return {
    key: `__ai/${provider.name}/${tier}`,
    name: `${provider.name} ${name}`,
    emoji: provider.emoji,
    model: isOllama ? "ollama" : (provider.prefix ?? "") + name,
    base_model: provider.base_model,
    temp: settings.temperature ?? 1.0,
    settings,
  };
}
