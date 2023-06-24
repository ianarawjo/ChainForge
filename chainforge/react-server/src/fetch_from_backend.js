const BACKEND_TYPES = {
  FLASK: 'flask',
  JAVASCRIPT: 'js',
};
let BACKEND_TYPE = BACKEND_TYPES.FLASK;

/** Where the ChainForge Flask server is being hosted. */
export const FLASK_BASE_URL = 'http://localhost:8000/';

/**
 * Abstracts calls to the ChainForge backend, so that Python Flask backend can be used,
 * or Javascript (client-side) 'backend' in used. 
 * This should be used in place of native 'fetch' operations.
 * 
 * @returns a Promise with the result of the fetch call.
 */
export default function fetch_from_backend(route, params, rejected) {
  switch (BACKEND_TYPE) {
    case BACKEND_TYPES.FLASK:  // Fetch from Flask (python) backend
      return fetch(`${FLASK_BASE_URL}app/${route}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify(params)
      }, rejected || ((err) => {throw new Error(err)}));
    case BACKEND_TYPES.JAVASCRIPT:  // Fetch from client-side Javascript 'backend'
      // TO BE IMPLEMENTED
      break;
    default:
      console.error('Unsupported backend type:', BACKEND_TYPE);
      break;
  }
}

export function set_backend_type(t) {
  BACKEND_TYPE = t;
}