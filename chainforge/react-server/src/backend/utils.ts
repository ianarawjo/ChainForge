// from typing import Dict, Tuple, List, Union, Optional
// import json, os, time, asyncio
// from string import Template

// from chainforge.promptengine.models import LLM
import React from "react";
import {
  LLM,
  LLMProvider,
  NativeLLM,
  getProvider,
  isGeminiImageModel,
  isOpenAIImageModel,
  isOpenRouterImageModel,
  stripBedrockPrefix,
  stripHuggingFacePrefix,
  stripTogetherPrefix,
  stripOpenRouterPrefix,
} from "./models";
import {
  Dict,
  LLMAPICall,
  RawLLMResponseObject,
  ChatHistory,
  ChatMessage,
  GeminiChatContext,
  GeminiChatMessage,
  LLMResponse,
  LLMResponsesByVarDict,
  Func,
  VarsContext,
  TemplateVarInfo,
  BaseLLMResponseObject,
  LLMSpec,
  EvaluationScore,
  LLMResponseData,
  isImageResponseData,
  StringOrHash,
  PromptVarsDict,
  MultiModalContentAnthropic,
  MultiModalContentOpenAI,
  MultiModalContentGemini,
  PromptVarType,
} from "./typing";
import { v4 as uuid } from "uuid";
import { StringTemplate } from "./template";

import OpenAI from "openai";
import {
  GenerateContentConfig,
  GoogleGenAI,
  PartListUnion,
} from "@google/genai";
import { UserForcedPrematureExit } from "./errors";
import StorageCache, { StringLookup, MediaLookup } from "./cache";
import Compressor from "compressorjs";
import { Annotations } from "plotly.js";

/**
 * ChainForge queries models straight from the browser, which the OpenAI SDK
 * asks callers to acknowledge. The keys are the user's own and are never sent
 * anywhere but the provider.
 */
const OPENAI_BROWSER_OPTS = { dangerouslyAllowBrowser: true as const };

/** The image fields ChainForge reads back from an OpenAI-shaped image response. */
interface ImagesResponseDataInner {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

/** The useful part of an OpenAI SDK error, which nests the API's own message. */
function openai_error_message(error: any): string {
  return (
    error?.error?.message ??
    error?.response?.data?.error?.message ??
    error?.message ??
    String(error)
  );
}

const ANTHROPIC_HUMAN_PROMPT = "\n\nHuman:";
const ANTHROPIC_AI_PROMPT = "\n\nAssistant:";

/** Where the ChainForge Flask server is being hosted, if any. */
export const FLASK_BASE_URL =
  // @ts-expect-error undefined
  window.__CF_HOSTNAME !== undefined && window.__CF_PORT !== undefined
    ? "/"
    : "http://localhost:8000/";

export async function call_flask_backend(
  route: string,
  params: Dict | string,
): Promise<Dict> {
  return fetch(`${FLASK_BASE_URL}app/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(function (res) {
    return res.json();
  });
}

// We only calculate whether the app is running locally once upon load, and store it here:
let _APP_IS_RUNNING_LOCALLY: boolean | undefined;

/**
 * Tries to determine if the ChainForge front-end is running on user's local machine (and hence has access to Flask backend).
 * @returns `true` if we think the app is running locally (on localhost or equivalent); `false` if not.
 */
export function APP_IS_RUNNING_LOCALLY(): boolean {
  if (_APP_IS_RUNNING_LOCALLY === undefined) {
    // Calculate whether we're running the app locally or not, and save the result
    try {
      const location = window.location;

      _APP_IS_RUNNING_LOCALLY =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1" ||
        location.hostname === "0.0.0.0" ||
        location.hostname === "" || // @ts-expect-error undefined
        window.__CF_HOSTNAME !== undefined;
    } catch (e) {
      // ReferenceError --window or location does not exist.
      // We must not be running client-side in a browser, in this case (e.g., we are running a Node.js server)
      _APP_IS_RUNNING_LOCALLY = false;
    }
  }
  return _APP_IS_RUNNING_LOCALLY;
}

// We cache the RAG availability check to avoid repeated backend calls
export let RAG_AVAILABLE: boolean | undefined;
let _RAG_CHECK_PROMISE: Promise<boolean> | undefined;

async function checkRagAvailabilityFromBackend(): Promise<boolean> {
  // Hosted in a browser there is no Flask server to ask: FLASK_BASE_URL still
  // points at http://localhost:8000, i.e. the visitor's own machine, so the
  // request just fails (slowly) and warns. Server-side RAG is unavailable
  // there by definition, which is the same answer the failed call produced.
  if (!APP_IS_RUNNING_LOCALLY()) return false;
  try {
    const response = await call_flask_backend("checkRagAvailable", {});
    return response.rag_available === true;
  } catch (error) {
    console.warn("Failed to check RAG availability from backend:", error);
    return false;
  }
}

export async function isRagAvailable(): Promise<boolean> {
  // First check if the window flag is set
  // @ts-expect-error undefined
  if (window.__RAG_AVAILABLE !== undefined) {
    RAG_AVAILABLE = (window as any).__RAG_AVAILABLE as boolean;
  } else if (window?.location.port === "3000") {
    // Dev mode -- assume RAG is available for easier testing
    RAG_AVAILABLE = true;
  }
  // If not cached, check with the backend
  else if (RAG_AVAILABLE === undefined) {
    // Avoid multiple concurrent requests
    if (!_RAG_CHECK_PROMISE) {
      _RAG_CHECK_PROMISE = checkRagAvailabilityFromBackend();
    }
    RAG_AVAILABLE = await _RAG_CHECK_PROMISE;
    _RAG_CHECK_PROMISE = undefined;
  }

  return RAG_AVAILABLE;
}

// Check RAG availability immediately upon load
// :: Start the async check but don't block
isRagAvailable().catch((err) =>
  console.warn("Background RAG availability check failed:", err),
);

/**
 * Equivalent to a 'fetch' call, but routes it to the backend Flask server in
 * case we are running a local server and prefer to not deal with CORS issues making API calls client-side.
 */
async function route_fetch(
  url: string,
  method: string,
  headers: Dict,
  body: Dict,
) {
  if (APP_IS_RUNNING_LOCALLY()) {
    return call_flask_backend("makeFetchCall", {
      url,
      method,
      headers,
      body,
    }).then((res) => {
      if (!res || res.error) throw new Error(res.error);
      return res.response;
    });
  } else {
    return fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
    }).then((res) => res.json());
  }
}

function appendEndSlashIfMissing(path: string) {
  return path + (path[path.length - 1] === "/" ? "" : "/");
}

function get_environ(key: string): string | undefined {
  return process.env[key];
}

let OPENAI_API_KEY = get_environ("OPENAI_API_KEY");
let OPENAI_BASE_URL = get_environ("OPENAI_BASE_URL");
let ANTHROPIC_API_KEY = get_environ("ANTHROPIC_API_KEY");
let GOOGLE_PALM_API_KEY = get_environ("PALM_API_KEY");
let AZURE_OPENAI_KEY = get_environ("AZURE_OPENAI_KEY");
let AZURE_OPENAI_ENDPOINT = get_environ("AZURE_OPENAI_ENDPOINT");
let HUGGINGFACE_API_KEY = get_environ("HUGGINGFACE_API_KEY");
let AWS_ACCESS_KEY_ID = get_environ("AWS_ACCESS_KEY_ID");
let AWS_SECRET_ACCESS_KEY = get_environ("AWS_SECRET_ACCESS_KEY");
let AWS_SESSION_TOKEN = get_environ("AWS_SESSION_TOKEN");
let AWS_REGION = get_environ("AWS_REGION");
let TOGETHER_API_KEY = get_environ("TOGETHER_API_KEY");
let DEEPSEEK_API_KEY = get_environ("DEEPSEEK_API_KEY");
let MINIMAX_API_KEY = get_environ("MINIMAX_API_KEY");
let OPENROUTER_API_KEY = get_environ("OPENROUTER_API_KEY");

/**
 * The AWS SDK is a heavy dependency that reaches for web-stream globals as soon
 * as it loads, so it is imported only when a Bedrock model is first queried --
 * keeping it out of the main bundle, and out of everyone else's way.
 */
let _BEDROCK_MODULE_PROMISE: Promise<any> | undefined;

async function get_bedrock_module(): Promise<any> {
  if (!_BEDROCK_MODULE_PROMISE)
    _BEDROCK_MODULE_PROMISE = import("@aws-sdk/client-bedrock-runtime");
  return _BEDROCK_MODULE_PROMISE;
}

let _WEBLLM_MODULE_PROMISE: Promise<any> | undefined;
let _WEBLLM_ENGINE: any;
let _WEBLLM_MODEL: string | undefined;
let _WEBLLM_LOAD_PROMISE: Promise<any> | undefined;

async function get_webllm_module(): Promise<any> {
  if (!_WEBLLM_MODULE_PROMISE) {
    _WEBLLM_MODULE_PROMISE = import("@mlc-ai/web-llm");
  }
  return _WEBLLM_MODULE_PROMISE;
}

/**
 * Per-model options for WebLLM, where a model's published config won't load
 * as is. Gemma 3's sets both a context window and a sliding window, which
 * WebLLM refuses ("Only one of context_window_size and sliding_window_size can
 * be positive"); full attention over the context window is used instead.
 */
const WEBLLM_CHAT_OPTIONS: Dict<Dict> = {
  "gemma3-1b-it-q4f16_1-MLC": { sliding_window_size: -1 },
};

async function get_webllm_engine(model: string): Promise<any> {
  const chat_opts = WEBLLM_CHAT_OPTIONS[model];
  if (_WEBLLM_LOAD_PROMISE) await _WEBLLM_LOAD_PROMISE;

  if (_WEBLLM_ENGINE && _WEBLLM_MODEL === model) return _WEBLLM_ENGINE;

  if (_WEBLLM_ENGINE && typeof _WEBLLM_ENGINE.reload === "function") {
    _WEBLLM_LOAD_PROMISE = _WEBLLM_ENGINE.reload(model, chat_opts);
    try {
      await _WEBLLM_LOAD_PROMISE;
      _WEBLLM_MODEL = model;
      return _WEBLLM_ENGINE;
    } finally {
      _WEBLLM_LOAD_PROMISE = undefined;
    }
  }

  const webllm = await get_webllm_module();
  _WEBLLM_LOAD_PROMISE = webllm.CreateMLCEngine(
    model,
    {
      initProgressCallback: (report: Dict) => {
        if (report?.text) console.log(`[WebLLM] ${report.text}`);
      },
    },
    chat_opts,
  );

  try {
    _WEBLLM_ENGINE = await _WEBLLM_LOAD_PROMISE;
    _WEBLLM_MODEL = model;
    return _WEBLLM_ENGINE;
  } catch (e) {
    _WEBLLM_ENGINE = undefined;
    _WEBLLM_MODEL = undefined;
    throw e;
  } finally {
    _WEBLLM_LOAD_PROMISE = undefined;
  }
}

/**
 * Resets the API keys to those from the environment, e.g. once the user asks
 * for the keys they entered in Settings to be forgotten.
 */
export function clear_api_keys(): void {
  OPENAI_API_KEY = get_environ("OPENAI_API_KEY");
  OPENAI_BASE_URL = get_environ("OPENAI_BASE_URL");
  ANTHROPIC_API_KEY = get_environ("ANTHROPIC_API_KEY");
  GOOGLE_PALM_API_KEY = get_environ("PALM_API_KEY");
  AZURE_OPENAI_KEY = get_environ("AZURE_OPENAI_KEY");
  AZURE_OPENAI_ENDPOINT = get_environ("AZURE_OPENAI_ENDPOINT");
  HUGGINGFACE_API_KEY = get_environ("HUGGINGFACE_API_KEY");
  AWS_ACCESS_KEY_ID = get_environ("AWS_ACCESS_KEY_ID");
  AWS_SECRET_ACCESS_KEY = get_environ("AWS_SECRET_ACCESS_KEY");
  AWS_SESSION_TOKEN = get_environ("AWS_SESSION_TOKEN");
  AWS_REGION = get_environ("AWS_REGION");
  TOGETHER_API_KEY = get_environ("TOGETHER_API_KEY");
  DEEPSEEK_API_KEY = get_environ("DEEPSEEK_API_KEY");
  MINIMAX_API_KEY = get_environ("MINIMAX_API_KEY");
  OPENROUTER_API_KEY = get_environ("OPENROUTER_API_KEY");
}

/**
 * Sets the local API keys for the revelant LLM API(s).
 */
export function set_api_keys(given_keys: Dict<string>): void {
  // A pasted key often brings a space or line break along. Sent as is, the
  // provider rejects it as malformed, which looks like a wrong key.
  const api_keys: Dict<string> = Object.fromEntries(
    Object.entries(given_keys).map(([name, value]) => [
      name,
      typeof value === "string" ? value.trim() : value,
    ]),
  );
  function key_is_present(name: string): boolean {
    return (
      (name in api_keys &&
        api_keys[name] &&
        api_keys[name].trim().length > 0) ||
      name === "OpenAI_BaseURL"
    );
  }
  if (key_is_present("OpenAI")) OPENAI_API_KEY = api_keys.OpenAI;
  if (key_is_present("OpenAI_BaseURL"))
    OPENAI_BASE_URL = api_keys.OpenAI_BaseURL;
  if (key_is_present("HuggingFace")) HUGGINGFACE_API_KEY = api_keys.HuggingFace;
  if (key_is_present("Anthropic")) ANTHROPIC_API_KEY = api_keys.Anthropic;
  if (key_is_present("Google")) GOOGLE_PALM_API_KEY = api_keys.Google;
  if (key_is_present("Azure_OpenAI")) AZURE_OPENAI_KEY = api_keys.Azure_OpenAI;
  if (key_is_present("Azure_OpenAI_Endpoint"))
    AZURE_OPENAI_ENDPOINT = api_keys.Azure_OpenAI_Endpoint;
  // Soft fail for non-present keys
  if (key_is_present("AWS_Access_Key_ID"))
    AWS_ACCESS_KEY_ID = api_keys.AWS_Access_Key_ID;
  if (key_is_present("AWS_Secret_Access_Key"))
    AWS_SECRET_ACCESS_KEY = api_keys.AWS_Secret_Access_Key;
  if (key_is_present("AWS_Session_Token"))
    AWS_SESSION_TOKEN = api_keys.AWS_Session_Token;
  if (key_is_present("AWS_Region")) AWS_REGION = api_keys.AWS_Region;
  if (key_is_present("Together")) TOGETHER_API_KEY = api_keys.Together;
  if (key_is_present("DeepSeek")) DEEPSEEK_API_KEY = api_keys.DeepSeek;
  if (key_is_present("MiniMax")) MINIMAX_API_KEY = api_keys.MiniMax;
  if (key_is_present("OpenRouter")) OPENROUTER_API_KEY = api_keys.OpenRouter;
}

export function get_azure_openai_api_keys(): [
  string | undefined,
  string | undefined,
] {
  return [AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT];
}

function construct_text_payload(
  text: string,
  variant: "openai" | "gemini" | "anthropic",
): Dict {
  switch (variant) {
    case "openai":
      return { type: "text", text };
    case "gemini":
      return { text };
    case "anthropic":
      return { type: "text", text };
    default:
      throw new Error(`Unknown variant: ${variant}`);
  }
}

function construct_image_payload(
  base64image: string,
  variant: "openai" | "gemini" | "anthropic",
):
  | MultiModalContentAnthropic
  | MultiModalContentOpenAI
  | MultiModalContentGemini {
  switch (variant) {
    case "openai":
      return {
        type: "image_url",
        image_url: {
          url: base64image,
          detail: "auto",
        },
      };
    case "gemini": {
      return {
        inlineData: {
          data: getBase64DataFromDataURL(base64image) ?? "",
          mimeType: getMimeTypeFromDataURL(base64image) ?? "image/png",
        },
      };
    }
    case "anthropic":
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: getMimeTypeFromDataURL(base64image) ?? "image/png",
          data: getBase64DataFromDataURL(base64image) ?? "",
        },
      };
    default:
      throw new Error(`Unknown variant: ${variant}`);
  }
}

async function imagesToBase64(images: string[]) {
  if (images && images.length > 0) {
    const base64_images: Array<string> = [];
    for (const image of images) {
      const imageBlob = await MediaLookup.get(image);
      if (!imageBlob) {
        // This should never happen, but just in case:
        console.error(`Image not found in MediaLookup: ${image}`);
        continue;
      }
      const base64_image = await blobOrFileToDataURL(imageBlob);
      if (base64_image) base64_images.push(base64_image);
    }
    return base64_images;
  }
  return [];
}

/** Removes empty settings from OpenAI-style chat params, in place, so they aren't sent to the API. */
function strip_empty_chat_params(params?: Dict): void {
  if (
    params?.stop !== undefined &&
    (!Array.isArray(params.stop) || params.stop.length === 0)
  )
    delete params.stop;
  if (params?.seed && params.seed.toString().length === 0) delete params?.seed;
  if (
    params?.functions !== undefined &&
    (!Array.isArray(params.functions) || params.functions.length === 0)
  )
    delete params?.functions;
  if (
    params?.function_call !== undefined &&
    (!(typeof params.function_call === "string") ||
      params.function_call.trim().length === 0)
  )
    delete params.function_call;
  if (
    params?.tools !== undefined &&
    (!Array.isArray(params.tools) || params.tools.length === 0)
  )
    delete params?.tools;
  if (
    params?.tool_choice !== undefined &&
    (!(typeof params.tool_choice === "string") ||
      params.tool_choice.trim().length === 0)
  )
    delete params.tool_choice;
  if (params?.tools === undefined && params?.parallel_tool_calls !== undefined)
    delete params?.parallel_tool_calls;
}

async function resolve_images_in_user_messages(
  messages: ChatHistory,
  variant: "openai" | "gemini" | "anthropic" | "ollama",
): Promise<Array<any>> {
  const res = [];
  for (const message of messages) {
    if (message.role !== "user") {
      res.push(message);
      continue;
    }

    const prompt = message.content;
    const images = message.images;

    // Cast any images to base64 data URLs
    const image_data_urls = await imagesToBase64(images ?? []);

    if (variant === "ollama") {
      // Resolving Image in user messages
      if (images && images.length > 0) {
        // These images should already be base64 encoded
        const texts_in_prompt: Array<string> = [];

        // Add the prompt text
        texts_in_prompt.push(prompt);

        res.push({
          content: texts_in_prompt.join("\n"),
          images: image_data_urls.map(getBase64DataFromDataURL), // base64 encoded images
        });
      } else {
        res.push(message);
      }
    } else {
      if (image_data_urls && image_data_urls.length > 0) {
        const new_content = [];

        for (const image of image_data_urls)
          new_content.push(construct_image_payload(image, variant));

        // Add the prompt text
        new_content.push(construct_text_payload(prompt, variant));

        res.push({ role: "user", content: new_content });
      } else {
        res.push(message);
      }
    }
  }
  return res;
}

/**
 * Construct an OpenAI format chat history for sending off to an OpenAI API call.
 * @param prompt The next prompt (user message) to append.
 * @param chat_history The prior turns of the chat, ending with the AI assistants' turn.
 * @param system_msg Optional; the system message to use if none is present in chat_history. (Ignored if chat_history already has a sys message.)
 */
function construct_chat_history(
  prompt: string,
  images: string[] | undefined,
  chat_history?: ChatHistory,
  system_msg?: string,
  system_role_name?: string,
): ChatHistory {
  const sys_role_name = system_role_name ?? "system";
  const prompt_msg: ChatMessage = { role: "user", content: prompt };
  if (images && images.length > 0) {
    prompt_msg.images = images;
  }
  const sys_msg: ChatMessage[] =
    system_msg !== undefined
      ? [{ role: sys_role_name, content: system_msg }]
      : [];
  if (chat_history !== undefined && chat_history.length > 0) {
    if (chat_history[0].role === sys_role_name) {
      // In this case, the system_msg is ignored because the prior history already contains one.
      return chat_history.concat([prompt_msg]);
    } else {
      // In this case, there's no system message that starts the prior history, so inject one:
      // NOTE: We might reach this scenario if we chain output of a non-OpenAI chat model into an OpenAI model.
      return sys_msg.concat(chat_history).concat([prompt_msg]);
    }
  } else return sys_msg.concat([prompt_msg]);
}

/**
 * Calls OpenAI text + chat models via OpenAI's API.
   @returns raw query and response JSON dicts.
 */
export async function call_chatgpt(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
  BASE_URL?: string,
  API_KEY?: string,
): Promise<[Dict, Dict]> {
  const effectiveKey = API_KEY ?? OPENAI_API_KEY;
  if (!effectiveKey)
    throw new Error(
      "Could not find an OpenAI API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  const openai = new OpenAI({
    apiKey: effectiveKey,
    baseURL: BASE_URL ?? OPENAI_BASE_URL ?? undefined,
    ...OPENAI_BROWSER_OPTS,
  });

  const modelname: string = model.toString();

  strip_empty_chat_params(params);

  // Reasoning summaries only come from the Responses API, so OpenAI's reasoning
  // models go through it when a summary is asked for.
  const reasoning_summary = params?.reasoning_summary;
  delete params?.reasoning_summary;
  if (
    BASE_URL === undefined &&
    typeof reasoning_summary === "string" &&
    reasoning_summary !== "off" &&
    is_openai_reasoning_model(modelname)
  )
    return call_openai_responses(
      prompt,
      modelname,
      n,
      reasoning_summary,
      params,
      should_cancel,
      images,
    );

  // Chat Completions can't take reasoning state back
  if (params?.chat_history)
    params.chat_history = strip_reasoning_state(params.chat_history);

  // Pass in reasoning-model-only parameters, removing them if the
  // model name does not correspond to those models:
  // NOTE: Chat Completions passes reasoning_effort instead of a dictionary for 'reasoning'.
  if (params?.reasoning_effort !== undefined) {
    if (!is_openai_reasoning_model(modelname)) delete params?.reasoning_effort;
  }
  if (params?.verbosity !== undefined) {
    if (!is_openai_reasoning_model(modelname)) delete params?.verbosity;
  }

  if (!BASE_URL)
    console.log(`Querying OpenAI model '${model}' with prompt '${prompt}'...`);

  // Determine the system message and whether there's chat history to continue:
  const chat_history: ChatHistory | undefined = params?.chat_history;
  const system_msg: string | undefined =
    params?.system_msg !== undefined ? params.system_msg : undefined;
  delete params?.system_msg;
  delete params?.chat_history;

  // The o1 and later OpenAI models, for whatever reason, block the system message from being sent in the chat history.
  // The official API states that "developer" works, but it doesn't for some models, so until OpenAI fixes this
  // and fully supports system messages, we have to block them from being sent in the chat history.
  // if (model.startsWith("o")) system_msg = undefined;

  const query: Dict = {
    model: modelname,
    n,
    temperature,
    ...params, // 'the rest' of the settings, passed from the front-end settings
  };

  // Get the correct function to call
  let openai_call: any;
  if (modelname.includes("davinci") || modelname.includes("instruct")) {
    if ("response_format" in query) delete query.response_format;
    // Create call to text completions model
    openai_call = openai.completions.create.bind(openai.completions);
    query.prompt = prompt;
  } else {
    // Create call to chat model
    openai_call = openai.chat.completions.create.bind(openai.chat.completions);

    // Carry over chat history, if present:
    query.messages = construct_chat_history(
      prompt,
      images,
      chat_history,
      system_msg,
    );
  }

  query.messages = await resolve_images_in_user_messages(
    query.messages,
    "openai",
  );

  // Try to call OpenAI
  let response: Dict = {};
  try {
    response = (await openai_call(query)) as Dict;
  } catch (error: any) {
    throw new Error(openai_error_message(error));
  }

  return [query, response];
}

/**
 * Calls DeepSeek models via DeepSeek's API.
 */
export async function call_deepseek(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!DEEPSEEK_API_KEY)
    throw new Error(
      "Could not find a DeepSeek API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  console.log(`Querying DeepSeek model '${model}' with prompt '${prompt}'...`);

  if (params?.chat_history)
    params.chat_history = chat_history_with_reasoning(
      params.chat_history,
      LLMProvider.DeepSeek,
    );

  return await call_chatgpt(
    prompt,
    model,
    n,
    temperature,
    params,
    should_cancel,
    images,
    "https://api.deepseek.com",
    DEEPSEEK_API_KEY,
  );
}

/**
 * Calls MiniMax models via MiniMax's OpenAI-compatible API.
 */
export async function call_minimax(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!MINIMAX_API_KEY)
    throw new Error(
      "Could not find a MiniMax API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  console.log(`Querying MiniMax model '${model}' with prompt '${prompt}'...`);

  // MiniMax requires temperature to be strictly greater than 0
  const clampedTemp = Math.max(temperature, 0.01);

  return await call_chatgpt(
    prompt,
    model,
    n,
    clampedTemp,
    params,
    should_cancel,
    images,
    "https://api.minimax.io/v1",
    MINIMAX_API_KEY,
  );
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** POSTs to an OpenRouter endpoint, turning API errors into readable Errors. */
async function openrouter_request(path: string, body: Dict): Promise<Dict> {
  const res = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // Optional attribution, so requests are credited to ChainForge on openrouter.ai.
      "HTTP-Referer": "https://chainforge.ai",
      "X-OpenRouter-Title": "ChainForge",
    },
    body: JSON.stringify(body),
  });

  let payload: Dict | undefined;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }
  // OpenRouter answers a key that isn't shaped like one of its keys with
  // "Missing Authentication header", which reads as though no key was sent.
  if (res.status === 401 && !OPENROUTER_API_KEY?.startsWith("sk-or-"))
    throw new Error(
      'OpenRouter did not recognize the API key. OpenRouter keys start with "sk-or-"; check the key in Settings.',
    );
  // Errors can also arrive with a 200 status, e.g. when the upstream provider fails.
  if (!res.ok || payload?.error)
    throw new Error(
      payload?.error?.message ??
        `OpenRouter request failed (HTTP ${res.status}).`,
    );
  return payload ?? {};
}

/** Whether a setting was left blank, e.g. an empty number field. */
function is_blank_setting(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "number" && isNaN(value))
  );
}

/**
 * Calls a model through OpenRouter's OpenAI-compatible chat completions API.
 * OpenRouter doesn't support `n`, so each response is its own request.
 */
export async function call_openrouter(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!OPENROUTER_API_KEY)
    throw new Error(
      "Could not find an OpenRouter API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  const modelname = stripOpenRouterPrefix(model);
  const settings: Dict = { ...params };
  strip_empty_chat_params(settings);

  // Reasoning takes either a token budget or an effort level, not both. Models
  // that don't reason ignore it. See https://openrouter.ai/docs/use-cases/reasoning-tokens
  const reasoning: Dict = {};
  // Some models have reasoning off by default (e.g. GPT-5.4 Nano and DeepSeek
  // V4 Pro), so it's on unless turned off. ("default" is an older name for "on".)
  const effort = settings.reasoning_effort;
  if (!is_blank_setting(settings.reasoning_max_tokens))
    reasoning.max_tokens = settings.reasoning_max_tokens;
  else if (is_blank_setting(effort) || effort === "on" || effort === "default")
    reasoning.enabled = true;
  else if (effort === "off") reasoning.enabled = false;
  else reasoning.effort = effort;
  delete settings.reasoning_max_tokens;
  delete settings.reasoning_effort;

  const chat_history: ChatHistory | undefined = settings.chat_history
    ? chat_history_with_reasoning(settings.chat_history, LLMProvider.OpenRouter)
    : undefined;
  const system_msg: string | undefined = settings.system_msg;
  delete settings.chat_history;
  delete settings.system_msg;

  for (const [key, value] of Object.entries(settings))
    if (is_blank_setting(value)) delete settings[key];

  const query: Dict = { model: modelname, temperature, ...settings };
  if (Object.keys(reasoning).length > 0) query.reasoning = reasoning;
  query.messages = await resolve_images_in_user_messages(
    construct_chat_history(prompt, images, chat_history, system_msg),
    "openai",
  );

  console.log(`Querying OpenRouter model '${modelname}' (n=${n})...`);

  const responses: Dict[] = [];
  while (responses.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const payload = await openrouter_request("/chat/completions", query);
    const choice = payload.choices?.[0];
    if (!choice) throw new Error("OpenRouter returned no response.");
    if (choice.error)
      throw new Error(choice.error.message ?? "The model returned an error.");

    // A reasoning model can spend its whole token budget thinking, leaving no
    // answer. Say so, rather than recording a blank response.
    const message = choice.message ?? {};
    const answered = message.content || message.tool_calls?.length > 0;
    if (!answered && choice.finish_reason === "length")
      throw new Error(
        message.reasoning
          ? `${modelname} ran out of tokens while reasoning, before it answered. Raise max_tokens, or lower the reasoning effort.`
          : `${modelname} ran out of tokens before it answered. Raise max_tokens.`,
      );

    responses.push(payload);
  }

  return [query, responses];
}

/** Settings sent to OpenRouter's Image API when set. "auto" leaves them to the model. */
const OPENROUTER_IMAGE_SETTINGS = [
  "resolution",
  "aspect_ratio",
  "quality",
  "background",
  "output_format",
  "seed",
];

/**
 * Generates images through OpenRouter's Image API. Input images (e.g. from a
 * Media Node) are sent as references, for editing. Image models differ in how
 * many images they can return per request, so this requests until it has `n`.
 */
export async function call_openrouter_image_gen(
  prompt: string,
  model: LLM,
  n = 1,
  temperature?: number,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!OPENROUTER_API_KEY)
    throw new Error(
      "Could not find an OpenRouter API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  const modelname = stripOpenRouterPrefix(model);
  const query: Dict = { model: modelname, prompt };
  for (const key of OPENROUTER_IMAGE_SETTINGS) {
    const value = params?.[key];
    if (!is_blank_setting(value) && value !== "auto") query[key] = value;
  }

  const references = await imagesToBase64(images ?? []);
  const body: Dict =
    references.length > 0
      ? {
          ...query,
          input_references: references.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        }
      : query;

  console.log(
    `Querying OpenRouter image model '${modelname}' (n=${n}, input images=${references.length})...`,
  );

  const results: Dict[] = [];
  while (results.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const payload = await openrouter_request("/images", body);
    const data: Dict[] = (
      Array.isArray(payload.data) ? payload.data : []
    ).filter((d: Dict) => typeof d?.b64_json === "string");
    if (data.length === 0)
      throw new Error("OpenRouter returned no images for this request.");
    results.push(...data);
  }

  // Kept with cached responses: record the input image count, not the bytes.
  return [
    references.length > 0
      ? { ...query, input_images: references.length }
      : query,
    results.slice(0, n),
  ];
}

/** Whether an OpenAI model reasons: the o-series, and GPT-5 and later (but not their chat models). */
function is_openai_reasoning_model(model: string): boolean {
  return /^(o\d|gpt-[5-9])/.test(model) && !/-chat/.test(model);
}

/**
 * Calls an OpenAI reasoning model through the Responses API, which, unlike
 * Chat Completions, can return summaries of the model's reasoning. Settings the
 * Responses API doesn't take (stop, seed, penalties, logit_bias) are left out,
 * as are temperature and top_p, which reasoning models don't accept.
 * See https://developers.openai.com/api/docs/guides/reasoning
 */
async function call_openai_responses(
  prompt: string,
  model: string,
  n: number,
  summary: string,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  const settings: Dict = { ...params };
  const messages = await resolve_images_in_user_messages(
    construct_chat_history(
      prompt,
      images,
      settings.chat_history,
      settings.system_msg,
    ),
    "openai",
  );

  // System messages become instructions, and content parts take the Responses API's types.
  const isSystem = (m: Dict) => m.role === "system" || m.role === "developer";
  const instructions = messages
    .filter(isSystem)
    .map((m) => m.content)
    .join("\n\n");
  const input = messages
    .filter((m) => !isSystem(m))
    .flatMap((m) => [
      // A past turn's own reasoning items go back just before its message
      ...(own_reasoning_state(m, LLMProvider.OpenAI)?.items ?? []),
      {
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : m.content.map((part: Dict) =>
                part.type === "image_url"
                  ? {
                      type: "input_image",
                      image_url: part.image_url?.url ?? part.image_url,
                    }
                  : part.type === "text"
                    ? {
                        type:
                          m.role === "assistant" ? "output_text" : "input_text",
                        text: part.text,
                      }
                    : part,
              ),
      },
    ]);

  const query: Dict = {
    model,
    input,
    reasoning: { summary },
    store: false,
    // So a later Chat Turn can send the reasoning back
    include: ["reasoning.encrypted_content"],
  };
  if (instructions) query.instructions = instructions;
  if (settings.reasoning_effort)
    query.reasoning.effort = settings.reasoning_effort;
  if (settings.verbosity) query.text = { verbosity: settings.verbosity };
  const format = settings.response_format;
  if (format && format.type !== "text")
    query.text = {
      ...query.text,
      format:
        format.type === "json_schema"
          ? { type: "json_schema", ...format.json_schema }
          : format,
    };
  const max_tokens = settings.max_completion_tokens ?? settings.max_tokens;
  if (!is_blank_setting(max_tokens)) query.max_output_tokens = max_tokens;
  if (Array.isArray(settings.tools) && settings.tools.length > 0) {
    // Function tools are flat: {type: "function", name, parameters}
    query.tools = settings.tools.map((t: Dict) =>
      t.function
        ? { type: "function", ...t.function }
        : t.type
          ? t
          : { type: "function", ...t },
    );
    const choice = settings.tool_choice;
    if (choice)
      query.tool_choice = choice.function
        ? { type: "function", name: choice.function.name }
        : choice;
    if (settings.parallel_tool_calls !== undefined)
      query.parallel_tool_calls = settings.parallel_tool_calls;
  }

  console.log(
    `Querying OpenAI model '${model}' through the Responses API (n=${n})...`,
  );

  const base = (OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const responses: Dict[] = [];
  while (responses.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const res = await fetch(`${base}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });
    let payload: Dict | undefined;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }
    if (!res.ok || payload?.error)
      throw new Error(
        payload?.error?.message ??
          `OpenAI request failed (HTTP ${res.status}).`,
      );
    // A reasoning model can spend its whole token budget thinking, leaving no answer.
    if (
      payload?.status === "incomplete" &&
      !_extract_openai_responses_api_text(payload)
    )
      throw new Error(
        `${model} stopped before it answered (${payload.incomplete_details?.reason ?? "incomplete"}). Raise max_completion_tokens, or lower the reasoning effort.`,
      );
    responses.push(payload as Dict);
  }

  return [query, responses];
}

/** The answer in a Responses API result: its output text, or its tool calls. */
function _extract_openai_responses_api_text(response: Dict): string {
  const output: Dict[] = Array.isArray(response?.output) ? response.output : [];
  const calls = output.filter((o) => o?.type === "function_call");
  if (calls.length > 0)
    return (
      "[[TOOLS]] " + calls.map((c) => c.name + " " + c.arguments).join("\n\n")
    );
  return output
    .filter((o) => o?.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c: Dict) => c?.type === "output_text")
    .map((c: Dict) => c.text)
    .join("");
}

/** The most images OpenAI's Images API returns for one request. */
const OPENAI_MAX_IMAGES_PER_REQUEST = 10;

/** POSTs to an OpenAI Images API endpoint, turning API errors into readable Errors. */
async function openai_images_request(
  endpoint: "generations" | "edits",
  body: FormData | Dict,
): Promise<Dict> {
  const base = (OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const isForm = body instanceof FormData;
  const res = await fetch(`${base}/images/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      // A multipart body sets its own Content-Type, with the boundary.
      ...(isForm ? {} : { "Content-Type": "application/json" }),
    },
    body: isForm ? body : JSON.stringify(body),
  });

  let payload: Dict | undefined;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }

  if (!res.ok) {
    const error = payload?.error;
    const categories = error?.moderation_details?.categories;
    const moderation =
      error?.code === "moderation_blocked" && categories
        ? ` (blocked by moderation: ${[categories].flat().join(", ")})`
        : "";
    throw new Error(
      (error?.message ?? `OpenAI image request failed (HTTP ${res.status}).`) +
        moderation,
    );
  }
  return payload ?? {};
}

/**
 * Calls OpenAI image models (GPT Image) through the Images API. Uses the
 * generations endpoint, or the edits endpoint when input images are given
 * (e.g. from a Media Node), passing them as reference images.
 *
 * Calls fetch directly: the installed openai SDK (v3) predates GPT Image and
 * can't send several input images to the edits endpoint.
 *
 * @returns raw query and a list of image objects ({ b64_json, ... }).
 */
export async function call_openai_image_gen(
  prompt: string,
  model: LLM,
  n = 1,
  temperature: number,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!OPENAI_API_KEY)
    throw new Error(
      "Could not find an OpenAI API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  const modelname = model.toString();
  if (modelname.startsWith("dall-e"))
    throw new Error(
      `OpenAI shut down ${modelname} on May 12, 2026. Switch to a GPT Image model, such as gpt-image-2.5-flare.`,
    );

  // Settings, minus empty values. "auto" is a valid value for most of them.
  const settings: Dict = {};
  for (const [key, value] of Object.entries(params ?? {}))
    if (value !== undefined && value !== null && value !== "")
      settings[key] = value;

  // Only meaningful for lossy formats.
  if (!["jpeg", "webp"].includes(settings.output_format))
    delete settings.output_compression;

  const editing = images !== undefined && images.length > 0;
  // input_fidelity only applies to edits; "auto" means leave it to the model,
  // and gpt-image-2 always uses high fidelity and doesn't take the parameter.
  if (
    !editing ||
    settings.input_fidelity === "auto" ||
    /^gpt-image-2(-\d{4}-\d{2}-\d{2})?$/.test(modelname)
  )
    delete settings.input_fidelity;

  const query: Dict = { model: modelname, prompt, ...settings };

  // Load input images once, for every batch.
  const inputBlobs: Blob[] = [];
  if (editing) {
    for (const uid of images) {
      const blob = await MediaLookup.get(uid);
      if (!blob) throw new Error(`Input image ${uid} is not available.`);
      inputBlobs.push(blob);
    }
  }

  console.log(
    `Querying OpenAI image model '${modelname}' (${editing ? `editing ${inputBlobs.length} image(s)` : "generating"}, n=${n})...`,
  );

  const results: Dict[] = [];
  while (results.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();
    const batch = Math.min(OPENAI_MAX_IMAGES_PER_REQUEST, n - results.length);

    let payload: Dict;
    if (editing) {
      const form = new FormData();
      Object.entries({ ...query, n: batch }).forEach(([key, value]) =>
        form.append(key, String(value)),
      );
      inputBlobs.forEach((blob, i) =>
        form.append(
          "image[]",
          blob,
          `image_${i}.${(blob.type.split("/")[1] || "png").replace("jpeg", "jpg")}`,
        ),
      );
      payload = await openai_images_request("edits", form);
    } else {
      payload = await openai_images_request("generations", {
        ...query,
        n: batch,
      });
    }

    const data: Dict[] = Array.isArray(payload?.data) ? payload.data : [];
    if (data.length === 0)
      throw new Error("OpenAI returned no images for this request.");
    results.push(...data);
  }

  // The returned query is kept with cached responses, so it records how many
  // input images there were rather than their bytes.
  return [
    editing ? { ...query, input_images: inputBlobs.length } : query,
    results.slice(0, n),
  ];
}

/**
 * Calls OpenAI models hosted on Microsoft Azure services.
 *  Returns raw query and response JSON dicts.
 *
 *  NOTE: It is recommended to set an environment variables AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT
 */
export async function call_azure_openai(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!AZURE_OPENAI_KEY)
    throw new Error(
      "Could not find an Azure OpenAPI Key to use. Double-check that your key is set in Settings or in your local environment.",
    );
  if (!AZURE_OPENAI_ENDPOINT)
    throw new Error(
      "Could not find an Azure OpenAI Endpoint to use. Double-check that your endpoint is set in Settings or in your local environment.",
    );

  const deployment_name: string = params?.deployment_name;
  const model_type: string = params?.model_type;
  if (!deployment_name)
    throw new Error(
      "Could not find an Azure OpenAPI deployment name. Double-check that your deployment name is set in Settings or in your local environment.",
    );
  if (!model_type)
    throw new Error(
      "Could not find a model type specified for an Azure OpenAI model. Double-check that your deployment name is set in Settings or in your local environment.",
    );

  // Azure's v1 API is OpenAI-shaped and needs no api-version, so the same
  // client that serves OpenAI serves Azure: the deployment name stands in for
  // the model, and the endpoint gains Azure's /openai/v1 path.
  // See https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle
  const client = new OpenAI({
    apiKey: AZURE_OPENAI_KEY,
    baseURL: `${AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "")}/openai/v1/`,
    ...OPENAI_BROWSER_OPTS,
  });

  if (
    params?.stop !== undefined &&
    (!Array.isArray(params.stop) || params.stop.length === 0)
  )
    delete params.stop;
  if (
    params?.functions !== undefined &&
    (!Array.isArray(params.functions) || params.functions.length === 0)
  )
    delete params?.functions;
  if (
    params?.function_call !== undefined &&
    (!(typeof params.function_call === "string") ||
      params.function_call.trim().length === 0)
  )
    delete params.function_call;

  console.log(
    `Querying Azure OpenAI deployed model '${deployment_name}' at endpoint '${AZURE_OPENAI_ENDPOINT}' with prompt '${prompt}'...`,
  );
  const chat_history: ChatHistory | undefined = params?.chat_history;
  const system_msg =
    params?.system_msg !== undefined
      ? params.system_msg
      : "You are a helpful assistant.";
  delete params?.chat_history;
  delete params?.system_msg;
  delete params?.model_type;
  delete params?.deployment_name;
  delete params?.api_version; // not a parameter of Azure's v1 API

  // Setup the args for the query
  const query: Dict = {
    n,
    temperature,
    ...params, // 'the rest' of the settings, passed from the front-end settings
  };
  // The deployment name is what Azure routes on, in the model field.
  query.model = deployment_name;
  let openai_call: any;
  if (model_type === "text-completion") {
    openai_call = client.completions.create.bind(client.completions);
    query.prompt = prompt;
  } else {
    openai_call = client.chat.completions.create.bind(client.chat.completions);
    query.messages = await resolve_images_in_user_messages(
      construct_chat_history(prompt, images, chat_history, system_msg),
      "openai",
    );
  }

  let response: Dict = {};
  try {
    response = (await openai_call(query)) as Dict;
  } catch (error: any) {
    throw new Error(openai_error_message(error));
  }

  return [query, response];
}

/**
 * Whether a Claude model uses the Messages API: all but the earliest models
 * (Claude 1, Claude Instant and Claude 2.0), which use text completions.
 */
function is_newer_anthropic_model(model: LLM) {
  return !/^claude-(v1|instant|2$|2\.0)/.test(model.toString());
}

/** Claude models that think by default, but leave out the thinking's text unless asked for it. */
const CLAUDE_THINKS_BY_DEFAULT = /^claude-(opus-5|sonnet-5|fable|mythos)/;

/** Claude models released after Opus 4.6, which reject temperature, top_p and top_k set to anything but their defaults. */
const CLAUDE_FIXED_SAMPLING =
  /^claude-(opus-4-[7-9]|sonnet-4-[7-9]|(opus|sonnet|haiku)-[5-9]|fable|mythos)/;

/**
 * Removes the sampling settings a Claude Messages API request can't have, in
 * place: ChainForge's -1 ("not set") for top_k and top_p; temperature, top_p and
 * top_k on models that don't take them; and, while thinking, a temperature
 * other than 1, top_k, and a top_p below 0.95.
 * See https://platform.claude.com/docs/en/build-with-claude/thinking
 */
export function anthropic_clean_sampling(query: Dict): Dict {
  for (const key of ["top_k", "top_p"])
    if (is_blank_setting(query[key]) || Number(query[key]) < 0)
      delete query[key];

  const model = String(query.model);
  const thinking =
    query.thinking?.type === "enabled" ||
    query.thinking?.type === "adaptive" ||
    (CLAUDE_THINKS_BY_DEFAULT.test(model) &&
      query.thinking?.type !== "disabled");
  if (CLAUDE_FIXED_SAMPLING.test(model)) {
    delete query.temperature;
    delete query.top_k;
    delete query.top_p;
  } else if (thinking) {
    if (query.temperature !== 1) delete query.temperature;
    delete query.top_k;
    if (query.top_p !== undefined && Number(query.top_p) < 0.95)
      delete query.top_p;
  }
  return query;
}

/**
 * The thinking request fields for a Claude model, from ChainForge's settings
 * (`thinking`, `thinking_budget_tokens` and `effort`). With `thinking` "auto"
 * (the default), only models that already think are asked for a summary of it,
 * so other models behave as before.
 * See https://platform.claude.com/docs/en/build-with-claude/thinking
 */
export function anthropic_thinking_config(model: string, params?: Dict): Dict {
  const mode = params?.thinking ?? "auto";
  const fields: Dict = {};
  if (mode === "enabled")
    fields.thinking = {
      type: "enabled",
      budget_tokens: is_blank_setting(params?.thinking_budget_tokens)
        ? 2048
        : params?.thinking_budget_tokens,
    };
  else if (
    mode === "adaptive" ||
    (mode === "auto" && CLAUDE_THINKS_BY_DEFAULT.test(model))
  )
    fields.thinking = { type: "adaptive", display: "summarized" };
  else if (mode === "disabled") fields.thinking = { type: "disabled" };

  const effort = params?.effort;
  if (typeof effort === "string" && effort && effort !== "default")
    fields.output_config = { effort };
  return fields;
}

/**
 * Calls Anthropic API with the given model, passing in params.
   Returns raw query and response JSON dicts.

   Unique parameters:
      - custom_prompt_wrapper: Anthropic models expect prompts in form "\n\nHuman: ${prompt}\n\nAssistant". If you wish to
                               explore custom prompt wrappers that deviate, write a python Template that maps from 'prompt' to custom wrapper.
                               If set to None, defaults to Anthropic's suggested prompt wrapper.
      - max_tokens_to_sample: A maximum number of tokens to generate before stopping.
      - stop_sequences: A list of strings upon which to stop generating. Defaults to ["\n\nHuman:"], the cue for the next turn in the dialog agent.

   NOTE: It is recommended to set an environment variable ANTHROPIC_API_KEY with your Anthropic API key
 */
export async function call_anthropic(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!ANTHROPIC_API_KEY)
    throw new Error(
      "Could not find an API key for Anthropic models. Double-check that your API key is set in Settings or in your local environment.",
    );

  // Wrap the prompt in the provided template, or use the default Anthropic one
  const custom_prompt_wrapper: string =
    params?.custom_prompt_wrapper ||
    ANTHROPIC_HUMAN_PROMPT + " {prompt}" + ANTHROPIC_AI_PROMPT;
  if (!custom_prompt_wrapper.includes("{prompt}"))
    throw new Error(
      "Custom prompt wrapper is missing required {prompt} template variable.",
    );
  const prompt_wrapper_template = new StringTemplate(custom_prompt_wrapper);
  let wrapped_prompt = prompt_wrapper_template.safe_substitute({
    prompt,
  });

  if (params?.custom_prompt_wrapper !== undefined)
    delete params.custom_prompt_wrapper;

  // Required non-standard params
  const max_tokens_to_sample = params?.max_tokens_to_sample ?? 1024;
  const stop_sequences = params?.stop_sequences ?? [ANTHROPIC_HUMAN_PROMPT];
  let system_msg = params?.system_msg;

  delete params?.custom_prompt_wrapper;
  delete params?.max_tokens_to_sample;
  delete params?.system_msg;

  // Thinking settings become request fields (see anthropic_thinking_config)
  const thinking_fields = anthropic_thinking_config(model.toString(), params);
  const thinking_budget: number = thinking_fields.thinking?.budget_tokens ?? 0;
  delete params?.thinking;
  delete params?.thinking_budget_tokens;
  delete params?.effort;

  // Tool usage -- remove tool params before passing, if they are empty
  if (
    params?.tools !== undefined &&
    (!Array.isArray(params.tools) || params.tools.length === 0)
  )
    delete params?.tools;
  if (
    params?.tool_choice !== undefined &&
    (!(typeof params.tool_choice === "string") ||
      params.tool_choice.trim().length === 0)
  )
    delete params.tool_choice;
  if (params?.tools === undefined) delete params?.parallel_tool_calls;
  else {
    // A fixed thinking budget only allows Claude to choose its tools itself.
    if (params?.tool_choice === undefined)
      params.tool_choice = {
        type: thinking_fields.thinking?.type === "enabled" ? "auto" : "any",
      };
    params.tool_choice.disable_parallel_tool_use = !params.parallel_tool_calls;
    delete params?.parallel_tool_calls;
  }

  // Detect whether to use old text completions or new messaging API
  const use_messages_api = is_newer_anthropic_model(model);

  // Carry chat history
  // :: See https://docs.anthropic.com/claude/docs/human-and-assistant-formatting#use-human-and-assistant-to-put-words-in-claudes-mouth
  let chat_history: ChatHistory | undefined = params?.chat_history
    ? use_messages_api
      ? anthropic_chat_history(params.chat_history)
      : strip_reasoning_state(params.chat_history)
    : undefined;
  if (chat_history !== undefined) {
    // FOR OLD TEXT COMPLETIONS API ONLY: Carry chat history by prepending it to the prompt
    if (!use_messages_api) {
      let anthr_chat_context = "";
      for (const chat_msg of chat_history) {
        if (chat_msg.role === "user")
          anthr_chat_context += ANTHROPIC_HUMAN_PROMPT;
        else if (chat_msg.role === "assistant")
          anthr_chat_context += ANTHROPIC_AI_PROMPT;
        else continue; // ignore system messages and other roles
        anthr_chat_context += " " + chat_msg.content;
      }
      wrapped_prompt = anthr_chat_context + wrapped_prompt; // prepend the chat context
    } else {
      // The new messages API doesn't allow a first "system" message inside chat history, like OpenAI does.
      // We need to detect a "system" message and eject it:
      if (chat_history.some((m) => m.role === "system")) {
        system_msg = chat_history.filter((m) => m.role === "system")[0].content;
        chat_history = chat_history.filter((m) => m.role !== "system");
      }
    }

    // For newer models Claude 2.1 and Claude 3, we carry chat history directly below; no need to do anything else.
    delete params?.chat_history;
  }

  // Format query
  const query: Dict = {
    model,
    stop_sequences,
    temperature,
    ...params,
  };

  if (use_messages_api) {
    // This goes by a different name than text completions. Thinking counts
    // toward it, so a thinking budget gets room of its own.
    query.max_tokens = max_tokens_to_sample + thinking_budget;
    Object.assign(query, thinking_fields);
    anthropic_clean_sampling(query);
    query.messages = construct_chat_history(
      prompt,
      images,
      chat_history,
      undefined,
    );

    // Pass the system message into the query. For Anthropic models this is passed outside of the chat history, unlike OpenAI.
    if (system_msg) query.system = system_msg;
  } else {
    query.max_tokens_to_sample = max_tokens_to_sample;
    query.prompt = wrapped_prompt;
  }

  query.messages = await resolve_images_in_user_messages(
    query.messages,
    "anthropic",
  );

  console.log(
    `Calling Anthropic model '${model}' with prompt '${prompt}' (n=${n}). Please be patient...`,
  );

  // Make a REST call to Anthropic
  // Repeat call n times, waiting for each response to come in:
  const responses: Array<Dict> = [];
  while (responses.length < n) {
    // Abort if canceled
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    if (APP_IS_RUNNING_LOCALLY()) {
      // If we're running locally, route the request through the Flask backend,
      // where we can use the Anthropic Python API to make the API call:
      const url = `https://api.anthropic.com/v1/${
        use_messages_api ? "messages" : "complete"
      }`;
      const headers = {
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "User-Agent": "Anthropic/JS 0.5.0",
        "X-Api-Key": ANTHROPIC_API_KEY,
      };
      const resp = await route_fetch(url, "POST", headers, query);
      responses.push(resp);
    } else {
      // We're on the chainforge.ai server; route API call through a proxy on the server, since Anthropic has CORS policy on their API:
      const resp = await fetch(
        use_messages_api
          ? "/db/call_anthropic_chat.php"
          : "/db/call_anthropic.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": ANTHROPIC_API_KEY,
          },
          body: JSON.stringify(query),
        },
      ).then((r) => r.json());

      // Check for error from server
      if (resp?.error !== undefined) {
        throw new Error(`${resp.error.type}: ${resp.error.message}`);
      }

      responses.push(resp);
    }
  }

  return [query, responses];
}

/**
 * The thinking config for a Gemini model that thinks (Gemini 2.5 and later),
 * from ChainForge's settings: thought summaries unless `include_thoughts` is
 * off, and a `thinking_budget` if one is set. Undefined for other models.
 * See https://ai.google.dev/gemini-api/docs/generate-content/thinking
 */
export function gemini_thinking_config(
  model: string,
  params?: Dict,
): GenerateContentConfig["thinkingConfig"] {
  if (!/^(models\/)?gemini-(2\.5|[3-9])/.test(model)) return undefined;
  const config: Dict = {};
  if (
    params?.include_thoughts !== false &&
    params?.include_thoughts !== "false"
  )
    config.includeThoughts = true;
  // Gemini 3 models think by level, and 2.5 models by budget; a request can't have both.
  const level = params?.thinking_level;
  if (typeof level === "string" && level && level !== "default")
    config.thinkingLevel = level.toUpperCase();
  else if (!is_blank_setting(params?.thinking_budget))
    config.thinkingBudget = Number(params?.thinking_budget);
  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Calls a Google Gemini model, based on the model selection from the user.
 * Returns raw query and response JSON dicts.
 */
export async function call_google_ai(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 0.7,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!GOOGLE_PALM_API_KEY)
    throw new Error(
      "Could not find an API key for Google Gemini models. Double-check that your API key is set in Settings or in your local environment.",
    );

  if (isGeminiImageModel(model))
    return call_gemini_image_gen(
      prompt,
      model,
      n,
      temperature,
      params,
      should_cancel,
      images,
    );

  const max_output_tokens = params?.max_output_tokens || 1000;
  const chat_history: ChatHistory = params?.chat_history;
  const system_msg = params?.system_msg;
  delete params?.chat_history;
  delete params?.system_msg;

  const gemini_client = new GoogleGenAI({ apiKey: GOOGLE_PALM_API_KEY });

  const gemini_config: GenerateContentConfig = {
    candidateCount: 1,
    systemInstruction: system_msg,
  };

  // Thought summaries; the response's text leaves them out.
  const thinking_config = gemini_thinking_config(model.toString(), params);
  if (thinking_config) gemini_config.thinkingConfig = thinking_config;
  delete params?.include_thoughts;
  delete params?.thinking_budget;
  delete params?.thinking_level;

  const query: Dict = {
    model: `models/${model}`,
    candidate_count: n,
    temperature,
    max_output_tokens,
    ...params,
  };

  // For some reason Google needs to be special and have its API params be different names --camel or snake-case
  // --depending on if it's the Python or Node JS API. ChainForge needs a consistent name, so we must convert snake to camel:
  const casemap: Record<string, keyof GenerateContentConfig> = {
    safety_settings: "safetySettings",
    stop_sequences: "stopSequences",
    candidate_count: "candidateCount",
    max_output_tokens: "maxOutputTokens",
    top_p: "topP",
    top_k: "topK",
  };

  Object.entries(casemap).forEach(([key, val]) => {
    if (key in query) {
      // (Indexed as a Dict: the SDK's config type is too large for TypeScript to index by key.)
      (gemini_config as Dict)[val] = query[key];
      query[val as string | number] = query[key];
      delete query[key];
    }
  });

  gemini_config.candidateCount = 1; // Gemini only supports 1 candidate

  // -1 is not a sensible value, so assume default is intended
  if ("topK" in gemini_config && gemini_config.topK === -1) {
    delete gemini_config.topK;
  }
  if ("topP" in gemini_config && gemini_config.topP === -1) {
    gemini_config.topP = 1.0;
  }

  const gemini_chat_history: GeminiChatContext = { history: [] };

  const openai_gemini_role_map: Record<string, "user" | "model"> = {
    user: "user",
    assistant: "model",
    system: "model",
  };

  // Chat completions
  if (chat_history !== undefined && chat_history.length > 0) {
    // Carry over any chat history, converting OpenAI formatted chat history to Gemini:
    for (const chat_msg of chat_history) {
      // Carry over system message to systemInstruction instead, on Gemini's config
      // NOTE: This will override any systemInstruction already present in gemini_config.
      // If the user is passing a chat history, it means they are using a Chat Turn node.
      if (chat_msg.role === "system") {
        if (system_msg !== undefined) {
          console.warn(
            "Warning: Both a system message and a chat history with a system message were provided to Google Gemini (typically, this occurs when a system message is defined in a Prompt Node and passed into a later Chat Turn node). The system message in the chat history will override the standalone system message.",
          );
        }
        gemini_config.systemInstruction = chat_msg.content;
      }
      const prompt_part: GeminiChatMessage = {
        role: openai_gemini_role_map[chat_msg.role],
        parts: gemini_history_parts(chat_msg) as GeminiChatMessage["parts"],
      };
      gemini_chat_history.history.push(prompt_part);
    }
  }

  console.log(
    `Calling Google Gemini model '${model}' with prompt '${prompt}' (n=${n}). Please be patient...`,
  );

  const responses: Array<Dict> = [];
  const prompt_parts: PartListUnion = [{ text: prompt }];
  if (images && images.length > 0) {
    const image_data_urls: string[] = await imagesToBase64(images);
    for (const image of image_data_urls) {
      prompt_parts.push({
        inlineData: {
          mimeType: getMimeTypeFromDataURL(image) ?? "image/png",
          data: getBase64DataFromDataURL(image) ?? "",
        },
      });
    }
  }

  let num_retries = 0;
  const max_retries = 3;
  while (responses.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const chat = gemini_client.chats.create({
      model,
      history: gemini_chat_history.history,
      config: gemini_config,
    });

    const chat_response = await chat.sendMessage({ message: prompt_parts });

    // NOTE: Sometimes, Google's API returns empty responses.
    // I'm not sure why this happens. In this case, we just retry until we get a non-empty response.
    if (!chat_response?.text) {
      if (num_retries >= max_retries) {
        throw new Error(
          "Maximum retries reached: Google Gemini is returning empty text responses. This happens occasionally due to ongoing issues with Google's API and the fix is unknown.",
        );
      }
      num_retries += 1;
      console.warn(
        "Received empty response from Google Gemini; retrying once more...",
      );
      continue;
    }

    responses.push({
      text: chat_response.text,
      candidates: chat_response.candidates,
      promptFeedback: chat_response.promptFeedback,
    });
  }

  return [query, responses];
}

/**
 * Calls Gemini image models (e.g. gemini-3.1-flash-image) via the REST
 * generateContent endpoint. Input images (e.g. from a Media Node) are sent as
 * inline parts, for editing or as references.
 *
 * Calls fetch directly, so the request is exactly the one the REST API
 * documents (this predates the SDK's support for `imageConfig`).
 *
 * @returns raw query and the list of raw generateContent responses.
 */
export async function call_gemini_image_gen(
  prompt: string,
  model: LLM,
  n = 1,
  temperature?: number,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!GOOGLE_PALM_API_KEY)
    throw new Error(
      "Could not find an API key for Google Gemini models. Double-check that your API key is set in Settings or in your local environment.",
    );

  const modelname = model.toString().replace(/^models\//, "");

  const imageConfig: Dict = {};
  if (params?.aspect_ratio && params.aspect_ratio !== "auto")
    imageConfig.aspectRatio = params.aspect_ratio;
  if (params?.image_size && params.image_size !== "auto")
    imageConfig.imageSize = params.image_size;

  const generationConfig: Dict = {
    // The model must support exactly this combination.
    responseModalities:
      params?.response_modalities === "TEXT_AND_IMAGE"
        ? ["TEXT", "IMAGE"]
        : ["IMAGE"],
  };
  if (typeof temperature === "number")
    generationConfig.temperature = temperature;
  if (Object.keys(imageConfig).length > 0)
    generationConfig.imageConfig = imageConfig;

  const parts: Dict[] = [{ text: prompt }];
  if (images && images.length > 0)
    for (const dataURL of await imagesToBase64(images))
      parts.push({
        inlineData: {
          mimeType: getMimeTypeFromDataURL(dataURL) ?? "image/png",
          data: getBase64DataFromDataURL(dataURL) ?? "",
        },
      });

  const body: Dict = { contents: [{ role: "user", parts }], generationConfig };
  if (params?.system_msg)
    body.systemInstruction = { parts: [{ text: params.system_msg }] };

  console.log(
    `Calling Gemini image model '${modelname}' (n=${n}, input images=${images?.length ?? 0})...`,
  );

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelname)}:generateContent`;
  const responses: Dict[] = [];
  while (responses.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GOOGLE_PALM_API_KEY,
      },
      body: JSON.stringify(body),
    });
    let payload: Dict | undefined;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }
    if (!res.ok)
      throw new Error(
        payload?.error?.message ??
          `Gemini image request failed (HTTP ${res.status}).`,
      );

    // Fail this response (not the whole run) when nothing usable came back,
    // e.g. a safety block, saying why.
    const candidate = payload?.candidates?.[0];
    const outParts: Dict[] = candidate?.content?.parts ?? [];
    const hasOutput = outParts.some((p) => p?.inlineData?.data || p?.text);
    if (!hasOutput) {
      const reason =
        candidate?.finishReason ?? payload?.promptFeedback?.blockReason;
      throw new Error(
        `Gemini returned no image${reason ? ` (reason: ${reason})` : ""}.`,
      );
    }
    responses.push(payload as Dict);
  }

  // Kept with cached responses: record the input image count, not the bytes.
  const query: Dict = {
    model: modelname,
    prompt,
    generationConfig,
    system_msg: params?.system_msg,
    input_images: images?.length ?? 0,
  };
  return [query, responses];
}

/** Hugging Face's OpenAI-compatible router for Inference Providers. */
const HUGGINGFACE_ROUTER_URL = "https://router.huggingface.co/v1";

/**
 * Calls a model through Hugging Face Inference Providers, which replaced the
 * serverless Inference API (api-inference.huggingface.co, now gone). It is an
 * OpenAI-shaped chat endpoint routing to whichever provider serves the model.
 *
 * A Hugging Face token is required -- anonymous calls are refused. Every
 * account gets a small monthly inference credit, so `provider_policy`
 * defaults to "cheapest" to make that credit go as far as possible.
 * See https://huggingface.co/docs/inference-providers
 */
export async function call_huggingface(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  const settings: Dict = { ...params };
  strip_empty_chat_params(settings);

  const chat_history: ChatHistory | undefined = settings.chat_history;
  const system_msg: string | undefined = settings.system_msg;
  // "custom_model" is what flows saved before Inference Providers used, for
  // both a typed-in model name and a dedicated endpoint's URL.
  const legacy_custom: string | undefined = settings.custom_model;
  const legacy_is_url =
    !is_blank_setting(legacy_custom) &&
    (legacy_custom as string).trim().startsWith("https:");
  const custom_endpoint: string | undefined = is_blank_setting(
    settings.custom_endpoint,
  )
    ? legacy_is_url
      ? legacy_custom
      : undefined
    : settings.custom_endpoint;
  // The provider to route to, appended to the model ID as HF expects. A model
  // typed in with its own suffix (e.g. "...:groq") keeps it.
  const provider_policy: string | undefined = settings.provider_policy;
  delete settings.chat_history;
  delete settings.system_msg;
  delete settings.custom_endpoint;
  delete settings.provider_policy;

  // Settings from before Inference Providers, which the chat endpoint doesn't take:
  const legacy_max_tokens = settings.max_new_tokens;
  if (settings.max_tokens === undefined && !is_blank_setting(legacy_max_tokens))
    settings.max_tokens = legacy_max_tokens;
  for (const key of [
    "max_new_tokens",
    "model_type",
    "num_continuations",
    "top_k",
    "repetition_penalty",
    "do_sample",
    "use_cache",
    "custom_model",
  ])
    delete settings[key];

  for (const [key, value] of Object.entries(settings))
    if (is_blank_setting(value)) delete settings[key];

  let modelname = stripHuggingFacePrefix(model);
  // An old flow's typed-in model name lived in custom_model, not the model ID.
  if (!legacy_is_url && !is_blank_setting(legacy_custom))
    modelname = (legacy_custom as string).trim();
  if (!is_blank_setting(provider_policy) && !modelname.includes(":"))
    modelname = `${modelname}:${(provider_policy as string).trim()}`;

  // A dedicated Inference Endpoint is queried directly, at its own URL; it
  // speaks the same OpenAI-shaped API, so only the base URL differs.
  const using_custom_endpoint = !is_blank_setting(custom_endpoint);
  const base_url = using_custom_endpoint
    ? (custom_endpoint as string).trim().replace(/\/+$/, "")
    : HUGGINGFACE_ROUTER_URL;
  const url = base_url.endsWith("/chat/completions")
    ? base_url
    : `${base_url}/chat/completions`;

  if (!HUGGINGFACE_API_KEY && !using_custom_endpoint)
    throw new Error(
      "Could not find a HuggingFace API key. Inference Providers refuses anonymous requests, so you need a (free) Hugging Face token: create one at https://huggingface.co/settings/tokens with the 'Make calls to Inference Providers' permission, then set it in Settings.",
    );

  const headers: Dict<string> = { "Content-Type": "application/json" };
  if (HUGGINGFACE_API_KEY)
    headers.Authorization = `Bearer ${HUGGINGFACE_API_KEY}`;

  // A dedicated endpoint serves one model, so it takes no provider suffix. It
  // wants the model ID it was deployed with; "tgi" is the documented
  // placeholder, and all an old flow that only set custom_model can offer.
  const endpoint_model =
    stripHuggingFacePrefix(model) === NativeLLM.HF_OTHER
      ? "tgi"
      : stripHuggingFacePrefix(model);

  const query: Dict = {
    model: using_custom_endpoint ? endpoint_model : modelname,
    temperature,
    ...settings,
  };
  query.messages = await resolve_images_in_user_messages(
    construct_chat_history(prompt, images, chat_history, system_msg),
    "openai",
  );

  console.log(`Querying HuggingFace model '${modelname}' (n=${n})...`);

  // Providers behind the router differ on whether they honour n, so ask once
  // per response, as ChainForge does for other routed providers.
  const responses: Dict[] = [];
  while (responses.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const response = await fetch(url, {
      headers,
      method: "POST",
      body: JSON.stringify(query),
    });
    const result = await response.json().catch(() => undefined);

    // Errors come back as a JSON body rather than a thrown exception.
    if (!response.ok || result?.error !== undefined) {
      const detail =
        result?.error?.message ??
        result?.error ??
        `${response.status} ${response.statusText}`;
      if (response.status === 401 || response.status === 403)
        throw new Error(
          `Hugging Face refused the request (${detail}). Check that your token is set in Settings and has the 'Make calls to Inference Providers' permission.`,
        );
      if (response.status === 402)
        throw new Error(
          `Hugging Face says this account is out of inference credits (${detail}). Free accounts get a small monthly credit; a cheaper model, or the 'cheapest' provider setting, makes it last longer.`,
        );
      throw new Error(
        `HuggingFace API error querying '${modelname}': ${detail}`,
      );
    }

    const content = result?.choices?.[0]?.message?.content;
    if (content === undefined)
      throw new Error(
        `HuggingFace returned no completion for '${modelname}'. Check that the model is served by Inference Providers -- the list is at ${HUGGINGFACE_ROUTER_URL}/models.`,
      );

    // Stored in the shape ChainForge has always stored HuggingFace responses
    // in, so that runs cached before this change still display.
    responses.push({ generated_text: content, raw: result });
  }

  return [query, responses];
}

export async function call_ollama_provider(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!params?.ollama_url)
    throw Error(
      "Could not find a base URL for Ollama model. Double-check that your base URL is set in the model settings.",
    );

  let url: string = appendEndSlashIfMissing(params?.ollama_url);
  if (!url.endsWith("api/")) url += "api/";
  const ollama_model: string = params?.ollamaModel.toString();
  const model_type: string = params?.model_type ?? "text";
  const system_msg: string = params?.system_msg ?? "";
  const chat_history: ChatHistory | undefined = params?.chat_history;
  const format: Dict | string | undefined = params?.format;

  // Cleanup
  for (const name of [
    "ollamaModel",
    "ollama_url",
    "model_type",
    "system_msg",
    "chat_history",
    "format",
  ])
    if (params && name in params) delete params[name];

  // FIXME: Ollama doesn't support batch inference, but llama.cpp does so it will eventually
  // For now, we send n requests and then wait for all of them to finish
  const query: Dict = {
    model: ollama_model,
    stream: false,
    options: {
      temperature,
      ...params, // 'the rest' of the settings, passed from the front-end settings
    },
  };

  let n_images = 0;
  // If the model type is explicitly or implicitly set to "chat", pass chat history instead:
  if (model_type === "chat" || /[-:](chat)/.test(ollama_model)) {
    // Construct chat history and pass to query payload
    query.messages = construct_chat_history(
      prompt,
      images,
      chat_history,
      system_msg,
    );
    url += "chat";

    query.messages = await resolve_images_in_user_messages(
      query.messages,
      "ollama",
    );
    // construct_chat_history only attaches `images` when there are some, so a
    // text-only prompt leaves the property undefined -- which made every
    // image-free Ollama chat request throw before it was ever sent.
    n_images = query.messages.filter(
      (msg: Dict) => msg.role === "user" && (msg.images?.length ?? 0) > 0,
    ).length;
    console.log(
      "Resolved images in user messages: ",
      query.messages,
      query.messages.length,
    );
  } else {
    // Text-only models
    query.prompt = prompt;
    query.images = (await imagesToBase64(images ?? [])).map(
      getBase64DataFromDataURL,
    );
    url += "generate";
  }

  console.log(query);
  console.log(
    `Calling Ollama API at ${url} for model '${ollama_model}' with prompt '${query.prompt !== undefined ? query.prompt : query.messages[query.messages.length - 1].content}' n=${n} times. Contains n_img=${n_images} Please be patient...`,
  );

  // If there are structured outputs specified, convert to an object:
  if (typeof format === "string" && format.trim().length > 0) {
    try {
      query.format = JSON.parse(format);
    } catch (err) {
      throw Error(
        "Cannot parse structured output format into JSON: JSON schema is incorrectly structured.",
      );
    }
  }

  // Call Ollama API
  const resps: Response[] = [];
  for (let i = 0; i < n; i++) {
    // Abort if the user canceled
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    // Query Ollama and collect the response
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(query),
    });

    resps.push(response);
  }

  const parse_response = (body: string) => {
    const json = JSON.parse(body);
    if (json.message)
      // chat models
      return { generated_text: json.message.content };
    // text-only models
    else return { generated_text: json.response };
  };

  const responses = await Promise.all(resps.map((resp) => resp.text())).then(
    (responses) => {
      return responses.map((response) => parse_response(response));
    },
  );

  return [query, responses];
}

/**
 * Turns ChainForge's chat history into Converse API messages. Converse takes
 * one content block list per message, with images as raw bytes rather than
 * base64, and carries the system prompt outside the messages.
 */
function to_bedrock_messages(history: ChatHistory): Dict[] {
  const messages: Dict[] = [];
  for (const msg of history) {
    if (msg.role === "system") continue; // Converse takes this in `system`
    const content: Dict[] = [];
    if (typeof msg.content === "string") {
      if (msg.content.length > 0) content.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content as Dict[]) {
        if (block.type === "text" && block.text)
          content.push({ text: block.text });
        else if (block.type === "image" && block.source?.data) {
          const media: string = block.source.media_type ?? "image/png";
          content.push({
            image: {
              format: media.split("/")[1]?.replace("jpg", "jpeg") ?? "png",
              source: { bytes: base64ToBytes(block.source.data) },
            },
          });
        }
      }
    }
    if (content.length === 0) continue;
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content,
    });
  }
  return messages;
}

/** Decodes base64 image data into the byte array Converse wants. */
function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Calls a model on Amazon Bedrock through the Converse API, which takes the
 * same request shape for every vendor on Bedrock -- so one code path, and one
 * settings form, cover Anthropic, Amazon, Meta, Mistral and the rest.
 *
 * The model ID is usually a cross-region inference profile (us./eu./global.
 * and so on) rather than a bare model ID, which most models released since
 * 2025 reject on on-demand throughput.
 * See https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
 */
export async function call_bedrock(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  // A session token is only issued for temporary credentials, so it is optional.
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION)
    throw new Error(
      "Could not find credentials for Amazon Bedrock. Double-check that your AWS access key, secret key and region are set in Settings or in your local environment.",
    );

  const modelId = stripBedrockPrefix(model);
  const settings: Dict = { ...params };
  strip_empty_chat_params(settings);

  const chat_history: ChatHistory | undefined = settings.chat_history;
  const system_msg: string | undefined = settings.system_msg;
  const extra_fields: string | undefined =
    settings.additional_model_request_fields;
  delete settings.chat_history;
  delete settings.system_msg;
  delete settings.additional_model_request_fields;

  const inferenceConfig: Dict = { temperature };
  if (!is_blank_setting(settings.max_tokens))
    inferenceConfig.maxTokens = settings.max_tokens;
  if (!is_blank_setting(settings.top_p)) inferenceConfig.topP = settings.top_p;
  if (
    Array.isArray(settings.stop_sequences) &&
    settings.stop_sequences.length > 0
  )
    inferenceConfig.stopSequences = settings.stop_sequences;

  let additionalModelRequestFields: Dict | undefined;
  if (!is_blank_setting(extra_fields)) {
    try {
      additionalModelRequestFields = JSON.parse(extra_fields as string);
    } catch (e) {
      throw new Error(
        `additionalModelRequestFields must be a JSON object: ${(e as Error).message}`,
      );
    }
  }

  const messages = to_bedrock_messages(
    await resolve_images_in_user_messages(
      construct_chat_history(prompt, images, chat_history, undefined),
      "anthropic",
    ),
  );

  const query: Dict = { modelId, messages, inferenceConfig };
  if (!is_blank_setting(system_msg))
    query.system = [{ text: system_msg as string }];
  if (additionalModelRequestFields)
    query.additionalModelRequestFields = additionalModelRequestFields;

  const { BedrockRuntimeClient, ConverseCommand } = await get_bedrock_module();
  const client = new BedrockRuntimeClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      ...(AWS_SESSION_TOKEN ? { sessionToken: AWS_SESSION_TOKEN } : {}),
    },
  });

  console.log(`Querying Bedrock model '${modelId}' (n=${n})...`);

  const responses: Dict[] = [];
  while (responses.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    let result: Dict;
    try {
      result = (await client.send(new ConverseCommand(query as any))) as Dict;
    } catch (error: any) {
      // Bedrock's own message is the useful part, but the commonest failure --
      // a bare model ID where an inference profile is required -- deserves a
      // pointer to the fix.
      const detail = error?.message ?? error?.toString?.() ?? "unknown error";
      if (
        /on-demand throughput isn(')?t supported|inference profile/i.test(
          detail,
        )
      )
        throw new Error(
          `${detail}\n\nBedrock wants an inference profile for this model: try prefixing the model ID with your geography, e.g. "us.${modelId}".`,
        );
      throw new Error(detail);
    }

    const text = (result.output?.message?.content ?? [])
      .map((block: Dict) => block.text)
      .filter((t: unknown) => typeof t === "string")
      .join("");
    if (!text)
      throw new Error(
        `Bedrock returned no text for '${modelId}' (stopReason: ${result.stopReason ?? "unknown"}).`,
      );

    responses.push({ generated_text: text, raw: result });
  }

  return [query, responses];
}

/**
 * Calls Together.ai text + chat models via Together's API.
   @returns raw query and response JSON dicts.
 */
export async function call_together(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!TOGETHER_API_KEY)
    throw new Error(
      "Could not find an Together API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  const togetherBaseUrl = "https://api.together.xyz/v1";

  // Together.ai speaks OpenAI's API, so the same client serves it:
  const together = new OpenAI({
    apiKey: TOGETHER_API_KEY,
    baseURL: togetherBaseUrl,
    ...OPENAI_BROWSER_OPTS,
  });

  const modelname: string = stripTogetherPrefix(model);
  if (
    params?.stop !== undefined &&
    (!Array.isArray(params.stop) || params.stop.length === 0)
  )
    delete params.stop;
  if (params?.seed && params.seed.toString().length === 0) delete params?.seed;
  if (
    params?.functions !== undefined &&
    (!Array.isArray(params.functions) || params.functions.length === 0)
  )
    delete params?.functions;
  if (
    params?.function_call !== undefined &&
    (!(typeof params.function_call === "string") ||
      params.function_call.trim().length === 0)
  )
    delete params.function_call;

  console.log(
    `Querying Together model '${modelname}' with prompt '${prompt}'...`,
  );

  // Determine the system message and whether there's chat history to continue:
  const chat_history: ChatHistory | undefined = params?.chat_history;
  const system_msg: string =
    params?.system_msg !== undefined
      ? params.system_msg
      : "You are a helpful assistant.";
  delete params?.system_msg;
  delete params?.chat_history;

  const query: Dict = {
    model: modelname,
    n,
    temperature,
    ...params, // 'the rest' of the settings, passed from the front-end settings
  };

  // Create call to chat model
  const together_call: any = together.chat.completions.create.bind(
    together.chat.completions,
  );

  // Carry over chat history, if present:
  query.messages = construct_chat_history(
    prompt,
    images,
    chat_history,
    system_msg,
  );

  // Try to call Together
  let response: Dict = {};
  try {
    response = (await together_call(query)) as Dict;
  } catch (error: any) {
    throw new Error(openai_error_message(error));
  }

  return [query, response];
}

async function call_custom_provider(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict[]]> {
  if (!APP_IS_RUNNING_LOCALLY())
    throw new Error(
      "The ChainForge app does not appear to be running locally. You can only call custom model providers if you are running ChainForge on your local machine, from a Flask app.",
    );

  // The model to call is in format:
  // __custom/<provider_name>/<submodel name>
  // It may also exclude the final tag.
  // We extract the provider name (this is the name used in the Python backend's `ProviderRegistry`) and optionally, the submodel name
  const provider_path = model.substring(9);
  const provider_name = provider_path.substring(0, provider_path.indexOf("/"));
  const submodel_name =
    provider_path.length === provider_name.length - 1
      ? undefined
      : provider_path.substring(provider_path.lastIndexOf("/") + 1);

  const responses: Dict[] = [];
  const query = { prompt, model, temperature, ...params };

  // Convert any images to base64
  const base64_images = await (images ? imagesToBase64(images) : undefined);

  // Call the custom provider n times
  while (responses.length < n) {
    // Abort if the user canceled
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    // Collect response from the custom provider
    const { response, error } = await call_flask_backend("callCustomProvider", {
      name: provider_name,
      params: {
        prompt,
        model: submodel_name,
        temperature,
        images: base64_images,
        ...params,
      },
    });

    // Fail if an error is encountered
    if (error !== undefined || response === undefined) throw new Error(error);

    responses.push(response);
  }
  return [query, responses];
}

/**
 * Reasoning models run in the browser (e.g. Qwen3) write their reasoning into
 * the reply, in a leading <think> block. Moves it to `reasoning_content`, as
 * DeepSeek sends it, so the response is just the answer. A block that never
 * closes (the model ran out of tokens while reasoning) is all reasoning.
 */
export function split_webllm_thinking(choice: Dict): Dict {
  const content = choice?.message?.content;
  if (typeof content !== "string") return choice;
  const match = content.match(/^\s*<think>([\s\S]*?)(?:<\/think>|$)/);
  if (!match) return choice;
  const reasoning = match[1].trim();
  return {
    ...choice,
    message: {
      ...choice.message,
      content: content.slice(match[0].length).trim(),
      ...(reasoning ? { reasoning_content: reasoning } : {}),
    },
  };
}

async function call_webllm(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (images && images.length > 0)
    throw new Error(
      "WebLLM text models currently do not support image inputs in ChainForge.",
    );

  const llm_model = model.toString();
  const engine = await get_webllm_engine(llm_model);
  const call_params = deepcopy(params) ?? {};

  const chat_history: ChatHistory | undefined = call_params.chat_history;
  const system_msg: string | undefined =
    call_params.system_msg !== undefined ? call_params.system_msg : undefined;
  delete call_params.chat_history;
  delete call_params.system_msg;

  const messages = construct_chat_history(
    prompt,
    undefined,
    chat_history,
    system_msg,
  ).map((m) => ({ role: m.role, content: m.content }));

  const max_tokens = call_params.max_tokens;
  const top_p = call_params.top_p;
  delete call_params.max_tokens;
  delete call_params.top_p;

  const query: Dict = {
    model: llm_model,
    n,
    temperature,
    messages,
    ...call_params,
  };

  const choices: Dict[] = [];
  while (choices.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const completion = await engine.chat.completions.create({
      model: llm_model,
      messages,
      temperature,
      ...(max_tokens !== undefined ? { max_tokens } : {}),
      ...(top_p !== undefined ? { top_p } : {}),
      ...call_params,
    });

    if (completion?.choices && completion.choices.length > 0)
      choices.push(...completion.choices.map(split_webllm_thinking));
    else throw new Error("WebLLM returned no choices.");
  }

  return [query, { choices: choices.slice(0, n) }];
}

/**
 * Switcher that routes the request to the appropriate API call function. If call doesn't exist, throws error.
 */
export async function call_llm(
  llm: LLM,
  provider: LLMProvider,
  prompt: string,
  n: number,
  temperature: number,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  // Get the correct API call for the given LLM:
  let call_api: LLMAPICall | undefined;
  const llm_provider: LLMProvider | undefined = provider ?? getProvider(llm); // backwards compatibility if there's no explicit provider

  if (llm_provider === undefined)
    throw new Error(`Language model ${llm} is not supported.`);

  const llm_name = llm.toString().toLowerCase();
  if (llm_provider === LLMProvider.OpenAI) {
    if (isOpenAIImageModel(llm_name)) call_api = call_openai_image_gen;
    else call_api = call_chatgpt;
  } else if (llm_provider === LLMProvider.WebLLM) call_api = call_webllm;
  else if (llm_provider === LLMProvider.Azure_OpenAI)
    call_api = call_azure_openai;
  else if (llm_provider === LLMProvider.Google) call_api = call_google_ai;
  else if (llm_provider === LLMProvider.Anthropic) call_api = call_anthropic;
  else if (llm_provider === LLMProvider.HuggingFace)
    call_api = call_huggingface;
  else if (llm_provider === LLMProvider.Ollama) call_api = call_ollama_provider;
  else if (llm_provider === LLMProvider.Custom) call_api = call_custom_provider;
  else if (llm_provider === LLMProvider.Bedrock) call_api = call_bedrock;
  else if (llm_provider === LLMProvider.Together) call_api = call_together;
  else if (llm_provider === LLMProvider.DeepSeek) call_api = call_deepseek;
  else if (llm_provider === LLMProvider.MiniMax) call_api = call_minimax;
  else if (llm_provider === LLMProvider.OpenRouter)
    call_api = isOpenRouterImageModel(llm)
      ? call_openrouter_image_gen
      : call_openrouter;
  if (call_api === undefined)
    throw new Error(
      `Adapter for Language model ${llm} and ${llm_provider} not found`,
    );
  // Past turns' reasoning state is only for the provider that made it, which handles it itself
  if (params?.chat_history && !PROVIDERS_REPLAYING_REASONING.has(llm_provider))
    params.chat_history = strip_reasoning_state(params.chat_history);
  return call_api(prompt, llm, n, temperature, params, should_cancel, images);
}

/**
 * Extracts the relevant portion of a OpenAI chat response.
 * Note that chat choice objects can now include 'function_call' and a blank 'content' response.
 * This method detects a 'function_call's presence, prepends [[FUNCTION]] and converts the function call into JS format.
 */
function _extract_openai_chat_choice_content(choice: Dict): string {
  if (
    choice.finish_reason === "function_call" ||
    ("function_call" in choice.message &&
      choice.message.function_call.length > 0)
  ) {
    const func = choice.message.function_call;
    return "[[FUNCTION]] " + func.name + func.arguments.toString();
  } else if (
    choice.finish_reason === "tool_calls" ||
    ("tool_calls" in choice.message && choice.message.tool_calls.length > 0)
  ) {
    const tools = choice.message.tool_calls;
    return (
      "[[TOOLS]] " +
      tools
        .map((t: Dict) => t.function.name + " " + t.function.arguments)
        .join("\n\n")
    );
  } else {
    // Extract the content. Note that structured outputs in OpenAI's API as of late 2024
    // can sometimes output a response to a "refusal" key, which is annoying. We check for that here:
    if (
      "refusal" in choice.message &&
      typeof choice.message.refusal === "string"
    )
      return choice.message.refusal;
    // General chat outputs
    else return choice.message.content;
  }
}

/**
 * Extracts the text part of a response JSON from ChatGPT. If there is more
 * than 1 response (e.g., asking the LLM to generate multiple responses),
 * this produces a list of all returned responses.
 */
function _extract_chatgpt_responses(response: Dict): Array<string> {
  return response.choices.map(_extract_openai_chat_choice_content);
}

/**
 * Extracts the text part of a response JSON from OpenAI completions models like Davinci. If there are more
 * than 1 response (e.g., asking the LLM to generate multiple responses),
 * this produces a list of all returned responses.
 */
function _extract_openai_completion_responses(response: Dict): Array<string> {
  return response.choices.map((c: Dict) => c.text.trim());
}

/**
 * Extracts the text part of a response JSON from ChatGPT. If there is more
 * than 1 response (e.g., asking the LLM to generate multiple responses),
 * this produces a list of all returned responses.
 */
function _extract_openai_image_responses(
  response: Array<ImagesResponseDataInner>,
): LLMResponseData[] {
  return response.map((v) => ({
    t: "img",
    d: v.b64_json ?? v.url ?? "[[NO DATA]]",
  }));
}

/**
 * Deduces the format of an OpenAI model response (completion or chat)
 * and extracts the response text using the appropriate method.
 */
function _extract_openai_responses(response: Dict): Array<string> {
  if (response.choices.length === 0) return [];
  const first_choice = response.choices[0];
  if ("message" in first_choice) return _extract_chatgpt_responses(response);
  else return _extract_openai_completion_responses(response);
}

/**
 * Extracts the text of OpenRouter chat responses: one request per response,
 * each in OpenAI's format. A blank answer is kept as "" rather than null.
 */
function _extract_openrouter_chat_responses(
  responses: Array<Dict>,
): Array<string> {
  return responses.flatMap((response) =>
    _extract_chatgpt_responses(response).map((text) => text ?? ""),
  );
}

/** Extracts images from OpenRouter Image API results, as base64. */
function _extract_openrouter_image_responses(
  data: Array<Dict>,
): LLMResponseData[] {
  return data.map((d) => ({ t: "img", d: d.b64_json }));
}

function _extract_google_ai_responses(
  response: Dict,
  llm: LLM | string,
): Array<LLMResponseData> {
  if (isGeminiImageModel(llm))
    return _extract_gemini_image_responses(response as Array<Dict>);
  return _extract_gemini_responses(response as Array<Dict>);
}

/**
 * Extracts images from Gemini image model responses, as base64. A response
 * that carries only text (e.g. the model declining) yields that text instead,
 * so the reason is visible.
 */
function _extract_gemini_image_responses(
  completions: Array<Dict>,
): Array<LLMResponseData> {
  const out: LLMResponseData[] = [];
  for (const completion of completions) {
    const parts: Dict[] = completion?.candidates?.[0]?.content?.parts ?? [];
    const images = parts.filter(
      (p) =>
        p?.inlineData?.data &&
        String(p.inlineData.mimeType ?? "image/").startsWith("image/"),
    );
    if (images.length > 0)
      images.forEach((p) => out.push({ t: "img", d: p.inlineData.data }));
    else {
      const text = parts
        .map((p) => p?.text)
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) out.push(text);
    }
  }
  return out;
}

/**
 * Extracts the text part of a 'EnhancedGenerateContentResponse' object from Google Gemini `sendChat` or `chat`.
 */
function _extract_gemini_responses(completions: Array<Dict>): Array<string> {
  console.log("Extracting Gemini responses from: ", completions);
  return completions.map((c: Dict) => c.text);
}

/**
 * Extracts the text part of an Anthropic chat completion (Claude 2.1+ models).
 */
function _extract_anthropic_chat_responses(
  response: Array<Dict>,
): Array<string> {
  return response.map((r: Dict) =>
    r.content
      .map((c: Dict) => {
        // Regular text response
        if (c?.type === "text") return c.text.trim();
        // Anthropic tool usage
        else if (c?.type === "tool_use")
          return (
            "[[TOOLS]] " +
            JSON.stringify({
              name: c.name,
              input: c.input,
            })
          );
        // Thinking, which extract_reasoning collects instead
        else if (c?.type === "thinking" || c?.type === "redacted_thinking")
          return undefined;
        // Unknown type of message
        else
          throw Error(
            `Unknown type '${c?.type}' of message found in Anthropic response. If this is a new type, raise an Issue on the ChainForge Github.`,
          );
      })
      .filter((s: string | undefined) => s !== undefined)
      .join("\n\n"),
  );
}

/**
 * Extracts the text part of an Anthropic text completion.
 */
function _extract_anthropic_text_responses(
  response: Array<Dict>,
): Array<string> {
  return response.map((r: Dict) => r.completion?.trim());
}

/**
 * Extracts the text of a Bedrock Converse response. Responses cached before
 * the move to Converse were stored as plain strings, so both are accepted.
 */
function _extract_bedrock_responses(response: Array<Dict>): Array<string> {
  return response.map((r: Dict | string) =>
    typeof r === "string" ? r.trim() : (r.generated_text ?? "").trim(),
  );
}

/**
 * Extracts the text part of a HuggingFace completion. Responses cached before
 * the move to Inference Providers only have generated_text, so both the stored
 * text and a raw OpenAI-shaped payload are accepted.
 */
function _extract_huggingface_responses(response: Array<Dict>): Array<string> {
  return response.map((r: Dict) =>
    (r.generated_text ?? r.choices?.[0]?.message?.content ?? "").trim(),
  );
}

/**
 * Extracts the text part of a Ollama text completion.
 */
function _extract_ollama_responses(
  response: Array<Dict>,
): Array<LLMResponseData> {
  return response.map((r: any) => r.generated_text?.trim());
}

/** The metavar under which a response's reasoning (a reasoning model's "thinking") is exposed. */
export const REASONING_METAVAR = "reasoning";

/** The readable reasoning in an OpenAI-format chat message from OpenRouter, if any. */
function _extract_openrouter_message_reasoning(message?: Dict): string | null {
  const reasoning = message?.reasoning;
  if (typeof reasoning === "string" && reasoning.trim()) return reasoning;
  // Some models only return structured details: text, or summaries. (Encrypted details aren't readable.)
  const rawDetails = message?.reasoning_details;
  const details: Dict[] = Array.isArray(rawDetails) ? rawDetails : [];
  const text = details
    .map((d) => (d?.type === "reasoning.summary" ? d.summary : d?.text))
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .join("\n\n");
  return text || null;
}

/**
 * Extracts each response's reasoning, in the same order as `extract_responses`,
 * with null for a response without any. Returns undefined when no response has
 * reasoning, so response objects only carry it when there's something to show.
 */
export function extract_reasoning(
  response: Array<string | Dict> | Dict,
  llm: LLM | string,
  provider: LLMProvider,
): Array<string | null> | undefined {
  const llm_provider = provider ?? getProvider(llm as LLM);
  const llm_name = llm.toString();
  const readable = (s: unknown) =>
    typeof s === "string" && s.trim().length > 0 ? s : null;
  const joined = (parts: unknown[]) =>
    readable(parts.filter((p) => readable(p) !== null).join("\n\n"));
  const responses: Dict[] = Array.isArray(response)
    ? (response as Dict[])
    : [response as Dict];

  let reasoning: Array<string | null> = [];
  switch (llm_provider) {
    case LLMProvider.OpenRouter:
      if (!isOpenRouterImageModel(llm))
        reasoning = responses.flatMap((r) =>
          (r?.choices ?? []).map((c: Dict) =>
            _extract_openrouter_message_reasoning(c?.message),
          ),
        );
      break;
    case LLMProvider.DeepSeek:
    case LLMProvider.WebLLM: // see split_webllm_thinking
      // OpenAI-format chat completions, with the reasoning beside the content
      reasoning = responses.flatMap((r) =>
        (r?.choices ?? []).map((c: Dict) =>
          readable(c?.message?.reasoning_content),
        ),
      );
      break;
    case LLMProvider.OpenAI:
      // Only Responses API results (see call_openai_responses) have reasoning summaries
      reasoning = responses
        .filter((r) => Array.isArray(r?.output))
        .map((r) =>
          joined(
            r.output
              .filter((o: Dict) => o?.type === "reasoning")
              .flatMap((o: Dict) =>
                (o.summary ?? []).map((s: Dict) => s?.text),
              ),
          ),
        );
      break;
    case LLMProvider.Anthropic:
      reasoning = responses.map((r) =>
        joined(
          (Array.isArray(r?.content) ? r.content : [])
            .filter((c: Dict) => c?.type === "thinking")
            .map((c: Dict) => c.thinking),
        ),
      );
      break;
    case LLMProvider.Google:
      if (!isGeminiImageModel(llm_name))
        reasoning = responses.map((r) =>
          joined(
            (r?.candidates?.[0]?.content?.parts ?? [])
              .filter((p: Dict) => p?.thought)
              .map((p: Dict) => p.text),
          ),
        );
      break;
  }
  return reasoning.some((r) => r !== null) ? reasoning : undefined;
}

/**
 * Extracts each response's reasoning state: a reasoning model's own record of
 * its reasoning, which it needs back in later turns of a chat (e.g. Claude's
 * signed thinking blocks, or OpenAI's encrypted reasoning items). Each is tagged
 * with its provider, since only that provider can use it. In the same order as
 * `extract_responses`, with null for a response without any.
 */
export function extract_reasoning_state(
  response: Array<string | Dict> | Dict,
  llm: LLM | string,
  provider: LLMProvider,
): Array<Dict | null> | undefined {
  const llm_provider = provider ?? getProvider(llm as LLM);
  const responses: Dict[] = Array.isArray(response)
    ? (response as Dict[])
    : [response as Dict];
  const nonEmpty = (items: unknown) =>
    Array.isArray(items) && items.length > 0 ? items : undefined;
  const textIn = (s: unknown) =>
    typeof s === "string" && s.length > 0 ? s : undefined;

  let states: Array<Dict | null> = [];
  switch (llm_provider) {
    case LLMProvider.OpenRouter:
      // Fields of OpenAI-format assistant messages, as sent back
      if (!isOpenRouterImageModel(llm))
        states = responses.flatMap((r) =>
          (r?.choices ?? []).map((c: Dict) => {
            const details = nonEmpty(c?.message?.reasoning_details);
            if (details)
              return { provider: llm_provider, reasoning_details: details };
            const text = textIn(c?.message?.reasoning);
            return text ? { provider: llm_provider, reasoning: text } : null;
          }),
        );
      break;
    case LLMProvider.DeepSeek:
      states = responses.flatMap((r) =>
        (r?.choices ?? []).map((c: Dict) => {
          const text = textIn(c?.message?.reasoning_content);
          return text
            ? { provider: llm_provider, reasoning_content: text }
            : null;
        }),
      );
      break;
    case LLMProvider.OpenAI:
      // Responses aren't stored, so reasoning items only go back with their encrypted content
      states = responses
        .filter((r) => Array.isArray(r?.output))
        .map((r) => {
          const items = nonEmpty(
            r.output.filter(
              (o: Dict) => o?.type === "reasoning" && o.encrypted_content,
            ),
          );
          return items ? { provider: llm_provider, items } : null;
        });
      break;
    case LLMProvider.Anthropic:
      // Thinking blocks go back unchanged, including ones whose text was omitted
      states = responses.map((r) => {
        const blocks = nonEmpty(
          (Array.isArray(r?.content) ? r.content : []).filter(
            (c: Dict) =>
              c?.type === "thinking" || c?.type === "redacted_thinking",
          ),
        );
        return blocks ? { provider: llm_provider, blocks } : null;
      });
      break;
    case LLMProvider.Google:
      // The model's parts go back whole, keeping their thought signatures
      if (!isGeminiImageModel(llm.toString()))
        states = responses.map((r) => {
          const parts: Dict[] = r?.candidates?.[0]?.content?.parts ?? [];
          return parts.some((p) => p?.thought || p?.thoughtSignature)
            ? { provider: llm_provider, parts }
            : null;
        });
      break;
  }
  return states.some((s) => s !== null) ? states : undefined;
}

/** Providers that get their own reasoning state back in later turns of a chat. */
const PROVIDERS_REPLAYING_REASONING = new Set<LLMProvider>([
  LLMProvider.OpenRouter,
  LLMProvider.DeepSeek,
  LLMProvider.OpenAI,
  LLMProvider.Anthropic,
  LLMProvider.Google,
]);

/** A past assistant turn's reasoning state, if the given provider made it. */
function own_reasoning_state(
  message: ChatMessage,
  provider: LLMProvider,
): Dict | undefined {
  return message.role === "assistant" &&
    message.reasoning_state?.provider === provider
    ? message.reasoning_state
    : undefined;
}

/** A chat history without reasoning state, for requests that can't use it. */
export function strip_reasoning_state(history: ChatHistory): ChatHistory {
  return history.map((message) => {
    if (message.reasoning_state === undefined) return message;
    const rest = { ...message };
    delete rest.reasoning_state;
    return rest;
  });
}

/**
 * A chat history for OpenAI-format chat completions, with a provider's own
 * reasoning back on its past turns, in that provider's message fields (e.g.
 * OpenRouter's reasoning_details, or DeepSeek's reasoning_content).
 */
export function chat_history_with_reasoning(
  history: ChatHistory,
  provider: LLMProvider,
): ChatHistory {
  return strip_reasoning_state(history).map((message, i) => {
    const state = own_reasoning_state(history[i], provider);
    if (!state) return message;
    const fields = { ...state };
    delete fields.provider;
    return { ...message, ...fields };
  });
}

/** A chat history for Claude's Messages API, with Claude's own thinking blocks back at the start of its past turns. */
export function anthropic_chat_history(history: ChatHistory): ChatHistory {
  return strip_reasoning_state(history).map((message, i) => {
    const state = own_reasoning_state(history[i], LLMProvider.Anthropic);
    if (!state) return message;
    const text = message.content
      ? [{ type: "text", text: message.content }]
      : [];
    return {
      ...message,
      content: [...state.blocks, ...text],
    } as unknown as ChatMessage;
  });
}

/** The parts of a past turn in a Gemini chat: the model's own parts (with thought signatures), or the turn's text. */
export function gemini_history_parts(message: ChatMessage): Dict[] {
  return (
    own_reasoning_state(message, LLMProvider.Google)?.parts ?? [
      { text: message.content },
    ]
  );
}

/**
 * Given a LLM and a response object from its API, extract the
 * text response(s) part of the response object.
 */
export function extract_responses(
  response: Array<string | Dict> | Dict,
  llm: LLM | string,
  provider: LLMProvider,
): Array<LLMResponseData> {
  const llm_provider: LLMProvider | undefined =
    provider ?? getProvider(llm as LLM);
  const llm_name = llm.toString().toLowerCase();
  switch (llm_provider) {
    case LLMProvider.OpenAI:
      if (isOpenAIImageModel(llm_name))
        return _extract_openai_image_responses(
          response as Array<ImagesResponseDataInner>,
        );
      else if (llm_name.includes("davinci") || llm_name.includes("instruct"))
        return _extract_openai_completion_responses(response);
      // Responses API results (see call_openai_responses)
      else if (Array.isArray(response))
        return (response as Dict[]).map(_extract_openai_responses_api_text);
      else return _extract_chatgpt_responses(response);
    case LLMProvider.WebLLM:
      return _extract_chatgpt_responses(response);
    case LLMProvider.Azure_OpenAI:
      return _extract_openai_responses(response);
    case LLMProvider.Google:
      return _extract_google_ai_responses(response as Dict, llm);
    case LLMProvider.Anthropic:
      if (is_newer_anthropic_model(llm_name))
        return _extract_anthropic_chat_responses(response as Dict[]);
      else return _extract_anthropic_text_responses(response as Dict[]);
    case LLMProvider.HuggingFace:
      return _extract_huggingface_responses(response as Dict[]);
    case LLMProvider.Ollama:
      return _extract_ollama_responses(response as Dict[]);
    case LLMProvider.Bedrock:
      return _extract_bedrock_responses(response as Dict[]);
    case LLMProvider.Together:
      return _extract_openai_responses(response as Dict[]);
    case LLMProvider.DeepSeek:
      return _extract_openai_responses(response as Dict[]);
    case LLMProvider.MiniMax:
      return _extract_openai_responses(response as Dict[]);
    case LLMProvider.OpenRouter:
      if (isOpenRouterImageModel(llm))
        return _extract_openrouter_image_responses(response as Dict[]);
      return _extract_openrouter_chat_responses(response as Dict[]);
    default:
      if (
        Array.isArray(response) &&
        response.length > 0 &&
        (typeof response[0] === "string" ||
          (typeof response[0] === "object" && isImageResponseData(response[0])))
      )
        return response as LLMResponseData[];
      else
        throw new Error(
          `No method defined to extract responses for LLM ${llm}.`,
        );
  }
}

/**
 * Marge the 'responses' and 'raw_response' properties of two LLMResponseObjects,
 * keeping all the other params from the second argument (llm, query, etc).
 *
 * If one object is undefined or null, returns the object that is defined, unaltered.
 */
export function merge_response_objs(
  resp_obj_A: RawLLMResponseObject | undefined,
  resp_obj_B: RawLLMResponseObject | undefined,
): RawLLMResponseObject | undefined {
  if (!resp_obj_A && !resp_obj_B) {
    console.warn("Warning: Merging two undefined response objects.");
    return undefined;
  } else if (!resp_obj_B && resp_obj_A) return resp_obj_A;
  else if (!resp_obj_A && resp_obj_B) return resp_obj_B;
  resp_obj_A = resp_obj_A as RawLLMResponseObject; // required by typescript
  resp_obj_B = resp_obj_B as RawLLMResponseObject;
  const res: RawLLMResponseObject = {
    responses: resp_obj_A.responses.concat(resp_obj_B.responses),
    prompt: resp_obj_B.prompt,
    llm: resp_obj_B.llm,
    vars: resp_obj_B.vars ?? (resp_obj_B as any).info ?? {}, // backwards compatibility---vars used to be 'info'
    metavars: resp_obj_B.metavars ?? {},
    uid: resp_obj_B.uid,
  };
  // Reasoning lines up with responses, so a side without it gets nulls.
  if (resp_obj_A.reasoning || resp_obj_B.reasoning) {
    const reasoningOf = (o: RawLLMResponseObject) =>
      o.responses.map((_, i) => o.reasoning?.[i] ?? null);
    res.reasoning = reasoningOf(resp_obj_A).concat(reasoningOf(resp_obj_B));
  }
  if (resp_obj_A.reasoning_state || resp_obj_B.reasoning_state) {
    const stateOf = (o: RawLLMResponseObject) =>
      o.responses.map((_, i) => o.reasoning_state?.[i] ?? null);
    res.reasoning_state = stateOf(resp_obj_A).concat(stateOf(resp_obj_B));
  }
  if (resp_obj_B.chat_history !== undefined)
    res.chat_history = resp_obj_B.chat_history;
  return res;
}

export function mergeDicts(A?: Dict, B?: Dict): Dict | undefined {
  if (A === undefined && B === undefined) return undefined;
  else if (A === undefined) return B;
  else if (B === undefined) return A;
  const d: Dict = {};
  Object.entries(A).forEach(([key, val]) => {
    d[key] = val;
  });
  Object.entries(B).forEach(([key, val]) => {
    d[key] = val;
  });
  return d; // gives priority to B
}

/**
 * Filters and transforms the dictionary 'dict'. Returns a new dictionary with the transformed keys/values.
 * @param dict Dict to process
 * @param keyFilterFunc Optional. Filter function on whether to include the given key.
 * @param keyTransformFunc Optional. Function to transform the keys.
 * @param valTransformFunc Optional. Function to transform values for each key.
 * @returns
 */
export const transformDict = (
  dict: Dict,
  keyFilterFunc?: (key: string) => boolean,
  keyTransformFunc?: (key: string) => string,
  valTransformFunc?: (key: string, val: any) => any,
) => {
  return Object.keys(dict).reduce((acc, key) => {
    if (!keyFilterFunc || keyFilterFunc(key) === true)
      acc[keyTransformFunc ? keyTransformFunc(key) : key] = valTransformFunc
        ? valTransformFunc(key, dict[key])
        : dict[key];
    return acc;
  }, {} as Dict);
};

/** Extracts only the settings vars (of form like "=system_msg", starts with =) from a vars dict.
 * (This also removes the = at the start of the keys.)
 * NOTE: This does not typecast the values yet; that should be performed later on right before they are passed to the call_llm API call.
 *
 * Returns empty dict {} if no settings vars found.
 */
export const extractSettingsVars = (vars?: PromptVarsDict) => {
  if (
    vars !== undefined &&
    Object.keys(vars).some((k) => k.charAt(0) === "=")
  ) {
    return StringLookup.concretizeDict(
      transformDict(
        deepcopy(vars),
        (k) => k.charAt(0) === "=",
        (k) => k.substring(1),
      ),
    );
  } else return {};
};

export const extractMediaVars = (vars?: PromptVarsDict) => {
  if (vars === undefined) return {};

  const media_vars: Dict<LLMResponseData[]> = {};
  Object.entries(vars).forEach(([k, v]) => {
    if (
      Array.isArray(v) &&
      v.length > 0 &&
      v.some((i) => typeof i === "object" && "t" in i)
    ) {
      media_vars[k] = (v as PromptVarType[]).filter(
        (i) => typeof i === "object" && "t" in i,
      ) as LLMResponseData[];
    } else if (typeof v === "object" && v !== null && "t" in v) {
      media_vars[k] = [v];
    }
  });

  return media_vars;
};

export const areEqualLLMResponseData = (
  A: TemplateVarInfo | LLMResponseData | undefined,
  B: TemplateVarInfo | LLMResponseData | undefined,
): boolean => {
  if (A === undefined || B === undefined) {
    if (A === undefined && B === undefined) return true;
    return false;
  }
  if (typeof A !== typeof B) return false;
  if (typeof A === "string" || typeof A === "number") return A === B;
  else if (typeof A === "object" && typeof B === "object") {
    const keys_A = Object.keys(A);
    const keys_B = Object.keys(B);
    if (keys_A.length !== keys_B.length) return false;
    for (const k of keys_A) {
      // @ts-expect-error TS doesn't know that k is a key of A/B
      if (!(k in B) || A[k] !== B[k]) return false;
    }
    return true;
  }
  return false;
};

const areEqualPromptVarsDictValues = (
  A: LLMResponseData | PromptVarType[] | undefined,
  B: LLMResponseData | PromptVarType[] | undefined,
): boolean => {
  if (A === undefined || B === undefined) {
    if (A === undefined && B === undefined) return true;
    return false;
  }
  if (
    (Array.isArray(A) && !Array.isArray(B)) ||
    (!Array.isArray(A) && Array.isArray(B))
  )
    return false;
  else if (Array.isArray(A) && Array.isArray(B)) {
    if (A.length !== B.length) return false;
    for (let i = 0; i < A.length; i++) {
      if (!areEqualLLMResponseData(A[i], B[i])) return false;
    }
    return true;
  } else {
    return areEqualLLMResponseData(A as LLMResponseData, B as LLMResponseData);
  }
};

/**
 * Given two info vars dicts, detects whether any + all vars (keys) match values.
 */
export const areEqualVarsDicts = (
  A: PromptVarsDict | undefined,
  B: PromptVarsDict | undefined,
): boolean => {
  if (A === undefined || B === undefined) {
    if (A === undefined && B === undefined) return true;
    return false;
  }
  const keys_A = Object.keys(A);
  const keys_B = Object.keys(B);
  if (keys_A.length !== keys_B.length) return false;
  else if (keys_A.length === 0) return true;
  const all_vars = new Set(keys_A.concat(keys_B));
  for (const v of all_vars) {
    if (!(v in B) || !(v in A) || !areEqualPromptVarsDictValues(A[v], B[v]))
      return false;
  }
  return true;
};

export const processCSV = (csv: string): string[] => {
  const matches = csv.match(/(\s*"[^"]+"\s*|\s*[^,]+|,)(?=,|$)/g);
  if (!matches) return [csv];
  for (let n = 0; n < matches.length; ++n) {
    matches[n] = matches[n].trim();
    if (matches[n] === ",") matches[n] = "";
  }
  return matches.map((e) => e.trim()).filter((e) => e.length > 0);
};

export const countNumLLMs = (
  resp_objs_or_dict: RawLLMResponseObject[] | Dict,
): number => {
  const resp_objs = Array.isArray(resp_objs_or_dict)
    ? resp_objs_or_dict
    : Object.values(resp_objs_or_dict).flat();
  return new Set(
    resp_objs
      .filter((r) => typeof r !== "string" && r.llm !== undefined)
      .map((r) => r.llm?.key || r.llm),
  ).size;
};

export const setsAreEqual = (setA: Set<any>, setB: Set<any>): boolean => {
  if (setA.size !== setB.size) return false;
  const equal = true;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return equal;
};

export const deepcopy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const deepcopy_and_modify = (v: Dict, new_val_dict: Dict) => {
  const new_v = deepcopy(v);
  Object.entries(new_val_dict).forEach(([key, val]) => {
    new_v[key] = val;
  });
  return new_v;
};
export const dict_excluding_key = (d: Dict, key: string) => {
  if (!(key in d)) return d;
  const copy_d = { ...d };
  delete copy_d[key];
  return copy_d;
};

export const getLLMsInPulledInputData = (pulled_data: Dict) => {
  const found_llms: Dict = {};
  Object.values(pulled_data).forEach((_vs) => {
    const vs = Array.isArray(_vs) ? _vs : [_vs];
    vs.forEach((v) => {
      if (v?.llm !== undefined && !(v.llm.key in found_llms))
        found_llms[v.llm.key] = v.llm;
    });
  });
  return Object.values(found_llms);
};

export const stripLLMDetailsFromResponses = (
  resps: LLMResponse[],
): LLMResponse[] =>
  resps.map((r) => ({
    ...r,
    llm:
      (typeof r?.llm === "string" || typeof r?.llm === "number"
        ? StringLookup.get(r?.llm)
        : r?.llm?.name) ?? "undefined",
  }));

// NOTE: The typing is purposefully general since we are trying to cast to an expected format.
export const toStandardResponseFormat = (r: Dict | string) => {
  if (typeof r === "string" || typeof r === "number")
    return {
      vars: {},
      metavars: {},
      uid: uuid(),
      prompt: "",
      responses: [r],
      tokens: {},
    } as LLMResponse;
  const resp_obj: LLMResponse = {
    vars: r?.fill_history ?? {},
    metavars: r?.metavars ?? {},
    uid: r?.uid ?? r?.batch_id ?? uuid(),
    llm: r?.llm ?? undefined,
    prompt: r?.prompt ?? "",
    responses: [typeof r === "string" || typeof r === "number" ? r : r?.text],
    tokens: r?.raw_response?.usage ?? {},
  };
  if (r?.eval_res !== undefined) resp_obj.eval_res = r.eval_res;
  if (r?.chat_history !== undefined) resp_obj.chat_history = r.chat_history;
  // A single response, e.g. from a Prompt Node's output, whose reasoning
  // is a metavar: keep it (and its reasoning state) with the response.
  const reasoning = r?.metavars?.[REASONING_METAVAR];
  if (reasoning !== undefined && reasoning !== null)
    resp_obj.reasoning = [reasoning];
  if (r?.reasoning_state !== undefined)
    resp_obj.reasoning_state = [r.reasoning_state];
  return resp_obj;
};

// Check if the current browser window/tab is 'active' or not
export const browserTabIsActive = () => {
  try {
    const visible = document.visibilityState === "visible";
    return visible;
  } catch (e) {
    console.error(e);
    return true; // indeterminate
  }
};

export const tagMetadataWithLLM = (input_data: LLMResponsesByVarDict) => {
  const new_data: LLMResponsesByVarDict = {};
  Object.entries(input_data).forEach(([varname, resp_objs]) => {
    new_data[varname] = resp_objs.map((r) => {
      if (
        !r ||
        typeof r === "string" ||
        typeof r === "number" ||
        !r?.llm ||
        typeof r.llm === "string" ||
        typeof r.llm === "number" ||
        !r.llm.key
      )
        return r;
      const r_copy = JSON.parse(JSON.stringify(r));
      r_copy.metavars.__LLM_key = r.llm.key;
      return r_copy;
    });
  });
  return new_data;
};

export const extractLLMLookup = (
  input_data: Dict<
    (StringOrHash | TemplateVarInfo | BaseLLMResponseObject | LLMResponse)[]
  >,
) => {
  const llm_lookup: Dict<StringOrHash | LLMSpec> = {};
  Object.values(input_data).forEach((resp_objs) => {
    resp_objs.forEach((r) => {
      const llm_name =
        typeof r === "string" || typeof r === "number"
          ? undefined
          : !r.llm || typeof r.llm === "string" || typeof r.llm === "number"
            ? StringLookup.get(r.llm)
            : r.llm.key;
      if (
        typeof r === "string" ||
        typeof r === "number" ||
        !r.llm ||
        !llm_name ||
        llm_name in llm_lookup
      )
        return;
      llm_lookup[llm_name] = r.llm;
    });
  });
  return llm_lookup;
};

export const removeLLMTagFromMetadata = (metavars: Dict) => {
  if (!("__LLM_key" in metavars)) return metavars;
  const mcopy = JSON.parse(JSON.stringify(metavars));
  delete mcopy.__LLM_key;
  return mcopy;
};

export const truncStr = (
  s: string | undefined,
  maxLen: number,
): string | undefined => {
  if (s === undefined) return s;
  if (s.length > maxLen)
    // Cut the name short if it's long
    return s.substring(0, maxLen) + "...";
  else return s;
};

export const groupResponsesBy = <T>(
  responses: T[],
  keyFunc: (item: T) => string | number | null | undefined,
): [Dict<T[]>, T[]] => {
  const responses_by_key: Dict<T[]> = {};
  const unspecified_group: T[] = [];
  responses.forEach((item) => {
    const key = keyFunc(item);
    if (key === null || key === undefined) {
      unspecified_group.push(item);
      return;
    }
    if (key in responses_by_key) responses_by_key[key].push(item);
    else responses_by_key[key] = [item];
  });
  return [responses_by_key, unspecified_group];
};

/**
 * Merges inner .responses and eval_res.items properties for LLMResponses with the same
 * uid, returning the (smaller) list of merged items.
 * @param responses
 * @returns
 */
export const batchResponsesByUID = (
  responses: LLMResponse[],
): LLMResponse[] => {
  const [batches, unspecified_id_group] = groupResponsesBy(
    responses,
    (resp_obj) => resp_obj.uid,
  );
  return Object.values(batches)
    .map((resp_objs: LLMResponse[]) => {
      if (resp_objs.length === 1) {
        return resp_objs[0];
      } else {
        const batched = deepcopy_and_modify(resp_objs[0], {
          responses: resp_objs.map((resp_obj) => resp_obj.responses).flat(),
        }) as LLMResponse;
        if (batched.eval_res?.items !== undefined) {
          batched.eval_res.items = resp_objs
            .map((resp_obj) => resp_obj?.eval_res?.items as EvaluationScore[])
            .flat();
        }
        return batched;
      }
    })
    .concat(unspecified_id_group);
};

export function llmResponseDataToString(data: LLMResponseData): string {
  if (typeof data === "string") return data;
  else if (typeof data === "number")
    return StringLookup.get(data) ?? "(string lookup failed)";
  else return data?.d;
}

/**
 * Naive method to sample N items at random from an array.
 * @param arr an array of items
 * @param num_sample the number of items to sample
 * @returns The sampled elements of the array (unmodified).
 */
export function sampleRandomElements(arr: any[], num_sample: number): any[] {
  if (num_sample >= arr.length) return arr; // nothing to do

  // Find num_sample unique indexes
  const idxs: Set<number> = new Set();
  while (idxs.size < num_sample) {
    // Pick an index at random
    const idx = Math.floor(Math.random() * arr.length);

    // If it's already chosen, continue
    if (idxs.has(idx)) continue;

    // Otherwise, add to sample
    idxs.add(idx);
  }

  // Return the items at the sampled indexes
  return Array.from(idxs).map((idx) => arr[idx]);
}

export const getVarsAndMetavars = (input_data: Dict): VarsContext => {
  // Find all vars and metavars in the input data (if any):
  // NOTE: The typing is purposefully general for some backwards compatibility concenrs.
  const varnames = new Set<string>();
  const metavars = new Set<string>();

  const add_from_resp_obj = (resp_obj: Dict) => {
    if (typeof resp_obj === "string") return;
    if (resp_obj?.fill_history)
      Object.keys(resp_obj.fill_history).forEach((v) => varnames.add(v));
    else if (resp_obj?.vars)
      Object.keys(resp_obj.vars).forEach((v) => varnames.add(v));
    if (resp_obj.metavars)
      Object.keys(resp_obj.metavars).forEach((v) => metavars.add(v));
    else if (resp_obj.meta)
      Object.keys(resp_obj.meta).forEach((v) => metavars.add(v));
  };

  if (Array.isArray(input_data)) input_data.forEach(add_from_resp_obj);
  else {
    Object.entries(input_data).forEach(([key, obj]: [string, Dict[]]) => {
      if (key !== "__input") varnames.add(key); // A "var" can also be other properties on input_data
      obj.forEach(add_from_resp_obj);
    });
  }

  return {
    vars: Array.from(varnames),
    metavars: Array.from(metavars),
  };
};

/**
 * Retries a func 'func' N times.
 * @param func
 * @param numTimes
 */
export async function retryAsyncFunc<T>(
  func: () => Promise<T>,
  numTimes: number,
): Promise<T> {
  if (numTimes < 1)
    throw new Error("Negative numTimes encountered when calling 'retry'.");

  try {
    // Attempt to execute the function
    return await func();
  } catch (error) {
    if (numTimes <= 1) {
      // If no more retries are left, throw the last error
      throw error;
    }
    // If there are retries left, retry the function:
    return retryAsyncFunc(func, numTimes - 1);
  }
}

// Filters internally used keys LLM_{idx} and __{str} from metavar dictionaries.
// This method is used to pass around information hidden from the user.
export function cleanMetavarsFilterFunc(key: string) {
  // Reasoning is long text, which isn't useful to group or plot by.
  return !(
    key.startsWith("LLM_") ||
    key.startsWith("__pt") ||
    key === REASONING_METAVAR
  );
}

/** The reasoning of the response at `index` of a response object, if it has any. */
export function reasoningAt(
  resp_obj: { reasoning?: (StringOrHash | null)[] },
  index: number,
): string | undefined {
  const r = resp_obj.reasoning?.[index];
  return (typeof r === "number" ? StringLookup.get(r) : r) || undefined;
}

/**
 * The metavars for the response at `index` of a response object, with that
 * response's reasoning (if any) under REASONING_METAVAR. Without reasoning,
 * returns `metavars` itself, unchanged.
 */
export function withReasoningMetavar<T extends Dict>(
  metavars: T,
  resp_obj: { reasoning?: (StringOrHash | null)[] },
  index: number,
): T {
  const text = reasoningAt(resp_obj, index);
  return text ? { ...metavars, [REASONING_METAVAR]: text } : metavars;
}

/**
 * Metavars without REASONING_METAVAR: for a new response, whose metavars would
 * otherwise carry an earlier model's reasoning as though it were its own.
 */
export function withoutReasoningMetavar<T extends Dict>(metavars: T): T {
  if (!(REASONING_METAVAR in metavars)) return metavars;
  const rest: Dict = { ...metavars };
  delete rest[REASONING_METAVAR];
  return rest as T;
}

// Verify data integrity: check that uids are present for all responses.
// If they are not present, add it and note the discrepency.
// NOTE: This modifies the dictionary in place.
export function repairCachedResponses(
  data: Dict,
  storageKey: string,
  itemSelector?: (data: Dict) => Dict,
): Dict {
  let repaired = false;
  const d = itemSelector ? itemSelector(data) : data;
  Object.values(d).forEach((val) => {
    const resps = Array.isArray(val) ? val : [val];
    resps.forEach((r) => {
      if (r.uid === undefined) {
        r.uid = uuid();
        repaired = true;
      }
    });
  });

  if (repaired) {
    // The data did not include uids. Flash it back to the cache to repair.
    // This maintains consistency across re-runs.
    StorageCache.store(storageKey, data);
  }

  return data;
}

/**
 * Generates a function that can be called to debounce another function,
 * inside a React component. Note that it requires passing (and capturing) a React ref using useRef.
 * The ref is used so that when the function is called multiple times; it will 'debounce' --cancel any pending call.
 * @param ref An empty React ref from useRef
 * @returns A debounce function of signature (func: Func, delay: number), taking an arbitrary function and delay in milliseconds
 */
export const genDebounceFunc = (
  ref: React.MutableRefObject<null | NodeJS.Timeout>,
) => {
  return (func: Func, delay: number) => {
    return (...args: any[]) => {
      if (ref?.current) {
        clearTimeout(ref.current);
      }
      ref.current = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };
};
export type DebounceRef = React.MutableRefObject<NodeJS.Timeout | null>;

// Thanks to AmerllicA on SO: https://stackoverflow.com/a/61226119
export const blobToBase64 = (blob: Blob): Promise<string> => {
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  return new Promise((resolve, reject) => {
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res.substring(res.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Error reading file"));
  });
};

export const base64ToBlob = (b64: string, type = "image/png"): Blob => {
  const byteString = atob(b64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type });
};

export const compressBase64Image = (b64: string): Promise<string> => {
  // Convert base64 to Blob. Compress asynchronously, then convert back to base64.
  return fetch(`data:image/png;base64,${b64}`)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          /* eslint-disable no-new */
          new Compressor(blob, {
            success: resolve,
            error: reject,
          });
        }),
    )
    .then((compressedBlob) => blobToBase64(compressedBlob as Blob));
};

/**
 * Extends array `a` with the values of `b`.
 * @param a The array to extend (in-place).
 * @param b The array to add to the end of `a`.
 * @returns `a`, extended.
 */
export const extendArray = <T>(a: Array<T>, b: Array<T>): Array<T> => {
  for (const i in b) {
    a.push(b[i]);
  }
  return a;
};

/**
 * Extends the array `key` in a dict with `values`, creating a new array if the key is missing.
 * @param dict The dictionary to extend (in-place).
 * @param key The key of the dictionary.
 * @param values The new array to append to the end of the dict value for `key`.
 */
export const extendArrayDict = <K extends string | number | symbol, V>(
  dict: Record<K, V[]>,
  key: K,
  values: V[],
): void => {
  if (!dict[key]) {
    dict[key] = [];
  }
  extendArray(dict[key], values);
};

/** Ensure that a name is 'unique'; if not, return an amended version with a count tacked on (e.g. "GPT-4 (2)") */
export const ensureUniqueName = (_name: string, _prev_names: string[]) => {
  // Strip whitespace around names
  const prev_names = _prev_names.map((n) => n.trim());
  const name = _name.trim();

  // Check if name is unique
  if (!prev_names.includes(name)) return name;

  // Name isn't unique; find a unique one:
  let i = 2;
  let new_name = `${name} (${i})`;
  while (prev_names.includes(new_name)) {
    i += 1;
    new_name = `${name} (${i})`;
  }
  return new_name;
};

/**
 * Converts a Blob or File to a Data URL.
 * @param input The Blob or File to convert.
 * @returns A Promise that resolves with the Data URL string.
 */
export function blobOrFileToDataURL(input: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result); // full data URL
      } else {
        throw new Error("Failed to convert Blob/File to Data URL.");
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(input);
  });
}

/**
 * Converts a Data URL to a Blob.
 * @param dataURL The Data URL to convert.
 * @returns A Blob object representing the data.
 */
export function dataURLToBlob(dataURL: string): Blob {
  const [meta, base64] = dataURL.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const byteString = atob(base64);
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  return new Blob([byteArray], { type: mime });
}

/**
 * Extracts the MIME type from a Data URL.
 * @param dataUrl The Data URL to extract the MIME type from.
 * @returns The MIME type as a string, or null if not found.
 */
function getMimeTypeFromDataURL(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/);
  return match ? match[1] : null;
}

function getBase64DataFromDataURL(dataUrl: string): string | null {
  return dataUrl.substring(dataUrl.indexOf(",") + 1);
}

// This function takes a string as argument that represents either :
//  - a local path
//  - a URL
//  - a base64 encoded string
// and return ithe following infos about the image:
//  - size : the size of the image in bytes
//  - width : the width of the image in pixels
//  - height : the height of the image in pixels
//  - type : the type of the image (png, jpeg, ...)
export const get_image_infos = (image: string): Dict<string> => {
  const infos: Dict<string> = {
    size: "",
    width: "",
    height: "",
    type: "",
  };

  if (image.startsWith("data:image")) {
    // Base64 image
    const base64 = image.split(",")[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes.buffer], { type: "image/png" });
    infos.size = blob.size.toString();
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    infos.width = img.width.toString();
    infos.height = img.height.toString();
    URL.revokeObjectURL(url);
  } else {
    // URL or local path
    const img = new Image();
    img.src = image;
    infos.width = img.width.toString();
    infos.height = img.height.toString();
  }

  return infos;
};

export const __http_url_to_base64 = (url: string) => {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = () => {
      if (xhr.status === 200) {
        const base64String = btoa(
          new Uint8Array(xhr.response).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            "",
          ),
        );
        resolve(base64String);
      } else {
        reject(new Error("Failed to load image"));
      }
    };
    xhr.onerror = () => reject(new Error("Failed to load image"));
    xhr.send();
  });
};

export const stripWrappingQuotes = (str: string) => {
  if (
    typeof str === "string" &&
    str.length >= 2 &&
    str.charAt(0) === '"' &&
    str.charAt(str.length - 1) === '"'
  )
    return str.substring(1, str.length - 1);
  else return str;
};

export const accuracyToColor = (acc: number) => {
  if (acc > 0.9) return "green";
  else if (acc > 0.7) return "yellow";
  else if (acc > 0.5) return "orange";
  else return "red";
};

export const cmatrixTextAnnotations = (
  x: string[],
  y: string[],
  z: number[][],
) => {
  const annotations = [];
  const midVal = Math.max(...z.flat());
  for (let i = 0; i < y.length; i++) {
    for (let j = 0; j < x.length; j++) {
      annotations.push({
        xref: "x1",
        yref: "y1",
        x: x[j],
        y: y[i],
        text: z[i][j].toString(),
        font: {
          // family: "monospace",
          // size: 12,
          color: z[i][j] < midVal ? "white" : "black",
        },
        showarrow: false,
      });
    }
  }
  return annotations as Partial<Annotations>[];
};

/**
 * Adds a hashtag prefix to template variables in a string.
 * Converts unescaped templates of the form {template} to {#template}.
 * Ignores escaped braces like \{ and \}.
 *
 * @param input - The input string containing templates
 * @returns The string with templates converted to hashtagged form
 */
export function hashtagTemplateVars(input: string): string {
  let result = "";
  let i = 0;

  while (i < input.length) {
    // Check for escaped braces
    if (
      input[i] === "\\" &&
      i + 1 < input.length &&
      (input[i + 1] === "{" || input[i + 1] === "}")
    ) {
      // Add the escape character and the brace
      result += input[i] + input[i + 1];
      i += 2;
    }
    // Check for opening brace of a template (that isn't already hashtagged)
    else if (input[i] === "{" && i + 1 < input.length && input[i + 1] !== "#") {
      // Add the opening brace and the hashtag
      result += "{#";
      i++;
    }
    // Regular character
    else {
      result += input[i];
      i++;
    }
  }

  return result;
}
