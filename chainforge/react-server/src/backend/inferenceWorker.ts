/**
 * Starts the inference worker.
 *
 * On its own because `new URL(..., import.meta.url)` is how webpack finds and
 * bundles the worker, and Jest cannot load a module that uses `import.meta`.
 * inferenceWorkerClient.ts imports this only when the page has Workers.
 */

import { InferenceWorkerClient, WorkerLike } from "./inferenceWorkerClient";

export function startInferenceWorker(): InferenceWorkerClient {
  const worker = new Worker(
    new URL("./browserInference.worker.ts", import.meta.url),
  );
  return new InferenceWorkerClient(worker as unknown as WorkerLike);
}
