/** 
 * A list of all model APIs natively supported by ChainForge. 
 */
export type LLM = string | NativeLLM;
export enum NativeLLM {
  // OpenAI Chat
  OpenAI_ChatGPT = "gpt-3.5-turbo",
  OpenAI_ChatGPT_1106 = "gpt-3.5-turbo-1106",
  OpenAI_ChatGPT_16k = "gpt-3.5-turbo-16k",
  OpenAI_ChatGPT_16k_0613 = "gpt-3.5-turbo-16k-0613",
  OpenAI_ChatGPT_0301 = "gpt-3.5-turbo-0301",
  OpenAI_ChatGPT_0613 = "gpt-3.5-turbo-0613",
  OpenAI_GPT4 = "gpt-4",
  OpenAI_GPT4_0314 = "gpt-4-0314",
  OpenAI_GPT4_0613 = "gpt-4-0613",
  OpenAI_GPT4_1106_Prev = "gpt-4-1106-preview",
  OpenAI_GPT4_32k = "gpt-4-32k",
  OpenAI_GPT4_32k_0314 = "gpt-4-32k-0314",
  OpenAI_GPT4_32k_0613 = "gpt-4-32k-0613",

  // OpenAI Text Completions
  OpenAI_Davinci003 = "text-davinci-003",
  OpenAI_Davinci002 = "text-davinci-002",
  OpenAI_ChatGPT_Instruct = "gpt-3.5-turbo-instruct",

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
  Claude_v2 = "claude-2",
  Claude_v2_0 = "claude-2.0",
  Claude_v2_1 = "claude-2.1",
  Claude_1_instant = "claude-instant-1",
  Claude_1_instant_1 = "claude-instant-1.1",
  Claude_1_instant_2 = "claude-instant-1.2",
  Claude_v1 = "claude-v1",
  Claude_v1_0 = "claude-v1.0",
  Claude_v1_2 = "claude-v1.2",
  Claude_v1_3 = "claude-v1.3",
  Claude_v1_instant = "claude-instant-v1",

  // Google models
  PaLM2_Text_Bison = "text-bison-001",  // it's really models/text-bison-001, but that's confusing
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
}

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
  Custom = "__custom",
}

/**
 * Given an LLM, return what the model provider is.
 * @param llm the specific large language model
 * @returns an `LLMProvider` describing what provider hosts the model
 */
export function getProvider(llm: LLM): LLMProvider | undefined {
  const llm_name = getEnumName(NativeLLM, llm.toString());
  if (llm_name?.startsWith('OpenAI'))
    return LLMProvider.OpenAI;
  else if (llm_name?.startsWith('Azure'))
    return LLMProvider.Azure_OpenAI;
  else if (llm_name?.startsWith('PaLM2') || llm_name?.startsWith('GEMINI'))
    return LLMProvider.Google;
  else if (llm_name?.startsWith('Dalai'))
    return LLMProvider.Dalai;
  else if (llm_name?.startsWith('HF_'))
    return LLMProvider.HuggingFace;
  else if (llm.toString().startsWith('claude'))
    return LLMProvider.Anthropic;
  else if (llm_name?.startsWith('Aleph_Alpha'))
    return LLMProvider.Aleph_Alpha;
  else if (llm.toString().startsWith('__custom/'))
    return LLMProvider.Custom;
  
  return undefined;
}


/** LLM APIs often have rate limits, which control number of requests. E.g., OpenAI: https://platform.openai.com/account/rate-limits
#   For a basic organization in OpenAI, GPT3.5 is currently 3500 and GPT4 is 200 RPM (requests per minute).
#   For Anthropic evaluaton preview of Claude, can only send 1 request at a time (synchronously).
#   This 'cheap' version of controlling for rate limits is to wait a few seconds between batches of requests being sent off.
#   If a model is missing from below, it means we must send and receive only 1 request at a time (synchronous).
#   The following is only a guideline, and a bit on the conservative side.  */
export let RATE_LIMITS: { [key in LLM]?: [number, number] } = {
  [NativeLLM.OpenAI_ChatGPT]: [30, 10],  // max 30 requests a batch; wait 10 seconds between
  [NativeLLM.OpenAI_ChatGPT_0301]: [30, 10],
  [NativeLLM.OpenAI_ChatGPT_0613]: [30, 10],
  [NativeLLM.OpenAI_ChatGPT_16k]: [30, 10],
  [NativeLLM.OpenAI_ChatGPT_16k_0613]: [30, 10],
  [NativeLLM.OpenAI_GPT4]: [4, 15],  // max 4 requests a batch; wait 15 seconds between
  [NativeLLM.OpenAI_GPT4_0314]: [4, 15],
  [NativeLLM.OpenAI_GPT4_0613]: [4, 15],
  [NativeLLM.OpenAI_GPT4_32k]: [4, 15],
  [NativeLLM.OpenAI_GPT4_32k_0314]: [4, 15],
  [NativeLLM.OpenAI_GPT4_32k_0613]: [4, 15],
  [NativeLLM.Azure_OpenAI]: [30, 10],
  [NativeLLM.PaLM2_Text_Bison]: [4, 10],  // max 30 requests per minute; so do 4 per batch, 10 seconds between (conservative)
  [NativeLLM.PaLM2_Chat_Bison]: [4, 10],
};


/** Equivalent to a Python enum's .name property */
export function getEnumName(enumObject: any, enumValue: any): string | undefined {
  for (const key in enumObject) 
    if (enumObject[key] === enumValue) 
      return key;
  return undefined;
}
