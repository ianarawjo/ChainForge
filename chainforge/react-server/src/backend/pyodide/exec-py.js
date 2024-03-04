/**
 * Executes Python code in browser sandbox with pyodide.
 *
 * Code adapted from https://pyodide.org/en/stable/usage/webworker.html
 */

import { v4 as uuid } from "uuid";

// Setup
let pyodideWorker = undefined;
const callbacks = {};

const execPy = (() => {
  return (script, context) => {
    // Initalize the worker only when first called, to save on load times
    if (!pyodideWorker) {
      pyodideWorker = new Worker(
        new URL("./exec-py.worker.js", import.meta.url),
      );
      pyodideWorker.onmessage = (event) => {
        const { id, ...data } = event.data;
        const onSuccess = callbacks[id];
        delete callbacks[id];
        onSuccess(data);
      };
    }

    let id = uuid();

    // Execute the worker
    return new Promise((onSuccess) => {
      callbacks[id] = onSuccess;
      pyodideWorker.postMessage({
        ...context,
        python: script,
        id,
      });
    });
  };
})();

export { execPy };
