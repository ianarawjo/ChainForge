/**
 * Runs the in-browser models off the page's main thread.
 *
 * transformers.js runs ONNX Runtime's single-threaded WASM build on whichever
 * thread calls it, so on the page every model call is computed on the main
 * thread, with no gap for the browser to paint or handle input until it
 * returns. Here the same work happens in a worker, and the page only receives
 * progress and results.
 *
 * inferenceWorkerClient.ts is the page's end of these messages, and
 * inferenceRequests.ts says what each request does.
 */

import { handleInferenceRequest } from "./inferenceRequests";
import type { InferenceMessage, InferenceReply } from "./inferenceWorkerClient";

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;

function post(reply: InferenceReply, transfer: Transferable[] = []) {
  scope.postMessage(reply, transfer);
}

scope.onmessage = async (event: MessageEvent<InferenceMessage>) => {
  const { id, request } = event.data;
  try {
    const value = await handleInferenceRequest(request, (progress) =>
      post({ id, type: "progress", progress }),
    );
    // Vectors are transferred, not copied: a corpus of them is megabytes.
    const transfer = Array.isArray(value)
      ? value
          .filter((v): v is Float32Array => v instanceof Float32Array)
          .map((v) => v.buffer)
      : [];
    post({ id, type: "result", value }, transfer);
  } catch (err) {
    post({
      id,
      type: "error",
      name: err instanceof Error ? err.name : "Error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
