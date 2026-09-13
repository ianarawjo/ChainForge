/**
 * Runs the browser embedding model off the page's main thread.
 *
 * transformers.js runs ONNX Runtime's single-threaded WASM build on whichever
 * thread calls it (it sets `wasm.proxy = false`), so on the page every chunk
 * is computed on the main thread. Embedding a corpus is a long run of those
 * calls with no gap for the browser to paint or handle input: 1,400 chunks
 * froze the tab outright, progress bar included. Here the same work happens
 * in a worker, and the page only receives progress and finished vectors.
 *
 * embeddingWorkerClient.ts is the page's end of these messages.
 */

import { embedTextsInThisThread } from "./browserEmbeddings";
import type { EmbedRequest, EmbedWorkerMessage } from "./embeddingWorkerClient";

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;

function post(message: EmbedWorkerMessage, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer);
}

scope.onmessage = async (event: MessageEvent<EmbedRequest>) => {
  const { id, modelId, texts, isQuery } = event.data;
  try {
    const vectors = await embedTextsInThisThread(modelId, texts, {
      isQuery,
      onProgress: (progress) => post({ id, type: "progress", progress }),
    });
    // Transferred, not copied: a corpus of vectors is megabytes.
    post(
      { id, type: "result", vectors },
      vectors.map((v) => v.buffer),
    );
  } catch (err) {
    post({
      id,
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
