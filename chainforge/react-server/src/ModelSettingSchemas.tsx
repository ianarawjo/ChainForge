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
import { deepcopy, transformDict } from "./backend/utils";
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
        enum: [
          "gpt-5",
          "gpt-5-mini",
          "gpt-5-nano",
          "gpt-5-chat-latest",
          "o3",
          "o3-mini",
          "gpt-4.1",
          "gpt-4.1-mini",
          "gpt-4.1-nano",
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "o1",
          "o1-mini",
          "o1-pro",
          "gpt-4.5-preview",
          "gpt-3.5-turbo",
          "gpt-4o-2024-05-13",
          "gpt-4o-2024-08-06",
          "chatgpt-4o-latest",
          "gpt-4",
          "gpt-4-turbo-2024-04-09",
          "gpt-4-turbo-preview",
          "gpt-4-0125-preview",
          "gpt-4-1106-preview",
          "gpt-4-32k",
          "gpt-4-0613",
          "gpt-4-0314",
          "gpt-4-32k-0613",
          "gpt-4-32k-0314",
          "gpt-3.5-turbo-0125",
          "gpt-3.5-turbo-1106",
          "gpt-3.5-turbo-0613",
          "gpt-3.5-turbo-0301",
          "gpt-3.5-turbo-16k",
          "gpt-3.5-turbo-16k-0613",
          "gpt-3.5-turbo-instruct",
          "text-davinci-003",
          "text-davinci-002",
          "code-davinci-002",
        ],
        default: "gpt-4o-mini",
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
        default: "GPT-4o-mini",
      },
      model: {
        ...ChatGPTSettings.schema.properties.model,
        default: "gpt-4o-mini",
      },
    },
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
    model: {
      "ui:help": "Defaults to gpt-4o-mini.",
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
        enum: ["MiniMax-M2.7", "MiniMax-M2.7-highspeed"],
        default: "MiniMax-M2.7",
        shortname_map: {
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
        enum: [
          "claude-opus-5",
          "claude-sonnet-5",
          "claude-haiku-4-5",
          "claude-fable-5-1",
          "claude-3-7-sonnet-latest",
          "claude-3-7-sonnet-20250219",
          "claude-3-opus-latest",
          "claude-3-5-sonnet-latest",
          "claude-3-5-haiku-latest",
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-5-sonnet-20240620",
          "claude-3-haiku-20240307",
          "claude-2.1",
          "claude-2",
          "claude-2.0",
          "claude-instant-1",
          "claude-instant-1.1",
          "claude-instant-1.2",
          "claude-v1",
          "claude-v1-100k",
          "claude-instant-v1",
          "claude-instant-v1-100k",
          "claude-v1.3",
          "claude-v1.3-100k",
          "claude-v1.2",
          "claude-v1.0",
          "claude-instant-v1.1",
          "claude-instant-v1.1-100k",
          "claude-instant-v1.0",
        ],
        default: "claude-3-5-sonnet-latest",
        shortname_map: {
          "claude-3-opus-20240229": "claude-3-opus",
          "claude-3-opus-latest": "claude-3-opus",
          "claude-3-sonnet-20240229": "claude-3-sonnet",
          "claude-3-5-sonnet-20240620": "claude-3.5-sonnet",
          "claude-3-5-sonnet-latest": "claude-3.5-sonnet",
          "claude-3-haiku-20240307": "claude-3-haiku",
          "claude-3-5-haiku-latest": "claude-3.5-haiku",
          "claude-3-7-sonnet-latest": "claude-3.7-sonnet",
          "claude-3-7-sonnet-20250219": "claude-3.7-sonnet",
          "claude-opus-5": "Claude Opus 5",
          "claude-sonnet-5": "Claude Sonnet 5",
          "claude-haiku-4-5": "Claude Haiku 4.5",
          "claude-fable-5-1": "Claude Fable 5.1",
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
        "Defaults to claude-2.1. Note that Anthropic models are subject to change. Model names prior to Claude 2, including 100k context window, are no longer listed on the Anthropic site, so they may or may not work.",
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
        enum: [
          "gemini-3.8-flash",
          "gemini-3.6-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.1-pro-preview",
          "gemini-2.5-pro",
          "gemini-2.5-flash",
          "gemini-2.5-flash-lite",
          "gemini-2.0-flash",
          "gemini-2.0-flash-lite",
          "gemini-embedding-001",
          "text-embedding-005",
          "text-embedding-004",
          "text-multilingual-embedding-002",
        ],
        default: "gemini-3.8-flash",
        shortname_map: {
          "gemini-2.5-pro": "Gemini 2.5 Pro",
          "gemini-2.5-flash": "Gemini 2.5 Flash",
          "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
          "gemini-2.0-flash": "Gemini 2.0 Flash",
          "gemini-2.0-flash-lite": "Gemini 2.0 Flash Lite",
          "gemini-embedding-001": "gemini-embedding-001",
          "text-embedding-005": "text-embedding-005",
          "text-embedding-004": "text-embedding-004",
          "text-multilingual-embedding-002": "text-multilingual-embedding-002",
          "gemini-3.8-flash": "Gemini 3.8 Flash",
          "gemini-3.6-flash": "Gemini 3.6 Flash",
          "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
          "gemini-3.1-pro-preview": "Gemini 3.1 Pro",
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
        "Defaults to gemini-3.8-flash. Gemini 2.5 and 2.0 models are no longer available to new API keys.",
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
      api_version: {
        type: "string",
        title: "API Version (date)",
        description:
          "Used when calling the OpenAI API through Azure services. Normally you don't need to change this setting.",
        default: "2023-05-15",
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

const HuggingFaceTextInferenceSettings: ModelSettingsDict = {
  fullName: "HuggingFace-hosted text generation models",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Falcon.7B",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "Select a suggested HuggingFace-hosted model to query using the Inference API. For more details, check out https://huggingface.co/inference-api",
        enum: [
          "mistralai/Mistral-7B-Instruct-v0.1",
          "HuggingFaceH4/zephyr-7b-beta",
          "tiiuae/falcon-7b-instruct",
          "microsoft/DialoGPT-large",
          "bigscience/bloom-560m",
          "gpt2",
          "bigcode/santacoder",
          "bigcode/starcoder",
          "Other (HuggingFace)",
        ],
        default: "tiiuae/falcon-7b-instruct",
        shortname_map: {
          "mistralai/Mistral-7B-Instruct-v0.1": "Mistral-7B",
          "HuggingFaceH4/zephyr-7b-beta": "Zephyr-7B",
          "tiiuae/falcon-7b-instruct": "Falcon-7B",
          "microsoft/DialoGPT-large": "DialoGPT",
          "bigscience/bloom-560m": "Bloom560M",
          gpt2: "GPT-2",
          "bigcode/santacoder": "santacoder",
          "bigcode/starcoder": "starcoder",
        },
      },
      model_type: {
        type: "string",
        title: "Model Type (Text or Chat)",
        description:
          "Select the type of model you are querying. You must selected 'chat' if you want to pass conversation history in Chat Turn nodes.",
        enum: ["text", "chat"],
        default: "text",
      },
      temperature: {
        type: "number",
        title: "temperature",
        description: "Controls the 'creativity' or randomness of the response.",
        default: 1.0,
        minimum: 0,
        maximum: 5.0,
        multipleOf: 0.01,
      },
      num_continuations: {
        type: "integer",
        title: "Number of times to continue generation (ChainForge-specific)",
        description:
          "The number of times to feed the model response back into the model, to continue generating text past the 250 token limit per API call. Only useful for text completions models like gpt2. Set to 0 to ignore.",
        default: 0,
        minimum: 0,
        maximum: 6,
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          "Sets the maximum number of tokens to sample from on each step. Set to -1 to remain unspecified.",
        minimum: -1,
        default: -1,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Sets the maximum cumulative probability of tokens to sample from (from 0 to 1.0). Set to -1 to remain unspecified.",
        default: -1,
        minimum: -1,
        maximum: 1,
        multipleOf: 0.001,
      },
      repetition_penalty: {
        type: "number",
        title: "repetition_penalty",
        description:
          "The more a token is used within generation the more it is penalized to not be picked in successive generation passes. Set to -1 to remain unspecified.",
        minimum: -1,
        default: -1,
        maximum: 100,
        multipleOf: 0.01,
      },
      max_new_tokens: {
        type: "integer",
        title: "max_new_tokens",
        description:
          "The amount of new tokens to be generated. Free HF models only support up to 250 tokens. Set to -1 to remain unspecified.",
        default: 250,
        minimum: -1,
        maximum: 250,
      },
      do_sample: {
        type: "boolean",
        title: "do_sample",
        description:
          "Whether or not to use sampling. Default is True; uses greedy decoding otherwise.",
        enum: [true, false],
        default: true,
      },
      use_cache: {
        type: "boolean",
        title: "use_cache",
        description:
          "Whether or not to fetch from HF's cache. There is a cache layer on the inference API to speedup requests HF has already seen. Most models can use those results as is as models are deterministic (meaning the results will be the same anyway). However if you use a non-deterministic model, you can set this parameter to prevent the caching mechanism from being used resulting in a real new query.",
        enum: [true, false],
        default: false,
      },
    },
  },

  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help": "Defaults to Falcon.7B.",
      "ui:widget": "datalist",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    top_k: {
      "ui:help": "Defaults to unspecified (-1)",
    },
    top_p: {
      "ui:help": "Defaults to unspecified (-1)",
      "ui:widget": "range",
    },
    repetition_penalty: {
      "ui:help": "Defaults to unspecified (-1)",
      "ui:widget": "range",
    },
    max_new_tokens: {
      "ui:help": "Defaults to 250 (max)",
    },
    num_continuations: {
      "ui:widget": "range",
    },
    do_sample: {
      "ui:widget": "radio",
    },
    use_cache: {
      "ui:widget": "radio",
      "ui:help":
        "Defaults to false in ChainForge. This differs from the HuggingFace docs, as CF's intended use case is evaluation, and for evaluation we want different responses each query.",
    },
  },

  postprocessors: {},
};

const AlephAlphaLuminousSettings: ModelSettingsDict = {
  fullName: "Aleph Alpha Luminous",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Luminous",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "Select a suggested Aleph Alpha model to query using the Aleph Alpha API. For more details, check out https://docs.aleph-alpha.com/api/available-models/",
        enum: [
          "luminous-extended",
          "luminous-extended-control",
          "luminous-base-control",
          "luminous-base",
          "luminous-supreme",
          "luminous-supreme-control",
        ],
        default: "luminous-base",
        shortname_map: {
          "luminous-extended": "luminous-ext",
          "luminous-extended-control": "luminous-ext-ctrl",
          "luminous-base-control": "luminous-base-ctrl",
          "luminous-base": "luminous-base",
          "luminous-supreme": "luminous-supr",
          "luminous-supreme-control": "luminous-supr-ctrl",
        },
      },
      chat_model: {
        type: "boolean",
        title: "chat_model",
        description: "Specifies whether the model is a chat model.",
        enum: [true, false],
        default: false,
      },
      system_msg: {
        type: "string",
        title: "System Message (chat models only)",
        description:
          "Enter your system message here. Note that the type of model must be set to 'chat' for this to be passed.",
        default: "You are a helpful assistant.",
        allow_empty_str: true,
      },
      temperature: {
        type: "number",
        title: "temperature",
        description: "Controls the 'creativity' or randomness of the response.",
        default: 0.0,
        minimum: 0,
        maximum: 1.0,
        multipleOf: 0.01,
      },
      maximum_tokens: {
        type: "integer",
        title: "Maximum Tokens",
        description:
          "The maximum number of tokens to generate in the chat completion.",
        default: 64,
      },
      stop_sequences: {
        type: "string",
        title: "stop_sequences",
        description:
          'Sequences where the API will stop generating further tokens. Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      best_of: {
        type: "integer",
        maximum: 100,
        minimum: 1,
        description:
          "best_of number of completions will be generated on server side. The completion with the highest log probability per token is returned, must be strictly greater than n",
        default: null,
      },
      log_probs: {
        type: "boolean",
        title: "log_probs",
        description:
          "Number of top log probabilities for each token generated.",
        enum: [true, false],
        default: false,
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          "Introduces random sampling for generated tokens by randomly selecting the next token from the k most likely options.",
        default: 0,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Introduces random sampling for generated tokens by randomly selecting the next token from the smallest possible set of tokens whose cumulative probability exceeds the probability top_p.",
        default: 0,
        minimum: 0,
        maximum: 1.0,
        multipleOf: 0.01,
      },
      sequence_penalty_min_length: {
        type: "integer",
        title: "sequence_penalty_min_length",
        description: "Minimal number of tokens to be considered as sequence.",
        default: 2,
      },
    },
  },
  uiSchema: {
    "ui:submitButtonOptions": UI_SUBMIT_BUTTON_SPEC,
    shortname: {
      "ui:autofocus": true,
    },
    model: {
      "ui:help": "Defaults to Luminous Base.",
      "ui:widget": "datalist",
    },
    chat_model: {
      "ui:widget": "radio",
      "ui:help":
        "Defaults to false. Set to true if you're using a chat-capable model.",
    },
    system_msg: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to 'You are a helpful assistant.'",
    },
    temperature: {
      "ui:help": "Defaults to 0.0.",
      "ui:widget": "range",
    },
    maximum_tokens: {
      "ui:help": "Defaults to 64.",
    },
    top_k: {
      "ui:help": "Defaults to 0",
    },
    top_p: {
      "ui:help": "Defaults to 0",
    },
    presence_penalty: {
      "ui:help": "Defaults to 0",
    },
    frequency_penalty: {
      "ui:help": "Defaults to 0",
    },
    sequence_penalty: {
      "ui:help": "Defaults to 0",
    },
    sequence_penalty_min_length: {
      "ui:help": "Defaults to 2",
    },
    repetition_penalties_include_prompt: {
      "ui:help": "Defaults to false",
      "ui:widget": "radio",
    },
    repetition_penalties_include_completion: {
      "ui:help": "Defaults to true",
      "ui:widget": "radio",
    },
    use_multiplicative_presence_penalty: {
      "ui:help": "Defaults to false",
      "ui:widget": "radio",
    },
    use_multiplicative_frequency_penalty: {
      "ui:help": "Defaults to false",
      "ui:widget": "radio",
    },
    use_multiplicative_sequence_penalty: {
      "ui:help": "Defaults to false",
      "ui:widget": "radio",
    },
    penalty_exceptions: {
      "ui:help": "Defaults to null",
    },
    penalty_exceptions_include_stop_sequences: {
      "ui:help": "Defaults to true",
      "ui:widget": "radio",
    },
    best_of: {
      "ui:help": "Defaults to 1 (max. 100)",
    },
    logit_bias: {
      "ui:help": "Defaults to null, type object",
    },
    log_probs: {
      "ui:widget": "radio",
    },
    stop_sequences: {
      "ui:help": "Defaults to null, string[]",
    },
    tokens: {
      "ui:help": "Defaults to false, nullable, boolean",
    },
    raw_completion: {
      "ui:help": "Defaults to false",
    },
    disable_optimizations: {
      "ui:help": "Defaults to false",
    },
    completion_bias_inclusion: {
      "ui:help": "Defaults to [], string[]",
    },
    completion_bias_inclusion_first_token_only: {
      "ui:help": "Defaults to false",
    },
    completion_bias_exclusion: {
      "ui:help": "Defaults to []",
    },
    completion_bias_exclusion_first_token_only: {
      "ui:help": "Defaults to false",
    },
    contextual_control_threshold: {
      "ui:help": "Defaults to null, is number",
    },
    control_log_additive: {
      "ui:help": "Defaults to true",
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
    log_probs: (bool) => {
      if (typeof bool !== "boolean") return bool;
      return bool ? 3 : null;
    },
    best_of: (a) => {
      if (typeof a !== "number") return a;
      return a === 1 ? null : a;
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

const BedrockClaudeSettings: ModelSettingsDict = {
  fullName: "Claude (Anthropic) via Amazon Bedrock",
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
        enum: [
          NativeLLM.Bedrock_Claude_3_Opus,
          NativeLLM.Bedrock_Claude_3_Haiku,
          NativeLLM.Bedrock_Claude_3_Sonnet,
          NativeLLM.Bedrock_Claude_Instant_1,
          NativeLLM.Bedrock_Claude_2,
          NativeLLM.Bedrock_Claude_2_1,
        ],
        default: NativeLLM.Bedrock_Claude_3_Haiku,
        shortname_map: {
          "anthropic.claude-3-sonnet-20240229-v1:0": "claude-3-sonnet",
          "anthropic.claude-3-haiku-20240307-v1:0": "claude-3-haiku",
        },
      },
      system_msg: {
        type: "string",
        title: "system_msg",
        description: "A system message to use with the model",
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
          // eslint-disable-next-line no-template-curly-in-string
          'Anthropic models expect prompts in the form "\\n\\nHuman: ${prompt}\\n\\nAssistant:". ChainForge wraps all prompts in this template by default. If you wish to' +
          // eslint-disable-next-line no-template-curly-in-string
          "explore custom prompt wrappers that deviate, write a Python template here with a single variable, ${prompt}, where the actual prompt text should go. Otherwise, leave this field blank. (Note that you should enter newlines as newlines, not escape codes like \\n.)",
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
        minimum: 1,
        default: 1,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Does nucleus sampling, in which we compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. Defaults to -1, which disables it. Note that you should either alter temperature or top_p, but not both.",
        default: 0.9,
        minimum: 0.001,
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
        "Defaults to claude-2. Note that Anthropic models in particular are subject to change. Model names prior to Claude 2, including 100k context window, are no longer listed on the Anthropic site, so they may or may not work.",
      "ui:widget": "datalist",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
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
        'Defaults to Anthropic\'s internal wrapper "\\n\\nHuman: {prompt}\\n\\nAssistant".',
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
};

const BedrockJurassic2Settings: ModelSettingsDict = {
  fullName: "Jurassic-2 (Ai21) via Amazon Bedrock",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Jurassic2",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a version of Jurassic 2 to query. For more details on the differences, see the AI21 API documentation.",
        enum: [
          NativeLLM.Bedrock_Jurassic_Mid,
          NativeLLM.Bedrock_Jurassic_Ultra,
        ],
        default: NativeLLM.Bedrock_Jurassic_Ultra,
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
      maxTokens: {
        type: "integer",
        title: "maxTokens",
        description:
          "The maximum number of tokens to generate for each response.",
        default: 1024,
        minimum: 1,
      },
      minTokens: {
        type: "integer",
        title: "minTokens",
        description:
          "The minimum number of tokens to generate for each response.",
        default: 1,
        minimum: 1,
      },
      numResults: {
        type: "integer",
        title: "numResults",
        description: "The number of responses to generate for a given prompt.",
        default: 1,
        minimum: 1,
      },
      stop_sequences: {
        type: "string",
        title: "stopSequences",
        description:
          'Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      topKReturn: {
        type: "integer",
        title: "topKReturn",
        description:
          "The number of top-scoring tokens to consider for each generation step.",
        minimum: 0,
        default: 0,
      },
      topP: {
        type: "number",
        title: "topP",
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
      "ui:help": "Defaults to Jurassic 2 Ultra.",
      "ui:widget": "datalist",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    maxTokens: {
      "ui:help": "Defaults to 1024.",
    },
    minTokens: {
      "ui:help": "Defaults to 1.",
    },
    topKReturn: {
      "ui:help": "Defaults to 0.",
    },
    topP: {
      "ui:help": "Defaults to 1.",
    },
    stop_sequences: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to no sequence",
    },
  },
};

const BedrockTitanSettings: ModelSettingsDict = {
  fullName: "Titan (Amazon) via Amazon Bedrock",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Titan",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a version of Amazon Titan to query. For more details on the differences, see the Amazon Titan API documentation.",
        enum: [
          NativeLLM.Bedrock_Titan_Large,
          NativeLLM.Bedrock_Titan_Light,
          NativeLLM.Bedrock_Titan_Express,
        ],
        default: NativeLLM.Bedrock_Titan_Large,
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
      maxTokenCount: {
        type: "integer",
        title: "maxTokens",
        description:
          "The maximum number of tokens to generate for each response.",
        default: 1024,
        minimum: 1,
      },
      stop_sequences: {
        type: "string",
        title: "stopSequences",
        description:
          'Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      topP: {
        type: "number",
        title: "topP",
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
      "ui:help": "Defaults to Titan Large",
      "ui:widget": "datalist",
    },
    temperature: {
      "ui:help": "Defaults to 1.0.",
      "ui:widget": "range",
    },
    maxTokenCount: {
      "ui:help": "Defaults to 1024.",
    },
    topP: {
      "ui:help": "Defaults to 1.",
    },
    stop_sequences: {
      "ui:widget": "textarea",
      "ui:help": "Defaults to no sequence",
    },
  },
};

const BedrockCommandTextSettings: ModelSettingsDict = {
  fullName: "Command Text (Cohere) via Amazon Bedrock",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "CommandText",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a version of Command Cohere to query. For more details on the differences, see the Cohere API documentation.",
        enum: [
          NativeLLM.Bedrock_Command_Text,
          NativeLLM.Bedrock_Command_Text_Light,
        ],
        default: NativeLLM.Bedrock_Command_Text,
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
      max_tokens: {
        type: "integer",
        title: "max_tokens",
        description:
          "The maximum number of tokens to generate for each response.",
        default: 1024,
        minimum: 1,
      },
      num_generations: {
        type: "integer",
        title: "num_generations",
        description: "The number of responses to generate for a given prompt.",
        default: 1,
        minimum: 1,
      },
      stop_sequences: {
        type: "string",
        title: "stop_sequences",
        description:
          'Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      k: {
        type: "integer",
        title: "k",
        description:
          "The number of top-scoring tokens to consider for each generation step.",
        minimum: 0,
        default: 0,
      },
      p: {
        type: "number",
        title: "p",
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
      "ui:help": "Defaults to Command Text",
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

const MistralSettings: ModelSettingsDict = {
  fullName: "Mistral models via Amazon Bedrock",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Mistral",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a version of Mistral model to query. For more details on the differences, see the Mistral API documentation.",
        enum: [
          NativeLLM.Bedrock_Mistral_Mistral,
          NativeLLM.Bedrock_Mistral_Mistral_Large,
        ],
        default: NativeLLM.Bedrock_Mistral_Mistral,
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
      max_tokens: {
        type: "integer",
        title: "max_tokens",
        description:
          "The maximum number of tokens to generate for each response.",
        default: 1024,
        minimum: 1,
      },
      stop_sequences: {
        type: "string",
        title: "stop",
        description:
          'Enclose stop sequences in double-quotes "" and use whitespace to separate them.',
        default: "",
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          "The number of top-scoring tokens to consider for each generation step.",
        minimum: 0,
        default: 0,
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
      "ui:help": "Defaults to Mistral",
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

const MixtralSettings = deepcopy(MistralSettings);

MixtralSettings.schema.properties = {
  ...deepcopy(MixtralSettings.schema.properties),
  ...{
    model: {
      type: "string",
      title: "Model Version",
      description:
        "Select a version of Mistral model to query. For more details on the differences, see the Mixtral API documentation.",
      enum: [NativeLLM.Bedrock_Mistral_Mixtral],
      default: NativeLLM.Bedrock_Mistral_Mixtral,
    },
    shortname: {
      type: "string",
      title: "Nickname",
      description: "Unique identifier to appear in ChainForge. Keep it short.",
      default: "Mixtral",
    },
  },
};

MixtralSettings.uiSchema.model = { "ui:help": "Defaults to Mixtral" };

const BedrockLlama2ChatSettings: ModelSettingsDict = {
  fullName: "Llama2Chat (Meta) via Amazon Bedrock",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "LlamaChat",
      },
      model: {
        type: "string",
        title: "Model Version",
        description:
          "Select a version of Meta Llama2 model to query. For more details on the differences, see the Meta Llama API documentation.",
        enum: [
          NativeLLM.Bedrock_Meta_LLama2Chat_13b,
          NativeLLM.Bedrock_Meta_LLama2Chat_70b,
        ],
        default: NativeLLM.Bedrock_Meta_LLama2Chat_13b,
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
        title: "max_gen_len",
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
      "ui:help": "Defaults to LlamaChat 13B",
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
          "Select a version of Together model to query. For more details on the differences, see the Together API documentation.",
        enum: [
          "zero-one-ai/Yi-34B-Chat",
          "allenai/OLMo-7B-Instruct",
          "allenai/OLMo-7B-Twin-2T",
          "allenai/OLMo-7B",
          "Austism/chronos-hermes-13b",
          "cognitivecomputations/dolphin-2.5-mixtral-8x7b",
          "databricks/dbrx-instruct",
          "deepseek-ai/DeepSeek-V3",
          "deepseek-ai/DeepSeek-R1",
          "deepseek-ai/deepseek-coder-33b-instruct",
          "deepseek-ai/deepseek-llm-67b-chat",
          "garage-bAInd/Platypus2-70B-instruct",
          "google/gemma-2-27b-it",
          "google/gemma-2-9b-it",
          "google/gemma-2b-it",
          "google/gemma-7b-it",
          "Gryphe/MythoMax-L2-13b",
          "lmsys/vicuna-13b-v1.5",
          "lmsys/vicuna-7b-v1.5",
          "codellama/CodeLlama-13b-Instruct-hf",
          "codellama/CodeLlama-34b-Instruct-hf",
          "codellama/CodeLlama-70b-Instruct-hf",
          "codellama/CodeLlama-7b-Instruct-hf",
          "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
          "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
          "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
          "meta-llama/Meta-Llama-3-8B-Instruct-Turbo",
          "meta-llama/Meta-Llama-3-70B-Instruct-Turbo",
          "meta-llama/Llama-3.2-3B-Instruct-Turbo",
          "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
          "meta-llama/Meta-Llama-3-70B-Instruct-Lite",
          "meta-llama/Llama-2-70b-chat-hf",
          "meta-llama/Llama-2-13b-chat-hf",
          "meta-llama/Llama-2-7b-chat-hf",
          "meta-llama/Llama-3-8b-chat-hf",
          "meta-llama/Llama-3-70b-chat-hf",
          "microsoft/WizardLM-2-8x22B",
          "mistralai/Mistral-7B-Instruct-v0.3",
          "mistralai/Mistral-7B-Instruct-v0.1",
          "mistralai/Mistral-7B-Instruct-v0.2",
          "mistralai/Mixtral-8x7B-Instruct-v0.1",
          "mistralai/Mixtral-8x22B-Instruct-v0.1",
          "NousResearch/Nous-Capybara-7B-V1p9",
          "NousResearch/Nous-Hermes-2-Mistral-7B-DPO",
          "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
          "NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT",
          "NousResearch/Nous-Hermes-llama-2-7b",
          "NousResearch/Nous-Hermes-Llama2-13b",
          "NousResearch/Nous-Hermes-2-Yi-34B",
          "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF",
          "openchat/openchat-3.5-1210",
          "Open-Orca/Mistral-7B-OpenOrca",
          "Qwen/Qwen2.5-7B-Instruct-Turbo",
          "Qwen/Qwen2.5-72B-Instruct-Turbo",
          "Qwen/Qwen2-72B-Instruct",
          "Qwen/Qwen2-VL-72B-Instruct",
          "Qwen/Qwen2.5-Coder-32B-Instruct",
          "Qwen/QwQ-32B-Preview",
          "Qwen/Qwen1.5-0.5B-Chat",
          "Qwen/Qwen1.5-1.8B-Chat",
          "Qwen/Qwen1.5-4B-Chat",
          "Qwen/Qwen1.5-7B-Chat",
          "Qwen/Qwen1.5-14B-Chat",
          "Qwen/Qwen1.5-32B-Chat",
          "Qwen/Qwen1.5-72B-Chat",
          "Qwen/Qwen1.5-110B-Chat",
          "snorkelai/Snorkel-Mistral-PairRM-DPO",
          "Snowflake/snowflake-arctic-instruct",
          "togethercomputer/alpaca-7b",
          "teknium/OpenHermes-2-Mistral-7B",
          "teknium/OpenHermes-2p5-Mistral-7B",
          "togethercomputer/Llama-2-7B-32K-Instruct",
          "togethercomputer/RedPajama-INCITE-Chat-3B-v1",
          "togethercomputer/RedPajama-INCITE-7B-Chat",
          "togethercomputer/StripedHyena-Nous-7B",
          "Undi95/ReMM-SLERP-L2-13B",
          "Undi95/Toppy-M-7B",
          "WizardLM/WizardLM-13B-V1.2",
          "upstage/SOLAR-10.7B-Instruct-v1.0",
        ],
        default: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
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

const BedrockLlama3Settings = deepcopy(BedrockLlama2ChatSettings);

BedrockLlama3Settings.schema.properties = {
  ...deepcopy(BedrockLlama3Settings.schema.properties),
  ...{
    model: {
      type: "string",
      title: "Model Version",
      description:
        "Select a version of Meta Llama3 model to query. For more details on the differences, see the Meta Llama3 API documentation.",
      enum: [
        NativeLLM.Bedrock_Meta_LLama3Instruct_8b,
        NativeLLM.Bedrock_Meta_LLama3Instruct_70b,
      ],
      default: NativeLLM.Bedrock_Meta_LLama3Instruct_8b,
    },
    shortname: {
      type: "string",
      title: "Nickname",
      description: "Unique identifier to appear in ChainForge. Keep it short.",
      default: "Llama3Instruct8b",
    },
  },
};

BedrockLlama3Settings.uiSchema.model = {
  "ui:help": "Defaults to Llama3Instruct8b",
};

const WebLLMSettings: ModelSettingsDict = {
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
        description: "Select a WebLLM model to run fully in-browser (WebGPU).",
        enum: [NativeLLM.WebLLM_Qwen2_5_0_5B, NativeLLM.WebLLM_SmolLM2_1_7B],
        default: NativeLLM.WebLLM_Qwen2_5_0_5B,
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
  hf: HuggingFaceTextInferenceSettings,
  "luminous-base": AlephAlphaLuminousSettings,
  ollama: OllamaSettings,
  "br.anthropic.claude": BedrockClaudeSettings,
  "br.ai21.j2": BedrockJurassic2Settings,
  "br.amazon.titan": BedrockTitanSettings,
  "br.cohere.command": BedrockCommandTextSettings,
  "br.mistral.mistral": MistralSettings,
  "br.mistral.mixtral": MixtralSettings,
  "br.meta.llama2": BedrockLlama2ChatSettings,
  "br.meta.llama3": BedrockLlama3Settings,
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
    "luminous-base": LLMProvider.Aleph_Alpha,
    ollama: LLMProvider.Ollama,
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
    [LLMProvider.HuggingFace]: HuggingFaceTextInferenceSettings,
    [LLMProvider.Aleph_Alpha]: AlephAlphaLuminousSettings,
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
  else if (llm_provider === LLMProvider.Bedrock) {
    return ModelSettings[llm_name.split("-")[0]];
  } else {
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
