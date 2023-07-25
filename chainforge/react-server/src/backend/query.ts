import { PromptTemplate, PromptPermutationGenerator } from "./template";
import { LLM, RATE_LIMITS } from './models';
import { Dict, LLMResponseError, LLMResponseObject, ChatHistory } from "./typing";
import { extract_responses, merge_response_objs, call_llm } from "./utils";
import StorageCache from "./cache";

const clone = (obj) => JSON.parse(JSON.stringify(obj));

interface _IntermediateLLMResponseType {
  prompt: PromptTemplate,
  chat_history?: ChatHistory,
  query?: Dict,
  response?: Dict | LLMResponseError,
  past_resp_obj?: LLMResponseObject,
}

// From trincot @ SO: https://stackoverflow.com/a/76477994/1911342
// Functions equivalently to Python's asyncio 'as_completed' method,
// performing a Promise.race() but where all promises are yielded as they complete
async function* yield_as_completed(promises: Array<Promise<any>>) {
  // Don't mutate original array, and have Promise.race work with the
  // chained promises, so that if there is a rejection, the caller's 
  // error handler will stop a rejection to bubble up unhandled.
  promises = promises.map(p => p = p.then((val: any) => {
      promises.splice(promises.indexOf(p), 1);
      return val;
  }));
  while (promises.length) yield Promise.race(promises);
  return true;
}

/** Equivalent to Python's asyncio.sleep */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 *  Abstract class that captures a generic querying interface to prompt LLMs
 */
export class PromptPipeline {
  private _storageKey: string;
  private _template: string;

  constructor(template: string, storageKey: string) {
    this._template = template;
    this._storageKey = storageKey;
  }

  *gen_prompts(vars: Dict): Generator<PromptTemplate, boolean, undefined> {
    const prompt_perm_gen = new PromptPermutationGenerator(this._template);
    yield* prompt_perm_gen.generate(vars);
    return true;
  }

  private collect_LLM_response(result: _IntermediateLLMResponseType, llm: LLM, cached_responses: Dict): LLMResponseObject | LLMResponseError {
    let {prompt, chat_history, query, response, past_resp_obj} = result;

    // Check for selective failure
    if (!query && response instanceof LLMResponseError)
      return response;  // yield the LLMResponseException

    // Each prompt has a history of what was filled in from its base template.
    // This data --like, "class", "language", "library" etc --can be useful when parsing responses.
    let info = prompt.fill_history;
    let metavars = prompt.metavars;

    // Create a response obj to represent the response
    let resp_obj: LLMResponseObject = {
      "prompt": prompt.toString(), 
      "query": query, 
      "responses": extract_responses(response, llm),
      "raw_response": response,
      "llm": llm,
      "info": info,
      "metavars": metavars,
    };

    // Carry over the chat history if present:
    if (chat_history !== undefined)
      resp_obj.chat_history = chat_history;

    // Merge the response obj with the past one, if necessary
    if (past_resp_obj)
      resp_obj = merge_response_objs(resp_obj, past_resp_obj) as LLMResponseObject;

    // Save the current state of cache'd responses to a JSON file
    // NOTE: We do this to save money --in case something breaks between calls, can ensure we got the data!
    cached_responses[resp_obj["prompt"]] = resp_obj;
    this._cache_responses(cached_responses);

    // console.log(` - collected response from ${llm} for prompt: ${resp_obj['prompt']}`);

    // Yield the response
    return resp_obj;
  }

  /**
    Calls LLM 'llm' with all prompts, and yields responses as dicts in format {prompt, query, response, llm, info}.

    Queries are sent off asynchronously (if possible).
    Yields responses as they come in. All LLM calls that yield errors (e.g., 'rate limit' error)
    will yield an individual LLMResponseException, so downstream tasks must check for this exception type.

    By default, for each response successfully collected, this also saves reponses to disk as JSON at the filepath given during init. 
    (Very useful for saving money in case something goes awry!)
    To clear the cached responses, call clear_cached_responses(). 

    NOTE: The reason we collect, rather than raise, LLMResponseExceptions is because some API calls 
          may still succeed, even if some fail. We don't want to stop listening to pending API calls, 
          because we may lose money. Instead, we fail selectively. 

   * @param vars The 'vars' dict to fill variables in the root prompt template. For instance, for 'Who is {person}?', vars might = { person: ['TJ', 'MJ', 'AD'] }.
   * @param llm The specific LLM model to call. See the LLM enum for supported models.
   * @param n How many generations per prompt sent to the LLM.
   * @param temperature The temperature to use when querying the LLM.
   * @param llm_params Optional. The model-specific settings to pass into the LLM API call. Varies by LLM. 
   * @param chat_histories Optional. A list of chat histories, with messages in OpenAI format. When present, calculates the cross product:
   *                                    queries = (prompts) X (chat_histories)
   *                                 to generate individual queries to LLMs. For instance, wish the prompt 'Who is {person}?', 3 values for person,
   *                                 and 3 different prior chat histories, it will send off 9 queries. 
   * @yields Yields `LLMResponseObject` if API call succeeds, or `LLMResponseError` if API call fails, for all requests. 
   */
  async *gen_responses(vars: Dict, 
                        llm: LLM,
                          n: number = 1, 
                temperature: number = 1.0, 
                llm_params?: Dict,
            chat_histories?: ChatHistory[]): AsyncGenerator<LLMResponseObject | LLMResponseError, boolean, undefined> {
    // Load any cache'd responses
    let responses = this._load_cached_responses();

    // Query LLM with each prompt, yield + cache the responses
    let tasks: Array<Promise<_IntermediateLLMResponseType>> = [];
    const rate_limit = RATE_LIMITS[llm] || [1, 0];
    let [max_req, wait_secs] = rate_limit ? rate_limit : [1, 0];
    let num_queries_sent = -1;

    for (const prompt of this.gen_prompts(vars)) {
      if (!prompt.is_concrete())
        throw Error(`Cannot send a prompt '${prompt}' to LLM: Prompt is a template.`)

      const prompt_str = prompt.toString();
      const info = prompt.fill_history;
      const metavars = prompt.metavars;

      let cached_resp = prompt_str in responses ? responses[prompt_str] : undefined;
      let extracted_resps: Array<any> = cached_resp ? cached_resp["responses"] : [];
      
      // First check if there is already a response for this item under these settings. If so, we can save an LLM call:
      if (cached_resp && extracted_resps.length >= n) {
        // console.log(` - Found cache'd response for prompt ${prompt_str}. Using...`);
        yield ({
          "prompt": prompt_str,
          "query": cached_resp["query"],
          "responses": extracted_resps.slice(0, n),
          "raw_response": cached_resp["raw_response"],
          "llm": cached_resp["llm"] || LLM.OpenAI_ChatGPT,
          // We want to use the new info, since 'vars' could have changed even though 
          // the prompt text is the same (e.g., "this is a tool -> this is a {x} where x='tool'")
          "info": info,
          "metavars": metavars,
        });
        continue;
      }

      num_queries_sent += 1;

      if (max_req > 1) {                
        // Call the LLM asynchronously to generate a response, sending off
        // requests in batches of size 'max_req' separated by seconds 'wait_secs' to avoid hitting rate limit
        tasks.push(this._prompt_llm(llm, prompt, n, temperature, 
                                    cached_resp, 
                                    num_queries_sent, 
                                    max_req, 
                                    wait_secs, 
                                    llm_params));
      } else {
        // Block. Await + yield a single LLM call.
        let result = await this._prompt_llm(llm, prompt, n, temperature, cached_resp, 
                                            undefined, undefined, undefined, 
                                            llm_params);
        yield this.collect_LLM_response(result, llm, responses);
      }
    }

    // Yield responses as they come in
    for await (const result of yield_as_completed(tasks)) {
      yield this.collect_LLM_response(result, llm, responses);
    }
      
    return true;
  }

  /**
   * Loads cache'd responses of JSON.
   * Useful for continuing if computation was interrupted halfway through. 
   */
  _load_cached_responses(): {[key: string]: LLMResponseObject} {
    return StorageCache.get(this._storageKey) || {};
  }

  /**
   * Stores the JSON responses to the local cache. 
   * (Overrides the existing responses stored in the cache.)
   */
  _cache_responses(responses: Dict): void {
    StorageCache.store(this._storageKey, responses);
  }

  async _prompt_llm(llm: LLM, 
                    prompt: PromptTemplate, 
                    n: number = 1, 
                    temperature: number = 1.0, 
                    past_resp_obj?: LLMResponseObject,
                    query_number?: number,
                    rate_limit_batch_size?: number,
                    rate_limit_wait_secs?: number,
                    llm_params?: Dict,
                    chat_history?: ChatHistory): Promise<_IntermediateLLMResponseType> {
    // Detect how many responses we have already (from cache obj past_resp_obj)
    if (past_resp_obj) {
      // How many *new* queries we need to send: 
      // NOTE: The check n > len(past_resp_obj["responses"]) should occur prior to calling this function. 
      n = n - past_resp_obj["responses"].length;
    }
    
    // Block asynchronously when we exceed rate limits
    if (query_number !== undefined && rate_limit_batch_size !== undefined && rate_limit_wait_secs !== undefined && 
        rate_limit_batch_size >= 1 && rate_limit_wait_secs > 0) {
      let batch_num = Math.floor(query_number / rate_limit_batch_size);
      if (batch_num > 0) {
        // We've exceeded the estimated batch rate limit and need to wait the appropriate seconds before sending off new API calls:
        const wait_secs = rate_limit_wait_secs * batch_num;
        if (query_number % rate_limit_batch_size === 0)  // Print when we start blocking, for each batch
          console.log(`Batch rate limit of ${rate_limit_batch_size} reached for LLM ${llm}. Waiting {$wait_secs} seconds until sending request batch #${batch_num}...`);
        await sleep(wait_secs);
      }
    }
    
    // Now try to call the API. If it fails for whatever reason, 'soft fail' by returning
    // an LLMResponseException object as the 'response'.
    let params = clone(llm_params);
    if (chat_history !== undefined) params.chat_history = chat_history;
    let query: Dict | undefined;
    let response: Dict | LLMResponseError;
    try {
      [query, response] = await call_llm(llm, prompt.toString(), n, temperature, params);
    } catch(err) {
      return { prompt: prompt, 
               query: undefined, 
               response: new LLMResponseError(err.message), 
               past_resp_obj: undefined };
    }
    
    return { prompt, 
             chat_history,
             query, 
             response,
             past_resp_obj };
  }
}
