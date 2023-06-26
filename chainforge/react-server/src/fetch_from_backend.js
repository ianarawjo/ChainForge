import { queryLLM } from "./backend/backend";

const BACKEND_TYPES = {
  FLASK: 'flask',
  JAVASCRIPT: 'js',
};
export let BACKEND_TYPE = BACKEND_TYPES.FLASK;

/** Where the ChainForge Flask server is being hosted. */
export const FLASK_BASE_URL = 'http://localhost:8000/';

async function _route_to_js_backend(route, params) {
  switch (route) {
    case 'queryllm':
      return queryLLM(...Object.values(params));
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
  switch (BACKEND_TYPE) {
    case BACKEND_TYPES.FLASK:  // Fetch from Flask (python) backend
      return fetch(`${FLASK_BASE_URL}app/${route}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify(params)
      }, rejected).then(function(res) {
        return res.json();
      });
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