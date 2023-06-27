import { queryLLM, executejs, FLASK_BASE_URL, 
         fetchExampleFlow, fetchOpenAIEval, importCache, 
         exportCache, countQueries, grabResponses, 
         createProgressFile } from "./backend/backend";
import { APP_IS_RUNNING_LOCALLY } from "./backend/utils";

const BACKEND_TYPES = {
  FLASK: 'flask',
  JAVASCRIPT: 'js',
};
export let BACKEND_TYPE = BACKEND_TYPES.JAVASCRIPT;

function _route_to_flask_backend(route, params, rejected) {
  return fetch(`${FLASK_BASE_URL}app/${route}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
    body: JSON.stringify(params)
  }, rejected).then(function(res) {
    return res.json();
  });
}

async function _route_to_js_backend(route, params) {
  switch (route) {
    case 'grabResponses':
      return grabResponses(params.responses);
    case 'countQueriesRequired':
      return countQueries(params.prompt, params.vars, params.llms, params.n, params.id);
    case 'createProgressFile':
      return createProgressFile(params.id);
    case 'queryllm':
      return queryLLM(params.id, params.llm, params.n, params.prompt, params.vars, params.api_keys, params.no_cache, params.progress_listener);
    case 'executejs':
      return executejs(params.id, params.code, params.responses, params.scope);
    case 'importCache':
      return importCache(params.files);
    case 'exportCache':
      return exportCache(params.ids);
    case 'fetchExampleFlow':
      return fetchExampleFlow(params.name);
    case 'fetchOpenAIEval':
      return fetchOpenAIEval(params.name);
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

  if (route === 'execute') {  // executing Python code 
    if (APP_IS_RUNNING_LOCALLY())
      return _route_to_flask_backend(route, params, rejected);
    else {
      // We can't execute Python if we're not running the local Flask server. Error out:
      return new Promise((resolve, reject) => {
        const msg = "Cannot run 'execute' route to evaluate Python code: ChainForge does not appear to be running on localhost.";
        rejected(new Error(msg));
        reject(msg);
      });
    }
  }

  switch (BACKEND_TYPE) {
    case BACKEND_TYPES.FLASK:  // Fetch from Flask (python) backend
      return _route_to_flask_backend(route, params, rejected);
    case BACKEND_TYPES.JAVASCRIPT:  // Fetch from client-side Javascript 'backend'
      return _route_to_js_backend(route, params);
    default:
      console.error('Unsupported backend type:', BACKEND_TYPE);
      break;
  }
}

export function set_backend_type(t) {
  BACKEND_TYPE = t;
}
