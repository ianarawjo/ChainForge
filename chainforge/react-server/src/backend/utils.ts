// from typing import Dict, Tuple, List, Union, Optional
// import json, os, time, asyncio
// from string import Template

// from chainforge.promptengine.models import LLM
import { LLM } from './models';
import { Dict, StringDict, LLMAPICall, LLMResponseObject } from './typing';
import { env as process_env } from 'process';
import { StringTemplate } from './template';

/* LLM API SDKs */
import { Configuration as OpenAIConfig, OpenAIApi } from "openai";
import { OpenAIClient as AzureOpenAIClient, AzureKeyCredential } from "@azure/openai";
import { AI_PROMPT, Client as AnthropicClient, HUMAN_PROMPT } from "@anthropic-ai/sdk";
import { DiscussServiceClient, TextServiceClient } from "@google-ai/generativelanguage";
import { GoogleAuth } from "google-auth-library";

function get_environ(key: string): string | undefined {
  if (key in process_env)
    return process_env[key];
  return undefined;
}

let DALAI_MODEL: string | undefined;
let DALAI_RESPONSE: Dict | undefined;

let OPENAI_API_KEY = get_environ("OPENAI_API_KEY");
let ANTHROPIC_API_KEY = get_environ("ANTHROPIC_API_KEY");
let GOOGLE_PALM_API_KEY = get_environ("PALM_API_KEY");
let AZURE_OPENAI_KEY = get_environ("AZURE_OPENAI_KEY");
let AZURE_OPENAI_ENDPOINT = get_environ("AZURE_OPENAI_ENDPOINT");

/**
 * Sets the local API keys for the revelant LLM API(s).
 */
export function set_api_keys(api_keys: StringDict): void {
  function key_is_present(name: string): boolean {
    return name in api_keys && api_keys[name].trim().length > 0;
  }
  if (key_is_present('OpenAI'))
    OPENAI_API_KEY= api_keys['OpenAI'];
  if (key_is_present('Anthropic'))
    ANTHROPIC_API_KEY = api_keys['Anthropic'];
  if (key_is_present('Google'))
    GOOGLE_PALM_API_KEY = api_keys['Google'];
  if (key_is_present('Azure_OpenAI'))
    AZURE_OPENAI_KEY = api_keys['Azure_OpenAI'];
  if (key_is_present('Azure_OpenAI_Endpoint'))
    AZURE_OPENAI_ENDPOINT = api_keys['Azure_OpenAI_Endpoint'];
  // Soft fail for non-present keys
}

/** Equivalent to a Python enum's .name property */
export function getEnumName(enumObject: any, enumValue: any): string | undefined {
  for (const key in enumObject) {
    if (enumObject[key] === enumValue) {
      return key;
    }
  }
  return undefined;
}

// async def make_sync_call_async(sync_method, *args, **params):
//     """
//         Makes a blocking synchronous call asynchronous, so that it can be awaited.
//         NOTE: This is necessary for LLM APIs that do not yet support async (e.g. Google PaLM).
//     """
//     loop = asyncio.get_running_loop()
//     method = sync_method
//     if len(params) > 0:
//         def partial_sync_meth(*a):
//             return sync_method(*a, **params)
//         method = partial_sync_meth
//     return await loop.run_in_executor(None, method, *args)

/**
 * Calls OpenAI models via OpenAI's API. 
   @returns raw query and response JSON dicts. 
 */
export async function call_chatgpt(prompt: string, model: LLM, n: number = 1, temperature: number = 1.0, params?: Dict): Promise<[Dict, Dict]> {
  if (!OPENAI_API_KEY)
    throw new Error("Could not find an OpenAI API key. Double-check that your API key is set in Settings or in your local environment.");

  console.log('openai api key', OPENAI_API_KEY);
  const configuration = new OpenAIConfig({
    apiKey: OPENAI_API_KEY,
  });

  // Since we are running client-side, we need to remove the user-agent header:
  delete configuration.baseOptions.headers['User-Agent'];

  const openai = new OpenAIApi(configuration);

  let modelname: string = model.toString();
  if (params?.stop !== undefined && (!Array.isArray(params.stop) || params.stop.length === 0))
    delete params.stop;
  if (params?.functions !== undefined && (!Array.isArray(params.functions) || params.functions.length === 0))
    delete params?.functions;
  if (params?.function_call !== undefined && ((!(typeof params.function_call === 'string')) || params.function_call.trim().length === 0)) {
    delete params.function_call;
  }

  console.log(`Querying OpenAI model '${model}' with prompt '${prompt}'...`);
  const system_msg: string = params?.system_msg || "You are a helpful assistant.";
  delete params?.system_msg;

  let query: Dict = {
    model: modelname,
    n: n,
    temperature: temperature,
    ...params,  // 'the rest' of the settings, passed from the front-end settings
  };

  // Get the correct function to call
  let openai_call: any;
  if (modelname.includes('davinci')) {  // text completions model
    openai_call = openai.createCompletion.bind(openai);
    query['prompt'] = prompt;
  } else {  // chat model
    openai_call = openai.createChatCompletion.bind(openai);
    query['messages'] = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": prompt},
    ]
  }

  // Try to call OpenAI
  let response: Dict = {};
  try {
    const completion = await openai_call(query);
    response = completion.data;
  } catch (error: any) {
    if (error?.response) {
      console.error(error.response.data?.error?.message);
      throw new Error("Could not authenticate to OpenAI. Double-check that your API key is set in Settings or in your local environment.");
      // throw new Error(error.response.status);
    } else {
      console.log(error?.message || error);
      throw new Error(error?.message || error);
    }
  } 
  
  return [query, response];
}

/**
 * Calls OpenAI models hosted on Microsoft Azure services.
 *  Returns raw query and response JSON dicts. 
 *
 *  NOTE: It is recommended to set an environment variables AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT
 */
export async function call_azure_openai(prompt: string, model: LLM, n: number = 1, temperature: number = 1.0, params?: Dict): Promise<[Dict, Dict]> {
  if (!AZURE_OPENAI_KEY)
    throw Error("Could not find an Azure OpenAPI Key to use. Double-check that your key is set in Settings or in your local environment.");
  if (!AZURE_OPENAI_ENDPOINT)
    throw Error("Could not find an Azure OpenAI Endpoint to use. Double-check that your endpoint is set in Settings or in your local environment.");
  
  const deployment_name: string = params?.deployment_name;
  const model_type: string = params?.model_type;
  if (!deployment_name)
    throw Error("Could not find an Azure OpenAPI deployment name. Double-check that your deployment name is set in Settings or in your local environment.");
  if (!model_type)
    throw Error("Could not find a model type specified for an Azure OpenAI model. Double-check that your deployment name is set in Settings or in your local environment.");
  
  const client = new AzureOpenAIClient(AZURE_OPENAI_ENDPOINT, new AzureKeyCredential(AZURE_OPENAI_KEY));

  if (params?.stop !== undefined && (!Array.isArray(params.stop) || params.stop.length === 0))
    delete params.stop;
  if (params?.functions !== undefined && (!Array.isArray(params.functions) || params.functions.length === 0))
    delete params?.functions;
  if (params?.function_call !== undefined && (!(typeof params.function_call === 'string') || params.function_call.trim().length === 0))
    delete params.function_call;

  console.log(`Querying Azure OpenAI deployed model '${deployment_name}' at endpoint '${AZURE_OPENAI_ENDPOINT}' with prompt '${prompt}'...`)
  const system_msg = params?.system_msg || "You are a helpful assistant.";

  delete params?.system_msg;
  delete params?.model_type;
  delete params?.deployment_name;
    
  // Setup the args for the query
  let query: Dict = {
    n: n,
    temperature: temperature,
    ...params,  // 'the rest' of the settings, passed from the front-end settings
  };
  let arg2: Array<Dict | string>;
  let openai_call: any;
  if (model_type === 'text-completion') {
    openai_call = client.getCompletions;
    arg2 = [prompt];
  } else {
    openai_call = client.getChatCompletions;
    arg2 = [
      {"role": "system", "content": system_msg},
      {"role": "user", "content": prompt},
    ];
  }

  let response: Dict = {};
  try {
    response = await openai_call(deployment_name, arg2, query);
  } catch (error) {
    if (error?.response) {
      throw new Error("Could not authenticate to Azure OpenAI. Double-check that your API key is set in Settings or in your local environment.");
      // throw new Error(error.response.status);
    } else {
      console.log(error?.message || error);
      throw new Error(error?.message || error);
    }
  }
  
  return [query, response];
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
export async function call_anthropic(prompt: string, model: LLM, n: number = 1, temperature: number = 1.0, params?: Dict): Promise<[Dict, Dict]> {
  if (!ANTHROPIC_API_KEY)
    throw Error("Could not find an API key for Anthropic models. Double-check that your API key is set in Settings or in your local environment.");
  
  // Initialize Anthropic API client
  const client = new AnthropicClient(ANTHROPIC_API_KEY);

  // Wrap the prompt in the provided template, or use the default Anthropic one
  const custom_prompt_wrapper: string = params?.custom_prompt_wrapper || (HUMAN_PROMPT + " {prompt}" + AI_PROMPT);
  if (!custom_prompt_wrapper.includes('{prompt}'))
    throw Error("Custom prompt wrapper is missing required {prompt} template variable.");
  const prompt_wrapper_template = new StringTemplate(custom_prompt_wrapper);
  const wrapped_prompt = prompt_wrapper_template.safe_substitute({prompt: prompt});

  // Required non-standard params 
  const max_tokens_to_sample = params?.max_tokens_to_sample || 1024;
  const stop_sequences = params?.stop_sequences || [HUMAN_PROMPT];

  // Format query
  let query = {
    model: model,
    prompt: wrapped_prompt,
    max_tokens_to_sample: max_tokens_to_sample,
    stop_sequences: stop_sequences,
    temperature: temperature,
    ...params,
  };

  console.log(`Calling Anthropic model '${model}' with prompt '${prompt}' (n=${n}). Please be patient...`);

  // Repeat call n times, waiting for each response to come in:
  let responses: Array<Dict> = [];
  while (responses.length < n) {
    const resp = await client.complete(query);
    responses.push(resp);
    console.log(`${model} response ${responses.length} of ${n}:\n${resp}`);
  }

  return [query, responses];
}

/**
 * Calls a Google PaLM model. 
   Returns raw query and response JSON dicts.
 */
export async function call_google_palm(prompt: string, model: LLM, n: number = 1, temperature: number = 0.7, params?: Dict): Promise<[Dict, Dict]> {
  if (!GOOGLE_PALM_API_KEY)
    throw Error("Could not find an API key for Google PaLM models. Double-check that your API key is set in Settings or in your local environment.");

  const is_chat_model = model.toString().includes('chat');
  const client = new (is_chat_model ? DiscussServiceClient : TextServiceClient)({
    authClient: new GoogleAuth().fromAPIKey(GOOGLE_PALM_API_KEY),
  });

  // Required non-standard params 
  const max_output_tokens = params?.max_output_tokens || 800;

  let query: Dict = {
      model: `models/${model}`,
      candidate_count: n,
      temperature: temperature,
      max_output_tokens: max_output_tokens,
      ...params,
  };

  // Remove erroneous parameters for text and chat models
  if (query.top_k !== undefined && query.top_k <= 0)
    delete query.top_k;
  if (query.top_p !== undefined && query.top_p <= 0)
    delete query.top_p;
  if (is_chat_model && query.max_output_tokens !== undefined)
    delete query.max_output_tokens;
  if (is_chat_model && query.stop_sequences !== undefined)
    delete query.stop_sequences;

  // For some reason Google needs to be special and have its API params be different names --camel or snake-case 
  // --depending on if it's the Python or Node JS API. ChainForge needs a consistent name, so we must convert snake to camel:
  const casemap = {
    safety_settings: 'safetySettings',
    stop_sequences: 'stopSequences',
    candidate_count: 'candidateCount',
    max_output_tokens: 'maxOutputTokens',
    top_p: 'topP',
    top_k: 'topK',
  };
  Object.entries(casemap).forEach(([key, val]) => {
    if (key in query) {
      query[val] = query[key];
      delete query[key];
    }
  });

  console.log(`Calling Google PaLM model '${model}' with prompt '${prompt}' (n=${n}). Please be patient...`);
  
  // Call the correct model client
  let completion;
  if (is_chat_model) {
    // Chat completions
    query.prompt = { messages: [{content: prompt}] };
    completion = await (client as DiscussServiceClient).generateMessage(query);
  } else {
    // Text completions
    query.prompt = { text: prompt };
    completion = await (client as TextServiceClient).generateText(query);
  }

  // Google PaLM, unlike other chat models, will output empty
  // responses for any response it deems unsafe (blocks). Although the text completions
  // API has a (relatively undocumented) 'safety_settings' parameter,
  // the current chat completions API provides users no control over the blocking.
  // We need to detect this and fill the response with the safety reasoning:
  if (completion[0].filters.length > 0) {
      // Request was blocked. Output why in the response text, repairing the candidate dict to mock up 'n' responses
      const block_error_msg = `[[BLOCKED_REQUEST]] Request was blocked because it triggered safety filters: ${JSON.stringify(completion.filters)}`
      completion[0].candidates = new Array(n).fill({'author': '1', 'content':block_error_msg});
  }

  // Weirdly, google ignores candidate_count if temperature is 0. 
  // We have to check for this and manually append the n-1 responses:
  // if n > 1 and temperature == 0 and len(completion_dict['candidates']) == 1:
  //     copied_candidates = [completion_dict['candidates'][0]] * n
  //     completion_dict['candidates'] = copied_candidates

  return [query, completion[0]];
}

export async function call_dalai(prompt: string, model: LLM, n: number = 1, temperature: number = 0.7, params?: Dict): Promise<[Dict, Dict]> {
  throw Error("Dalai support in JS backend is not yet implemented.");
}

// async def call_dalai(prompt: str, model: LLM, server: str="http://localhost:4000", n: int = 1, temperature: float = 0.5,  **params) -> Tuple[Dict, Dict]:
//     """
//         Calls a Dalai server running LLMs Alpaca, Llama, etc locally.
//         Returns the raw query and response JSON dicts. 

//         Parameters:
//             - model: The LLM model, whose value is the name known byt Dalai; e.g. 'alpaca.7b'
//             - port: The port of the local server where Dalai is running. By default 4000.
//             - prompt: The prompt to pass to the LLM.
//             - n: How many times to query. If n > 1, this will continue to query the LLM 'n' times and collect all responses.
//             - temperature: The temperature to query at
//             - params: Any other Dalai-specific params to pass. For more info, see below or https://cocktailpeanut.github.io/dalai/#/?id=syntax-1 

//         TODO: Currently, this uses a modified dalaipy library for simplicity; however, in the future we might remove this dependency. 
//     """
//     # Import and load upon first run
//     global DALAI_MODEL, DALAI_RESPONSE
//     if not server or len(server.strip()) == 0:  # In case user passed a blank server name, revert to default on port 4000
//         server = "http://localhost:4000"
//     if DALAI_MODEL is None:
//         from chainforge.promptengine.dalaipy import Dalai
//         DALAI_MODEL = Dalai(server)
//     elif DALAI_MODEL.server != server:  # if the port has changed, we need to create a new model
//         DALAI_MODEL = Dalai(server)
    
//     # Make sure server is connected
//     DALAI_MODEL.connect()

//     # Create settings dict to pass to Dalai as args
//     def_params = {'n_predict':128, 'repeat_last_n':64, 'repeat_penalty':1.3, 'seed':-1, 'threads':4, 'top_k':40, 'top_p':0.9}
//     for key in params:
//         if key in def_params:
//             def_params[key] = params[key]
//         else:
//             print(f"Attempted to pass unsupported param '{key}' to Dalai. Ignoring.")
    
//     # Create full query to Dalai
//     query = {
//         'prompt': prompt,
//         'model': model.value,
//         'id': str(round(time.time()*1000)),
//         'temp': temperature,
//         **def_params
//     }

//     # Create spot to put response and a callback that sets it
//     DALAI_RESPONSE = None
//     def on_finish(r):
//         global DALAI_RESPONSE
//         DALAI_RESPONSE = r
    
//     print(f"Calling Dalai model '{query['model']}' with prompt '{query['prompt']}' (n={n}). Please be patient...")

//     # Repeat call n times
//     responses = []
//     while len(responses) < n:

//         # Call the Dalai model 
//         req = DALAI_MODEL.generate_request(**query)
//         sent_req_success = DALAI_MODEL.generate(req, on_finish=on_finish)

//         if not sent_req_success:
//             print("Something went wrong pinging the Dalai server. Returning None.")
//             return None, None

//         # Blocking --wait for request to complete: 
//         while DALAI_RESPONSE is None:
//             await asyncio.sleep(0.01)

//         response = DALAI_RESPONSE['response']
//         if response[-5:] == '<end>':  # strip ending <end> tag, if present
//             response = response[:-5]
//         if response.index('\r\n') > -1:  # strip off the prompt, which is included in the result up to \r\n:
//             response = response[(response.index('\r\n')+2):]
//         DALAI_RESPONSE = None

//         responses.append(response)
//         print(f'Response {len(responses)} of {n}:\n', response)

//     # Disconnect from the server
//     DALAI_MODEL.disconnect()

//     return query, responses

/**
 * Extracts the relevant portion of a OpenAI chat response.    
 * Note that chat choice objects can now include 'function_call' and a blank 'content' response.
 * This method detects a 'function_call's presence, prepends [[FUNCTION]] and converts the function call into JS format. 
 */
function _extract_openai_chat_choice_content(choice: Dict): string {
  if (choice['finish_reason'] === 'function_call' || 
     !choice["message"]["content"] ||
     ('function_call' in choice['message'] && choice['message']['function_call'].length > 0)) {
    const func = choice['message']['function_call'];
    return '[[FUNCTION]] ' + func['name'] + func['arguments'].toString();
  } else {
    return choice["message"]["content"];
  }
}

/**
 * Extracts the text part of a response JSON from ChatGPT. If there is more
 * than 1 response (e.g., asking the LLM to generate multiple responses), 
 * this produces a list of all returned responses.
 */
function _extract_chatgpt_responses(response: Dict): Array<string> {
  return response["choices"].map(_extract_openai_chat_choice_content);
}

/**
 * Extracts the text part of a response JSON from OpenAI completions models like Davinci. If there are more
 * than 1 response (e.g., asking the LLM to generate multiple responses), 
 * this produces a list of all returned responses.
 */
function _extract_openai_completion_responses(response: Dict): Array<string> {
  return response["choices"].map((c: Dict) => c.text.trim());
}

/**
 * Deduces the format of an OpenAI model response (completion or chat)
 * and extracts the response text using the appropriate method.
 */
function _extract_openai_responses(response: Dict): Array<string> {
  if (response["choices"].length === 0) return [];
  const first_choice = response["choices"][0];
  if ("message" in first_choice)
    return _extract_chatgpt_responses(response);
  else
    return _extract_openai_completion_responses(response);
}

/**
 * Extracts the text part of a 'Completion' object from Google PaLM2 `generate_text` or `chat`.
 *
 * NOTE: The candidate object for `generate_text` has a key 'output' which contains the response,
 * while the `chat` API uses a key 'content'. This checks for either.
 */
function _extract_palm_responses(completion: Dict): Array<string> {
    return completion['candidates'].map((c: Dict) => c.output || c.content);
}

/**
 * Extracts the text part of an Anthropic text completion.
 */
function _extract_anthropic_responses(response: Array<Dict>): Array<string> {
  return response.map((r: Dict) => r.completion.trim());
}

/**
 * Given a LLM and a response object from its API, extract the
 * text response(s) part of the response object.
 */
export function extract_responses(response: Array<string | Dict> | Dict, llm: LLM | string): Array<string> {
  const llm_name = getEnumName(LLM, llm.toString());
  if (llm_name?.startsWith('OpenAI')) {
    if (llm_name.toLowerCase().includes('davinci'))
      return _extract_openai_completion_responses(response);
    else
      return _extract_chatgpt_responses(response);
  } else if (llm_name?.startsWith('Azure'))
    return _extract_openai_responses(response);
  else if (llm_name?.startsWith('PaLM2'))
    return _extract_palm_responses(response);
  else if (llm_name?.startsWith('Dalai'))
    return [response.toString()];
  else if (llm.toString().startsWith('claude'))
    return _extract_anthropic_responses(response as Dict[]);
  else
    throw new Error(`No method defined to extract responses for LLM ${llm}.`)
}

export function merge_response_objs(resp_obj_A: LLMResponseObject | undefined, resp_obj_B: LLMResponseObject | undefined): LLMResponseObject | undefined {
  if (!resp_obj_A && !resp_obj_B) {
    console.warn('Warning: Merging two undefined response objects.')
    return undefined;
  } else if (!resp_obj_B && resp_obj_A)
    return resp_obj_A;
  else if (!resp_obj_A && resp_obj_B)
    return resp_obj_B;
  resp_obj_A = resp_obj_A as LLMResponseObject;  // required by typescript
  resp_obj_B = resp_obj_B as LLMResponseObject;
  let raw_resp_A = resp_obj_A.raw_response;
  let raw_resp_B = resp_obj_B.raw_response;
  if (!Array.isArray(raw_resp_A))
    raw_resp_A = [ raw_resp_A ];
  if (!Array.isArray(raw_resp_B))
    raw_resp_B = [ raw_resp_B ];
  return {
    responses: resp_obj_A.responses.concat(resp_obj_B.responses),
    raw_response: raw_resp_A.concat(raw_resp_B),
    prompt: resp_obj_B.prompt,
    query: resp_obj_B.query,
    llm: resp_obj_B.llm,
    info: resp_obj_B.info,
    metavars: resp_obj_B.metavars,
  };
}

export function APP_IS_RUNNING_LOCALLY(): boolean {
  const location = window.location;
  return location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "";
}

// def create_dir_if_not_exists(path: str) -> None:
//     if not os.path.exists(path):
//         os.makedirs(path)

// def is_valid_filepath(filepath: str) -> bool:
//     try:
//         with open(filepath, 'r', encoding='utf-8'):
//             pass
//     except IOError:
//         try:
//             # Create the file if it doesn't exist, and write an empty json string to it
//             with open(filepath, 'w+', encoding='utf-8') as f:
//                 f.write("{}")
//                 pass
//         except IOError:
//             return False
//     return True

// def is_valid_json(json_dict: dict) -> bool:
//     if isinstance(json_dict, dict):
//         try:
//             json.dumps(json_dict)
//             return True
//         except Exception:
//             pass
//     return False

// def get_files_at_dir(path: str) -> list:
//     f = []
//     for (dirpath, dirnames, filenames) in os.walk(path):
//         f = filenames
//         break
//     return f