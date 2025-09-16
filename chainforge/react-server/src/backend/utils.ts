// from typing import Dict, Tuple, List, Union, Optional
// import json, os, time, asyncio
// from string import Template

// from chainforge.promptengine.models import LLM
import React from "react";
import { LLM, LLMProvider, NativeLLM, getProvider } from "./models";
import {
  Dict,
  LLMAPICall,
  RawLLMResponseObject,
  ChatHistory,
  ChatMessage,
  HuggingFaceChatHistory,
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

import {
  Configuration as OpenAIConfig,
  OpenAIApi,
  CreateImageRequest,
  ImagesResponseDataInner,
} from "openai";
import {
  OpenAIClient as AzureOpenAIClient,
  AzureKeyCredential,
} from "@azure/openai";
import {
  GenerateContentConfig,
  GoogleGenAI,
  PartListUnion,
} from "@google/genai";
import { UserForcedPrematureExit } from "./errors";
import {
  fromModelId,
  ChatMessage as BedrockChatMessage,
} from "@mirai73/bedrock-fm";
import StorageCache, { StringLookup, MediaLookup } from "./cache";
import Compressor from "compressorjs";
import { Annotations } from "plotly.js";
// import { Models } from "@mirai73/bedrock-fm/lib/bedrock";

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
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
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
let ALEPH_ALPHA_API_KEY = get_environ("ALEPH_ALPHA_API_KEY");
let ALEPH_ALPHA_BASE_URL = get_environ("ALEPH_ALPHA_BASE_URL");
let AWS_ACCESS_KEY_ID = get_environ("AWS_ACCESS_KEY_ID");
let AWS_SECRET_ACCESS_KEY = get_environ("AWS_SECRET_ACCESS_KEY");
let AWS_SESSION_TOKEN = get_environ("AWS_SESSION_TOKEN");
let AWS_REGION = get_environ("AWS_REGION");
let TOGETHER_API_KEY = get_environ("TOGETHER_API_KEY");
let DEEPSEEK_API_KEY = get_environ("DEEPSEEK_API_KEY");

/**
 * Sets the local API keys for the revelant LLM API(s).
 */
export function set_api_keys(api_keys: Dict<string>): void {
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
  if (key_is_present("AlephAlpha")) ALEPH_ALPHA_API_KEY = api_keys.AlephAlpha;
  if (key_is_present("AlephAlpha_BaseURL"))
    ALEPH_ALPHA_BASE_URL = api_keys.AlephAlpha_BaseURL;
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
      return { type: "text", text: text };
    case "gemini":
      return { text: text };
    case "anthropic":
      return { type: "text", text: text };
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
  if (!OPENAI_API_KEY)
    throw new Error(
      "Could not find an OpenAI API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  const configuration = new OpenAIConfig({
    apiKey: API_KEY ?? OPENAI_API_KEY,
    basePath: BASE_URL ?? OPENAI_BASE_URL ?? undefined,
  });

  // Since we are running client-side, we need to remove the user-agent header:
  delete configuration.baseOptions.headers["User-Agent"];

  const openai = new OpenAIApi(configuration);

  const modelname: string = model.toString();

  // Remove empty params
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
    openai_call = openai.createCompletion.bind(openai);
    query.prompt = prompt;
  } else {
    // Create call to chat model
    openai_call = openai.createChatCompletion.bind(openai);

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
    const completion = await openai_call(query);
    response = completion.data;
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.error?.message);
      // throw new Error(error.response.status);
    } else {
      console.log(error?.message || error);
      throw new Error(error?.message || error);
    }
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
 * Calls OpenAI Image models via OpenAI's API.
   @returns raw query and response JSON dicts.
 */
export async function call_openai_image_gen(
  prompt: string,
  model: LLM,
  n = 1,
  temperature: number,
  params?: Dict,
  should_cancel?: () => boolean,
): Promise<[Dict, Dict]> {
  if (!OPENAI_API_KEY)
    throw new Error(
      "Could not find an OpenAI API key. Double-check that your API key is set in Settings or in your local environment.",
    );

  const configuration = new OpenAIConfig({
    apiKey: OPENAI_API_KEY,
  });
  // Since we are running client-side, we need to remove the user-agent header:
  delete configuration.baseOptions.headers["User-Agent"];
  const openai = new OpenAIApi(configuration);

  const modelname = model.toString();
  console.log(
    `Querying OpenAI image model '${model}' with prompt '${prompt}'...`,
  );

  const query: Dict = {
    prompt,
    model: modelname,
    size: params?.size ?? "auto",
  };

  if (modelname.includes("gpt-image") && params) {
    // Pass in GPT-Image-1 specific settings
    Object.entries(params).forEach(([key, value]) => {
      query[key] = value;
    });
  }
  if (modelname.includes("dall-e-3")) {
    // Pass in DALLE-3 specific settings
    if (params?.quality) query.quality = params.quality;
    if (params?.style) query.style = params.style;
  }
  if (modelname.startsWith("dall-e")) {
    query.response_format = "b64_json"; // request image in base-64 encoded string
  }

  // Try to call OpenAI
  // Since n doesn't work for DALLE3, we must repeat call n times if n > 1, waiting for each response to come in:
  const responses: Array<Dict> = [];
  while (responses.length < n) {
    // Abort if canceled
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    let response: Dict = {};
    try {
      const completion = await openai.createImage(query as CreateImageRequest);
      response = completion.data.data[0];
      responses.push(response);
    } catch (error: any) {
      if (error?.response) {
        throw new Error(error.response.data?.error?.message);
        // throw new Error(error.response.status);
      } else {
        console.log(error?.message || error);
        throw new Error(error?.message || error);
      }
    }
  }

  return [query, responses];
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

  const client = new AzureOpenAIClient(
    AZURE_OPENAI_ENDPOINT,
    new AzureKeyCredential(AZURE_OPENAI_KEY),
  );

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

  // Setup the args for the query
  const query: Dict = {
    n,
    temperature,
    ...params, // 'the rest' of the settings, passed from the front-end settings
  };
  let arg2: Array<Dict | string>;
  let openai_call: any;
  if (model_type === "text-completion") {
    openai_call = client.getCompletions.bind(client);
    arg2 = [prompt];
  } else {
    openai_call = client.getChatCompletions.bind(client);
    arg2 = construct_chat_history(prompt, images, chat_history, system_msg);
  }

  let response: Dict = {};
  try {
    response = await openai_call(deployment_name, arg2, query);
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.error?.message);
    } else {
      throw new Error(error?.message || error);
    }
  }

  return [query, response];
}

function is_newer_anthropic_model(model: LLM) {
  return model.startsWith("claude-2.1") || model.startsWith("claude-3");
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
    if (params?.tool_choice === undefined) params.tool_choice = { type: "any" };
    params.tool_choice.disable_parallel_tool_use = !params.parallel_tool_calls;
    delete params?.parallel_tool_calls;
  }

  // Detect whether to use old text completions or new messaging API
  const use_messages_api = is_newer_anthropic_model(model);

  // Carry chat history
  // :: See https://docs.anthropic.com/claude/docs/human-and-assistant-formatting#use-human-and-assistant-to-put-words-in-claudes-mouth
  let chat_history: ChatHistory | undefined = params?.chat_history;
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
    query.max_tokens = max_tokens_to_sample; // this goes by a different name than text completions
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
      gemini_config[val] = query[key];
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
        parts: [{ text: chat_msg.content }],
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

  while (responses.length < n) {
    if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

    const chat = gemini_client.chats.create({
      model,
      history: gemini_chat_history.history,
      config: gemini_config,
    });

    const chat_response = await chat.sendMessage({ message: prompt_parts });

    responses.push({
      text: chat_response.text,
      candidates: chat_response.candidates,
      promptFeedback: chat_response.promptFeedback,
    });
  }

  return [query, responses];
}

export async function call_huggingface(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  // Whether we should notice a given param in 'params'
  const param_exists = (p: any) =>
    p !== undefined &&
    !(
      (typeof p === "number" && p < 0) ||
      (typeof p === "string" && p.trim().length === 0)
    );
  const set_param_if_exists = (name: string, query: Dict) => {
    if (!params || params.size === 0) return;
    const p = params[name];
    const exists = param_exists(p);
    if (exists) {
      // Set the param on the query dict
      query[name] = p;
    }
  };

  let num_continuations = 0;
  if (
    params?.num_continuations !== undefined &&
    typeof params.num_continuations === "number"
  )
    num_continuations = params.num_continuations;

  const query: Dict = {
    temperature,
  };
  set_param_if_exists("top_k", query);
  set_param_if_exists("top_p", query);
  set_param_if_exists("repetition_penalty", query);

  const options = {
    use_cache: false, // we want it generating fresh each time
  };
  set_param_if_exists("use_cache", options);

  // Carry over chat history if (a) we're using a chat model and (b) if it exists, converting to HF format.
  // :: See https://huggingface.co/docs/api-inference/detailed_parameters#conversational-task
  const model_type: string = params?.model_type;
  const hf_chat_hist: HuggingFaceChatHistory = {
    past_user_inputs: [],
    generated_responses: [],
  };
  if (model_type === "chat") {
    if (params?.chat_history !== undefined) {
      for (const chat_msg of params.chat_history as ChatHistory) {
        if (chat_msg.role === "user")
          hf_chat_hist.past_user_inputs = hf_chat_hist.past_user_inputs.concat(
            chat_msg.content,
          );
        else if (chat_msg.role === "assistant")
          hf_chat_hist.generated_responses =
            hf_chat_hist.generated_responses.concat(chat_msg.content);
        // ignore system messages
      }
    }
  } else {
    // Text generation-only parameters:
    set_param_if_exists("max_new_tokens", query);
    set_param_if_exists("do_sample", options);
    query.return_full_text = false; // we never want it to include the prompt in the response
  }

  const using_custom_model_endpoint: boolean = param_exists(
    params?.custom_model,
  );

  const headers: Dict<string> = { "Content-Type": "application/json" };
  // For HuggingFace, technically, the API keys are optional.
  if (HUGGINGFACE_API_KEY !== undefined)
    headers.Authorization = `Bearer ${HUGGINGFACE_API_KEY}`;

  // Inference Endpoints for text completion models has the same call,
  // except the endpoint is an entire URL. Detect this:
  const url =
    using_custom_model_endpoint && params?.custom_model.startsWith("https:")
      ? params.custom_model
      : `https://api-inference.huggingface.co/models/${
          using_custom_model_endpoint ? params?.custom_model.trim() : model
        }`;

  const responses: Array<Dict> = [];
  while (responses.length < n) {
    const continued_response: Dict = { generated_text: "" };
    let curr_cont = 0;
    let curr_text = prompt;

    while (curr_cont <= num_continuations) {
      // Abort if user canceled the query operation
      if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

      const inputs =
        model_type === "chat"
          ? {
              text: curr_text,
              past_user_inputs: hf_chat_hist.past_user_inputs,
              generated_responses: hf_chat_hist.generated_responses,
            }
          : curr_text;

      // Call HuggingFace inference API
      const response = await fetch(url, {
        headers,
        method: "POST",
        body: JSON.stringify({
          inputs,
          parameters: query,
          options,
        }),
      });
      const result = await response.json();

      // HuggingFace sometimes gives us an error, for instance if a model is loading.
      // It returns this as an 'error' key in the response:
      if (result?.error !== undefined) throw new Error(result.error);
      else if (
        (model_type !== "chat" &&
          (!Array.isArray(result) || result.length !== 1)) ||
        (model_type === "chat" &&
          (Array.isArray(result) ||
            !result ||
            result?.generated_text === undefined))
      )
        throw new Error(
          "Result of HuggingFace API call is in unexpected format:" +
            JSON.stringify(result),
        );

      // Merge responses
      const resp_text: string =
        model_type === "chat"
          ? result.generated_text
          : result[0].generated_text;

      continued_response.generated_text += resp_text;
      curr_text += resp_text;
      curr_cont += 1;
    }

    // Continue querying
    responses.push(continued_response);
  }

  return [query, responses];
}

export async function call_alephalpha(
  prompt: string,
  model: LLM,
  n = 1,
  temperature = 1.0,
  params?: Dict,
  should_cancel?: () => boolean,
  images?: string[],
): Promise<[Dict, Dict]> {
  if (!ALEPH_ALPHA_API_KEY)
    throw Error(
      "Could not find an API key for Aleph Alpha models. Double-check that your API key is set in Settings or in your local environment.",
    );

  const isChatModel = params?.chat_model ?? false;
  const base_url = ALEPH_ALPHA_BASE_URL ?? "https://api.aleph-alpha.com";
  const endpoint = isChatModel ? "chat/completions" : "complete";
  const url = `${base_url}/${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${ALEPH_ALPHA_API_KEY}`,
  };

  const requestPayload: Dict = {
    model: model.toString(),
    temperature,
    n,
    ...params,
  };

  if (isChatModel) {
    const chatHistory = construct_chat_history(
      prompt,
      images,
      params?.chat_history,
      params?.system_msg,
    );
    requestPayload.messages = chatHistory;
  } else {
    requestPayload.prompt = prompt;
  }

  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(requestPayload),
  });

  const result = await response.json();

  // Extract responses based on model type
  const responses = isChatModel
    ? result.choices?.map((x: any) => x.message.content)
    : result.completions?.map((x: any) => x.completion);

  return [requestPayload, responses];
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
    n_images = query.messages.filter(
      (msg: Dict) => msg.role === "user" && msg.images.length > 0,
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

/** Convert OpenAI chat history to Bedrock format */
function to_bedrock_chat_history(
  chat_history: ChatHistory,
): BedrockChatMessage[] {
  const role_map: Dict<string> = {
    assistant: "ai",
    user: "human",
  };

  // Transform the ChatMessage format in the chat_history array to what is expected by Bedrock
  return chat_history.map((msg) =>
    transformDict(
      msg,
      undefined,
      (key) => (key === "content" ? "message" : key),
      (key: string, val: string): string => {
        if (key === "role") return val in role_map ? role_map[val] : val;
        return val;
      },
    ),
  ) as BedrockChatMessage[];
}

/**
 * Calls Bedrock models via Bedrock's API.
   @returns raw query and response JSON dicts.
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
  if (
    !AWS_ACCESS_KEY_ID ||
    !AWS_SECRET_ACCESS_KEY ||
    !AWS_SESSION_TOKEN ||
    !AWS_REGION
  ) {
    throw new Error(
      "Could not find credentials value for the Bedrock API. Double-check that your AWS Credentials are set in Settings or in your local environment.",
    );
  }

  const modelName: string = model.toString();
  let stopWords = [];
  if (
    params?.stop_sequences !== undefined &&
    Array.isArray(params.stop_sequences && params.stop_sequences.length > 0)
  ) {
    stopWords = params?.stop_sequences;
  }
  const bedrockConfig = {
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      sessionToken: AWS_SESSION_TOKEN,
    },
    region: AWS_REGION,
  };

  delete params?.stop_sequences;

  const query: Dict = {
    stopSequences: stopWords,
    temperature,
  };

  const fm = fromModelId(modelName, {
    region: bedrockConfig.region,
    credentials: bedrockConfig.credentials,
    ...query,
  });

  const responses: string[] = [];
  try {
    // Collect n responses, one at a time
    while (responses.length < n) {
      // Abort if the user canceled
      if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();

      // Grab the response
      let response: string;
      if (
        modelName.startsWith("anthropic") ||
        modelName.startsWith("mistral") ||
        modelName.startsWith("meta")
      ) {
        const chat_history: ChatHistory = construct_chat_history(
          prompt,
          images,
          params?.chat_history,
          params?.system_msg,
        );

        response = (
          await fm.chat(to_bedrock_chat_history(chat_history), {
            modelArgs: { ...(params as Map<string, any>) },
          })
        ).message;
      } else {
        response = await fm.generate(prompt, {
          modelArgs: { ...(params as Map<string, any>) },
        });
      }
      responses.push(response);
    }
  } catch (error: any) {
    throw new Error(error?.message ?? error.toString());
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

  // Together.ai uses OpenAI's API, so we can use the OpenAI API client to make the call:
  const configuration = new OpenAIConfig({
    apiKey: TOGETHER_API_KEY,
    basePath: togetherBaseUrl,
  });

  // Since we are running client-side, we need to remove the user-agent header:
  delete configuration.baseOptions.headers["User-Agent"];

  const together = new OpenAIApi(configuration);

  // Strip the "together/" prefix:
  const modelname: string = model.toString().substring(9);
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
  const together_call: any = together.createChatCompletion.bind(together);

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
    const completion = await together_call(query);
    response = completion.data;
  } catch (error: any) {
    if (error?.response) {
      throw new Error(error.response.data?.error?.message);
      // throw new Error(error.response.status);
    } else {
      console.log(error?.message || error);
      throw new Error(error?.message || error);
    }
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
    if (llm_name.startsWith("dall-e") || llm_name.startsWith("gpt-image"))
      call_api = call_openai_image_gen;
    else call_api = call_chatgpt;
  } else if (llm_provider === LLMProvider.Azure_OpenAI)
    call_api = call_azure_openai;
  else if (llm_provider === LLMProvider.Google) call_api = call_google_ai;
  else if (llm_provider === LLMProvider.Anthropic) call_api = call_anthropic;
  else if (llm_provider === LLMProvider.HuggingFace)
    call_api = call_huggingface;
  else if (llm_provider === LLMProvider.Aleph_Alpha) call_api = call_alephalpha;
  else if (llm_provider === LLMProvider.Ollama) call_api = call_ollama_provider;
  else if (llm_provider === LLMProvider.Custom) call_api = call_custom_provider;
  else if (llm_provider === LLMProvider.Bedrock) call_api = call_bedrock;
  else if (llm_provider === LLMProvider.Together) call_api = call_together;
  else if (llm_provider === LLMProvider.DeepSeek) call_api = call_deepseek;
  if (call_api === undefined)
    throw new Error(
      `Adapter for Language model ${llm} and ${llm_provider} not found`,
    );
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

function _extract_google_ai_responses(
  response: Dict,
  llm: LLM | string,
): Array<string> {
  return _extract_gemini_responses(response as Array<Dict>);
}

/**
 * Extracts the text part of a 'EnhancedGenerateContentResponse' object from Google Gemini `sendChat` or `chat`.
 */
function _extract_gemini_responses(completions: Array<Dict>): Array<string> {
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
        // Unknown type of message
        else
          throw Error(
            `Unknown type '${c?.type}' of message found in Anthropic response. If this is a new type, raise an Issue on the ChainForge Github.`,
          );
      })
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
 * Extracts the text part of a HuggingFace text completion.
 */
function _extract_huggingface_responses(response: Array<Dict>): Array<string> {
  return response.map((r: Dict) => r.generated_text?.trim());
}

/**
 * Extracts the text part of a Aleph Alpha text completion.
 */
function _extract_alephalpha_responses(response: Dict): Array<string> {
  return response.map((r: string) => r.trim());
}

/**
 * Extracts the text part of a Ollama text completion.
 */
function _extract_ollama_responses(
  response: Array<Dict>,
): Array<LLMResponseData> {
  return response.map((r: any) => r.generated_text?.trim());
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
      if (llm_name.startsWith("dall-e") || llm_name.startsWith("gpt-image"))
        return _extract_openai_image_responses(
          response as Array<ImagesResponseDataInner>,
        );
      else if (llm_name.includes("davinci") || llm_name.includes("instruct"))
        return _extract_openai_completion_responses(response);
      else return _extract_chatgpt_responses(response);
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
    case LLMProvider.Aleph_Alpha:
      return _extract_alephalpha_responses(response);
    case LLMProvider.Ollama:
      return _extract_ollama_responses(response as Dict[]);
    case LLMProvider.Bedrock:
      return response as Array<string>;
    case LLMProvider.Together:
      return _extract_openai_responses(response as Dict[]);
    case LLMProvider.DeepSeek:
      return _extract_openai_responses(response as Dict[]);
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
  return !(key.startsWith("LLM_") || key.startsWith("__pt"));
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
