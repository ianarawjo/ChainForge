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
          "gpt-3.5-turbo",
          "gpt-4-turbo",
          "gpt-4o",
          "gpt-4o-mini",
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
    max_tokens: {
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
        default: "GPT-4",
      },
      model: {
        ...ChatGPTSettings.schema.properties.model,
        default: "gpt-4-turbo",
      },
    },
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
    model: {
      "ui:help": "Defaults to gpt-4-turbo.",
    },
  },
  postprocessors: ChatGPTSettings.postprocessors,
};

const DalleSettings: ModelSettingsDict = {
  fullName: "Dall-E Image Models (OpenAI)",
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
          "Select an OpenAI image model to query. For more details on the differences, see the OpenAI API documentation.",
        enum: ["dall-e-3", "dall-e-2"],
        default: "dall-e-2",
      },
      size: {
        type: "string",
        title: "size",
        enum: ["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"],
        description:
          "The size of the generated images. NOTE: Dalle-2 supports from 256x256 to 1024x1024. Dalle-3 supports 1024x1024 and above. WARNING: Currently, all images are stored in browser memory. Be careful with Dall-E-3: you may run out of memory fast.",
        default: "256x256",
      },
      quality: {
        type: "string",
        title: "quality (DALL-E-3 ONLY)",
        enum: ["standard", "hd"],
        description:
          "The quality of the image that will be generated. hd creates images with finer details and greater consistency across the image. NOTE: This param is only supported for dall-e-3.",
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
        },
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

const PaLM2Settings: ModelSettingsDict = {
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
          "Select a PaLM model to query. For more details on the differences, see the Google PaLM API documentation.",
        enum: [
          "gemini-1.5-flash",
          "gemini-1.5-flash-8b",
          "gemini-1.5-pro",
          "gemini-1.0-pro",
          "gemini-pro",
          "text-bison-001",
          "chat-bison-001",
        ],
        default: "gemini-1.5-flash",
        shortname_map: {
          "text-bison-001": "PaLM2-text",
          "chat-bison-001": "PaLM2-chat",
          "gemini-pro": "Gemini 1.0",
          "gemini-1.5-pro": "Gemini 1.5",
          "gemini-1.0-pro": "Gemini 1.0",
          "gemini-1.5-flash": "Gemini Flash",
          "gemini-1.5-flash-8b": "Gemini Flash 8B",
        },
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
          "Controls the randomness of the output. Must be positive. Typical values are in the range: [0.0, 1.0]. Higher values produce a more random and varied response. A temperature of zero will be deterministic. (ChainForge only allows a max 1.0 temperature for PaLM).",
        default: 0.5,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.01,
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          "Sets the maximum number of tokens to sample from on each step. (The PaLM API uses combined nucleus and top-k sampling.) Set to -1 to use the default value.",
        minimum: -1,
        default: -1,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Sets the maximum cumulative probability of tokens to sample from. (The PaLM API uses combined nucleus and top-k sampling.) Set to -1 to use the default value.",
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
      "ui:help": "Defaults to gemini-pro.",
    },
    system_msg: {
      "ui:widget": "textarea",
    },
    temperature: {
      "ui:help": "Defaults to 0.5.",
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

const DalaiModelSettings: ModelSettingsDict = {
  fullName: "Dalai-hosted local model (Alpaca, Llama)",
  schema: {
    type: "object",
    required: ["shortname"],
    properties: {
      shortname: {
        type: "string",
        title: "Nickname",
        description:
          "Unique identifier to appear in ChainForge. Keep it short.",
        default: "Alpaca.7B",
      },
      model: {
        type: "string",
        title: "Model",
        description:
          "Select a Dalai-hosted model to query. For details on installing locally-run models via Dalai, check out https://cocktailpeanut.github.io/dalai/#/?id=_3-disk-space-requirements.",
        enum: [
          "alpaca.7B",
          "alpaca.13B",
          "llama.7B",
          "llama.13B",
          "llama.30B",
          "llama.65B",
        ],
        default: "alpaca.7B",
      },
      server: {
        type: "string",
        title: "URL of Dalai server",
        description:
          "Enter the URL where the Dalai server is running (usually localhost).",
        default: "http://localhost:4000",
      },
      temperature: {
        type: "number",
        title: "temperature",
        description: "Controls the 'creativity' or randomness of the response.",
        default: 0.5,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.01,
      },
      n_predict: {
        type: "integer",
        title: "n_predict",
        description:
          "Maximum number of tokens to include in the response. Must be greater than zero. Defaults to 128.",
        default: 128,
        minimum: 1,
      },
      threads: {
        type: "integer",
        title: "threads",
        description:
          "The number of threads to use on the local machine. Defaults to 4 in ChainForge, to support lower-end laptops. Set to higher the more powerful your machine.",
        minimum: 1,
        default: 4,
      },
      top_k: {
        type: "integer",
        title: "top_k",
        description:
          "Sets the maximum number of tokens to sample from on each step.",
        minimum: 1,
        default: 40,
      },
      top_p: {
        type: "number",
        title: "top_p",
        description:
          "Sets the maximum cumulative probability of tokens to sample from.",
        default: 0.9,
        minimum: 0,
        maximum: 1,
        multipleOf: 0.001,
      },
      repeat_last_n: {
        type: "integer",
        title: "repeat_last_n",
        description:
          "Use to control repetitions. When picking a new token, the model will avoid any of the tokens (~words) in the last n tokens, in a sliding window.",
        minimum: 0,
        default: 64,
      },
      repeat_penalty: {
        type: "number",
        title: "repeat_penalty",
        description:
          "Use to control repetitions. Penalizes words that have already appeared in the output, making them less likely to be generated again.",
        minimum: 0,
        default: 1.3,
        multipleOf: 0.001,
      },
      seed: {
        type: "integer",
        title: "seed",
        description:
          "The seed to use when generating new responses. The default is -1 (random). Change to fixed value for deterministic outputs across different runs.",
        minimum: -1,
        default: -1,
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
        "NOTE: You must have installed the selected model and have Dalai be running and accessible on the local environment with which you are running the ChainForge server.",
    },
    temperature: {
      "ui:help": "Defaults to 0.5.",
      "ui:widget": "range",
    },
    n_predict: {
      "ui:help": "Defaults to 128.",
    },
    top_k: {
      "ui:help": "Defaults to 40.",
    },
    top_p: {
      "ui:help": "Defaults to 0.9.",
      "ui:widget": "range",
    },
    seed: {
      "ui:help": "Defaults to -1 (random).",
    },
    repeat_last_n: {
      "ui:help": "Defaults to 64.",
    },
    repeat_penalty: {
      "ui:help": "Defaults to 1.3.",
    },
    stop_sequences: {
      "ui:widget": "textarea",
      "ui:help":
        "Defaults to no additional stop sequences (empty). Ignored for chat models.",
    },
    threads: {
      "ui:help": "Defaults to 4.",
    },
  },

  postprocessors: {},
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
      custom_model: {
        type: "string",
        title: "Custom HF model endpoint",
        description:
          "(Only used if you select 'Other' above.) Enter the HuggingFace id of the text generation model you wish to query via the inference API. Alternatively, if you have hosted a model on HF Inference Endpoints, you can enter the full URL of the endpoint here.",
        default: "",
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
      "ui:help": "Defaults to Jurassic 2 Ultra. ",
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
          "deepseek-ai/deepseek-coder-33b-instruct",
          "deepseek-ai/deepseek-llm-67b-chat",
          "garage-bAInd/Platypus2-70B-instruct",
          "google/gemma-2b-it",
          "google/gemma-7b-it",
          "Gryphe/MythoMax-L2-13b",
          "lmsys/vicuna-13b-v1.5",
          "lmsys/vicuna-7b-v1.5",
          "codellama/CodeLlama-13b-Instruct-hf",
          "codellama/CodeLlama-34b-Instruct-hf",
          "codellama/CodeLlama-70b-Instruct-hf",
          "codellama/CodeLlama-7b-Instruct-hf",
          "meta-llama/Llama-2-70b-chat-hf",
          "meta-llama/Llama-2-13b-chat-hf",
          "meta-llama/Llama-2-7b-chat-hf",
          "meta-llama/Llama-3-8b-chat-hf",
          "meta-llama/Llama-3-70b-chat-hf",
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
          "openchat/openchat-3.5-1210",
          "Open-Orca/Mistral-7B-OpenOrca",
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
        default: "meta-llama/Llama-2-7b-chat-hf",
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
      "ui:help": "Defaults to LlamaChat 13B",
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

// A lookup table indexed by base_model.
export const ModelSettings: Dict<ModelSettingsDict> = {
  "gpt-3.5-turbo": ChatGPTSettings,
  "gpt-4": GPT4Settings,
  "dall-e": DalleSettings,
  "claude-v1": ClaudeSettings,
  "palm2-bison": PaLM2Settings,
  dalai: DalaiModelSettings,
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
};

export function getSettingsSchemaForLLM(
  llm_name: string,
): ModelSettingsDict | undefined {
  const llm_provider = getProvider(llm_name);

  const provider_to_settings_schema: {
    [K in LLMProvider]?: ModelSettingsDict;
  } = {
    [LLMProvider.OpenAI]: GPT4Settings,
    [LLMProvider.Anthropic]: ClaudeSettings,
    [LLMProvider.Google]: PaLM2Settings,
    [LLMProvider.Dalai]: DalaiModelSettings,
    [LLMProvider.Azure_OpenAI]: AzureOpenAISettings,
    [LLMProvider.HuggingFace]: HuggingFaceTextInferenceSettings,
    [LLMProvider.Aleph_Alpha]: AlephAlphaLuminousSettings,
    [LLMProvider.Ollama]: OllamaSettings,
    [LLMProvider.Together]: TogetherChatSettings,
  };

  if (llm_provider === LLMProvider.Custom) return ModelSettings[llm_name];
  else if (llm_provider && llm_provider in provider_to_settings_schema)
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
) => {
  if (typeof emoji === "string" && (emoji.length === 0 || emoji.length > 2))
    throw new Error(`Emoji for a custom provider must have a character.`);

  const new_provider: Dict<JSONCompatible> = { name };
  new_provider.emoji = emoji || "✨";

  // Each LLM *model* must have a unique name. To avoid name collisions, for custom providers,
  // the full LLM model name is a path, __custom/<provider_name>/<submodel name>
  // If there's no submodel, it's just __custom/<provider_name>.
  const base_model = `__custom/${name}/`;
  new_provider.base_model = base_model;
  new_provider.model =
    base_model +
    (Array.isArray(models) && models.length > 0 ? `${models[0]}` : "");

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
  for (const p of providers)
    setCustomProvider(
      p.name,
      p.emoji,
      p.models,
      p.rate_limit,
      p.settings_schema,
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
