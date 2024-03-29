import { v4 as uuid } from "uuid";
import { PromptTemplate, PromptPermutationGenerator } from "./template";
import { LLM, NativeLLM, RateLimiter } from "./models";
import {
  Dict,
  LLMResponseError,
  RawLLMResponseObject,
  isEqualChatHistory,
  ChatHistoryInfo,
  ModelSettingsDict,
  isImageResponseData,
} from "./typing";
import {
  extract_responses,
  merge_response_objs,
  call_llm,
  mergeDicts,
  deepcopy,
  extractSettingsVars,
  areEqualVarsDicts,
  repairCachedResponses,
  compressBase64Image,
} from "./utils";
import StorageCache from "./cache";
import { UserForcedPrematureExit } from "./errors";
import { typecastSettingsDict } from "../ModelSettingSchemas";

interface _IntermediateLLMResponseType {
  prompt: PromptTemplate;
  chat_history?: ChatHistoryInfo;
  query?: Dict;
  response?: Dict | LLMResponseError;
  past_resp_obj?: RawLLMResponseObject;
  past_resp_obj_cache_idx?: number;
}

// From trincot @ SO: https://stackoverflow.com/a/76477994/1911342
// Functions equivalently to Python's asyncio 'as_completed' method,
// performing a Promise.race() but where all promises are yielded as they complete
async function* yield_as_completed(promises: Array<Promise<any>>) {
  // Don't mutate original array, and have Promise.race work with the
  // chained promises, so that if there is a rejection, the caller's
  // error handler will stop a rejection to bubble up unhandled.
  promises = promises.map(
    (p) =>
      (p = p.then((val: any) => {
        promises.splice(promises.indexOf(p), 1);
        return val;
      })),
  );
  while (promises.length) yield Promise.race(promises);
  return true;
}

/**
 *  Abstract class that captures a generic querying interface to prompt LLMs
 */
export class PromptPipeline {
  private _template: string;
  private _storageKey?: string;
  private _imgCompr: boolean;

  constructor(template: string, storageKey?: string) {
    this._template = template;
    this._storageKey = storageKey;
    this._imgCompr = StorageCache.get("imageCompression") === true;
  }

  *gen_prompts(vars: Dict): Generator<PromptTemplate, boolean, undefined> {
    const prompt_perm_gen = new PromptPermutationGenerator(this._template);
    yield* prompt_perm_gen.generate(vars);
    return true;
  }

  private async collect_LLM_response(
    result: _IntermediateLLMResponseType,
    llm: LLM,
    cached_responses: Dict,
  ): Promise<RawLLMResponseObject | LLMResponseError> {
    const {
      prompt,
      chat_history,
      query,
      response,
      past_resp_obj,
      past_resp_obj_cache_idx,
    } = result;

    // Check for selective failure
    if (!query && response instanceof LLMResponseError)
      return response; // yield the LLMResponseException
    else if (response === undefined) return new LLMResponseError("Unknown");

    // Each prompt has a history of what was filled in from its base template.
    // This data --like, "class", "language", "library" etc --can be useful when parsing responses.
    const info = prompt.fill_history;
    const metavars = prompt.metavars;

    // Extract and format the responses into `LLMResponseData`
    const extracted_resps = extract_responses(response, llm);

    // Detect any images and downrez them if the user has approved of automatic compression.
    // This saves a lot of performance and storage. We also need to disable storing the raw response here, to save space.
    const contains_imgs = extracted_resps.some(isImageResponseData);
    if (contains_imgs && this._imgCompr) {
      for (const r of extracted_resps) {
        if (isImageResponseData(r)) {
          try {
            // Compress asynchronously, then convert back to base64
            const b64_comp = await compressBase64Image(r.d);

            // DEBUG: Calculate compression ratio
            // console.warn(
            //   `Compressed image to ${(b64_comp.length / r.d.length) * 100}% of original b64 size`,
            // );

            // Swap data on original image for compressed
            r.d = b64_comp;
          } catch (e) {
            // If compression fails, we just move on.
            console.warn("Image compression attempt failed. Error info:", e);
          }
        }
      }
    }

    // Create a response obj to represent the response
    let resp_obj: RawLLMResponseObject = {
      prompt: prompt.toString(),
      query: query ?? {},
      uid: uuid(),
      responses: extracted_resps,
      raw_response: contains_imgs ? {} : response ?? {}, // don't double-store images
      llm,
      vars: mergeDicts(info, chat_history?.fill_history) ?? {},
      metavars: mergeDicts(metavars, chat_history?.metavars) ?? {},
    };

    // Carry over the chat history if present:
    if (chat_history !== undefined)
      resp_obj.chat_history = chat_history.messages;

    // Merge the response obj with the past one, if necessary
    if (past_resp_obj)
      resp_obj = merge_response_objs(
        resp_obj,
        past_resp_obj,
      ) as RawLLMResponseObject;

    // Save the current state of cache'd responses to a JSON file
    // NOTE: We do this to save money --in case something breaks between calls, can ensure we got the data!
    if (!(resp_obj.prompt in cached_responses))
      cached_responses[resp_obj.prompt] = [];
    else if (!Array.isArray(cached_responses[resp_obj.prompt]))
      cached_responses[resp_obj.prompt] = [cached_responses[resp_obj.prompt]];

    if (past_resp_obj_cache_idx !== undefined && past_resp_obj_cache_idx > -1)
      cached_responses[resp_obj.prompt][past_resp_obj_cache_idx] = resp_obj;
    else cached_responses[resp_obj.prompt].push(resp_obj);

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
  async *gen_responses(
    vars: Dict,
    llm: LLM,
    n = 1,
    temperature = 1.0,
    llm_params?: Dict,
    chat_histories?: ChatHistoryInfo[],
    should_cancel?: () => boolean,
  ): AsyncGenerator<
    RawLLMResponseObject | LLMResponseError,
    boolean,
    undefined
  > {
    // Load any cache'd responses
    const responses = this._load_cached_responses();

    // Normalize the chat history var such that there's always at least one element.
    const _chat_histories =
      chat_histories !== undefined && chat_histories.length > 0
        ? chat_histories
        : [undefined];

    // Query LLM with each prompt, yield + cache the responses
    const tasks: Array<
      Promise<
        _IntermediateLLMResponseType | LLMResponseError | RawLLMResponseObject
      >
    > = [];

    // Generate concrete prompts one by one. Yield response from the cache or make async call to LLM.
    for (const prompt of this.gen_prompts(vars)) {
      let prompt_str = prompt.toString();
      const info = prompt.fill_history;
      const metavars = prompt.metavars;

      // Settings params are special template vars of form {=name}, where = prefaces the varname.
      // These must be extracted and, below, passed as 'llm_params'. Note that the name of the param
      // *has to be correct* and match the param name, for this to work.
      const settings_params = extractSettingsVars(info);

      // Loop over any present chat histories. (If none, will have a single pass with 'undefined' as chat_history value.)
      for (const chat_history of _chat_histories) {
        // If there's chat history, we need to fill any special (#) vars from the carried chat_history vars and metavars:
        if (chat_history !== undefined) {
          prompt.fill_special_vars({
            ...chat_history?.fill_history,
            ...chat_history?.metavars,
          });
          prompt_str = prompt.toString();
        }

        if (!prompt.is_concrete())
          throw new Error(
            `Cannot send a prompt '${prompt}' to LLM: Prompt is a template.`,
          );

        // Get the cache of responses with respect to this prompt, + normalize format so it's always an array (of size >= 0)
        const cache_bucket = responses[prompt_str];
        const cached_resps: RawLLMResponseObject[] = Array.isArray(cache_bucket)
          ? cache_bucket
          : cache_bucket === undefined
            ? []
            : [cache_bucket];

        // Check if there's a cached response with the same prompt + (if present) chat history and settings vars:
        let cached_resp: RawLLMResponseObject | undefined;
        let cached_resp_idx = -1;
        // Find an indivdual response obj that matches the chat history + (if present) settings vars:
        for (let i = 0; i < cached_resps.length; i++) {
          if (
            isEqualChatHistory(
              cached_resps[i].chat_history,
              chat_history?.messages,
            ) &&
            areEqualVarsDicts(
              settings_params,
              extractSettingsVars(cached_resps[i].vars),
            )
          ) {
            cached_resp = cached_resps[i];
            cached_resp_idx = i;
            break;
          }
        }
        const extracted_resps: Array<any> = cached_resp
          ? cached_resp.responses
          : [];

        // First check if there is already a response for this item under these settings. If so, we can save an LLM call:
        if (cached_resp && extracted_resps.length >= n) {
          // console.log(` - Found cache'd response for prompt ${prompt_str}. Using...`);
          const resp: RawLLMResponseObject = {
            prompt: prompt_str,
            query: cached_resp.query,
            uid: cached_resp.uid ?? uuid(),
            responses: extracted_resps.slice(0, n),
            raw_response: cached_resp.raw_response,
            llm: cached_resp.llm || NativeLLM.OpenAI_ChatGPT,
            // We want to use the new info, since 'vars' could have changed even though
            // the prompt text is the same (e.g., "this is a tool -> this is a {x} where x='tool'")
            vars: mergeDicts(info, chat_history?.fill_history) ?? {},
            metavars: mergeDicts(metavars, chat_history?.metavars) ?? {},
          };
          if (chat_history !== undefined)
            resp.chat_history = chat_history.messages;
          yield resp;
          continue;
        }

        // Call the LLM asynchronously to generate a response
        tasks.push(
          this._prompt_llm(
            llm,
            prompt,
            n,
            temperature,
            cached_resp,
            cached_resp_idx,
            {
              ...llm_params,
              ...typecastSettingsDict(
                settings_params as ModelSettingsDict,
                llm,
              ),
            },
            chat_history,
            should_cancel,
          ).then((result) => this.collect_LLM_response(result, llm, responses)),
        );
      }
    }

    // Yield responses as they come in
    for await (const result of yield_as_completed(tasks)) {
      yield result;
    }

    return true;
  }

  /**
   * Loads cache'd responses of JSON.
   * Useful for continuing if computation was interrupted halfway through.
   */
  _load_cached_responses(): {
    [key: string]: RawLLMResponseObject | RawLLMResponseObject[];
  } {
    if (this._storageKey === undefined) return {};
    const data: Record<string, RawLLMResponseObject | RawLLMResponseObject[]> =
      StorageCache.get(this._storageKey) ?? {};

    // Before retuning, verify data integrity: check that uids are present for all responses.
    return repairCachedResponses(data, this._storageKey);
  }

  /**
   * Stores the JSON responses to the local cache.
   * (Overrides the existing responses stored in the cache.)
   */
  _cache_responses(responses: Dict): void {
    if (this._storageKey !== undefined)
      StorageCache.store(this._storageKey, responses);
  }

  async _prompt_llm(
    llm: LLM,
    prompt: PromptTemplate,
    n = 1,
    temperature = 1.0,
    past_resp_obj?: RawLLMResponseObject,
    past_resp_obj_cache_idx?: number,
    llm_params?: Dict,
    chat_history?: ChatHistoryInfo,
    should_cancel?: () => boolean,
  ): Promise<_IntermediateLLMResponseType> {
    // Detect how many responses we have already (from cache obj past_resp_obj)
    if (past_resp_obj) {
      // How many *new* queries we need to send:
      // NOTE: The check n > len(past_resp_obj["responses"]) should occur prior to calling this function.
      n = n - past_resp_obj.responses.length;
    }

    // Fix temperature if it's provided in llm_params:
    if (llm_params?.temperature !== undefined)
      temperature = llm_params.temperature;

    // Now try to call the API. If it fails for whatever reason, 'soft fail' by returning
    // an LLMResponseException object as the 'response'.
    const params = deepcopy(llm_params);
    if (chat_history !== undefined && params)
      params.chat_history = chat_history.messages;
    let query: Dict | undefined;
    let response: Dict | LLMResponseError;
    try {
      // When/if we emerge from sleep, check if this process has been canceled in the meantime:
      if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();
      // Call the LLM, returning when the Promise returns (if it does!)
      // NOTE: This also throttles API calls on a model-specific basis, across global application state, using Bottleneck.
      //       It's not perfect, but it's simpler than throttling at the call-specific level.
      [query, response] = await RateLimiter.throttle(
        llm,
        () =>
          call_llm(
            llm,
            prompt.toString(),
            n,
            temperature,
            params,
            should_cancel,
          ),
        should_cancel,
      );

      // When/if we emerge from getting a response, check if this process has been canceled in the meantime:
      if (should_cancel && should_cancel()) throw new UserForcedPrematureExit();
    } catch (err) {
      if (err instanceof UserForcedPrematureExit) throw err; // bubble cancels up

      return {
        prompt,
        query: undefined,
        response: new LLMResponseError((err as Error).message),
        past_resp_obj: undefined,
        past_resp_obj_cache_idx: -1,
      };
    }

    return {
      prompt,
      chat_history,
      query,
      response,
      past_resp_obj,
      past_resp_obj_cache_idx,
    };
  }
}
