/**
 * Starts the embedding worker.
 *
 * On its own because `new URL(..., import.meta.url)` is how webpack finds and
 * bundles the worker, and Jest cannot load a module that uses `import.meta`.
 * browserEmbeddings.ts imports this only when the page has Workers.
 */

import { EmbeddingWorkerClient, WorkerLike } from "./embeddingWorkerClient";

export function startEmbeddingWorker(): EmbeddingWorkerClient {
  const worker = new Worker(
    new URL("./browserEmbeddings.worker.ts", import.meta.url),
  );
  return new EmbeddingWorkerClient(worker as unknown as WorkerLike);
}
