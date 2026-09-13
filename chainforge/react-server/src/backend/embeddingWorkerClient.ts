/**
 * The page's end of the embedding worker (browserEmbeddings.worker.ts).
 *
 * The Worker itself is created in embeddingWorker.ts, so this module needs no
 * bundler features and can be tested with a fake worker.
 */

import type { EmbeddingLoadProgress, ProgressFn } from "./browserEmbeddings";

/** Page to worker: embed these texts. */
export interface EmbedRequest {
  id: number;
  modelId: string;
  texts: string[];
  isQuery: boolean;
}

/** Worker to page, about the request with the same id. */
export type EmbedWorkerMessage =
  | { id: number; type: "progress"; progress: EmbeddingLoadProgress }
  | { id: number; type: "result"; vectors: Float32Array[] }
  | { id: number; type: "error"; message: string };

/** The parts of a Worker this client uses. */
export interface WorkerLike {
  postMessage(message: EmbedRequest): void;
  onmessage: ((event: MessageEvent<EmbedWorkerMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

/**
 * The worker itself failed -- its script did not load, or it crashed -- as
 * opposed to the model reporting an error. Only this is worth falling back to
 * the page thread for; a failed download would fail there too.
 */
export class EmbeddingWorkerFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingWorkerFailed";
  }
}

interface Pending {
  resolve: (vectors: Float32Array[]) => void;
  reject: (err: Error) => void;
  onProgress?: ProgressFn;
}

export class EmbeddingWorkerClient {
  private readonly worker: WorkerLike;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private failure: EmbeddingWorkerFailed | undefined;

  constructor(worker: WorkerLike) {
    this.worker = worker;
    worker.onmessage = (event) => this.receive(event.data);
    worker.onerror = (event) => {
      // An error event on the Worker object means the worker is unusable, and
      // nothing it was asked will ever be answered.
      this.fail(
        new EmbeddingWorkerFailed(
          event?.message || "The embedding worker stopped unexpectedly.",
        ),
      );
    };
  }

  embed(
    modelId: string,
    texts: string[],
    opts: { isQuery?: boolean; onProgress?: ProgressFn } = {},
  ): Promise<Float32Array[]> {
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress: opts.onProgress });
      this.worker.postMessage({
        id,
        modelId,
        texts,
        isQuery: Boolean(opts.isQuery),
      });
    });
  }

  private receive(message: EmbedWorkerMessage): void {
    const request = this.pending.get(message.id);
    if (!request) return;
    if (message.type === "progress") {
      request.onProgress?.(message.progress);
      return;
    }
    this.pending.delete(message.id);
    if (message.type === "result") request.resolve(message.vectors);
    else request.reject(new Error(message.message));
  }

  private fail(failure: EmbeddingWorkerFailed): void {
    this.failure = failure;
    for (const request of this.pending.values()) request.reject(failure);
    this.pending.clear();
    this.worker.terminate();
  }
}
