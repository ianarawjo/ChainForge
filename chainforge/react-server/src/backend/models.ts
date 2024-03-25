/**
 * A list of all model APIs natively supported by ChainForge.
 */
import Bottleneck from "bottleneck";
import { UserForcedPrematureExit } from "./errors";

export enum NativeLLM {
  // OpenAI Chat
  OpenAI_ChatGPT = "gpt-3.5-turbo",
  OpenAI_ChatGPT_16k = "gpt-3.5-turbo-16k",
  OpenAI_ChatGPT_16k_0613 = "gpt-3.5-turbo-16k-0613",
  OpenAI_ChatGPT_0301 = "gpt-3.5-turbo-0301",
  OpenAI_ChatGPT_0613 = "gpt-3.5-turbo-0613",
  OpenAI_ChatGPT_1106 = "gpt-3.5-turbo-1106",
  OpenAI_ChatGPT_0125 = "gpt-3.5-turbo-0125",
  OpenAI_GPT4 = "gpt-4",
  OpenAI_GPT4_0314 = "gpt-4-0314",
  OpenAI_GPT4_0613 = "gpt-4-0613",
  OpenAI_GPT4_1106_Prev = "gpt-4-1106-preview",
  OpenAI_GPT4_0125_Prev = "gpt-4-0125-preview",
  OpenAI_GPT4_Turbo_Prev = "gpt-4-turbo-preview",
  OpenAI_GPT4_32k = "gpt-4-32k",
  OpenAI_GPT4_32k_0314 = "gpt-4-32k-0314",
  OpenAI_GPT4_32k_0613 = "gpt-4-32k-0613",

  // OpenAI Text Completions (deprecated)
  OpenAI_Davinci003 = "text-davinci-003",
  OpenAI_Davinci002 = "text-davinci-002",
  OpenAI_ChatGPT_Instruct = "gpt-3.5-turbo-instruct",

  // OpenAI Image models
  OpenAI_DallE_2 = "dall-e-2",
  OpenAI_DallE_3 = "dall-e-3",

  // Azure OpenAI Endpoints
  Azure_OpenAI = "azure-openai",

  // Dalai-served models (Alpaca and Llama)
  Dalai_Alpaca_7B = "alpaca.7B",
  Dalai_Alpaca_13B = "alpaca.13B",
  Dalai_Llama_7B = "llama.7B",
  Dalai_Llama_13B = "llama.13B",
  Dalai_Llama_30B = "llama.30B",
  Dalai_Llama_65B = "llama.65B",

  // Anthropic
  Claude_v3_opus = "claude-3-opus-20240229",
  Claude_v3_sonnet = "claude-3-sonnet-20240229",
  Claude_v3_haiku = "claude-3-haiku-20240307",
  Claude_v2_1 = "claude-2.1",
  Claude_v2 = "claude-2",
  Claude_v2_0 = "claude-2.0",
  Claude_1_instant = "claude-instant-1",
  Claude_1_instant_1 = "claude-instant-1.1",
  Claude_1_instant_2 = "claude-instant-1.2",
  Claude_v1 = "claude-v1",
  Claude_v1_0 = "claude-v1.0",
  Claude_v1_2 = "claude-v1.2",
  Claude_v1_3 = "claude-v1.3",
  Claude_v1_instant = "claude-instant-v1",

  // Google models
  PaLM2_Text_Bison = "text-bison-001", // it's really models/text-bison-001, but that's confusing
  PaLM2_Chat_Bison = "chat-bison-001",
  GEMINI_PRO = "gemini-pro",

  // Aleph Alpha
  Aleph_Alpha_Luminous_Extended = "luminous-extended",
  Aleph_Alpha_Luminous_ExtendedControl = "luminous-extended-control",
  Aleph_Alpha_Luminous_BaseControl = "luminous-base-control",
  Aleph_Alpha_Luminous_Base = "luminous-base",
  Aleph_Alpha_Luminous_Supreme = "luminous-supreme",
  Aleph_Alpha_Luminous_SupremeControl = "luminous-supreme-control",

  // HuggingFace Inference hosted models, suggested to users
  HF_MISTRAL_7B_INSTRUCT = "mistralai/Mistral-7B-Instruct-v0.1",
  HF_ZEPHYR_7B_BETA = "HuggingFaceH4/zephyr-7b-beta",
  HF_FALCON_7B_INSTRUCT = "tiiuae/falcon-7b-instruct",
  HF_SANTACODER = "bigcode/santacoder",
  HF_STARCODER = "bigcode/starcoder",
  HF_DIALOGPT_LARGE = "microsoft/DialoGPT-large", // chat model
  HF_GPT2 = "gpt2",
  HF_BLOOM_560M = "bigscience/bloom-560m",
  // HF_GPTJ_6B = "EleutherAI/gpt-j-6b",
  // HF_LLAMA_7B = "decapoda-research/llama-7b-hf",

  // A special flag for a user-defined HuggingFace model endpoint.
  // The actual model name will be passed as a param to the LLM call function.
  HF_OTHER = "Other (HuggingFace)",
  Ollama = "ollama",

  Bedrock_Claude_2_1 = "anthropic.claude-v2:1",
  Bedrock_Claude_2 = "anthropic.claude-v2",
  Bedrock_Claude_3_Sonnet = "anthropic.claude-3-sonnet-20240229-v1:0",
  Bedrock_Claude_3_Haiku = "anthropic.claude-3-haiku-20240307-v1:0",
  Bedrock_Claude_Instant_1 = "anthropic.claude-instant-v1",
  Bedrock_Jurassic_Ultra = "ai21.j2-ultra",
  Bedrock_Jurassic_Mid = "ai21.j2-mid",
  Bedrock_Titan_Light = "amazon.titan-text-lite-v1",
  Bedrock_Titan_Large = "amazon.titan-tg1-large",
  Bedrock_Titan_Express = "amazon.titan-text-express-v1",
  Bedrock_Command_Text = "cohere.command-text-v14",
  Bedrock_Command_Text_Light = "cohere.command-light-text-v14",
  Bedrock_Meta_LLama2Chat_13b = "meta.llama2-13b-chat-v1",
  Bedrock_Meta_LLama2Chat_70b = "meta.llama2-70b-chat-v1",
  Bedrock_Mistral_Mistral = "mistral.mistral-7b-instruct-v0:2",
  Bedrock_Mistral_Mixtral = "mistral.mixtral-8x7b-instruct-v0:1",
}

export type LLM = string | NativeLLM;

/**
 * A list of model providers
 */
export enum LLMProvider {
  OpenAI = "openai",
  Azure_OpenAI = "azure",
  Dalai = "dalai",
  Anthropic = "anthropic",
  Google = "google",
  HuggingFace = "hf",
  Aleph_Alpha = "alephalpha",
  Ollama = "ollama",
  Bedrock = "bedrock",
  Custom = "__custom",
}

/**
 * Given an LLM, return what the model provider is.
 * @param llm the specific large language model
 * @returns an `LLMProvider` describing what provider hosts the model
 */
export function getProvider(llm: LLM): LLMProvider | undefined {
  const llm_name = getEnumName(NativeLLM, llm.toString());
  if (llm_name?.startsWith("OpenAI")) return LLMProvider.OpenAI;
  else if (llm_name?.startsWith("Azure")) return LLMProvider.Azure_OpenAI;
  else if (llm_name?.startsWith("PaLM2") || llm_name?.startsWith("GEMINI"))
    return LLMProvider.Google;
  else if (llm_name?.startsWith("Dalai")) return LLMProvider.Dalai;
  else if (llm_name?.startsWith("HF_")) return LLMProvider.HuggingFace;
  else if (llm.toString().startsWith("claude")) return LLMProvider.Anthropic;
  else if (llm_name?.startsWith("Aleph_Alpha")) return LLMProvider.Aleph_Alpha;
  else if (llm_name?.startsWith("Ollama")) return LLMProvider.Ollama;
  else if (llm_name?.startsWith("Bedrock")) return LLMProvider.Bedrock;
  else if (llm.toString().startsWith("__custom/")) return LLMProvider.Custom;

  return undefined;
}

/** LLM APIs often have rate limits, which control number of requests. E.g., OpenAI: https://platform.openai.com/account/rate-limits
#   For a basic organization in OpenAI, GPT3.5 is currently 3500 and GPT4 is 200 RPM (requests per minute).
#   For Anthropic evaluaton preview of Claude, can only send 1 request at a time (synchronously).
#   This 'cheap' version of controlling for rate limits is to wait a few seconds between batches of requests being sent off.
#   If a model is missing from below, it means we must send and receive only 1 request at a time (synchronous).
#   The following is only a guideline, and a bit on the conservative side.  */
export const RATE_LIMIT_BY_MODEL: { [key in LLM]?: number } = {
  [NativeLLM.OpenAI_ChatGPT]: 1000, // max RPM (API requests per minute)
  [NativeLLM.OpenAI_ChatGPT_0301]: 1000,
  [NativeLLM.OpenAI_ChatGPT_0613]: 1000,
  [NativeLLM.OpenAI_ChatGPT_16k]: 1000,
  [NativeLLM.OpenAI_ChatGPT_16k_0613]: 1000,
  [NativeLLM.OpenAI_GPT4]: 500,
  [NativeLLM.OpenAI_GPT4_0314]: 500,
  [NativeLLM.OpenAI_GPT4_0613]: 500,
  [NativeLLM.OpenAI_GPT4_1106_Prev]: 500,
  [NativeLLM.OpenAI_GPT4_0125_Prev]: 500,
  [NativeLLM.OpenAI_GPT4_Turbo_Prev]: 500,
  [NativeLLM.OpenAI_GPT4_32k]: 500,
  [NativeLLM.OpenAI_GPT4_32k_0314]: 500,
  [NativeLLM.OpenAI_GPT4_32k_0613]: 500,
  [NativeLLM.OpenAI_DallE_2]: 10, // Should be 5 images per minute (1 img per every 10 seconds); here, we've been a bit lenient with it.
  [NativeLLM.OpenAI_DallE_3]: 10, // This differs per tier, see https://platform.openai.com/docs/guides/rate-limits/usage-tiers?context=tier-one
  [NativeLLM.Azure_OpenAI]: 500, // conservative
  [NativeLLM.PaLM2_Text_Bison]: 60, // max 60 requests per minute as of Mar 2023
  [NativeLLM.PaLM2_Chat_Bison]: 60,
  [NativeLLM.GEMINI_PRO]: 60,
  [NativeLLM.Bedrock_Jurassic_Mid]: [20, 5],
  [NativeLLM.Bedrock_Jurassic_Ultra]: [5, 5],
  [NativeLLM.Bedrock_Titan_Light]: [40, 5],
  [NativeLLM.Bedrock_Titan_Express]: [20, 5], // 400 RPM
  [NativeLLM.Bedrock_Claude_2]: [20, 15], // 100 RPM
  [NativeLLM.Bedrock_Claude_2_1]: [20, 15], // 100 RPM
  [NativeLLM.Bedrock_Claude_3_Haiku]: [20, 5], // 100 RPM
  [NativeLLM.Bedrock_Claude_3_Sonnet]: [20, 15], // 100 RPM
  [NativeLLM.Bedrock_Command_Text]: [20, 5], // 400 RPM
  [NativeLLM.Bedrock_Command_Text_Light]: [40, 5], // 800 RPM
  [NativeLLM.Bedrock_Meta_LLama2Chat_70b]: [20, 5], // 400 RPM
  [NativeLLM.Bedrock_Meta_LLama2Chat_13b]: [40, 5], // 800 RPM
  [NativeLLM.Bedrock_Mistral_Mixtral]: [20, 5], // 400 RPM
  [NativeLLM.Bedrock_Mistral_Mistral]: [40, 5], // 800 RPM
};

export const RATE_LIMIT_BY_PROVIDER: { [key in LLMProvider]?: number } = {
  [LLMProvider.Anthropic]: 25, // Tier 1 pricing limit is 50 per minute, across all models; we halve this, to be safe.
};

// Max concurrent requests. Add to this to further constrain the rate limiter.
export const MAX_CONCURRENT: { [key in LLM]?: number } = {};

const DEFAULT_RATE_LIMIT = 100; // RPM for any models not listed above

export class RateLimiter {
  // eslint-disable-next-line no-use-before-define
  private static instance: RateLimiter;
  private limiters: Record<LLM, Bottleneck>;

  private constructor() {
    // Initialize the singleton instance
    this.limiters = {};
  }

  /** Gets the global RateLimiter instance. Initializes it if the singleton instance does not yet exist. */
  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /** Get the Bottleneck limiter for the given model. If it doesn't already exist, instantiates it dynamically. */
  private getLimiter(model: LLM): Bottleneck {
    // Find if there's an existing limiter for this model
    if (!(model in this.limiters)) {
      // If there isn't, make one:
      // Find the RPM. First search if the model is present in predefined rate limits; then search for pre-defined RLs by provider; then set to default.
      const rpm =
        RATE_LIMIT_BY_MODEL[model] ??
        RATE_LIMIT_BY_PROVIDER[getProvider(model) ?? LLMProvider.Custom] ??
        DEFAULT_RATE_LIMIT;
      this.limiters[model] = new Bottleneck({
        reservoir: rpm, // max requests per minute
        reservoirRefreshAmount: rpm, // refresh up to max requests every minute
        reservoirRefreshInterval: 60000, // refresh every minute
        maxConcurrent: MAX_CONCURRENT[model] ?? Math.ceil(rpm / 2), // throttle max concurrent requests to half, just in case
        minTime: 20,
      }); // space out the requests by 20ms, to be safe
    }
    return this.limiters[model];
  }

  /** Throttles the API call for the given model, using Bottleneck
   * @param model The model name, as NativeLLM
   * @param func The (async) function to call when ready
   * @param should_cancel Optional. An abort function, that if true, will abort before calling func(), throwing `UserForcedPrematureExit`
   * @returns A Promise that returns with the return value of func.
   */
  public static throttle<T>(
    model: LLM,
    func: () => PromiseLike<T>,
    should_cancel?: () => boolean,
  ): Promise<T> {
    // Rate limit per model, and abort if the API request takes 3 minutes or more.
    return this.getInstance()
      .getLimiter(model)
      .schedule({ expiration: 180000 }, () => {
        if (should_cancel && should_cancel())
          throw new UserForcedPrematureExit();
        return func();
      });
  }
}

/** Equivalent to a Python enum's .name property */
export function getEnumName(
  enumObject: any,
  enumValue: any,
): string | undefined {
  for (const key in enumObject) if (enumObject[key] === enumValue) return key;
  return undefined;
}
