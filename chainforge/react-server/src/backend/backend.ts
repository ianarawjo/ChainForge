import markdownIt from "markdown-it";

import { Dict, StringDict, LLMResponseError, LLMResponseObject, StandardizedLLMResponse, ChatHistoryInfo, isEqualChatHistory } from "./typing";
import { LLM, getEnumName } from "./models";
import { APP_IS_RUNNING_LOCALLY, set_api_keys, FLASK_BASE_URL, call_flask_backend } from "./utils";
import StorageCache from "./cache";
import { PromptPipeline } from "./query";
import { PromptPermutationGenerator, PromptTemplate } from "./template";

// """ =================
//     SETUP AND GLOBALS
//     =================
// """

enum MetricType {
  KeyValue = 0,
  KeyValue_Numeric = 1,
  KeyValue_Categorical = 2,
  KeyValue_Mixed = 3,
  Numeric = 4,
  Categorical = 5,
  Mixed = 6,
  Unknown = 7,
  Empty = 8,
}

// """ ==============
//     UTIL FUNCTIONS
//     ==============
// """

// Store the original console log funcs once upon load,
// to ensure we can always revert to them:
const ORIGINAL_CONSOLE_LOG_FUNCS: Dict = console.log ? {
  log: console.log,
  warn: console.warn,
  error: console.error,
} : {};
let HIJACKED_CONSOLE_LOGS: Dict = {};

function HIJACK_CONSOLE_LOGGING(id: string, base_window: Dict): void {
  // This function body is adapted from designbyadrian 
  // @ GitHub: https://gist.github.com/designbyadrian/2eb329c853516cef618a  
  HIJACKED_CONSOLE_LOGS[id] = [];

  if (ORIGINAL_CONSOLE_LOG_FUNCS.log) {
    let cl = ORIGINAL_CONSOLE_LOG_FUNCS.log;
    base_window.console.log = function() {
      const a = Array.from(arguments).map(s => s.toString());
      HIJACKED_CONSOLE_LOGS[id].push(a.length === 1 ? a[0] : a);
      cl.apply(this, arguments);
    }
  }

  if (ORIGINAL_CONSOLE_LOG_FUNCS.warn) {
    let cw = ORIGINAL_CONSOLE_LOG_FUNCS.warn;
    base_window.console.warn = function() {
      const a = Array.from(arguments).map(s => `warn: ${s.toString()}`);
      HIJACKED_CONSOLE_LOGS[id].push(a.length === 1 ? a[0] : a);
      cw.apply(this, arguments);
    }
  }

  if (ORIGINAL_CONSOLE_LOG_FUNCS.error) {
    let ce = ORIGINAL_CONSOLE_LOG_FUNCS.error;
    base_window.console.error = function() {
      const a = Array.from(arguments).map(s => `error: ${s.toString()}`);
      HIJACKED_CONSOLE_LOGS[id].push(a.length === 1 ? a[0] : a);
      ce.apply(this, arguments);
    }
  }
}

function REVERT_CONSOLE_LOGGING(id: string): any[] {
  if (ORIGINAL_CONSOLE_LOG_FUNCS.log !== undefined)
    console.log = ORIGINAL_CONSOLE_LOG_FUNCS.log;
  if (ORIGINAL_CONSOLE_LOG_FUNCS.warn !== undefined)
    console.warn = ORIGINAL_CONSOLE_LOG_FUNCS.warn;
  if (ORIGINAL_CONSOLE_LOG_FUNCS.log !== undefined)
    console.error = ORIGINAL_CONSOLE_LOG_FUNCS.error;
  
  const logs = HIJACKED_CONSOLE_LOGS[id];
  delete HIJACKED_CONSOLE_LOGS[id];
  return logs;
}

/** Stores info about a single LLM response. Passed to evaluator functions. */
export class ResponseInfo {
  text: string;  // The text of the LLM response
  prompt: string  // The text of the prompt using to query the LLM
  var: Dict  // A dictionary of arguments that filled in the prompt template used to generate the final prompt
  meta: Dict  // A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt
  llm: string | LLM  // The name of the LLM queried (the nickname in ChainForge)

  constructor(text: string, prompt: string, _var: Dict, meta: Dict, llm: string | LLM) {
    this.text = text;
    this.prompt = prompt;
    this.var = _var;
    this.meta = meta;
    this.llm = llm;
  }

  toString(): string {
    return this.text;
  }

  asMarkdownAST() {
    const md = new markdownIt();
    return md.parse(this.text, {});
  }
}

function to_standard_format(r: LLMResponseObject | Dict): StandardizedLLMResponse {
  let resp_obj: StandardizedLLMResponse = {
    vars: r['info'],
    metavars: r['metavars'] || {},
    llm: r['llm'],
    prompt: r['prompt'],
    responses: r['responses'],
    tokens: r.raw_response?.usage || {},
  };
  if ('eval_res' in r)
    resp_obj.eval_res = r.eval_res;
  if ('chat_history' in r)
    resp_obj.chat_history = r.chat_history;
  return resp_obj;
}

function get_cache_keys_related_to_id(cache_id: string, include_basefile: boolean=true): string[] {
  // Load the base cache 'file' for cache_id
  const base_file = `${cache_id}.json`;
  const data = StorageCache.get(base_file);
  if (data?.cache_files !== undefined)
    return Object.keys(data.cache_files).concat((include_basefile ? [base_file] : []));
  else
    return include_basefile ? [base_file] : [];
}

async function setAPIKeys(api_keys: StringDict): Promise<void> {
  if (api_keys !== undefined)
    set_api_keys(api_keys);
}

/**
 * Loads the cache JSON file at filepath. 
 * 'Soft fails' if the file does not exist (returns empty object).
 */
function load_from_cache(storageKey: string): Dict {
    return StorageCache.get(storageKey) || {};
}

function load_cache_responses(storageKey: string): Array<Dict> {
  const data = load_from_cache(storageKey);
  if (Array.isArray(data))
    return data;
  else if (typeof data === 'object' && data.responses_last_run !== undefined)
    return data.responses_last_run;
  throw new Error(`Could not find cache file for id ${storageKey}`);
}

function gen_unique_cache_filename(cache_id: string, prev_filenames: Array<string>): string {
  let idx = 0;
  prev_filenames.forEach(f => {
    const lhs = f.split('.')[0];
    const num = parseInt(lhs.split('_').pop() as string);
    idx = Math.max(num+1, idx);
  }); 
  return `${cache_id}_${idx}.json`;
}

function extract_llm_nickname(llm_spec: Dict | string) {
  if (typeof llm_spec === 'object' && llm_spec.name !== undefined)
    return llm_spec.name;
  else
    return llm_spec;
}

function extract_llm_name(llm_spec: Dict | string): string {
  if (typeof llm_spec === 'string')
    return llm_spec;
  else
    return llm_spec.model;
}

function extract_llm_key(llm_spec: Dict | string): string {
  if (typeof llm_spec === 'string')
    return llm_spec;
  else if (llm_spec.key !== undefined)
    return llm_spec.key;
  else
    throw new Error(`Could not find a key property on spec ${JSON.stringify(llm_spec)} for LLM`);
}

function extract_llm_params(llm_spec: Dict | string): Dict {
  if (typeof llm_spec === 'object' && llm_spec.settings !== undefined)
    return llm_spec.settings;
  else
    return {};
}

function filterVarsByLLM(vars: Dict, llm_key: string): Dict {
  let _vars = {};
  Object.entries(vars).forEach(([key, val]) => {
    const vs = Array.isArray(val) ? val : [val];
    _vars[key] = vs.filter((v) => (typeof v === 'string' || v?.llm === undefined || (v?.llm?.key === llm_key)));
  });
  return _vars;
}

/**
 * Test equality akin to Python's list equality.
 */
function isLooselyEqual(value1: any, value2: any): boolean {
  // If both values are non-array types, compare them directly
  if (!Array.isArray(value1) && !Array.isArray(value2)) {
    if (typeof value1 === 'object' && typeof value2 === 'object')
      return JSON.stringify(value1) === JSON.stringify(value2);
    else 
      return value1 === value2;
  }

  // If either value is not an array or their lengths differ, they are not equal
  if (!Array.isArray(value1) || !Array.isArray(value2) || value1.length !== value2.length) {
    return false;
  }

  // Compare each element in the arrays recursively
  for (let i = 0; i < value1.length; i++) {
    if (!isLooselyEqual(value1[i], value2[i])) {
      return false;
    }
  }

  // All elements are equal
  return true;
}

/**
 * Given a cache'd response object, and an LLM name and set of parameters (settings to use), 
 * determines whether the response query used the same parameters.
 */
function matching_settings(cache_llm_spec: Dict | string, llm_spec: Dict | string): boolean {
  if (extract_llm_name(cache_llm_spec) !== extract_llm_name(llm_spec))
    return false;
  if (typeof llm_spec === 'object' && typeof cache_llm_spec === 'object') {
    const llm_params = extract_llm_params(llm_spec);
    const cache_llm_params = extract_llm_params(cache_llm_spec);
    for (const [param, val] of Object.entries(llm_params)) {
      if (param in cache_llm_params && !isLooselyEqual(cache_llm_params[param], val)) {
        return false;
      }
    }
  }
  return true;
}

function areSetsEqual(xs: Set<any>, ys: Set<any>): boolean {
    return xs.size === ys.size && [...xs].every((x) => ys.has(x));
}

function allStringsAreNumeric(strs: Array<string>) {
  return strs.every(s => !isNaN(parseFloat(s)));
}

function check_typeof_vals(arr: Array<any>): MetricType {
  if (arr.length === 0) return MetricType.Empty;

  const typeof_set: (types: Set<any>) => MetricType = (types: Set<any>) => {
    if (types.size === 0) return MetricType.Empty;
    const [first_val] = types;
    if (types.size === 1 && typeof first_val === 'object' && !Array.isArray(first_val)) {
      return MetricType.KeyValue;
    } else if (Array.from(types).every(t => typeof t === 'number'))
      // Numeric metrics only
      return MetricType.Numeric;
    else if (Array.from(types).every(t => ['string', 'boolean'].includes(typeof t)))
      // Categorical metrics only ('bool' is True/False, counts as categorical)
      return MetricType.Categorical;
    else if (Array.from(types).every(t => ['string', 'boolean', 'number'].includes(typeof t)))
      // Mix of numeric and categorical types
      return MetricType.Mixed;
    else
      //Mix of types beyond basic ones
      return MetricType.Unknown;
  };
  
  const typeof_dict_vals = (d: Dict) => {
    const dict_val_type = typeof_set(new Set(Object.values(d)));
    if (dict_val_type === MetricType.Numeric)
      return MetricType.KeyValue_Numeric;
    else if (dict_val_type === MetricType.Categorical)
      return MetricType.KeyValue_Categorical;
    else
      return MetricType.KeyValue_Mixed;
  };
      
  // Checks type of all values in 'arr' and returns the type
  const val_type = typeof_set(new Set(arr));
  if (val_type === MetricType.KeyValue) {
      // This is a 'KeyValue' pair type. We need to find the more specific type of the values in the dict.
      // First, we check that all dicts have the exact same keys
      for (let i = 0; i < arr.length-1; i++) {
        const d = arr[i];
        const e = arr[i+1];
        if (!areSetsEqual(d, e))
          throw new Error('The keys and size of dicts for evaluation results must be consistent across evaluations.');
      }
      
      // Then, we check the consistency of the type of dict values:
      const first_dict_val_type = typeof_dict_vals(arr[0]);
      arr.slice(1).forEach((d: Dict) => {
        if (first_dict_val_type !== typeof_dict_vals(d))
          throw new Error('Types of values in dicts for evaluation results must be consistent across responses.');
      });

      // If we're here, all checks passed, and we return the more specific KeyValue type:
      return first_dict_val_type;
  } else
    return val_type;
}

function run_over_responses(process_func: (resp: ResponseInfo) => any, 
                            responses: StandardizedLLMResponse[],
                            process_type: 'evaluator' | 'processor'): StandardizedLLMResponse[] {
  return responses.map((_resp_obj: StandardizedLLMResponse) => {
    // Deep clone the response object
    let resp_obj = JSON.parse(JSON.stringify(_resp_obj));

    // Map the processor func over every individual response text in each response object
    const res = resp_obj.responses;
    const processed = res.map((r: string) => 
      process_func(new ResponseInfo(r, 
                                    resp_obj.prompt, 
                                    resp_obj.vars, 
                                    resp_obj.metavars || {}, 
                                    extract_llm_nickname(resp_obj.llm)))
    );

    // If type is just a processor
    if (process_type === 'processor') {
      // Replace response texts in resp_obj with the transformed ones:
      resp_obj.responses = processed;

    } else { // If type is an evaluator
      // Check the type of evaluation results
      // NOTE: We assume this is consistent across all evaluations, but it may not be.
      const eval_res_type = check_typeof_vals(processed);

      if (eval_res_type === MetricType.Numeric) {
          // Store items with summary of mean, median, etc
          resp_obj.eval_res = {
            items: processed,
            dtype: getEnumName(MetricType, eval_res_type),
          };
      } else if ([MetricType.Unknown, MetricType.Empty].includes(eval_res_type)) {
        throw new Error('Unsupported types found in evaluation results. Only supported types for metrics are: int, float, bool, str.');
      } else {
        // Categorical, KeyValue, etc, we just store the items:
        resp_obj.eval_res = { 
          items: processed,
          dtype: getEnumName(MetricType, eval_res_type),
        }
      }
    }

    return resp_obj;
  });
}

// """ ===================
//     BACKEND FUNCTIONS
//     ===================
// """

/**
 * 
 * @param root_prompt The prompt template to start from 
 * @param vars a dict of the template variables to fill the prompt template with, by name. (See countQueries docstring for more info).
 * @returns An array of strings representing the prompts that will be sent out. Note that this could include unfilled template vars.
 */
export async function generatePrompts(root_prompt: string, vars: Dict): Promise<PromptTemplate[]> {  
  const gen_prompts = new PromptPermutationGenerator(root_prompt);
  const all_prompt_permutations = Array.from(gen_prompts.generate(vars));
  return all_prompt_permutations;
}

/**
 * Calculates how many queries we need to make, given the passed prompt and vars.
 * 
 * @param prompt the prompt template, with any {{}} vars
 * @param vars a dict of the template variables to fill the prompt template with, by name. 
 *             For each var value, can be single values or a list; in the latter, all permutations are passed. (Pass empty dict if no vars.)
 * @param llms the list of LLMs you will query
 * @param n how many responses expected per prompt
 * @param chat_histories (optional) Either an array of `ChatHistory` (to use across all LLMs), or a dict indexed by LLM nicknames of `ChatHistory` arrays to use per LLM. 
 * @param id (optional) a unique ID of the node with cache'd responses. If missing, assumes no cache will be used.
 * @returns If success, a dict with { counts: <dict of missing queries per LLM>, total_num_responses: <dict of total num responses per LLM> }
 *          If there was an error, returns a dict with a single key, 'error'. 
 */
export async function countQueries(prompt: string, 
                                   vars: Dict, 
                                   llms: Array<Dict | string>, 
                                   n: number, 
                                   chat_histories?: ChatHistoryInfo[] | {[key: string]: ChatHistoryInfo[]}, 
                                   id?: string,
                                   cont_only_w_prior_llms?: boolean): Promise<Dict> {
  if (chat_histories === undefined) chat_histories = [ undefined ];

  let gen_prompts: PromptPermutationGenerator;
  let all_prompt_permutations: Array<PromptTemplate> | Dict;
  try {
    gen_prompts = new PromptPermutationGenerator(prompt);
    if (cont_only_w_prior_llms && Array.isArray(llms)) {
      all_prompt_permutations = {};
      llms.forEach(llm_spec => {
        const llm_key = extract_llm_key(llm_spec);
        all_prompt_permutations[llm_key] = Array.from(gen_prompts.generate(filterVarsByLLM(vars, llm_key)));
      });
    } else {
      all_prompt_permutations = Array.from(gen_prompts.generate(vars));
    }

  } catch (err) {
    return {error: err.message};
  }
  
  let cache_file_lookup: Dict = {};
  if (id !== undefined) {
    const cache_data = load_from_cache(`${id}.json`);
    cache_file_lookup = cache_data?.cache_files || {};
  }
  
  let missing_queries = {};
  let num_responses_req = {};
  const add_to_missing_queries = (llm_key: string, prompt: string, num: number) => {
    if (!(llm_key in missing_queries))
      missing_queries[llm_key] = {};
    if (prompt in missing_queries[llm_key])
      missing_queries[llm_key][prompt] += num;
    else 
      missing_queries[llm_key][prompt] = num;
  };
  const add_to_num_responses_req = (llm_key: string, num: number) => {
    if (!(llm_key in num_responses_req))
      num_responses_req[llm_key] = 0;
    num_responses_req[llm_key] += num;
  }
  
  llms.forEach(llm_spec => {
    const llm_key = extract_llm_key(llm_spec);

    // Get only the relevant prompt permutations
    let _all_prompt_perms = cont_only_w_prior_llms ? all_prompt_permutations[llm_key] : all_prompt_permutations;

    // Get the relevant chat histories for this LLM:
    const chat_hists = (!Array.isArray(chat_histories)
                        ? chat_histories[extract_llm_nickname(llm_spec)] 
                        : chat_histories) as ChatHistoryInfo[];
    
    // Find the response cache file for the specific LLM, if any
    let found_cache = false;
    for (const [cache_filename, cache_llm_spec] of Object.entries(cache_file_lookup)) {

      if (matching_settings(cache_llm_spec, llm_spec)) {
        found_cache = true;

        // Load the cache file
        const cache_llm_responses = load_from_cache(cache_filename);

        // Iterate through all prompt permutations and check if how many responses there are in the cache with that prompt
        _all_prompt_perms.forEach(prompt => {
          let prompt_str = prompt.toString();

          add_to_num_responses_req(llm_key, n * chat_hists.length);

          // For each chat history, find an indivdual response obj that matches it 
          // (chat_hist be undefined, in which case the cache'd response obj must similarly have an undefined chat history in order to match):
          for (const chat_hist of chat_hists) {

            // If there's chat history, we need to fill any special (#) vars from the carried chat_history vars and metavars:
            if (chat_hist !== undefined) {
              prompt.fill_special_vars({...chat_hist?.fill_history, ...chat_hist?.metavars});
              prompt_str = prompt.toString();
            }

            // Get the cache of responses with respect to this prompt, + normalize format so it's always an array (of size >= 0)
            const cache_bucket = cache_llm_responses[prompt_str];
            let cached_resps: LLMResponseObject[] = Array.isArray(cache_bucket) ? cache_bucket : (cache_bucket === undefined ? [] : [ cache_bucket ]);

            let found_resp = false;
            for (const cached_resp of cached_resps) {
              if (isEqualChatHistory(cached_resp.chat_history, chat_hist?.messages)) {
                // Match found. Note it and count response length: 
                found_resp = true;
                const num_resps = cached_resp.responses.length;
                if (n > num_resps)
                  add_to_missing_queries(llm_key, prompt_str, n - num_resps);
                break;
              }
            }

            // If a cache'd response wasn't found, add n required: 
            if (!found_resp)
              add_to_missing_queries(llm_key, prompt_str, n);
          }
        });
        
        break;
      }
    }
    
    if (!found_cache) {
      _all_prompt_perms.forEach(perm => {
        add_to_num_responses_req(llm_key, n * chat_hists.length);
        add_to_missing_queries(llm_key, perm.toString(), n * chat_hists.length);
      });
    }
  });

  return {'counts': missing_queries, 'total_num_responses': num_responses_req};
}

interface LLMPrompterResults {
  llm_key: string,
  responses: Array<LLMResponseObject>,
  errors: Array<string>,
}

export async function fetchEnvironAPIKeys(): Promise<Dict> {
  return fetch(`${FLASK_BASE_URL}app/fetchEnvironAPIKeys`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
    body: "",
  }).then(res => res.json());
}

/**
 * Queries LLM(s) with root prompt template `prompt` and prompt input variables `vars`, `n` times per prompt.
 * Soft-fails if API calls fail, and collects the errors in `errors` property of the return object.
 * 
 * @param id a unique ID to refer to this information. Used when cache'ing responses. 
 * @param llm a string, list of strings, or list of LLM spec dicts specifying the LLM(s) to query.
 * @param n the amount of generations for each prompt. All LLMs will be queried the same number of times 'n' per each prompt.
 * @param prompt the prompt template, with any {{}} vars
 * @param vars a dict of the template variables to fill the prompt template with, by name. 
               For each var, can be single values or a list; in the latter, all permutations are passed. (Pass empty dict if no vars.)
 * @param chat_histories Either an array of `ChatHistory` (to use across all LLMs), or a dict indexed by LLM nicknames of `ChatHistory` arrays to use per LLM. 
 * @param api_keys (optional) a dict of {api_name: api_key} pairs. Supported key names: OpenAI, Anthropic, Google
 * @param no_cache (optional) if true, deletes any cache'd responses for 'id' (always calls the LLMs fresh)
 * @returns a dictionary in format `{responses: StandardizedLLMResponse[], errors: string[]}`
 */
export async function queryLLM(id: string, 
                               llm: string | Array<string> | Array<Dict>,
                               n: number, 
                               prompt: string,
                               vars: Dict,
                               chat_histories?: ChatHistoryInfo[] | {[key: string]: ChatHistoryInfo[]},
                               api_keys?: Dict,
                               no_cache?: boolean,
                               progress_listener?: (progress: {[key: symbol]: any}) => void,
                               cont_only_w_prior_llms?: boolean): Promise<Dict> {
  // Verify the integrity of the params
  if (typeof id !== 'string' || id.trim().length === 0)
    return {'error': 'id is improper format (length 0 or not a string)'};

  if (Array.isArray(llm) && llm.length === 0)
    return {'error': 'POST data llm is improper format (not string or list, or of length 0).'};
  
  // Ensure llm param is an array
  if (typeof llm === 'string')
    llm = [ llm ];

  llm = llm as (Array<string> | Array<Dict>);

  if (api_keys !== undefined)
    set_api_keys(api_keys);
  
  // Get the storage keys of any cache files for specific models + settings
  const llms = llm;
  let cache: Dict = StorageCache.get(`${id}.json`) || {};  // returns {} if 'id' is not in the storage cache yet

  // Ignore cache if no_cache is present
  if (no_cache) cache = {};

  let llm_to_cache_filename = {};
  let past_cache_files = {};
  if (typeof cache === 'object' && cache.cache_files !== undefined) {
    const past_cache_files: Dict = cache.cache_files;
    let past_cache_filenames: Array<string> = Object.keys(past_cache_files);
    llms.forEach(llm_spec => {
      let found_cache = false;
      for (const [filename, cache_llm_spec] of Object.entries(past_cache_files)) {
        if (matching_settings(cache_llm_spec, llm_spec)) {
          llm_to_cache_filename[extract_llm_key(llm_spec)] = filename;
          found_cache = true;
          break;
        }
      }
      if (!found_cache) {
        const new_filename = gen_unique_cache_filename(id, past_cache_filenames);
        llm_to_cache_filename[extract_llm_key(llm_spec)] = new_filename;
        cache.cache_files[new_filename] = llm_spec;
        past_cache_filenames.push(new_filename);
      }
    });    
  } else {
    // Create a new cache JSON object
    cache = { cache_files: {}, responses_last_run: [] };
    let prev_filenames: Array<string> = [];
    llms.forEach((llm_spec: string | Dict) => {
      const fname = gen_unique_cache_filename(id, prev_filenames);
      llm_to_cache_filename[extract_llm_key(llm_spec)] = fname;
      cache.cache_files[fname] = llm_spec;
      prev_filenames.push(fname);
    });
  }

  // Store the overall cache file for this id:
  if (!no_cache)
    StorageCache.store(`${id}.json`, cache);

  // Create a Proxy object to 'listen' for changes to a variable (see https://stackoverflow.com/a/50862441)
  // and then stream those changes back to a provided callback used to update progress bars.
  let progress = {};
  let progressProxy = new Proxy(progress, {
    set: function (target, key, value) {
      target[key] = value;

      // If the caller provided a callback, notify it 
      // of the changes to the 'progress' object:
      if (progress_listener)
        progress_listener(target);

      return true;
    }
  });

  // For each LLM, generate and cache responses:
  let responses: {[key: string]: Array<LLMResponseObject>} = {};
  let all_errors = {};
  let num_generations = n !== undefined ? n : 1;
  async function query(llm_spec: string | Dict): Promise<LLMPrompterResults> {
    // Get LLM model name and any params
    let llm_str = extract_llm_name(llm_spec);
    let llm_nickname = extract_llm_nickname(llm_spec);
    let llm_params = extract_llm_params(llm_spec);
    let llm_key = extract_llm_key(llm_spec);
    let temperature: number = llm_params?.temperature !== undefined ? llm_params.temperature : 1.0;
    let _vars = vars;

    if (cont_only_w_prior_llms) {
      // Filter vars so that only the var values with the matching LLM are used, or otherwise values with no LLM metadata
      _vars = filterVarsByLLM(vars, llm_key);
    }

    let chat_hists = ((chat_histories !== undefined && !Array.isArray(chat_histories)) 
                      ? chat_histories[llm_nickname]
                      : chat_histories) as ChatHistoryInfo[];

    // Create an object to query the LLM, passing a storage key for cache'ing responses
    const cache_filepath = llm_to_cache_filename[llm_key];
    const prompter = new PromptPipeline(prompt, no_cache ? undefined : cache_filepath);

    // Prompt the LLM with all permutations of the input prompt template:
    // NOTE: If the responses are already cache'd, this just loads them (no LLM is queried, saving $$$)
    let resps: Array<LLMResponseObject> = [];
    let errors: Array<string> = [];
    let num_resps = 0;
    let num_errors = 0;
    try {
      console.log(`Querying ${llm_str}...`)

      // Yield responses for 'llm' for each prompt generated from the root template 'prompt' and template variables in 'properties':
      for await (const response of prompter.gen_responses(_vars, llm_str as LLM, num_generations, temperature, llm_params, chat_hists)) {
        
        // Check for selective failure
        if (response instanceof LLMResponseError) {  // The request failed
          console.error(`error when fetching response from ${llm_str}: ${response.message}`);
          num_errors += 1;
          errors.push(response.message);
        } else {  // The request succeeded
          // The response name will be the actual name of the LLM. However,
          // for the front-end it is more informative to pass the user-provided nickname. 
          response.llm = llm_nickname;
          num_resps += response.responses.length;
          resps.push(response);
        }

        // Update the current 'progress' for this llm.
        // (this implicitly triggers any callbacks defined in the Proxy)
        progressProxy[llm_key] = {
          success: num_resps,
          error: num_errors
        };
      }
    } catch (e) {
      console.error(`Error generating responses for ${llm_str}: ${e.message}`);
      throw e;
    }

    return {
      llm_key: llm_key, 
      responses: resps, 
      errors: errors };
  }
      
  try {
    // Request responses simultaneously across LLMs
    let tasks: Array<Promise<LLMPrompterResults>> = llms.map(query);

    // Await the responses from all queried LLMs
    const llm_results = await Promise.all(tasks);
    llm_results.forEach(result => {
      responses[result.llm_key] = result.responses;
      if (result.errors.length > 0)
        all_errors[result.llm_key] = result.errors;
    });
  } catch (e) {
    console.error(`Error requesting responses: ${e.message}`);
    return { error: e.message };
  }

  // Convert the responses into a more standardized format with less information
  let res = Object.values(responses).flatMap(rs => rs.map(to_standard_format));

  // Reorder the responses to match the original vars dict ordering of keys and values
  let vars_lookup = {}; // we create a lookup table for faster sort
  Object.entries(vars).forEach(([varname, vals]) => {
    vars_lookup[varname] = {};
    vals.forEach((vobj: Dict | string, i: number) => {
      const v = typeof vobj === "string" ? vobj : vobj?.text;
      vars_lookup[varname][v] = i;
    });
  });
  res.sort((a, b) => {
    if (!a.vars || !b.vars) return 0;
    for (const [varname, vals] of Object.entries(vars_lookup)) {
      if (varname in a.vars && varname in b.vars) {
        const a_val = a.vars[varname];
        const b_val = b.vars[varname];
        const a_idx = vals[a_val];
        const b_idx = vals[b_val];
        if (a_idx > -1 && b_idx > -1 && a_idx !== b_idx) 
          return a_idx - b_idx;
      }
    }
    return 0;
  });
  
  // Save the responses *of this run* to the storage cache, for further recall:
  let cache_filenames = past_cache_files;
  llms.forEach((llm_spec: string | Dict) => {
    const filename = llm_to_cache_filename[extract_llm_key(llm_spec)];
    cache_filenames[filename] = llm_spec;
  });

  if (!no_cache)
    StorageCache.store(`${id}.json`, {
      cache_files: cache_filenames,
      responses_last_run: res,
    });
  
  // Return all responses for all LLMs
  return {
    responses: res, 
    errors: all_errors
  };
}

/**
 * Executes a Javascript 'evaluate' function over all cache'd responses with given id's.
 * 
 * Similar to Flask backend's Python 'execute' function, except requires code to be in Javascript.
 * 
 * > **NOTE**: This should only be run on code you trust. 
 *             There is no sandboxing; no safety. We assume you are the creator of the code.
 * 
 * @param id a unique ID to refer to this information. Used when cache'ing evaluation results. 
 * @param code the code to evaluate. Must include an 'evaluate()' function that takes a 'response' of type ResponseInfo. Alternatively, can be the evaluate function itself.
 * @param responses the cache'd response to run on, which must be a unique ID or list of unique IDs of cache'd data
 * @param scope the scope of responses to run on --a single response, or all across each batch. (If batch, evaluate() func has access to 'responses'.) NOTE: Currently this feature is disabled.
 * @param process_type the type of processing to perform. Evaluators only 'score'/annotate responses with an 'eval_res' key. Processors change responses (e.g. text).
 */
export async function executejs(id: string, 
                                code: string | ((rinfo: ResponseInfo) => any), 
                                responses: StandardizedLLMResponse[], 
                                scope: 'response' | 'batch',
                                process_type: 'evaluator' | 'processor'): Promise<Dict> {
  const req_func_name = (!process_type || process_type === 'evaluator') ? 'evaluate' : 'process';

  // Instantiate the evaluator function by eval'ing the passed code
  // DANGER DANGER!!
  let iframe: HTMLElement | undefined;
  let process_func: any;
  if (typeof code === 'string') {
    try {
      /*
        To run Javascript code in a psuedo-'sandbox' environment, we
        can use an iframe and run eval() inside the iframe, instead of the current environment.
        This is slightly safer than using eval() directly, doesn't clog our namespace, and keeps
        multiple Evaluate node execution environments separate. 
        
        The Evaluate node in the front-end has a hidden iframe with the following id. 
        We need to get this iframe element. 
      */
      iframe = document.getElementById(`${id}-iframe`);
      if (!iframe)
        throw new Error("Could not find iframe sandbox for evaluator node.");

      // Now run eval() on the 'window' of the iframe:
      // @ts-ignore
      iframe.contentWindow.eval(code);

      // Now check that there is an 'evaluate' method in the iframe's scope.
      // NOTE: We need to tell Typescript to ignore this, since it's a dynamic type check.
      // @ts-ignore
      process_func = (!process_type || process_type === 'evaluator') ? iframe.contentWindow.evaluate : iframe.contentWindow.process;
      if (process_func === undefined)
        throw new Error(`${req_func_name}() function is undefined.`);

    } catch (err) {
      return {'error': `Could not compile code. Error message:\n${err.message}`};
    }
  }

  // Load all responses with the given ID:
  let all_logs: string[] = [];
  let processed_resps: StandardizedLLMResponse[];
  try {
    // Intercept any calls to console.log, .warn, or .error, so we can store the calls
    // and print them in the 'output' footer of the Evaluator Node: 
    // @ts-ignore
    HIJACK_CONSOLE_LOGGING(id, iframe.contentWindow);

    // Run the user-defined 'evaluate' function over the responses: 
    // NOTE: 'evaluate' here was defined dynamically from 'eval' above. We've already checked that it exists. 
    // @ts-ignore
    processed_resps = run_over_responses((iframe ? process_func : code), responses, process_type);

    // Revert the console.log, .warn, .error back to browser default:
    // @ts-ignore
    all_logs = all_logs.concat(REVERT_CONSOLE_LOGGING(id, iframe.contentWindow));
  } catch (err) {
    // @ts-ignore
    all_logs = all_logs.concat(REVERT_CONSOLE_LOGGING(id, iframe.contentWindow));
    return { error: `Error encountered while trying to run "evaluate" method:\n${err.message}`, logs: all_logs };
  }

  // Store the evaluated responses in a new cache json:
  StorageCache.store(`${id}.json`, processed_resps);

  return {responses: processed_resps, logs: all_logs};
}

/**
 * Executes a Python 'evaluate' function over all cache'd responses with given id's.
 * Requires user to be running on localhost, with Flask access.
 * 
 * > **NOTE**: This should only be run on code you trust. 
 *             There is no sandboxing; no safety. We assume you are the creator of the code.
 * 
 * @param id a unique ID to refer to this information. Used when cache'ing evaluation results. 
 * @param code the code to evaluate. Must include an 'evaluate()' function that takes a 'response' of type ResponseInfo. Alternatively, can be the evaluate function itself.
 * @param response_ids the cache'd response to run on, which must be a unique ID or list of unique IDs of cache'd data
 * @param scope the scope of responses to run on --a single response, or all across each batch. (If batch, evaluate() func has access to 'responses'.) NOTE: Currently disabled.
 * @param process_type the type of processing to perform. Evaluators only 'score'/annotate responses with an 'eval_res' key. Processors change responses (e.g. text).
 */
export async function executepy(id: string, 
                                code: string | ((rinfo: ResponseInfo) => any), 
                                responses: StandardizedLLMResponse[], 
                                scope: 'response' | 'batch',
                                process_type: 'evaluator' | 'processor',
                                script_paths?: string[]): Promise<Dict> {
  if (!APP_IS_RUNNING_LOCALLY()) {
    // We can't execute Python if we're not running the local Flask server. Error out:
    throw new Error("Cannot evaluate Python code: ChainForge does not appear to be running on localhost.")
  }
  
  // All responses loaded; call our Python server to execute the evaluation code across all responses:
  const flask_response = await call_flask_backend('executepy', {
    id: id,
    code: code,
    responses: responses,
    scope: scope,
    process_type: process_type,
    script_paths: script_paths,
  }).catch(err => {
    throw new Error(err.message);
  });

  if (!flask_response || flask_response.error !== undefined)
    throw new Error(flask_response?.error || 'Empty response received from Flask server');
  
  // Grab the responses and logs from the Flask result object:
  const all_evald_responses = flask_response.responses;
  const all_logs = flask_response.logs;

  // Store the evaluated responses in a new cache json:
  StorageCache.store(`${id}.json`, all_evald_responses);

  return {responses: all_evald_responses, logs: all_logs};
}


/**
 * Runs an LLM over responses as a grader/evaluator. 
 * 
 * @param id a unique ID to refer to this information. Used when cache'ing evaluation results. 
 * @param llm the LLM to query (as an LLM specification dict)
 * @param root_prompt the prompt template to use as the scoring function. Should include exactly one template var, {input}, where input responses will be put.
 * @param response_ids the cache'd response to run on, which must be a unique ID or list of unique IDs of cache'd data
 * @param api_keys optional. any api keys to set before running the LLM
 */
export async function evalWithLLM(id: string, 
                                  llm: Dict, 
                                  root_prompt: string,
                                  response_ids: string | string[],
                                  api_keys?: Dict,
                                  progress_listener?: (progress: {[key: symbol]: any}) => void): Promise<Dict> {
  // Check format of response_ids
  if (!Array.isArray(response_ids))
    response_ids = [ response_ids ];
  response_ids = response_ids as Array<string>;

  if (api_keys !== undefined)
    set_api_keys(api_keys);

  // Load all responses with the given ID:
  let all_evald_responses: StandardizedLLMResponse[] = [];
  let all_errors: string[] = [];
  for (let i = 0; i < response_ids.length; i++) {
    const cache_id = response_ids[i];
    const fname = `${cache_id}.json`;
    if (!StorageCache.has(fname))
      return {error: `Did not find cache file for id ${cache_id}`};

    // Load the raw responses from the cache + clone them all:
    const resp_objs = load_cache_responses(fname).map(r => JSON.parse(JSON.stringify(r))) as StandardizedLLMResponse[];
    if (resp_objs.length === 0)
      continue;
    
    // We need to keep track of the index of each response in the response object.
    // We can generate var dicts with metadata to store the indices:
    let inputs = resp_objs.map((obj, __i) => obj.responses.map(
      (r: string, __j: number) => ({text: r, fill_history: obj.vars, metavars: { ...obj.metavars, __i, __j }})
    )).flat();

    // Now run all inputs through the LLM grader!: 
    const {responses, errors} = await queryLLM(`eval-${id}-${cache_id}`, [llm], 1, root_prompt, { input: inputs }, undefined, undefined, undefined, progress_listener);

    const err_vals: string[] = Array.from(Object.values(errors)) as string[];
    if (err_vals.length > 0)
      all_errors = all_errors.concat(err_vals);
    
    // Now we need to apply each response as an eval_res (a score) back to each response object,
    // using the aforementioned mapping metadata:
    responses.forEach((r: StandardizedLLMResponse) => {
      let resp_obj = resp_objs[r.metavars.__i];
      if (resp_obj.eval_res !== undefined)
        resp_obj.eval_res.items[r.metavars.__j] = r.responses[0];
      else {
        resp_obj.eval_res = {
          items: [],
          dtype: 'Categorical',
        };
        resp_obj.eval_res.items[r.metavars.__j] = r.responses[0];
      }
    });

    all_evald_responses = all_evald_responses.concat(resp_objs);
  }

  // Do additional processing to check if all evaluations are 
  // boolean-ish (e.g., 'true' and 'false') or all numeric-ish (parseable as numbers)
  let all_eval_res: Set<string> = new Set();
  for (const resp_obj of all_evald_responses) {
    if (!resp_obj.eval_res) continue;
    for (const score of resp_obj.eval_res.items) {
      if (score !== undefined)
        all_eval_res.add(score.trim().toLowerCase());
    }
  }

  // Check if the results are boolean-ish:
  if (all_eval_res.size === 2 && (all_eval_res.has('true') || all_eval_res.has('false') ||
      all_eval_res.has('yes') || all_eval_res.has('no'))) {
    // Convert all eval results to boolean datatypes:
    all_evald_responses.forEach(resp_obj => {
      resp_obj.eval_res.items = resp_obj.eval_res.items.map((i: string) => {
        const li = i.toLowerCase();
        return li === 'true' || li === 'yes';
      });
      resp_obj.eval_res.dtype = 'Categorical';
    });
  // Check if the results are all numeric-ish:
  } else if (allStringsAreNumeric(Array.from(all_eval_res))) {
    // Convert all eval results to numeric datatypes:
    all_evald_responses.forEach(resp_obj => {
      resp_obj.eval_res.items = resp_obj.eval_res.items.map((i: string) => parseFloat(i));
      resp_obj.eval_res.dtype = 'Numeric';
    });
  }

  // Store the evaluated responses in a new cache json:
  StorageCache.store(`${id}.json`, all_evald_responses);

  return {responses: all_evald_responses, errors: all_errors};
}


/**
 * Returns all responses with the specified id(s).
 * @param responses the ids to grab
 * @returns If success, a Dict with a single key, 'responses', with an array of StandardizedLLMResponse objects
 *          If failure, a Dict with a single key, 'error', with the error message.
 */
export async function grabResponses(responses: Array<string>): Promise<Dict> {
  // Grab all responses with the given ID:
  let grabbed_resps = [];
  for (let i = 0; i < responses.length; i++) {
    const cache_id = responses[i];
    const storageKey = `${cache_id}.json`;
    if (!StorageCache.has(storageKey))
      return {error: `Did not find cache data for id ${cache_id}`};
    
    let res: Dict[] = load_cache_responses(storageKey);
    if (typeof res === 'object' && !Array.isArray(res)) {
        // Convert to standard response format
        Object.entries(res).map(([prompt, res_obj]: [string, Dict]) => to_standard_format({prompt: prompt, ...res_obj}));
    }
    grabbed_resps = grabbed_resps.concat(res);
  }

  return {responses: grabbed_resps};
}

/**
 * Exports the cache'd data relevant to the given node id(s).
 * 
 * @param ids the ids of the nodes to export data for
 * @returns the cache'd data, as a JSON dict in format `{ files: { filename: <Dict|Array> } }`
 */
export async function exportCache(ids: string[]) {
  // For each id, extract relevant cache file data
  let export_data = {};
  for (let i = 0; i < ids.length; i++) {
    const cache_id = ids[i];
    const cache_keys = get_cache_keys_related_to_id(cache_id);
    if (cache_keys.length === 0) {
        console.warn(`Warning: Could not find cache data for id '${cache_id}'. Skipping...`);
        continue;
    }
    cache_keys.forEach((key: string) => {
      export_data[key] = load_from_cache(key);
    });
  }
  return {files: export_data};
}


/**
 * Imports the passed data relevant to specific node id(s), and saves on the backend cache.
 * Used for importing data from an exported flow, so that the flow is self-contained.
 * 
 * @param files the name and contents of the cache file
 * @returns Whether the import succeeded or not.
 */
export async function importCache(files: { [key: string]: Dict | Array<any> }): Promise<Dict> {
  try {
    // First clear the storage cache and any saved state:
    StorageCache.clear();
    StorageCache.saveToLocalStorage('chainforge-state');

    // Write imported files to StorageCache
    // Verify filenames, data, and access permissions to write to cache
    Object.entries(files).forEach(([filename, data]) => {
      StorageCache.store(filename, data);
    });
  } catch (err) {
    console.error('Error importing from cache:', err.message);
    return { result: false };
  }
  
  console.log("Imported cache data and stored to cache.");
  return { result: true };
}


/**
 * Fetches the example flow data, given its filename (without extension). 
 * The filename should be the name of a file in the examples/ folder of the package. 
 * 
 * @param _name The filename (without .cforge extension)
 * @returns a Promise with the JSON of the loaded data
 */
export async function fetchExampleFlow(evalname: string): Promise<Dict> {    
  if (APP_IS_RUNNING_LOCALLY()) {
    // Attempt to fetch the example flow from the local filesystem
    // by querying the Flask server: 
    return fetch(`${FLASK_BASE_URL}app/fetchExampleFlow`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
      body: JSON.stringify({ name: evalname })
    }).then(function(res) {
      return res.json();
    });
  }

  // App is not running locally, but hosted on a site.
  // If this is the case, attempt to fetch the example flow from a relative site path:
  return fetch(`examples/${evalname}.cforge`)
              .then(response => response.json())
              .then(res => ({data: res}));
}


/**
 * Fetches a preconverted OpenAI eval as a .cforge JSON file.

   First checks if it's running locally; if so, defaults to Flask backend for this bunction.
   Otherwise, tries to fetch the eval from a relative path on the website. 

 * @param _name The name of the eval to grab (without .cforge extension)
 * @returns a Promise with the JSON of the loaded data
 */
export async function fetchOpenAIEval(evalname: string): Promise<Dict> {
  if (APP_IS_RUNNING_LOCALLY()) {
    // Attempt to fetch the example flow from the local filesystem
    // by querying the Flask server: 
    return fetch(`${FLASK_BASE_URL}app/fetchOpenAIEval`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
      body: JSON.stringify({ name: evalname })
    }).then(function(res) {
      return res.json();
    });
  }

  // App is not running locally, but hosted on a site.
  // If this is the case, attempt to fetch the example flow from relative path on the site:
  //  > ALT: `https://raw.githubusercontent.com/ianarawjo/ChainForge/main/chainforge/oaievals/${_name}.cforge`
  return fetch(`oaievals/${evalname}.cforge`)
              .then(response => response.json())
              .then(res => ({data: res}));
}

/**
 * Passes a Python script to load a custom model provider to the Flask backend.

 * @param code The Python script to pass, as a string. 
 * @returns a Promise with the JSON of the response. Will include 'error' key if error'd; if success, 
 *          a 'providers' key with a list of all loaded custom provider callbacks, as dicts.
 */
export async function initCustomProvider(code: string): Promise<Dict> {
  // Attempt to fetch the example flow from the local filesystem
  // by querying the Flask server: 
  return fetch(`${FLASK_BASE_URL}app/initCustomProvider`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify({ code })
  }).then(function(res) {
    return res.json();
  });
}

/**
 * Asks Python script to remove a custom provider with name 'name'.

 * @param name The name of the provider to remove. The name must match the name in the `ProviderRegistry`.  
 * @returns a Promise with the JSON of the response. Will include 'error' key if error'd; if success, 
 *          a 'success' key with a true value.
 */
export async function removeCustomProvider(name: string): Promise<Dict> {
  // Attempt to fetch the example flow from the local filesystem
  // by querying the Flask server: 
  return fetch(`${FLASK_BASE_URL}app/removeCustomProvider`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify({ name })
  }).then(function(res) {
    return res.json();
  });
}

/**
 * Asks Python backend to load custom provider scripts that are cache'd in the user's local dir. 
 * 
 * @returns a Promise with the JSON of the response. Will include 'error' key if error'd; if success, 
 *          a 'providers' key with all loaded custom providers in an array. If there were none, returns empty array.
 */
export async function loadCachedCustomProviders(): Promise<Dict> {
  return fetch(`${FLASK_BASE_URL}app/loadCachedCustomProviders`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
    body: "{}"
  }).then(function(res) {
    return res.json();
  });
}
