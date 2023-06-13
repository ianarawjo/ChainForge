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

// Available LLMs in ChainForge, in the format expected by LLMListItems.
export const AvailableLLMs = [
  { name: "GPT3.5", emoji: "🙂", model: "gpt-3.5-turbo", base_model: "gpt-3.5-turbo", temp: 1.0 },  // The base_model designates what settings form will be used, and must be unique.
  { name: "GPT4", emoji: "🥵", model: "gpt-4", base_model: "gpt-4", temp: 1.0 },
  { name: "Alpaca.7B", emoji: "🦙", model: "alpaca.7B", base_model: "dalai", temp: 0.5 },
  { name: "Claude", emoji: "📚", model: "claude-v1", base_model: "claude-v1", temp: 0.5 },
  { name: "PaLM2", emoji: "🦬", model: "chat-bison-001", base_model: "palm2-bison", temp: 0.7 },
  { name: "Azure OpenAI", emoji: "🔷", model: "azure-openai", base_model: "azure-openai", temp: 1.0 },
];

const filterDict = (dict, keyFilterFunc) => {
  return Object.keys(dict).reduce((acc, key) => {
      if (keyFilterFunc(key) === true)
          acc[key] = dict[key];
      return acc;
  }, {});
};

const ChatGPTSettings = {
    fullName: "GPT-3.5+ (OpenAI)",
    schema: {
        "type": "object",
        "required": [
            "shortname"
        ],
        "properties": {
            "shortname": {
                "type": "string",
                "title": "Nickname",
                "description": "Unique identifier to appear in ChainForge. Keep it short.",
                "default": "GPT3.5"
            },
            "model": {
                "type": "string",
                "title": "Model Version",
                "description": "Select an OpenAI model to query. For more details on the differences, see the OpenAI API documentation.",
                "enum": ["gpt-3.5-turbo", "gpt-3.5-turbo-0301", "gpt-4", "gpt-4-0314", "gpt-4-32k", "gpt-4-32k-0314", "text-davinci-003", "text-davinci-002", "code-davinci-002"],
                "default": "gpt-3.5-turbo"
            },
            "system_msg": {
                "type": "string",
                "title": "System Message (chat models only)",
                "description": "Many conversations begin with a system message to gently instruct the assistant. By default, ChainForge includes the suggested 'You are a helpful assistant.'",
                "default": "You are a helpful assistant."
            },
            "temperature": {
                "type": "number",
                "title": "temperature",
                "description": "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.",
                "default": 1,
                "minimum": 0,
                "maximum": 2,
                "multipleOf": 0.01
            },
            "top_p": {
                "type": "number",
                "title": "top_p",
                "description": "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.",
                "default": 1,
                "minimum": 0,
                "maximum": 1,
                "multipleOf": 0.005
            },
            "stop": {
                "type": "string",
                "title": "stop sequences",
                "description": "Up to 4 sequences where the API will stop generating further tokens. Enclose stop sequences in double-quotes \"\" and use whitespace to separate them.",
                "default": ""
            },
            "max_tokens": {
                "type": "integer",
                "title": "max_tokens",
                "description": "The maximum number of tokens to generate in the chat completion. (The total length of input tokens and generated tokens is limited by the model's context length.)"
            },
            "presence_penalty": {
                "type": "number",
                "title": "presence_penalty",
                "description": "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
                "default": 0,
                "minimum": -2,
                "maximum": 2,
                "multipleOf": 0.005
            },
            "frequency_penalty": {
                "type": "number",
                "title": "frequency_penalty",
                "description": "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.",
                "default": 0,
                "minimum": -2,
                "maximum": 2,
                "multipleOf": 0.005
            },
            "logit_bias": {
                "type": "string",
                "title": "logit_bias",
                "description": "Modify the likelihood of specified tokens appearing in the completion. Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token."
            }
        }
    },

    uiSchema: {
        'ui:submitButtonOptions': {
            props: {
              disabled: false,
              className: 'mantine-UnstyledButton-root mantine-Button-root',
            },
            norender: false,
            submitText: 'Submit',
        },
        "shortname": {
          "ui:autofocus": true
        },
        "model": {
          "ui:help": "Defaults to gpt-3.5-turbo.",
        },
        "system_msg": {
          "ui:widget": "textarea",
          "ui:help": "For more details, see the OpenAI documentation: https://platform.openai.com/docs/guides/chat/instructing-chat-models"
        },
        "temperature": {
          "ui:help": "Defaults to 1.0. Leave at default if you prefer to set top_p.",
          "ui:widget": "range"
        },
        "top_p": {
          "ui:help": "Defaults to 1.0. Leave at default if you prefer to set temperature.",
          "ui:widget": "range"
        },
        "presence_penalty": {
          "ui:help": "Defaults to 0.",
          "ui:widget": "range"
        },
        "frequency_penalty": {
          "ui:help": "Defaults to 0.",
          "ui:widget": "range"
        },
        "stop": {
          "ui:widget": "textarea",
          "ui:help": "Defaults to empty."
        },
        "max_tokens": {
          "ui:help": "Defaults to infinity."
        },
        "logit_bias": {
          "ui:widget": "textarea",
          "ui:help": "Defaults to none."
        }
    },

    postprocessors: {
      'stop': (str) => {
        if (str.trim().length === 0) return [];
        return str.match(/"((?:[^"\\]|\\.)*)"/g).map(s => s.substring(1, s.length-1)); // split on double-quotes but exclude escaped double-quotes inside the group
      }
    }
};

const GPT4Settings = {
    fullName: ChatGPTSettings.fullName,
    schema: {
      "type": "object",
        "required": [
            "shortname"
        ],
        "properties": {
            ...ChatGPTSettings.schema.properties,
            "shortname": {
              "type": "string",
              "title": "Nickname",
              "description": "Unique identifier to appear in ChainForge. Keep it short.",
              "default": "GPT-4"
            },
            "model": {
              ...ChatGPTSettings.schema.properties.model,
              "default": "gpt-4"
            }
        }
    },
    uiSchema: {
      ...ChatGPTSettings.uiSchema,
      "model": {
        "ui:help": "Defaults to gpt-4.",
      },
    },
    postprocessors: ChatGPTSettings.postprocessors,
};

const ClaudeSettings = {
    fullName: "Claude (Anthropic)",
    schema: {
        "type": "object",
        "required": [
            "shortname"
        ],
        "properties": {
            "shortname": {
                "type": "string",
                "title": "Nickname",
                "description": "Unique identifier to appear in ChainForge. Keep it short.",
                "default": "Claude"
            },
            "model": {
                "type": "string",
                "title": "Model Version",
                "description": "Select a version of Claude to query. For more details on the differences, see the Anthropic API documentation.",
                "enum": ["claude-v1", "claude-v1-100k", "claude-instant-v1", "claude-instant-v1-100k", "claude-v1.3", 
                         "claude-v1.3-100k", "claude-v1.2", "claude-v1.0", "claude-instant-v1.1", "claude-instant-v1.1-100k", "claude-instant-v1.0"],
                "default": "claude-v1"
            },
            "temperature": {
                "type": "number",
                "title": "temperature",
                "description": "Amount of randomness injected into the response. Ranges from 0 to 1. Use temp closer to 0 for analytical / multiple choice, and temp closer to 1 for creative and generative tasks.",
                "default": 1,
                "minimum": 0,
                "maximum": 1,
                "multipleOf": 0.01
            },
            "max_tokens_to_sample": {
                "type": "integer",
                "title": "max_tokens_to_sample",
                "description": "A maximum number of tokens to generate before stopping. Lower this if you want shorter responses. By default, ChainForge uses the value 1024, although the Anthropic API does not specify a default value.",
                "default": 1024,
                "minimum": 1
            },
            "custom_prompt_wrapper": {
                "type": "string",
                "title": "Prompt Wrapper (ChainForge)",
                "description": "Anthropic models expect prompts in the form \"\\n\\nHuman: ${prompt}\\n\\nAssistant:\". ChainForge wraps all prompts in this template by default. If you wish to \
                explore custom prompt wrappers that deviate, write a Python template here with a single variable, ${prompt}, where the actual prompt text should go. Otherwise, leave this field blank. (Note that you should enter newlines as newlines, not escape codes like \\n.)",
                "default": ""
            },
            "stop_sequences": {
                "type": "string",
                "title": "stop_sequences",
                "description": "Anthropic models stop on \"\\n\\nHuman:\", and may include additional built-in stop sequences in the future. By providing the stop_sequences parameter, you may include additional strings that will cause the model to stop generating.\nEnclose stop sequences in double-quotes \"\" and use whitespace to separate them.",
                "default": "\"\n\nHuman:\""
            },
            "top_k": {
                "type": "integer",
                "title": "top_k",
                "description": "Only sample from the top K options for each subsequent token. Used to remove \"long tail\" low probability responses. Defaults to -1, which disables it.",
                "minimum": -1,
                "default": -1
            },
            "top_p": {
                "type": "number",
                "title": "top_p",
                "description": "Does nucleus sampling, in which we compute the cumulative distribution over all the options for each subsequent token in decreasing probability order and cut it off once it reaches a particular probability specified by top_p. Defaults to -1, which disables it. Note that you should either alter temperature or top_p, but not both.",
                "default": -1,
                "minimum": -1,
                "maximum": 1,
                "multipleOf": 0.001,
            },
        }
    },

    uiSchema: {
        'ui:submitButtonOptions': {
            props: {
              disabled: false,
              className: 'mantine-UnstyledButton-root mantine-Button-root',
            },
            norender: false,
            submitText: 'Submit',
        },
        "shortname": {
          "ui:autofocus": true
        },
        "model": {
            "ui:help": "Defaults to claude-v1."
        },
        "temperature": {
          "ui:help": "Defaults to 1.0.",
          "ui:widget": "range"
        },
        "max_tokens_to_sample": {
            "ui:help": "Defaults to 1024."
        },
        "top_k": {
            "ui:help": "Defaults to -1 (none)."
        },
        "top_p": {
          "ui:help": "Defaults to -1 (none)."
        },
        "stop_sequences": {
          "ui:widget": "textarea",
          "ui:help": "Defaults to one stop sequence, \"\\n\\nHuman: \""
        },
        "custom_prompt_wrapper": {
          "ui:widget": "textarea",
          "ui:help": "Defaults to Anthropic's internal wrapper \"\\n\\nHuman: {prompt}\\n\\nAssistant\"."
        }
    },

    postprocessors: {
      'stop_sequences': (str) => {
        if (str.trim().length === 0) return ["\n\nHuman:"];
        return str.match(/"((?:[^"\\]|\\.)*)"/g).map(s => s.substring(1, s.length-1)); // split on double-quotes but exclude escaped double-quotes inside the group
      }
    }
};

const PaLM2Settings = {
  fullName: "PaLM (Google)",
  schema: {
      "type": "object",
      "required": [
          "shortname"
      ],
      "properties": {
          "shortname": {
              "type": "string",
              "title": "Nickname",
              "description": "Unique identifier to appear in ChainForge. Keep it short.",
              "default": "chat-bison"
          },
          "model": {
              "type": "string",
              "title": "Model",
              "description": "Select a PaLM model to query. For more details on the differences, see the Google PaLM API documentation.",
              "enum": ["text-bison-001", "chat-bison-001"],
              "default": "chat-bison-001"
          },
          "temperature": {
              "type": "number",
              "title": "temperature",
              "description": "Controls the randomness of the output. Must be positive. Typical values are in the range: [0.0, 1.0]. Higher values produce a more random and varied response. A temperature of zero will be deterministic. (ChainForge only allows a max 1.0 temperature for PaLM).",
              "default": 0.5,
              "minimum": 0,
              "maximum": 1,
              "multipleOf": 0.01
          },
          "top_k": {
            "type": "integer",
            "title": "top_k",
            "description": "Sets the maximum number of tokens to sample from on each step. (The PaLM API uses combined nucleus and top-k sampling.) Set to -1 to use the default value.",
            "minimum": -1,
            "default": -1
          },
          "top_p": {
              "type": "number",
              "title": "top_p",
              "description": "Sets the maximum cumulative probability of tokens to sample from. (The PaLM API uses combined nucleus and top-k sampling.) Set to -1 to use the default value.",
              "default": -1,
              "minimum": -1,
              "maximum": 1,
              "multipleOf": 0.001,
          },
          "max_output_tokens": {
              "type": "integer",
              "title": "max_output_tokens (ignored for chat models)",
              "description": "Maximum number of tokens to include in each response of a text-bison model. Must be greater than zero. If unset, will default to 512. Ignored for chat models.",
              "default": 512,
              "minimum": 1
          },
          "stop_sequences": {
              "type": "string",
              "title": "stop_sequences (ignored for chat models)",
              "description": "A set of up to 5 character sequences that will stop output generation. If specified, the API will stop at the first appearance of a stop sequence. The stop sequence will not be included as part of the response.\nEnclose stop sequences in double-quotes \"\" and use whitespace to separate them. Ignored for chat models.",
              "default": ""
          },
      }
  },

  uiSchema: {
      'ui:submitButtonOptions': {
          props: {
            disabled: false,
            className: 'mantine-UnstyledButton-root mantine-Button-root',
          },
          norender: false,
          submitText: 'Submit',
      },
      "shortname": {
        "ui:autofocus": true
      },
      "model": {
          "ui:help": "Defaults to chat-bison."
      },
      "temperature": {
        "ui:help": "Defaults to 0.5.",
        "ui:widget": "range"
      },
      "max_output_tokens": {
          "ui:help": "Defaults to 512. Only relevant to text completions models (text-bison)."
      },
      "top_k": {
          "ui:help": "Defaults to -1 (none)."
      },
      "top_p": {
        "ui:help": "Defaults to -1 (none)."
      },
      "stop_sequences": {
        "ui:widget": "textarea",
        "ui:help": "Defaults to no additional stop sequences (empty). Ignored for chat models."
      },
  },

  postprocessors: {
    'stop_sequences': (str) => {
      if (str.trim().length === 0) return [];
      return str.match(/"((?:[^"\\]|\\.)*)"/g).map(s => s.substring(1, s.length-1)); // split on double-quotes but exclude escaped double-quotes inside the group
    }
  }
};

const DalaiModelSettings = {
  fullName: "Dalai-hosted local model (Alpaca, Llama)",
  schema: {
      "type": "object",
      "required": [
          "shortname",
      ],
      "properties": {
          "shortname": {
              "type": "string",
              "title": "Nickname",
              "description": "Unique identifier to appear in ChainForge. Keep it short.",
              "default": "Alpaca.7B",
          },
          "model": {
              "type": "string",
              "title": "Model",
              "description": "Select a Dalai-hosted model to query. For details on installing locally-run models via Dalai, check out https://cocktailpeanut.github.io/dalai/#/?id=_3-disk-space-requirements.",
              "enum": ["alpaca.7B", "alpaca.13B", "llama.7B", "llama.13B", "llama.30B", "llama.65B"],
              "default": "alpaca.7B",
          },
          "server": {
            "type": "string",
            "title": "URL of Dalai server",
            "description": "Enter the URL where the Dalai server is running (usually localhost).",
            "default": "http://localhost:4000",
          },
          "temperature": {
              "type": "number",
              "title": "temperature",
              "description": "Controls the 'creativity' or randomness of the response.",
              "default": 0.5,
              "minimum": 0,
              "maximum": 1,
              "multipleOf": 0.01,
          },
          "n_predict": {
            "type": "integer",
            "title": "n_predict",
            "description": "Maximum number of tokens to include in the response. Must be greater than zero. Defaults to 128.",
            "default": 128,
            "minimum": 1,
          },
          "threads": {
            "type": "integer",
            "title": "threads",
            "description": "The number of threads to use on the local machine. Defaults to 4 in ChainForge, to support lower-end laptops. Set to higher the more powerful your machine.",
            "minimum": 1,
            "default": 4,
          },
          "top_k": {
            "type": "integer",
            "title": "top_k",
            "description": "Sets the maximum number of tokens to sample from on each step.",
            "minimum": 1,
            "default": 40,
          },
          "top_p": {
              "type": "number",
              "title": "top_p",
              "description": "Sets the maximum cumulative probability of tokens to sample from.",
              "default": 0.9,
              "minimum": 0,
              "maximum": 1,
              "multipleOf": 0.001,
          },
          "repeat_last_n": {
            "type": "integer",
            "title": "repeat_last_n",
            "description": "Use to control repetitions. When picking a new token, the model will avoid any of the tokens (~words) in the last n tokens, in a sliding window.",
            "minimum": 0,
            "default": 64,
          },
          "repeat_penalty": {
            "type": "number",
            "title": "repeat_penalty",
            "description": "Use to control repetitions. Penalizes words that have already appeared in the output, making them less likely to be generated again.",
            "minimum": 0,
            "default": 1.3,
            "multipleOf": 0.001,
          },
          "seed": {
            "type": "integer",
            "title": "seed",
            "description": "The seed to use when generating new responses. The default is -1 (random). Change to fixed value for deterministic outputs across different runs.",
            "minimum": -1,
            "default": -1,
          },
      }
  },

  uiSchema: {
      'ui:submitButtonOptions': {
          props: {
            disabled: false,
            className: 'mantine-UnstyledButton-root mantine-Button-root',
          },
          norender: false,
          submitText: 'Submit',
      },
      "shortname": {
        "ui:autofocus": true
      },
      "model": {
          "ui:help": "NOTE: You must have installed the selected model and have Dalai be running and accessible on the local environment with which you are running the ChainForge server."
      },
      "temperature": {
        "ui:help": "Defaults to 0.5.",
        "ui:widget": "range"
      },
      "n_predict": {
          "ui:help": "Defaults to 128."
      },
      "top_k": {
          "ui:help": "Defaults to 40."
      },
      "top_p": {
        "ui:help": "Defaults to 0.9.",
        "ui:widget": "range"
      },
      "seed": {
        "ui:help": "Defaults to -1 (random)."
      },
      "repeat_last_n": {
        "ui:help": "Defaults to 64."
      },
      "repeat_penalty": {
        "ui:help": "Defaults to 1.3."
      },
      "stop_sequences": {
        "ui:widget": "textarea",
        "ui:help": "Defaults to no additional stop sequences (empty). Ignored for chat models."
      },
      "threads": {
        "ui:help": "Defaults to 4."
      },
  },

  postprocessors: {}
};

const AzureOpenAISettings = {
  fullName: "Azure OpenAI Model",
  schema: {
    "type": "object",
      "required": [
        "shortname",
        "deployment_name",
      ],
      "properties": {
        "shortname": {
          "type": "string",
          "title": "Nickname",
          "description": "Unique identifier to appear in ChainForge. Keep it short.",
          "default": "Azure-OpenAI"
        },
        "deployment_name": {
          "type": "string",
          "title": "Deployment name",
          "description": "The deployment name you chose when you deployed the model in Azure services (also known as the 'deployment_id' or 'engine'). This must exactly match the name of the deployed resource, or the request will fail.",
          "default": "gpt-35-turbo",
        },
        "model_type": {
          "type": "string",
          "title": "Model Type (Chat or Completions)",
          "description": "Select the type of model you are querying. For instance, if you host GPT3.5, select chat-completion; if you host davinci, use text-completion.",
          "enum": ["chat-completion", "text-completion"],
          "default": "chat-completion"
        },
        "api_version": {
          "type": "string",
          "title": "API Version (date)",
          "description": "Used when calling the OpenAI API through Azure services. Normally you don't need to change this setting.",
          "default": "2023-05-15"
        },
        ...filterDict(ChatGPTSettings.schema.properties, (key) => key !== 'model'),
      }
  },
  uiSchema: {
    ...ChatGPTSettings.uiSchema,
  },
  postprocessors: ChatGPTSettings.postprocessors,
};

// A lookup table indexed by base_model. 
export const ModelSettings = {
  'gpt-3.5-turbo': ChatGPTSettings,
  'gpt-4': GPT4Settings,
  'claude-v1': ClaudeSettings,
  'palm2-bison': PaLM2Settings,
  'dalai': DalaiModelSettings,
  'azure-openai': AzureOpenAISettings,
};

export const getTemperatureSpecForModel = (modelName) => {
  if (modelName in ModelSettings) {
    const temperature_property = ModelSettings[modelName].schema?.properties?.temperature;
    if (temperature_property) {
      return {minimum: temperature_property.minimum, maximum: temperature_property.maximum, default: temperature_property.default};
    }
  }
  return null;
};

export const postProcessFormData = (settingsSpec, formData) => {
  // Strip all 'model' and 'shortname' props in the submitted form, as these are passed elsewhere or unecessary for the backend
  const skip_keys = {'model': true, 'shortname': true};

  let new_data = {};
  let postprocessors = settingsSpec.postprocessors ? settingsSpec.postprocessors : {};

  Object.keys(formData).forEach(key => {
    if (key in skip_keys) return;
    if (key in postprocessors)
      new_data[key] = postprocessors[key](formData[key]);
    else
      new_data[key] = formData[key];
  });
    
  return new_data;
};

export const getDefaultModelFormData = (settingsSpec) => {
  let default_formdata = {};
  const schema = settingsSpec.schema;
  Object.keys(schema.properties).forEach(key => {
    default_formdata[key] = 'default' in schema.properties[key] ? schema.properties[key]['default'] : undefined;
  });
  return default_formdata;
};

export const getDefaultModelSettings = (modelName) => {
  if (!(modelName in ModelSettings)) {
    console.warn(`Model ${modelName} not found in list of available model settings.`);
    return {};
  }
  const settingsSpec = ModelSettings[modelName];
  return postProcessFormData(settingsSpec, getDefaultModelFormData(settingsSpec));
};