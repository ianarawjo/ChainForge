/**
 * The page's end of the inference worker (browserInference.worker.ts).
 *
 * Every in-browser model -- the embedding models, the cross-encoder reranker
 * and the NLI model that groups chat answers by meaning -- runs in that one
 * worker. transformers.js computes on whichever thread calls it (it sets
 * `wasm.proxy = false`), and on the page's main thread a corpus of chunks, a
 * long rerank or a turn's worth of answer pairs freezes the tab until it is
 * done: 2,176 chunks held it for 54 and then 68 seconds. One worker rather
 * than one per model, so transformers.js and ONNX Runtime load once.
 *
 * The Worker is created in inferenceWorker.ts, because Jest cannot load a
 * module that uses `import.meta`; this module can be tested with a fake.
 */

/** What the page can ask of the worker. inferenceRequests.ts does each. */
export type InferenceRequest =
  | { kind: "embed"; modelId: string; texts: string[]; isQuery: boolean }
  | { kind: "rerank"; modelId: string; query: string; documents: string[] }
  | { kind: "loadNli" }
  | { kind: "entails"; premise: string; hypothesis: string }
  | { kind: "cancelNliDownload" };

/** Page to worker. */
export interface InferenceMessage {
  id: number;
  request: InferenceRequest;
}

/** Worker to page, about the request with the same id. */
export type InferenceReply =
  | { id: number; type: "progress"; progress: unknown }
  | { id: number; type: "result"; value: unknown }
  | { id: number; type: "error"; name: string; message: string };

/** The parts of a Worker this client uses. */
export interface WorkerLike {
  postMessage(message: InferenceMessage): void;
  onmessage: ((event: MessageEvent<InferenceReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

/**
 * The worker itself failed -- its script did not load, or it crashed -- as
 * opposed to a model reporting an error. Only this is worth running on the
 * page instead; a failed download would fail there too.
 */
export class InferenceWorkerFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InferenceWorkerFailed";
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  onProgress?: (progress: unknown) => void;
}

export class InferenceWorkerClient {
  private readonly worker: WorkerLike;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private failure: InferenceWorkerFailed | undefined;

  constructor(worker: WorkerLike) {
    this.worker = worker;
    worker.onmessage = (event) => this.receive(event.data);
    worker.onerror = (event) => {
      // An error event on the Worker object means the worker is unusable, and
      // nothing it was asked will ever be answered.
      this.fail(
        new InferenceWorkerFailed(
          event?.message || "The inference worker stopped unexpectedly.",
        ),
      );
    };
  }

  request<T = unknown, P = unknown>(
    request: InferenceRequest,
    onProgress?: (progress: P) => void,
  ): Promise<T> {
    if (this.failure) return Promise.reject(this.failure);
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        onProgress: onProgress as ((progress: unknown) => void) | undefined,
      });
      this.worker.postMessage({ id, request });
    });
  }

  private receive(reply: InferenceReply): void {
    const request = this.pending.get(reply.id);
    if (!request) return;
    if (reply.type === "progress") {
      request.onProgress?.(reply.progress);
      return;
    }
    this.pending.delete(reply.id);
    if (reply.type === "result") {
      request.resolve(reply.value);
    } else {
      // The name survives the trip, so the page can still tell a cancelled
      // download from a failed one.
      const err = new Error(reply.message);
      err.name = reply.name;
      request.reject(err);
    }
  }

  private fail(failure: InferenceWorkerFailed): void {
    this.failure = failure;
    for (const request of this.pending.values()) request.reject(failure);
    this.pending.clear();
    this.worker.terminate();
  }
}

/** The worker, once started. See inferenceWorker(). */
let workerStarting: Promise<InferenceWorkerClient | undefined> | undefined;
/** Set once the worker could not start or stopped working. */
let workerUnavailable = false;

/**
 * The inference worker, started on first use, or undefined where there is
 * none: under Jest, in browsers without Workers, after it has failed, and
 * inside the worker itself, which must not start another.
 */
export function inferenceWorker(): Promise<InferenceWorkerClient | undefined> {
  if (
    workerUnavailable ||
    typeof window === "undefined" ||
    typeof Worker === "undefined"
  )
    return Promise.resolve(undefined);
  workerStarting ??= import("./inferenceWorker")
    .then(({ startInferenceWorker }) => startInferenceWorker())
    .catch((err) => {
      workerUnavailable = true;
      console.warn("Could not start the inference worker:", err);
      return undefined;
    });
  return workerStarting;
}

/** Stops using the worker, after it failed. Models run on the page from now. */
export function inferenceWorkerFailed(err: unknown): void {
  workerUnavailable = true;
  console.warn("The inference worker failed; running models on the page:", err);
}

/**
 * Runs a request in the inference worker, or `onPage` where there is no
 * working worker. `onPage` must do the same work on the calling thread.
 */
export async function inWorkerOrOnPage<T, P = unknown>(
  request: InferenceRequest,
  onPage: () => Promise<T>,
  onProgress?: (progress: P) => void,
): Promise<T> {
  const worker = await inferenceWorker();
  if (worker) {
    try {
      return await worker.request<T, P>(request, onProgress);
    } catch (err) {
      if (!(err instanceof InferenceWorkerFailed)) throw err;
      inferenceWorkerFailed(err);
    }
  }
  return onPage();
}
