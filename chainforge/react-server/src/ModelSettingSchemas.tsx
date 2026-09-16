/**
 * A place to put all models supported by ChainForge and their
 * settings as react-jsonschema-form JSON schemas.
 * The schemas describe the structure of HTML settings forms for that specific model.
 *
 * By convention, the key used for a 'property' should be the exact same
 * parameter name in the back-end for that API call (e.g., 'top_k' for OpenAI chat completions)
 * All properties that refer to temperature must use the key 'temperature'.
 *
 * Descriptions of OpenAI model parameters copied from OpenAI's official chat completions documentation: https://platform.openai.com/docs/models/model-endpoint-compatibility
 */

import {
  LLMProvider,
  MAX_CONCURRENT,
  NativeLLM,
  RATE_LIMIT_BY_MODEL,
  getProvider,
  isGeminiImageModel,
  isOpenAIImageModel,
  isOpenRouterImageModel,
} from "./backend/models";
import {
  Dict,
  JSONCompatible,
  CustomLLMProviderSpec,
  ModelSettingsDict,
  LLMSpec,
} from "./backend/typing";
import { transformDict } from "./backend/utils";
import useStore from "./store";

const UI_SUBMIT_BUTTON_SPEC = {
  props: {
    disabled: false,
    className: "mantine-UnstyledButton-root mantine-Button-root",
  },
  norender: false,
  submitText: "Submit",
} satisfies Dict;

const ChatGPTSettings: ModelSettingsDict = {
  fullName: "GPT-3.5+ (OpenAI)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "GPT3.5",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select an OpenAI model to query. For more details on the differences, see the OpenAI API documentation.",
        // Models OpenAI still serves, newest first. Ones OpenAI has announced
        // a shutdown date for are marked; retired models have been removed.
        enum: [
          "gpt-6-astra",
          "gpt-5.6-sol",
          "gpt-5.6-terra",
          "gpt-5.6-luna",
          "gpt-5.6-cyber",
          "gpt-5.5",
          "gpt-5.5-pro",
          "gpt-5.4",
          "gpt-5.4-mini",
          "gpt-5.4-nano",
          "gpt-5.4-pro",
          "gpt-5.2",
          "gpt-5.1",
          "gpt-5", // snapshot shuts down 2026-12-11
          "gpt-5-mini", // snapshot shuts down 2026-12-11
          "gpt-5-nano",
          "gpt-5-pro", // snapshot shuts down 2026-12-11
          "gpt-4.1",
          "gpt-4.1-mini",
          "gpt-4.1-nano", // shuts down 2026-10-23
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4o-2024-05-13", // shuts down 2026-10-23
          "o4-mini",
          "o3", // snapshot shuts down 2026-12-11
          "o3-pro", // snapshot shuts down 2026-12-11
          "o3-mini", // shuts down 2026-10-23
          "o1", // snapshot shuts down 2026-12-11
          "o1-pro", // snapshot shuts down 2026-12-11
          "gpt-4-turbo", // shuts down 2026-10-23
          "gpt-4-turbo-2024-04-09", // shuts down 2026-10-23
          "gpt-4", // shuts down 2026-10-23
          "gpt-4-0613", // shuts down 2026-10-23
          "gpt-4-1106-preview", // shuts down 2026-10-23
          "gpt-3.5-turbo",
          "gpt-3.5-turbo-0125",
          "gpt-3.5-turbo-1106", // shuts down 2026-09-28
          "gpt-3.5-turbo-instruct", // shuts down 2026-09-28
        ],
        // The GPT-4+ form (GPT4Settings, below) overrides this with a current
        // model; this form is the one attached to the GPT-3.5 menu entry.
        default: "gpt-3.5-turbo",
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "Many conversations begin with a system message to gently instruct the assistant. By default, ChainForge includes the suggested 'You are a helpful assistant.'",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. NOTE: GPT-5 models will ignore this parameter.",
        default: 1,
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      reasoning_effort: {
        type: "string",
        title: "reasoning.effort",
        description:
          "A parameter specific to o1+ and GPT-5+ models that controls the amount of reasoning effort the model expends when generating a response. NOTE: Currently, only GPT-5 supports the 'minimal' option.",
        enum: ["minimal", "low", "medium", "high"],
        default: "medium", // TODO: Add reasoning.summary option to visualize reasoning tokens in UI.
      },
      verbosity: {
        type: "string",
        title: "verbosity",
        description:
          "A parameter specific to GPT-5+ models that determines how many output tokens are generated. Lowering the number of tokens reduces overall latency.",
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      reasoning_summary: {
        type: "string",
        title: "reasoning.summary",
        description:
          "Ask a reasoning model (o-series, GPT-5+) for a summary of its reasoning, which ChainForge shows with each response. Only OpenAI's Responses API returns summaries, so ChainForge uses it for these models when this is on: stop sequences, seed, penalties and logit_bias don't apply, and temperature and top_p are left to the model. OpenAI may require your organization to be verified before it returns summaries.",
        enum: ["off", "auto", "concise", "detailed"],
        default: "off",
      },
      response_format: {
        type: "string",
        title: "response_format",
        description:
          "An object specifying the format that the model must output. Can be 'text' or 'json_object' or (late 2024) can be a JSON schema specifying structured outputs. In ChainForge, you should only specify text, json_object, or the verbatim JSON schema---do not add a JSON object with a 'type' parameter surrounding these values. JSON modes only works with newest GPT models. IMPORTANT: when using JSON mode, you must also instruct the model to produce JSON yourself via a system or user message.",
        default: "text",
      },
      tools: {
        type: "string",
        title: "tools",
        description:
          "A list of JSON schema objects, each with 'name', 'description', and 'parameters' keys, which describe functions the model may generate JSON inputs for. For more info, see https://github.com/openai/openai-cookbook/blob/main/examples/How_to_call_functions_with_chat_models.ipynb",
        default: "",
      },
      tool_choice: {
        type: "string",
        title: "tool_choice",
        description:
          "Controls how the model responds to function calls. 'none' means the model does not call a function, and responds to the end-user. 'auto' means the model can pick between an end-user or calling a function. 'required' means the model must call one or more tools. Specifying a particular function name forces the model to call only that function. Leave blank for default behavior.",
        default: "",
      },
      parallel_tool_calls: {
        type: "boolean",
        title: "parallel_tool_calls",
        description:
          "Whether to enable parallel function calling during tool use. Defaults to true.",
        enum: [true, false],
        default: true,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.",
        default: 1,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.005,
      },
      stop: {
        type: "string",
        title: "stop sequences",
        description:
          'Up to 4 sequences where the API will stop generating further tokens. Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      seed: {
        type: "integer",
        title: "seed",
        description:
          "If specified, the OpenAI API will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result. Determinism is not guaranteed.",
        allow_empty_str: true,
      },
      max_completion_tokens: {
        type: "integer",
        title: "max_completion_tokens",
        description:
          "An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens.",
      },
      presence_penalty: {
        type: "number",
        title: "presence_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
      frequency_penalty: {
        type: "number",
        title: "frequency_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
      logit_bias: {
        type: "string",
        title: "logit_bias",
        description:
          "Modify the likelihood of specified tokens appearing in the completion. Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.",
      },
    },
  },

  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help": "Defaults to gpt-3.5-turbo.",
      "ui:widget": "datalist",
    },
    system_msg: {
      "ui:widget": "textarea",
      "ui:help":
        "For more details, see the OpenAI documentation: https://platform.openai.com/docs/guides/chat/instructing-chat-models",
    },
    temperature: {
      "ui:help":
        "Defaults to 1.0. Leave at default if you prefer to set top_p.",
      "ui:widget": "range",
    },
    response_format: {
      "ui:help":
        "Defaults to 'text'. Set to a JSON schema for structured outputs in newer GPT models.",
      "ui:widget": "textarea",
    },
    tools: {
      "ui:help":
        "Leave blank to not specify any tools. NOTE: JSON schema MUST NOT have trailing commas.",
      "ui:widget": "textarea",
    },
    tool_choice: {
      "ui:help":
        "'none' is the default when no tools are present. 'auto' is the default if tools are present. 'required' means the model must call one or more tools. Specifying a specific tool via its name will force the model to use that tool.",
    },
    parallel_tool_calls: {
      "ui:widget": "radio",
    },
    top_p: {
      "ui:help":
        "Defaults to 1.0. Leave at default if you prefer to set temperature.",
      "ui:widget": "range",
    },
    presence_penalty: {
      "ui:help": "Defaults to 0.",
      "ui:widget": "range",
    },
    frequency_penalty: {
      "ui:help": "Defaults to 0.",
      "ui:widget": "range",
    },
    stop: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to empty.",
    },
    max_completion_tokens: {
      "ui:help": "Defaults to infinity.",
    },
    seed: {
      "ui:help": "Defaults to blank (no seed).",
    },
    logit_bias: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to none.",
    },
  },

  postprocessors: {
    functions: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return JSON.parse(str); // parse the JSON schema
    },
    function_call: (str) => {
      if (typeof str !== "string") return str;
      const s = str.trim();
      if (s.length === 0) return "";
      if (s === "auto" || s === "none") return s;
      else return { name: s };
    },
    tools: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return JSON.parse(str); // parse the JSON schema
    },
    tool_choice: (str) => {
      if (typeof str !== "string") return str;
      const s = str.trim();
      if (s.length === 0) return "";
      if (s === "auto" || s === "none" || s === "required") return s;
      else return { type: "function", function: { name: s } };
    },
    stop: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return str
        .match(/"((?:[^"\\]|\\.)*)"/g)
        ?.map((s) => s.substring(1, s.length - 1)); // split on double-quotes but exclude escaped double-quotes inside the group
    },
    response_format: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return "text";
      if (str === "text" || str === "json_object") return { type: str };
      // If it's not one of these options, we assume it's the new structured outputs JSON schema:
      return { type: "json_schema", json_schema: JSON.parse(str) };
    },
  },
};

const GPT4Settings: ModelSettingsDict = {
  fullName: ChatGPTSettings.fullName,
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      ...ChatGPTSettings.schema.properties,
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "GPT-5.6 Luna",
      },
      model: {
        ...ChatGPTSettings.schema.properties.model,
        default: "gpt-5.6-luna",
      },
    },
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
    model: {
      "ui:help": "Defaults to gpt-5.6-luna.",
      "ui:widget": "datalist",
    },
  },
  postprocessors: ChatGPTSettings.postprocessors,
};

const DeepSeekSettings: ModelSettingsDict = {
  fullName: "DeepSeek",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Deep Seek",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a DeepSeek model to query. For more details on the differences, see the DeepSeek API documentation.",
        // deepseek-flash and deepseek-v4-pro think by default, and return their
        // reasoning; deepseek-chat and deepseek-reasoner are older names.
        enum: [
          "deepseek-flash",
          "deepseek-v4-pro",
          "deepseek-chat",
          "deepseek-reasoner",
        ],
        default: "deepseek-flash",
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "Many conversations begin with a system message to gently instruct the assistant. By default, ChainForge includes the suggested 'You are a helpful assistant.'",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.",
        default: 1,
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      response_format: {
        type: "string",
        title: "response_format",
        description:
          "An object specifying the format that the model must output. Can be 'text' or 'json_object' or (late 2024) can be a JSON schema specifying structured outputs. In ChainForge, you should only specify text, json_object, or the verbatim JSON schema---do not add a JSON object with a 'type' parameter surrounding these values. JSON modes only works with newest GPT models. IMPORTANT: when using JSON mode, you must also instruct the model to produce JSON yourself via a system or user message.",
        default: "text",
      },
      tools: {
        type: "string",
        title: "tools",
        description:
          "A list of JSON schema objects, each with 'name', 'description', and 'parameters' keys, which describe functions the model may generate JSON inputs for. For more info, see https://github.com/openai/openai-cookbook/blob/main/examples/How_to_call_functions_with_chat_models.ipynb",
        default: "",
      },
      tool_choice: {
        type: "string",
        title: "tool_choice",
        description:
          "Controls how the model responds to function calls. 'none' means the model does not call a function, and responds to the end-user. 'auto' means the model can pick between an end-user or calling a function. 'required' means the model must call one or more tools. Specifying a particular function name forces the model to call only that function. Leave blank for default behavior.",
        default: "",
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.",
        default: 1,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.005,
      },
      stop: {
        type: "string",
        title: "stop sequences",
        description:
          'Up to 4 sequences where the API will stop generating further tokens. Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      max_tokens: {
        type: "integer",
        title: "max_tokens",
        description:
          "The maximum number of tokens to generate in the chat completion. (The total length of input tokens and generated tokens is limited by the model's context length.)",
      },
      presence_penalty: {
        type: "number",
        title: "presence_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
      frequency_penalty: {
        type: "number",
        title: "frequency_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
    },
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
    model: {
      "ui:help": "Defaults to deepseek-flash.",
      "ui:widget": "datalist",
    },
  },
  postprocessors: ChatGPTSettings.postprocessors,
};

const MiniMaxSettings: ModelSettingsDict = {
  fullName: "MiniMax",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "MiniMax",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a MiniMax model to query. For more details, see the MiniMax API documentation at https://platform.minimaxi.com.",
        enum: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.7-highspeed"],
        default: "MiniMax-M2.7",
        shortname_map: {
          "MiniMax-M3": "M3",
          "MiniMax-M2.7": "M2.7",
          "MiniMax-M2.7-highspeed": "M2.7-hs",
        },
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "Many conversations begin with a system message to gently instruct the assistant.",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "What sampling temperature to use, between 0.01 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. Note: MiniMax requires temperature > 0.",
        default: 0.7,
        minimum: 0.01,
        maximum: 1,
        multipleOf: 0.01,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "An alternative to sampling with temperature, called nucleus sampling.",
        default: 1,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.005,
      },
      stop: {
        type: "string",
        title: "stop sequences",
        description:
          'Sequences where the API will stop generating further tokens. Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      max_tokens: {
        type: "integer",
        title: "max_tokens",
        description:
          "The maximum number of tokens to generate in the chat completion.",
      },
      presence_penalty: {
        type: "number",
        title: "presence_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
      frequency_penalty: {
        type: "number",
        title: "frequency_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
    },
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
    model: {
      "ui:help": "Defaults to MiniMax-M2.7.",
      "ui:widget": "datalist",
    },
    temperature: {
      "ui:help": "Defaults to 0.7. MiniMax requires temperature > 0.",
      "ui:widget": "range",
    },
  },
  postprocessors: ChatGPTSettings.postprocessors,
};

/**
 * Models reached through OpenRouter's chat completions API. The listed models
 * fill the model menu; since OpenRouter's catalog changes all the time, any
 * other model ID can be typed in.
 */
export const OpenRouterSettings: ModelSettingsDict = {
  fullName: "OpenRouter",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "OpenRouter",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "The OpenRouter model to query. Pick a popular one, or type any model ID listed at https://openrouter.ai/models (e.g. anthropic/claude-sonnet-5).",
        // A mix of frontier models and cheap ones (e.g. for workshops), grouped by lab.
        enum: [
          "anthropic/claude-sonnet-5",
          "anthropic/claude-haiku-4.5",
          "openai/gpt-5.5",
          "openai/gpt-5.4-mini",
          "openai/gpt-5.4-nano",
          "google/gemini-3.8-flash",
          "google/gemini-3.1-flash-lite",
          "x-ai/grok-4.6",
          "deepseek/deepseek-v4-pro",
          "deepseek/deepseek-v4-flash",
          "qwen/qwen3.8-max-0902",
          "qwen/qwen3.8-flash",
          "moonshotai/kimi-k3",
        ],
        default: "anthropic/claude-sonnet-5",
        shortname_map: {
          "anthropic/claude-sonnet-5": "Claude Sonnet 5",
          "anthropic/claude-haiku-4.5": "Claude Haiku 4.5",
          "openai/gpt-5.5": "GPT-5.5",
          "openai/gpt-5.4-mini": "GPT-5.4 Mini",
          "openai/gpt-5.4-nano": "GPT-5.4 Nano",
          "google/gemini-3.8-flash": "Gemini 3.8 Flash",
          "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
          "x-ai/grok-4.6": "Grok 4.6",
          "deepseek/deepseek-v4-pro": "DeepSeek V4 Pro",
          "deepseek/deepseek-v4-flash": "DeepSeek V4 Flash",
          "qwen/qwen3.8-max-0902": "Qwen3.8 Max",
          "qwen/qwen3.8-flash": "Qwen3.8 Flash",
          "moonshotai/kimi-k3": "Kimi K3",
        },
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "Many conversations begin with a system message to gently instruct the assistant. By default, ChainForge includes the suggested 'You are a helpful assistant.'",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. Models that don't support temperature (e.g. GPT-5 models) ignore it.",
        default: 1,
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      reasoning_effort: {
        type: "string",
        title: "reasoning.effort",
        description:
          "How much a reasoning model thinks before it answers. 'on' turns reasoning on at the model's usual effort (some models, like GPT-5.4 Nano and DeepSeek V4 Pro, otherwise don't reason), and 'off' turns it off where the model allows it. Not every model supports every level, and OpenAI models don't return their reasoning through OpenRouter. Models that don't reason ignore this.",
        enum: ["on", "off", "minimal", "low", "medium", "high", "xhigh", "max"],
        default: "on",
      },
      reasoning_max_tokens: {
        type: "integer",
        title: "reasoning.max_tokens",
        description:
          "A token budget for reasoning, instead of an effort level. Some models (e.g. Claude, Gemini and Qwen) take a budget rather than a level. When set, reasoning.effort is ignored.",
      },
      response_format: {
        type: "string",
        title: "response_format",
        description:
          "An object specifying the format that the model must output. Can be 'text' or 'json_object', or a JSON schema specifying structured outputs. In ChainForge, you should only specify text, json_object, or the verbatim JSON schema---do not add a JSON object with a 'type' parameter surrounding these values. Not every model supports structured outputs. IMPORTANT: when using JSON mode, you must also instruct the model to produce JSON yourself via a system or user message.",
        default: "text",
      },
      tools: {
        type: "string",
        title: "tools",
        description:
          "A list of JSON schema objects, each with 'name', 'description', and 'parameters' keys, which describe functions the model may generate JSON inputs for. For more info, see https://openrouter.ai/docs/guides/features/tool-calling",
        default: "",
      },
      tool_choice: {
        type: "string",
        title: "tool_choice",
        description:
          "Controls how the model responds to function calls. 'none' means the model does not call a function, and responds to the end-user. 'auto' means the model can pick between an end-user or calling a function. 'required' means the model must call one or more tools. Specifying a particular function name forces the model to call only that function. Leave blank for default behavior.",
        default: "",
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.",
        default: 1,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.005,
      },
      stop: {
        type: "string",
        title: "stop sequences",
        description:
          'Up to 4 sequences where the API will stop generating further tokens. Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      max_tokens: {
        type: "integer",
        title: "max_tokens",
        description:
          "The maximum number of tokens to generate. Reasoning models may spend much of this on reasoning, so set it generously for them.",
      },
      seed: {
        type: "integer",
        title: "seed",
        description:
          "If specified, supporting models will make a best effort to sample deterministically, so repeated requests with the same seed and parameters return the same result.",
      },
      presence_penalty: {
        type: "number",
        title: "presence_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
      frequency_penalty: {
        type: "number",
        title: "frequency_penalty",
        description:
          "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.005,
      },
    },
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
    model: {
      "ui:help":
        "Defaults to anthropic/claude-sonnet-5. Type to enter any other OpenRouter model ID.",
      "ui:widget": "datalist",
    },
    reasoning_effort: {
      "ui:help": "Defaults to on.",
    },
    reasoning_max_tokens: {
      "ui:help": "Defaults to blank (use reasoning.effort).",
    },
    max_tokens: {
      "ui:help": "Defaults to the model's limit.",
    },
  },
  postprocessors: ChatGPTSettings.postprocessors,
};

/** Image models reached through OpenRouter's Image API. Any other image model ID can be typed in. */
export const OpenRouterImageSettings: ModelSettingsDict = {
  fullName: "OpenRouter Image Models",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "OpenRouter Image",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "The OpenRouter image model to use. Pick one, or type any model ID listed at https://openrouter.ai/collections/image-models. Input images (e.g. from a Media Node) are sent along with the prompt, for editing or as references.",
        // Cheapest first: FLUX.2 Klein 4B costs about $0.014 per 1-megapixel image,
        // so it's the default (e.g. for workshops or stress-testing image flows).
        enum: [
          "black-forest-labs/flux.2-klein-4b",
          "openai/gpt-image-1-mini",
          "google/gemini-3.1-flash-image",
          "bytedance-seed/seedream-5-0-lite",
          "openai/gpt-image-2.5-flare",
        ],
        default: "black-forest-labs/flux.2-klein-4b",
        shortname_map: {
          "black-forest-labs/flux.2-klein-4b": "FLUX.2 Klein 4B",
          "openai/gpt-image-1-mini": "GPT Image 1 Mini",
          "google/gemini-3.1-flash-image": "Gemini 3.1 Flash Image",
          "bytedance-seed/seedream-5-0-lite": "Seedream 5.0 Lite",
          "openai/gpt-image-2.5-flare": "GPT Image 2.5 Flare",
        },
      },
      resolution: {
        type: "string",
        title: "resolution",
        enum: ["auto", "512", "1K", "2K", "4K"],
        description:
          "Resolution of the generated images. Models support different resolutions (e.g. Seedream 5.0 Lite only 2K and 4K). auto uses the model's default.",
        default: "auto",
      },
      aspect_ratio: {
        type: "string",
        title: "aspect_ratio",
        enum: [
          "auto",
          "1:1",
          "2:3",
          "3:2",
          "3:4",
          "4:3",
          "4:5",
          "5:4",
          "9:16",
          "16:9",
          "21:9",
        ],
        description:
          "Aspect ratio of the generated images. Not every model supports every ratio. auto lets the model decide.",
        default: "auto",
      },
      quality: {
        type: "string",
        title: "quality",
        enum: ["auto", "low", "medium", "high"],
        description:
          "Rendering quality, for models that support it (e.g. GPT Image models). Higher quality costs more.",
        default: "auto",
      },
      background: {
        type: "string",
        title: "background",
        enum: ["auto", "transparent", "opaque"],
        description:
          "Background of the generated images, for models that support it. Transparent backgrounds need a png or webp output_format.",
        default: "auto",
      },
      output_format: {
        type: "string",
        title: "output_format",
        enum: ["auto", "png", "jpeg", "webp", "svg"],
        description:
          "File format of the generated images, for models that support it. svg is only for vector models (e.g. Recraft's vector models).",
        default: "auto",
      },
      seed: {
        type: "integer",
        title: "seed",
        description:
          "If specified, supporting models (e.g. FLUX and Seedream) generate the same image for the same seed and prompt.",
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help":
        "Defaults to black-forest-labs/flux.2-klein-4b, a cheap model. Type to enter any other OpenRouter image model ID.",
      "ui:widget": "datalist",
    },
    resolution: {
      "ui:help": "Defaults to auto.",
    },
    aspect_ratio: {
      "ui:help": "Defaults to auto.",
    },
    seed: {
      "ui:help": "Defaults to blank (no seed).",
    },
  },
  postprocessors: {},
};

const DalleSettings: ModelSettingsDict = {
  // OpenAI shut down DALL·E on May 12, 2026. Kept so flows that use it still open.
  fullName: "Dall-E Image Models (OpenAI; shut down May 2026)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Dalle2",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select an OpenAI Dall-E image model to query. For more details on the differences, see the OpenAI API documentation.",
        enum: ["dall-e-3", "dall-e-2"],
        default: "dall-e-2",
      },
      size: {
        type: "string",
        title: "size",
        enum: [
          "auto",
          "256x256",
          "512x512",
          "1024x1024",
          "1792x1024",
          "1024x1792",
        ],
        description:
          "The size of the generated images. NOTE: Dalle-2 supports from 256x256 to 1024x1024. Dalle-3 supports 1024x1024 and above. WARNING: Currently, all images are stored in browser memory. Be careful with Dall-E-3: you may run out of memory fast.",
        default: "256x256",
      },
      quality: {
        type: "string",
        title: "quality (DALL-E-3 ONLY)",
        enum: ["standard", "hd"],
        description:
          "The quality of the image that will be generated. hd and standard are supported for dall-e-3. standard is the only option for dall-e-2.",
        default: "standard",
      },
      style: {
        type: "string",
        title: "style (DALL-E-3 ONLY)",
        enum: ["vivid", "natural"],
        description:
          "The style of the generated images. Vivid causes the model to lean towards generating hyper-real and dramatic images. Natural causes the model to produce more natural, less hyper-real looking images. NOTE: Only supported for DALL-E-3.",
        default: "vivid",
      },
    },
  },

  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help": "Defaults to dalle-2.",
      "ui:widget": "datalist",
    },
    size: {
      "ui:help": "Defaults to 256x256.",
    },
    quality: {
      "ui:help": "Defaults to standard.",
    },
    style: {
      "ui:help": "Defaults to vivid.",
    },
  },

  postprocessors: {},
};

const GPTImageSettings: ModelSettingsDict = {
  fullName: "GPT Image (OpenAI)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "GPT Image",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "Select an OpenAI GPT Image model. gpt-image-2.5-flare is fast and suited to everyday generation; gpt-image-2.5-sunburst is best for precise edits. gpt-image-1.5 and gpt-image-1-mini shut down on December 1, 2026, and gpt-image-1 is being retired in favor of gpt-image-2. Input images (e.g. from a Media Node) are sent as images to edit.",
        enum: [
          "gpt-image-2.5-flare",
          "gpt-image-2.5-sunburst",
          "gpt-image-2",
          "gpt-image-1.5",
          "gpt-image-1",
          "gpt-image-1-mini",
        ],
        default: "gpt-image-2.5-flare",
        shortname_map: {
          "gpt-image-2.5-flare": "GPT Image 2.5 Flare",
          "gpt-image-2.5-sunburst": "GPT Image 2.5 Sunburst",
          "gpt-image-2": "GPT Image 2",
          "gpt-image-1.5": "GPT Image 1.5",
          "gpt-image-1": "GPT Image 1",
          "gpt-image-1-mini": "GPT Image 1 mini",
        },
      },
      size: {
        type: "string",
        title: "size",
        enum: [
          "auto",
          "1024x1024",
          "1536x1024",
          "1024x1536",
          "2048x2048",
          "2048x1152",
          "3840x2160",
        ],
        description:
          "Size of the generated images. gpt-image-2 and newer also accept any WIDTHxHEIGHT with both sides divisible by 16, an aspect ratio between 1:3 and 3:1, and at most 3840x2160 (above 2560x1440 is experimental). Older models support only auto, 1024x1024, 1536x1024 and 1024x1536.",
        default: "auto",
      },
      quality: {
        type: "string",
        title: "quality",
        enum: ["auto", "low", "medium", "high", "xhigh", "max"],
        description:
          "Quality of the generated images. xhigh and max are only supported by gpt-image-2.5-flare and gpt-image-2.5-sunburst.",
        default: "auto",
      },
      background: {
        type: "string",
        title: "background",
        description:
          "Background of the generated images. transparent requires png or webp output.",
        enum: ["auto", "opaque", "transparent"],
        default: "auto",
      },
      moderation: {
        type: "string",
        title: "moderation",
        description: "Content-moderation level for generated images.",
        enum: ["auto", "low"],
        default: "auto",
      },
      output_format: {
        type: "string",
        title: "output_format",
        description: "The format in which the generated images are returned.",
        enum: ["png", "jpeg", "webp"],
        default: "png",
      },
      output_compression: {
        type: "integer",
        title: "output_compression",
        description:
          "Compression level (0-100%) for jpeg or webp output. Ignored for png.",
        minimum: 0,
        maximum: 100,
        default: 100,
      },
      input_fidelity: {
        type: "string",
        title: "input_fidelity (edits only)",
        description:
          "How closely edits preserve details of the input images, such as faces. Only used when the prompt includes input images. gpt-image-2 always uses high fidelity.",
        enum: ["auto", "high", "low"],
        default: "auto",
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help": "Defaults to gpt-image-2.5-flare.",
      "ui:widget": "datalist",
    },
    size: {
      "ui:help": "Defaults to auto. You can type a custom size.",
      "ui:widget": "datalist",
    },
    quality: {
      "ui:help": "Defaults to auto.",
    },
  },
  postprocessors: {},
};

const GeminiImageSettings: ModelSettingsDict = {
  fullName: "Google AI Image Models (Gemini)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Gemini Image",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "Select a Gemini image model. gemini-3.1-flash-image is Google's recommended default, gemini-3.1-flash-lite-image the cheapest, and gemini-3-pro-image the highest quality. gemini-2.5-flash-image shuts down on October 2, 2026. Image models require a paid Gemini API key. Input images (e.g. from a Media Node) are sent along with the prompt, for editing or as references.",
        enum: [
          "gemini-3.1-flash-image",
          "gemini-3.1-flash-lite-image",
          "gemini-3-pro-image",
          "gemini-2.5-flash-image",
        ],
        default: "gemini-3.1-flash-image",
        shortname_map: {
          "gemini-3.1-flash-image": "Gemini 3.1 Flash Image",
          "gemini-3.1-flash-lite-image": "Gemini 3.1 Flash Lite Image",
          "gemini-3-pro-image": "Gemini 3 Pro Image",
          "gemini-2.5-flash-image": "Gemini 2.5 Flash Image",
        },
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "Enter your system message here, to be passed to the systemInstruction parameter.",
        default: "",
      },
      temperature: {
        type: "number",
        title: "temperature",
        description: "Controls the randomness of the output.",
        default: 1.0,
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      aspect_ratio: {
        type: "string",
        title: "aspect_ratio",
        enum: [
          "auto",
          "1:1",
          "2:3",
          "3:2",
          "3:4",
          "4:3",
          "4:5",
          "5:4",
          "9:16",
          "16:9",
          "21:9",
          "1:4",
          "4:1",
          "1:8",
          "8:1",
        ],
        description:
          "Aspect ratio of the generated images. 1:4, 4:1, 1:8 and 8:1 are only supported by gemini-3.1-flash-image. auto lets the model decide.",
        default: "auto",
      },
      image_size: {
        type: "string",
        title: "image_size",
        enum: ["auto", "512", "1K", "2K", "4K"],
        description:
          "Resolution of the generated images. 512 is only supported by gemini-3.1-flash-image; gemini-3.1-flash-lite-image supports 1K only; gemini-2.5-flash-image is fixed at about 1024px. auto uses the model's default (1K).",
        default: "auto",
      },
      response_modalities: {
        type: "string",
        title: "response_modalities",
        enum: ["IMAGE", "TEXT_AND_IMAGE"],
        description:
          "Whether the model returns only images, or may also return text. Images are shown when present; a text-only reply (e.g. declining a request) is shown as text.",
        default: "IMAGE",
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help": "Defaults to gemini-3.1-flash-image.",
      "ui:widget": "datalist",
    },
    system_msg: {
      "ui:widget": "textarea",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    aspect_ratio: {
      "ui:help": "Defaults to auto.",
    },
    image_size: {
      "ui:help": "Defaults to auto (1K).",
    },
  },
  postprocessors: {},
};

const ClaudeSettings: ModelSettingsDict = {
  fullName: "Claude (Anthropic)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Claude",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a version of Claude to query. For more details on the differences, see the Anthropic API documentation.",
        // Models Anthropic still serves. Everything Claude 3 and older has
        // been retired, so those have been removed.
        enum: [
          "claude-opus-5",
          "claude-sonnet-5",
          "claude-haiku-4-5",
          "claude-fable-5-1",
          "claude-fable-5",
          "claude-opus-4-8",
          "claude-opus-4-7",
          "claude-opus-4-6",
          "claude-opus-4-5",
          "claude-sonnet-4-6",
          "claude-sonnet-4-5",
          "claude-opus-4-0",
          "claude-sonnet-4-0",
        ],
        default: "claude-sonnet-5",
        shortname_map: {
          "claude-opus-5": "Claude Opus 5",
          "claude-sonnet-5": "Claude Sonnet 5",
          "claude-haiku-4-5": "Claude Haiku 4.5",
          "claude-fable-5-1": "Claude Fable 5.1",
          "claude-fable-5": "Claude Fable 5",
          "claude-opus-4-8": "Claude Opus 4.8",
          "claude-opus-4-7": "Claude Opus 4.7",
          "claude-opus-4-6": "Claude Opus 4.6",
          "claude-opus-4-5": "Claude Opus 4.5",
          "claude-sonnet-4-6": "Claude Sonnet 4.6",
          "claude-sonnet-4-5": "Claude Sonnet 4.5",
          "claude-opus-4-0": "Claude Opus 4",
          "claude-sonnet-4-0": "Claude Sonnet 4",
        },
      },
      thinking: {
        type: "string",
        title: "thinking",
        description:
          "Whether Claude thinks before it answers, with its thinking shown alongside each response. 'auto' shows the thinking of models that think by default (Claude Opus 5, Sonnet 5 and Fable), and leaves other models as they are. 'adaptive' lets Claude 4.6 and later decide when and how much to think. 'enabled' thinks within a fixed token budget, for Claude 3.7 through 4.5. 'disabled' turns thinking off, where the model allows it. Thinking counts toward max_tokens_to_sample, so set it generously. While Claude thinks, ChainForge leaves out a temperature other than 1, top_k, and a top_p below 0.95, which thinking doesn't allow. Claude Opus 4.7 and later, Sonnet 5 and Fable don't take temperature, top_p or top_k at all.",
        enum: ["auto", "adaptive", "enabled", "disabled"],
        default: "auto",
      },
      thinking_budget_tokens: {
        type: "integer",
        title: "thinking_budget_tokens",
        description:
          "For thinking 'enabled': how many tokens Claude may spend thinking (at least 1024). ChainForge adds this to max_tokens_to_sample, so the answer keeps its own room.",
        default: 2048,
        minimum: 1024,
      },
      effort: {
        type: "string",
        title: "effort",
        description:
          "How much work Claude puts into its response, thinking included (Claude 4.6 and later; not Haiku 4.5). 'default' leaves it to the model.",
        enum: ["default", "low", "medium", "high", "xhigh", "max"],
        default: "default",
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "Only supported in Claude 2.1+ models. A system prompt is a way of providing context and instructions to Claude, such as specifying a particular goal or role.",
        default: "",
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "Amount of randomness injected into the response. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and temp closer to 1 for creative and generative tasks.",
        default: 1,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.01,
      },
      tools: {
        type: "string",
        title: "tools",
        description:
          "Definitions of tools that the model may use, as a list of JSON schema. For more info, see the Anthropic documentation: https://docs.anthropic.com/en/docs/build-with-claude/tool-use#example-api-response-with-a-tool-use-content-block",
        default: "",
      },
      tool_choice: {
        type: "string",
        title: "tool_choice",
        description:
          "How the model should use the provided tools. The model can use a specific tool by its name, any available tool ('any'), or decide by itself whether to use a tool or not ('auto').",
        default: "",
      },
      parallel_tool_calls: {
        type: "boolean",
        title: "parallel_tool_calls",
        description:
          "Whether to enable parallel function calling during tool use. Defaults to true.",
        enum: [true, false],
        default: true,
      },
      max_tokens_to_sample: {
        type: "integer",
        title: "max_tokens_to_sample",
        description:
          "A maximum number of tokens to generate before stopping. Lower this if you want shorter responses. By default, ChainForge uses the value 1024, although the Anthropic API does not specify a default value.",
        default: 1024,
        minimum: 1,
      },
      custom_prompt_wrapper: {
        type: "string",
        title: "Prompt Wrapper (ChainForge)",
        description:
          // eslint-disable-next-line
          'Older text completions Anthropic models expect prompts in the form "\\n\\nHuman: ${prompt}\\n\\nAssistant:". ChainForge wraps all prompts in this template by default. If you wish to explore custom prompt wrappers that deviate, write a Python template here with a single variable, ${prompt}, where the actual prompt text should go. Otherwise, leave this field blank. (Note that you should enter newlines as newlines, not escape codes like \\n.)',
        default: "",
      },
      stop_sequences: {
        type: "string",
        title: "stop_sequences",
        description:
          'Anthropic models stop on "\\n\\nHuman:", and may include additional built-in stop sequences in the future. By providing the stop_sequences parameter, you may include additional strings that will cause the model to stop generating.\nEnclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: '"\n\nHuman:"',
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          'Only sample from the top K options for each subsequent token. Used to remove "long tail" low probability responses. Defaults to -1, which disables it.',
        minimum: -1,
        default: -1,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Does nucleus sampling, in which we compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. Defaults to -1, which disables it. Note that you should either alter temperature or top_p, but not both.",
        default: -1,
        minimum: -1,
        maximum: 1,
        multipleOf: 0.001,
      },
    },
  },

  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help":
        "Defaults to claude-sonnet-5. Claude 3 and older have all been retired by Anthropic and are no longer queryable. Newer models than those listed here can be typed in by hand.",
      "ui:widget": "datalist",
    },
    system_msg: {
      "ui:widget": "textarea",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    tools: {
      "ui:help":
        "Leave blank to not specify any tools. NOTE: JSON schema MUST NOT have trailing commas.",
      "ui:widget": "textarea",
    },
    tool_choice: {
      "ui:help":
        "'none' is the default when no tools are present. 'auto' is the default if tools are present.",
    },
    parallel_tool_calls: {
      "ui:widget": "radio",
    },
    max_tokens_to_sample: {
      "ui:help": "Defaults to 1024.",
    },
    top_k: {
      "ui:help": "Defaults to -1 (none).",
    },
    top_p: {
      "ui:help": "Defaults to -1 (none).",
    },
    stop_sequences: {
      "ui:widget": "textarea",
      "ui:help": 'Defaults to one stop sequence, "\\n\\nHuman: "',
    },
    custom_prompt_wrapper: {
      "ui:widget": "textarea",
      "ui:help":
        'Defaults to Anthropic\'s internal wrapper "\\n\\nHuman: {prompt}\\n\\nAssistant". Only used for text completions models (2.0 or earlier).',
    },
  },

  postprocessors: {
    stop_sequences: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return ["\n\nHuman:"];
      return str
        .match(/"((?:[^"\\]|\\.)*)"/g)
        ?.map((s) => s.substring(1, s.length - 1)); // split on double-quotes but exclude escaped double-quotes inside the group
    },
    tools: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return JSON.parse(str); // parse the JSON schema
    },
    tool_choice: (str) => {
      if (typeof str !== "string") return str;
      const s = str.trim();
      if (s.length === 0) return "";
      if (s === "auto" || s === "any") return { type: s };
      else return { type: "tool", name: s };
    },
  },
};

const Gemini25Settings: ModelSettingsDict = {
  fullName: "Google AI Models (Gemini)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Gemini",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "Select a Gemini model to query. For more details on the differences, see the Google Gemini API documentation.",
        // Models the Gemini API still serves. Gemini 2.0 and 1.5 have been
        // shut down, as has text-embedding-004, so those have been removed.
        enum: [
          "gemini-3.8-flash",
          "gemini-3.7-flash",
          "gemini-3.6-flash",
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.1-flash-lite",
          "gemini-3.1-pro-preview",
          "gemini-3-flash-preview",
          "gemini-2.5-pro",
          "gemini-2.5-flash",
          "gemini-2.5-flash-lite",
          "gemini-embedding-001",
        ],
        default: "gemini-3.8-flash",
        shortname_map: {
          "gemini-3.8-flash": "Gemini 3.8 Flash",
          "gemini-3.7-flash": "Gemini 3.7 Flash",
          "gemini-3.6-flash": "Gemini 3.6 Flash",
          "gemini-3.5-flash": "Gemini 3.5 Flash",
          "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
          "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
          "gemini-3.1-pro-preview": "Gemini 3.1 Pro",
          "gemini-3-flash-preview": "Gemini 3 Flash",
          "gemini-2.5-pro": "Gemini 2.5 Pro",
          "gemini-2.5-flash": "Gemini 2.5 Flash",
          "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
          "gemini-embedding-001": "gemini-embedding-001",
        },
      },
      include_thoughts: {
        type: "boolean",
        title: "include_thoughts",
        description:
          "Return summaries of the model's thinking (Gemini 2.5 and later), shown alongside each response. They don't change the response itself.",
        enum: [true, false],
        default: true,
      },
      thinking_budget: {
        type: "integer",
        title: "thinking_budget",
        description:
          "Gemini 2.5 only: how many tokens the model may spend thinking. 0 turns thinking off (not on 2.5 Pro), and -1 lets the model decide. Leave blank for the model's default. Ignored when thinking_level is set.",
      },
      thinking_level: {
        type: "string",
        title: "thinking_level",
        description:
          "Gemini 3 only: how much the model thinks. 'default' leaves it to the model. Not every model supports every level (e.g. 'minimal').",
        enum: ["default", "minimal", "low", "medium", "high"],
        default: "default",
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "Enter your system message here, to be passed to the systemInstructions parameter.",
        default: "",
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "Controls the randomness of the output. Must be positive. Typical values are in the range: [0.0, 1.0]. Higher values produce a more random and varied response. A temperature of zero will be deterministic.",
        default: 0.7,
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          "Sets the maximum number of tokens to sample from on each step. (The Gemini API uses combined nucleus and top-k sampling.) Set to -1 to use the default value.",
        minimum: -1,
        default: -1,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Sets the maximum cumulative probability of tokens to sample from. (The Gemini API uses combined nucleus and top-k sampling.) Set to -1 to use the default value.",
        default: -1,
        minimum: -1,
        maximum: 1,
        multipleOf: 0.001,
      },
      max_output_tokens: {
        type: "integer",
        title: "max_output_tokens (ignored for chat models)",
        description:
          "Maximum number of tokens to include in each response of a text-bison model. Must be greater than zero. If unset, will default to 512. Ignored for chat models.",
        default: 512,
        minimum: 1,
      },
      stop_sequences: {
        type: "string",
        title: "stop_sequences (ignored for chat models)",
        description:
          'A set of up to 5 character sequences that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.\nEnclose stop sequences in double-quotes "" and use whitespace to separate them. Ignored for chat models.',
        default: "",
      },
    },
  },

  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help":
        "Defaults to gemini-3.8-flash. Gemini 2.0 and 1.5 models have been shut down and are no longer queryable. Newer models than those listed here can be typed in by hand.",
      "ui:widget": "datalist",
    },
    system_msg: {
      "ui:widget": "textarea",
    },
    temperature: {
      "ui:help": "Defaults to 0.7.",
      "ui:widget": "range",
    },
    max_output_tokens: {
      "ui:help":
        "Defaults to 512. Only relevant to text completions models (text-bison).",
    },
    top_k: {
      "ui:help": "Defaults to -1 (none).",
    },
    top_p: {
      "ui:help": "Defaults to -1 (none).",
    },
    stop_sequences: {
      "ui:widget": "textarea",
      "ui:help":
        "Defaults to no additional stop sequences (empty). Ignored for chat models.",
    },
  },

  postprocessors: {
    stop_sequences: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return str
        .match(/"((?:[^"\\]|\\.)*)"/g)
        ?.map((s) => s.substring(1, s.length - 1)); // split on double-quotes but exclude escaped double-quotes inside the group
    },
  },
};

const AzureOpenAISettings: ModelSettingsDict = {
  fullName: "Azure OpenAI Model",
  schema: {
    type: "object",
    required: ["shortname", "deployment_name"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Azure-OpenAI",
      },
      deployment_name: {
        type: "string",
        title: "Deployment name",
        description:
          "The deployment name you chose when you deployed the model in Azure services (also known as the 'deployment_id' or 'engine'). This must exactly match the name of the deployed resource, or the request will fail.",
        default: "gpt-35-turbo",
      },
      model_type: {
        type: "string",
        title: "Model Type (Chat or Completions)",
        description:
          "Select the type of model you are querying. For instance, if you host GPT3.5, select chat-completion; if you host davinci, use text-completion.",
        enum: ["chat-completion", "text-completion"],
        default: "chat-completion",
      },
      ...transformDict(
        ChatGPTSettings.schema.properties,
        (key) => key !== "model",
      ),
    },
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
  },
  postprocessors: ChatGPTSettings.postprocessors,
};

/**
 * Hugging Face Inference Providers, which replaced the old serverless Inference
 * API. It is an OpenAI-shaped chat endpoint in front of a pool of providers
 * (Together, Groq, Cerebras, DeepInfra, ...), so the settings below are the
 * OpenAI ones rather than the old text-generation task's.
 * See https://huggingface.co/docs/inference-providers
 */
export const HuggingFaceSettings: ModelSettingsDict = {
  fullName: "Hugging Face",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "HF",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "The model to query. Pick a popular one, or type any model ID served by Inference Providers -- the full list is at https://router.huggingface.co/v1/models. Every Hugging Face account gets a small monthly credit to spend here, so the cheaper models go furthest.",
        // Cheap, widely-served open-weights models, so a workshop's free monthly
        // credit stretches. Blended $/1M at the time of writing in the comments.
        enum: [
          "meta-llama/Llama-3.1-8B-Instruct", // $0.07
          "Qwen/Qwen3-4B-Instruct-2507", // $0.04, 262K context
          "openai/gpt-oss-20b", // $0.17
          "openai/gpt-oss-120b", // $0.21, served by 11 providers
          "google/gemma-3-4b-it", // $0.15, takes image input
          "deepseek-ai/DeepSeek-R1-Distill-Llama-8B", // $0.10, reasoning
        ],
        default: "meta-llama/Llama-3.1-8B-Instruct",
        shortname_map: {
          "meta-llama/Llama-3.1-8B-Instruct": "Llama 3.1 8B",
          "Qwen/Qwen3-4B-Instruct-2507": "Qwen3 4B",
          "openai/gpt-oss-20b": "gpt-oss-20b",
          "openai/gpt-oss-120b": "gpt-oss-120b",
          "google/gemma-3-4b-it": "Gemma 3 4B",
          "deepseek-ai/DeepSeek-R1-Distill-Llama-8B": "R1 Distill 8B",
        },
      },
      provider_policy: {
        type: "string",
        title: "provider",
        description:
          "Which of the providers serving this model to route to. 'cheapest' bills the least per token, which is what makes a free monthly credit last; 'fastest' is Hugging Face's own default; 'preferred' follows the order set in your Hugging Face Inference Providers settings. You can also name a provider directly (e.g. groq, together, cerebras).",
        default: "cheapest",
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "A system message to gently instruct the model. Leave blank to send none.",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description: "Controls the 'creativity' or randomness of the response.",
        default: 1.0,
        minimum: 0,
        maximum: 2.0,
        multipleOf: 0.01,
      },
      max_tokens: {
        type: "integer",
        title: "max_tokens",
        description:
          "The maximum number of tokens to generate. Leave blank for the provider's default.",
        default: 512,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Sets the maximum cumulative probability of tokens to sample from (0 to 1.0). Set to -1 to leave unspecified.",
        default: -1,
        minimum: -1,
        maximum: 1,
        multipleOf: 0.001,
      },
      frequency_penalty: {
        type: "number",
        title: "frequency_penalty",
        description:
          "Penalizes tokens by how often they have appeared so far. Not every provider supports it.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.01,
      },
      presence_penalty: {
        type: "number",
        title: "presence_penalty",
        description:
          "Penalizes tokens that have appeared at all. Not every provider supports it.",
        default: 0,
        minimum: -2,
        maximum: 2,
        multipleOf: 0.01,
      },
      stop: {
        type: "string",
        title: "stop",
        description:
          'Sequences where the model will stop generating. Enclose each in double-quotes "" and separate them with whitespace.',
        default: "",
      },
      custom_endpoint: {
        type: "string",
        title: "Dedicated Inference Endpoint URL",
        description:
          "Leave blank to go through Inference Providers. To query your own dedicated Inference Endpoint instead, paste its URL here; ChainForge posts the same OpenAI-shaped request to it, with no provider suffix. Set Model above to the model ID the endpoint was deployed with, which newer endpoints check.",
        default: "",
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help":
        "Defaults to meta-llama/Llama-3.1-8B-Instruct. Any model on Inference Providers can be typed in.",
      "ui:widget": "datalist",
    },
    provider_policy: {
      "ui:help": "Defaults to cheapest.",
      "ui:widget": "datalist",
      "ui:options": {
        datalist: ["cheapest", "fastest", "preferred"],
      },
    },
    system_msg: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to 'You are a helpful assistant.'",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    max_tokens: {
      "ui:help": "Defaults to 512.",
    },
    top_p: {
      "ui:help": "Defaults to -1 (unspecified).",
    },
    frequency_penalty: {
      "ui:help": "Defaults to 0.",
    },
    presence_penalty: {
      "ui:help": "Defaults to 0.",
    },
    stop: {
      "ui:help": "Defaults to no stop sequences.",
    },
    custom_endpoint: {
      "ui:help": "Defaults to blank (use Inference Providers).",
    },
  },
  postprocessors: {
    stop: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return str
        .match(/"((?:[^"\\]|\\.)*)"/g)
        ?.map((s) => s.substring(1, s.length - 1)); // split on double-quotes but exclude escaped double-quotes inside the group
    },
  },
};

const OllamaSettings: ModelSettingsDict = {
  fullName: "Ollama",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Ollama",
      },
      ollamaModel: {
        type: "string",
        title: "Model",
        description:
          "Enter the model to query using Ollama's API. Make sure you've pulled the model before. For more details, check out https://ollama.ai/library",
        default: "mistral",
      },
      ollama_url: {
        type: "string",
        title: "URL",
        description:
          "URL of the Ollama server generate endpoint. Only enter the path up to /api, nothing else.",
        default: "http://localhost:11434/api",
      },
      model_type: {
        type: "string",
        title: "Model Type (Text or Chat)",
        description:
          "Select 'chat' to pass conversation history and use system messages on chat-enabled models, such as llama-2. Detected automatically when '-chat' or ':chat' is present in model name. You must select 'chat' if you want to use this model in Chat Turn nodes.",
        enum: ["text", "chat"],
        default: "text",
      },
      system_msg: {
        type: "string",
        title: "system_msg (chat models only)",
        description:
          "Enter your system message here. Note that the type of model must be set to 'chat' for this to be passed.",
        default: "",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "Amount of randomness injected into the response. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and temp closer to 1 for creative and generative tasks.",
        default: 1.0,
        minimum: 0,
        maximum: 1.0,
        multipleOf: 0.01,
      },
      format: {
        type: "string",
        title: "format",
        description:
          "The JSON schema to use for structured outputs. Note that using structured outputs, you should still prompt the model to output JSON. (Supported by Ollama since Dec 6 2024. For more info, see https://ollama.com/blog/structured-outputs)",
        default: "",
      },
      num_ctx: {
        type: "integer",
        title: "num_ctx",
        description:
          "How many tokens to allow in the *input* to the model. Defaults to Ollama's default setting of 2048. You must increase this if your context is lengthy.",
        minimum: 1,
        default: 2048,
      },
      raw: {
        type: "boolean",
        title: "raw",
        description:
          "Whether to disable the templating done by Ollama. If checked, you'll need to insert annotations ([INST]) in your prompt.",
        default: false,
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          'Only sample from the top K options for each subsequent token. Used to remove "long tail" low probability responses. Defaults to -1, which disables it.',
        minimum: -1,
        default: -1,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Does nucleus sampling, in which we compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. Defaults to -1, which disables it. Note that you should either alter temperature or top_p, but not both.",
        default: -1,
        minimum: -1,
        maximum: 1,
        multipleOf: 0.001,
      },
      seed: {
        type: "integer",
        title: "seed",
        description:
          "If specified, the OpenAI API will make a best effort to sample deterministically, such that repeated requests with the same seed and parameters should return the same result. Determinism is not guaranteed.",
        allow_empty_str: true,
      },
      stop_sequences: {
        type: "string",
        title: "stop_sequences",
        description:
          'Sequences where the API will stop generating further tokens. Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    format: {
      "ui:help":
        "Leave blank to not specify any structured outputs. NOTE: JSON schemas must NOT have trailing commas.",
      "ui:widget": "textarea",
    },
    raw: {
      "ui:help": "Defaults to false.",
    },
  },
  postprocessors: {
    stop_sequences: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return str
        .match(/"((?:[^"\\]|\\.)*)"/g)
        ?.map((s) => s.substring(1, s.length - 1)); // split on double-quotes but exclude escaped double-quotes inside the group
    },
  },
};

/**
 * Amazon Bedrock, through the Converse API -- one request shape for every
 * vendor on Bedrock, which is why a single form replaces the per-vendor ones
 * ChainForge used to carry.
 *
 * Which models an account can call depends on its region and the access it has
 * been granted, and most models released since 2025 cannot be called by their
 * bare ID on on-demand throughput at all: they need a cross-region inference
 * profile, which is the model ID behind a geography prefix (us., eu., apac.,
 * jp., au.) or global. So the model here is typed in, and the suggestions use
 * the US profiles.
 * See https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
 */
export const BedrockSettings: ModelSettingsDict = {
  fullName: "Amazon Bedrock",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Bedrock",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "The Bedrock model or inference profile to call. Which models you can use depends on your region and the model access granted to your AWS account, so type in whatever your account serves -- the catalog is in the Bedrock console. Most models released since 2025 reject their bare model ID on on-demand throughput and need an inference profile: the same ID behind a 'us.', 'eu.', 'apac.', 'jp.', 'au.' or 'global.' prefix. Swap the prefix to match your region.",
        enum: [
          "us.anthropic.claude-sonnet-5",
          "us.anthropic.claude-opus-4-8",
          "us.anthropic.claude-haiku-4-5-20251001-v1:0",
          "us.amazon.nova-2-lite-v1:0",
          "us.meta.llama4-maverick-17b-instruct-v1:0",
          "us.meta.llama4-scout-17b-instruct-v1:0",
          "us.mistral.mistral-large-3-675b-instruct",
          "us.openai.gpt-oss-120b-1:0",
        ],
        default: "us.anthropic.claude-sonnet-5",
        shortname_map: {
          "us.anthropic.claude-sonnet-5": "Claude Sonnet 5",
          "us.anthropic.claude-opus-4-8": "Claude Opus 4.8",
          "us.anthropic.claude-haiku-4-5-20251001-v1:0": "Claude Haiku 4.5",
          "us.amazon.nova-2-lite-v1:0": "Nova 2 Lite",
          "us.meta.llama4-maverick-17b-instruct-v1:0": "Llama 4 Maverick",
          "us.meta.llama4-scout-17b-instruct-v1:0": "Llama 4 Scout",
          "us.mistral.mistral-large-3-675b-instruct": "Mistral Large 3",
          "us.openai.gpt-oss-120b-1:0": "gpt-oss-120b",
        },
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description:
          "A prompt giving the model context or a persona. Leave blank to send none.",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "Controls the 'creativity' or randomness of the response. Bedrock's accepted range differs by model; most take 0 to 1.",
        default: 1.0,
        minimum: 0,
        maximum: 1.0,
        multipleOf: 0.01,
      },
      max_tokens: {
        type: "integer",
        title: "maxTokens",
        description:
          "The maximum number of tokens to generate. Leave blank for the model's default.",
        default: 1024,
      },
      top_p: {
        type: "number",
        title: "topP",
        description:
          "Nucleus sampling: the cumulative probability of the tokens to sample from. Set to -1 to leave unspecified.",
        default: -1,
        minimum: -1,
        maximum: 1,
        multipleOf: 0.001,
      },
      stop_sequences: {
        type: "string",
        title: "stopSequences",
        description:
          'Sequences where the model will stop generating. Enclose each in double-quotes "" and separate them with whitespace.',
        default: "",
      },
      additional_model_request_fields: {
        type: "string",
        title: "additionalModelRequestFields",
        description:
          'Parameters that Converse does not take but the model does, as a JSON object -- for instance {"top_k": 200} for Claude. Leave blank to send none.',
        default: "",
        allow_empty_str: true,
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help":
        "Defaults to us.anthropic.claude-sonnet-5. Any model or inference profile your account can call may be typed in.",
      "ui:widget": "datalist",
    },
    system_msg: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to 'You are a helpful assistant.'",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    max_tokens: {
      "ui:help": "Defaults to 1024.",
    },
    top_p: {
      "ui:help": "Defaults to -1 (unspecified).",
    },
    stop_sequences: {
      "ui:help": "Defaults to no stop sequences.",
    },
    additional_model_request_fields: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to none. Must be a JSON object.",
    },
  },
  postprocessors: {
    stop_sequences: (str) => {
      if (typeof str !== "string") return str;
      if (str.trim().length === 0) return [];
      return str
        .match(/"((?:[^"\\]|\\.)*)"/g)
        ?.map((s) => s.substring(1, s.length - 1)); // split on double-quotes but exclude escaped double-quotes inside the group
    },
  },
};

export const TogetherChatSettings: ModelSettingsDict = {
  fullName: "Together Chat",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "TogetherChat",
      },
      model: {
        type: "string",
        title: "model",
        description:
          "The Together model to query. Pick a popular one, or type any model ID from https://docs.together.ai/docs/serverless-models -- Together serves far more than can be listed here.",
        enum: [
          "openai/gpt-oss-120b",
          "deepseek-ai/DeepSeek-V4.1-Flash",
          "Qwen/Qwen3.8-Flash",
          "Qwen/Qwen3.5-9B",
          "zai-org/GLM-5.3-Flash",
          "moonshotai/Kimi-K3",
          "MiniMaxAI/MiniMax-M3",
          "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        ],
        default: "openai/gpt-oss-120b",
        shortname_map: {
          "openai/gpt-oss-120b": "gpt-oss-120b",
          "deepseek-ai/DeepSeek-V4.1-Flash": "DeepSeek V4.1 Flash",
          "Qwen/Qwen3.8-Flash": "Qwen3.8 Flash",
          "Qwen/Qwen3.5-9B": "Qwen3.5 9B",
          "zai-org/GLM-5.3-Flash": "GLM-5.3 Flash",
          "moonshotai/Kimi-K3": "Kimi K3",
          "MiniMaxAI/MiniMax-M3": "MiniMax M3",
          "meta-llama/Llama-3.3-70B-Instruct-Turbo": "Llama 3.3 70B",
        },
      },
      temperature: {
        type: "number",
        title: "temperature",
        description:
          "Amount of randomness injected into the response. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and temp closer to 1 for creative and generative tasks.",
        default: 1,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.01,
      },
      max_gen_len: {
        type: "integer",
        title: "max_tokens",
        description:
          "The maximum number of tokens to generate for each response.",
        default: 1024,
        minimum: 1,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Does nucleus sampling, in which we compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. Defaults to -1, which disables it. Note that you should either alter temperature or top_p, but not both.",
        default: 1,
        minimum: 0.01,
        maximum: 1,
        multipleOf: 0.001,
      },
    },
  },
  postprocessors: {
    stop_sequences: (str) => {
      if (typeof str !== "string" || str.trim().length === 0) return [];
      return str
        .match(/"((?:[^"\\]|\\.)*)"/g)
        ?.map((s) => s.substring(1, s.length - 1)); // split on double-quotes but exclude escaped double-quotes inside the group
    },
  },

  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help": "Defaults to Llama-3.3-70B",
      "ui:widget": "datalist",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    max_tokens: {
      "ui:help": "Defaults to 1024.",
    },
    num_generations: {
      "ui:help": "Defaults to 1.",
    },
    k: {
      "ui:help": "Defaults to 0.",
    },
    p: {
      "ui:help": "Defaults to 1.",
    },
    stop_sequences: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to no sequence",
    },
  },
};

export const WebLLMSettings: ModelSettingsDict = {
  fullName: "WebLLM (In-browser)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Qwen2.5 0.5B",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "The model to run fully in-browser on WebGPU -- no API key, and nothing leaves the machine. Each is downloaded and cached the first time it is used, so the smaller ones start fastest; sizes are given below.",
        enum: [
          NativeLLM.WebLLM_Gemma3_1B,
          NativeLLM.WebLLM_Llama3_2_1B,
          NativeLLM.WebLLM_Qwen2_5_0_5B,
          NativeLLM.WebLLM_Qwen3_5_0_8B,
          NativeLLM.WebLLM_SmolLM2_1_7B,
          NativeLLM.WebLLM_Qwen3_1_7B,
        ],
        default: NativeLLM.WebLLM_Qwen2_5_0_5B,
        shortname_map: {
          [NativeLLM.WebLLM_Gemma3_1B]: "Gemma 3 1B (711 MB)",
          [NativeLLM.WebLLM_Llama3_2_1B]: "Llama 3.2 1B (879 MB)",
          [NativeLLM.WebLLM_Qwen2_5_0_5B]: "Qwen2.5 0.5B (945 MB)",
          [NativeLLM.WebLLM_Qwen3_5_0_8B]: "Qwen3.5 0.8B (1.6 GB)",
          [NativeLLM.WebLLM_SmolLM2_1_7B]: "SmolLM2 1.7B (1.8 GB)",
          [NativeLLM.WebLLM_Qwen3_1_7B]: "Qwen3 1.7B (2 GB)",
        },
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description: "Optional system prompt prepended to the conversation.",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description: "Sampling temperature for generation.",
        default: 0.7,
        minimum: 0,
        maximum: 2,
        multipleOf: 0.01,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description: "Nucleus sampling parameter.",
        default: 1,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.01,
      },
      max_tokens: {
        type: "integer",
        title: "max_tokens",
        description: "Maximum output tokens per generation.",
        default: 512,
        minimum: 1,
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:widget": "datalist",
      "ui:help": "Defaults to Qwen2.5-0.5B.",
    },
    system_msg: {
      "ui:widget": "textarea",
    },
    temperature: {
      "ui:widget": "range",
    },
    top_p: {
      "ui:widget": "range",
    },
  },
  postprocessors: {},
};

// A lookup table indexed by base_model.
export const ModelSettings: Dict<ModelSettingsDict> = {
  "gpt-3.5-turbo": ChatGPTSettings,
  "gpt-4": GPT4Settings,
  "dall-e": DalleSettings,
  "gpt-image-1": GPTImageSettings, // key kept for saved flows; covers all GPT Image models
  "claude-v1": ClaudeSettings,
  "gemini-2.5": Gemini25Settings,
  "gemini-image": GeminiImageSettings,
  "azure-openai": AzureOpenAISettings,
  hf: HuggingFaceSettings,
  ollama: OllamaSettings,
  bedrock: BedrockSettings,
  // The per-vendor keys flows were saved with before Bedrock's Converse API
  // let one form cover every vendor. They all open that form now.
  "br.anthropic.claude": BedrockSettings,
  "br.ai21.j2": BedrockSettings,
  "br.amazon.titan": BedrockSettings,
  "br.cohere.command": BedrockSettings,
  "br.mistral.mistral": BedrockSettings,
  "br.mistral.mixtral": BedrockSettings,
  "br.meta.llama2": BedrockSettings,
  "br.meta.llama3": BedrockSettings,
  together: TogetherChatSettings,
  deepseek: DeepSeekSettings,
  minimax: MiniMaxSettings,
  openrouter: OpenRouterSettings,
  "openrouter-image": OpenRouterImageSettings,
  webllm: WebLLMSettings,
};

// A lookup that converts the base_model names into LLMProviders.
// Used for backwards compatibility.
// TODO in future: Deprecate base_model and migrate fully to using LLMProvider type throughout.
export function baseModelToProvider(base_model: string): LLMProvider {
  const lookup: Record<string, LLMProvider> = {
    "gpt-3.5-turbo": LLMProvider.OpenAI,
    "gpt-4": LLMProvider.OpenAI,
    "dall-e": LLMProvider.OpenAI,
    "gpt-image-1": LLMProvider.OpenAI,
    "claude-v1": LLMProvider.Anthropic,
    "gemini-2.5": LLMProvider.Google,
    "gemini-image": LLMProvider.Google,
    "azure-openai": LLMProvider.Azure_OpenAI,
    hf: LLMProvider.HuggingFace,
    ollama: LLMProvider.Ollama,
    bedrock: LLMProvider.Bedrock,
    "br.anthropic.claude": LLMProvider.Bedrock,
    "br.ai21.j2": LLMProvider.Bedrock,
    "br.amazon.titan": LLMProvider.Bedrock,
    "br.cohere.command": LLMProvider.Bedrock,
    "br.mistral.mistral": LLMProvider.Bedrock,
    "br.mistral.mixtral": LLMProvider.Bedrock,
    "br.meta.llama2": LLMProvider.Bedrock,
    "br.meta.llama3": LLMProvider.Bedrock,
    together: LLMProvider.Together,
    deepseek: LLMProvider.DeepSeek,
    minimax: LLMProvider.MiniMax,
    openrouter: LLMProvider.OpenRouter,
    "openrouter-image": LLMProvider.OpenRouter,
    webllm: LLMProvider.WebLLM,
  };
  return lookup[base_model] ?? LLMProvider.Custom;
}

export function getSettingsSchemaForLLM(
  llm_name: string,
): ModelSettingsDict | undefined {
  // Image models have their own settings, so they're matched before falling
  // back to their provider's (text) settings.
  if (isOpenAIImageModel(llm_name))
    return llm_name.startsWith("dall-e") ? DalleSettings : GPTImageSettings;
  if (isGeminiImageModel(llm_name)) return GeminiImageSettings;
  if (isOpenRouterImageModel(llm_name)) return OpenRouterImageSettings;

  const llm_provider = getProvider(llm_name);

  const provider_to_settings_schema: {
    [K in LLMProvider]?: ModelSettingsDict;
  } = {
    [LLMProvider.OpenAI]: GPT4Settings,
    [LLMProvider.Anthropic]: ClaudeSettings,
    [LLMProvider.Google]: Gemini25Settings,
    [LLMProvider.Azure_OpenAI]: AzureOpenAISettings,
    [LLMProvider.HuggingFace]: HuggingFaceSettings,
    [LLMProvider.Bedrock]: BedrockSettings,
    [LLMProvider.Ollama]: OllamaSettings,
    [LLMProvider.Together]: TogetherChatSettings,
    [LLMProvider.DeepSeek]: DeepSeekSettings,
    [LLMProvider.MiniMax]: MiniMaxSettings,
    [LLMProvider.OpenRouter]: OpenRouterSettings,
    [LLMProvider.WebLLM]: WebLLMSettings,
  };

  if (llm_provider === LLMProvider.Custom) {
    return (
      ModelSettings[llm_name] ??
      ModelSettings[llm_name?.endsWith("/") ? llm_name : `${llm_name}/`]
    );
  } else if (llm_provider && llm_provider in provider_to_settings_schema)
    return provider_to_settings_schema[llm_provider];
  else {
    console.error(`Could not find provider for llm ${llm_name}`);
    return undefined;
  }
}

/**
 * Processes settings values to the correct types according to schema for the model 'llm'.
 * @param {*} settings_dict A dict of form setting_name: value (string: string)
 * @param {*} llm A string of the name of the model to query.
 */
export function typecastSettingsDict(
  settings_dict: ModelSettingsDict,
  llm: string,
) {
  const settings = getSettingsSchemaForLLM(llm);
  const schema = settings?.schema?.properties ?? {};
  const postprocessors = settings?.postprocessors ?? {};

  // Return a clone of settings dict but with its values correctly typecast and postprocessed
  return transformDict(settings_dict, undefined, undefined, (key, val) => {
    if (key in schema) {
      // Check for postprocessing for this key; if so, its 'type' is determined by the processor:
      if (key in postprocessors) return postprocessors[key](val);

      // For other cases, use 'type' to typecast it:
      const typeof_setting = schema[key].type ?? "string";
      if (typeof_setting === "number")
        // process numbers (floats)
        return parseFloat(val);
      else if (typeof_setting === "integer")
        // process integers
        return parseInt(val);
      else if (typeof_setting === "boolean")
        // process booleans
        return val.trim().toLowerCase() === "true";
    }
    return val; // process strings
  });
}

/**
 * Add new model provider to the AvailableLLMs list. Also adds the respective ModelSettings schema and rate limit.
 * @param {*} name The name of the provider, to use in the dropdown menu and default name. Must be unique.
 * @param {*} emoji The emoji to use for the provider. Optional.
 * @param {*} models A list of models the user can select from this provider. Optional.
 * @param {*} rate_limit
 * @param {*} settings_schema
 */
export const setCustomProvider = (
  name: string,
  emoji: string,
  models?: string[],
  rate_limit?: number | string,
  settings_schema?: CustomLLMProviderSpec["settings_schema"],
  category?: string,
) => {
  if (typeof emoji === "string" && (emoji.length === 0 || emoji.length > 2))
    throw new Error(`Emoji for a custom provider must have a character.`);
  if ((category ?? "model") !== "model") return;

  const new_provider: Dict<JSONCompatible> = { name };
  new_provider.category = category || "model";
  new_provider.emoji = emoji || "✨";

  // Each LLM *model* must have a unique name. To avoid name collisions, for custom providers,
  // the full LLM model name is a path, __custom/<provider_name>/<submodel name>
  // If there's no submodel, it's just __custom/<provider_name>.
  const base_model = `__custom/${name}`; // no trailing slash
  new_provider.base_model = base_model;
  new_provider.model =
    Array.isArray(models) && models.length > 0
      ? `${base_model}/${models[0]}`
      : base_model;

  // Build the settings form schema for this new custom provider
  const compiled_schema: ModelSettingsDict = {
    fullName: `${name} (custom provider)`,
    schema: {
      type: "object",
      required: ["shortname"],
      properties: {
        shortname: {
          type: "string",
          title: "Nickname",
          description:
            "Unique identifier to appear in ChainForge. Keep it short.",
          default: name,
        },
      },
    },
    uiSchema: {
      "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
      shortname: {
        "ui:autofocus": true,
      },
    },
    postprocessors: {},
  };

  const canon = (id: string) => id.replace(/\/+$/, "");

  ModelSettings[canon(base_model)] = compiled_schema;

  if (typeof rate_limit === "number" && rate_limit > 0) {
    RATE_LIMIT_BY_MODEL[canon(base_model)] = rate_limit;
  } else {
    MAX_CONCURRENT[canon(base_model)] = 1;
  }

  // Add a models selector if there's multiple models
  if (Array.isArray(models) && models.length > 0) {
    compiled_schema.schema.properties.model = {
      type: "string",
      title: "Model",
      description: `Select a ${name} model to query.`,
      enum: models,
      default: models[0],
    };
    compiled_schema.uiSchema.model = {
      "ui:help": `Defaults to ${models[0]}`,
    };
  }

  // Add the rest of the settings window if there's one
  if (settings_schema) {
    compiled_schema.schema.properties = {
      ...compiled_schema.schema.properties,
      ...settings_schema.settings,
    };
    compiled_schema.uiSchema = {
      ...compiled_schema.uiSchema,
      ...settings_schema.ui,
    };
  }

  // Check for a default temperature
  const default_temp =
    compiled_schema?.schema?.properties?.temperature?.default;
  if (default_temp !== undefined) new_provider.temp = default_temp;

  // Add the built provider and its settings to the global lookups:
  const AvailableLLMs = useStore.getState().AvailableLLMs;
  const prev_provider_idx = AvailableLLMs.findIndex((d) => d.name === name);
  if (prev_provider_idx > -1)
    AvailableLLMs[prev_provider_idx] = new_provider as LLMSpec;
  else AvailableLLMs.push(new_provider as LLMSpec);
  ModelSettings[base_model] = compiled_schema;

  // Add rate limit info, if specified
  if (
    rate_limit !== undefined &&
    typeof rate_limit === "number" &&
    rate_limit > 0
  ) {
    RATE_LIMIT_BY_MODEL[base_model] = rate_limit;
  } else {
    MAX_CONCURRENT[base_model] = 1;
  }

  // Commit changes to LLM list
  useStore.getState().setAvailableLLMs([...AvailableLLMs]);
};

export const setCustomProviders = (providers: CustomLLMProviderSpec[]) => {
  (providers || [])
    .filter((p) => (p?.category ?? "model") === "model")
    .forEach((p) =>
      setCustomProvider(
        p.name,
        p.emoji,
        p.models,
        p.rate_limit,
        p.settings_schema,
        p.category,
      ),
    );
};
export const getTemperatureSpecForModel = (modelName: string) => {
  if (modelName in ModelSettings) {
    const temperature_property =
      ModelSettings[modelName].schema?.properties?.temperature;
    if (temperature_property) {
      return {
        minimum: temperature_property.minimum as number,
        maximum: temperature_property.maximum as number,
        default: temperature_property.default as number,
      };
    }
  }
  return null;
};

export const postProcessFormData = (
  settingsSpec: ModelSettingsDict,
  formData: Dict<JSONCompatible>,
) => {
  // Strip all 'model' and 'shortname' props in the submitted form, as these are passed elsewhere or unecessary for the backend
  const skip_keys = { model: true, shortname: true };

  const new_data: Dict<JSONCompatible> = {};
  const postprocessors = settingsSpec?.postprocessors
    ? settingsSpec.postprocessors
    : {};

  Object.keys(formData).forEach((key) => {
    if (key in skip_keys) return;
    if (key in postprocessors)
      new_data[key] = postprocessors[key](
        formData[key] as string | number | boolean,
      );
    else new_data[key] = formData[key];
  });

  return new_data;
};

export const getDefaultModelFormData = (
  settingsSpec: string | ModelSettingsDict,
) => {
  if (typeof settingsSpec === "string")
    settingsSpec = ModelSettings[settingsSpec];
  const default_formdata: Dict<JSONCompatible> = {};
  const schema = settingsSpec.schema;
  Object.keys(schema.properties).forEach((key) => {
    default_formdata[key] =
      "default" in schema.properties[key]
        ? schema.properties[key].default
        : null;
  });
  return default_formdata;
};

export const getDefaultModelSettings = (modelName: string) => {
  if (!(modelName in ModelSettings)) {
    console.warn(
      `Model ${modelName} not found in list of available model settings.`,
    );
    return {};
  }
  const settingsSpec = ModelSettings[modelName];
  return postProcessFormData(
    settingsSpec,
    getDefaultModelFormData(settingsSpec),
  );
};
