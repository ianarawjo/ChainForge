import { queryLLM, executejs, executepy, 
         fetchExampleFlow, fetchOpenAIEval, importCache, 
         exportCache, countQueries, grabResponses, 
         generatePrompts, initCustomProvider,
         removeCustomProvider, evalWithLLM, loadCachedCustomProviders, fetchEnvironAPIKeys } from "./backend/backend";

const clone = (obj) => JSON.parse(JSON.stringify(obj));

async function _route_to_js_backend(route, params) {
  switch (route) {
    case 'grabResponses':
      return grabResponses(params.responses);
    case 'countQueriesRequired':
      return countQueries(params.prompt, clone(params.vars), clone(params.llms), params.n, params.chat_histories, params.id, params.cont_only_w_prior_llms);
    case 'generatePrompts':
      return generatePrompts(params.prompt, clone(params.vars));
    case 'queryllm':
      return queryLLM(params.id, clone(params.llm), params.n, params.prompt, clone(params.vars), params.chat_histories, params.api_keys, params.no_cache, params.progress_listener, params.cont_only_w_prior_llms);
    case 'executejs':
      return executejs(params.id, params.code, params.responses, params.scope, params.process_type);
    case 'executepy':
      return executepy(params.id, params.code, params.responses, params.scope, params.process_type, params.script_paths);
    case 'evalWithLLM':
      return evalWithLLM(params.id, params.llm, params.root_prompt, params.responses, params.api_keys, params.progress_listener);
    case 'importCache':
      return importCache(params.files);
    case 'exportCache':
      return exportCache(params.ids);
    case 'fetchExampleFlow':
      return fetchExampleFlow(params.name);
    case 'fetchOpenAIEval':
      return fetchOpenAIEval(params.name);
    case 'fetchEnvironAPIKeys':
      return fetchEnvironAPIKeys();
    case 'initCustomProvider':
      return initCustomProvider(params.code);
    case 'removeCustomProvider':
      return removeCustomProvider(params.name);
    case 'loadCachedCustomProviders':
      return loadCachedCustomProviders();
    default:
      throw new Error(`Could not find backend function for route named ${route}`);
  }
}

/**
 * Abstracts calls to the ChainForge backend, so that Python Flask backend can be used,
 * or Javascript (client-side) 'backend' in used. 
 * This should be used in place of native 'fetch' operations.
 * 
 * @returns a Promise with the result of the fetch call.
 */
export default function fetch_from_backend(route, params, rejected) {
  rejected = rejected || ((err) => {throw new Error(err)});
  return _route_to_js_backend(route, params).catch(rejected);
}
