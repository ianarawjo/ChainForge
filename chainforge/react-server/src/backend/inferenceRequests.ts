/**
 * What the inference worker does with each request.
 *
 * Each is the same function the page runs when there is no worker, so a
 * result cannot depend on which thread computed it. Kept apart from the
 * worker's message handling (browserInference.worker.ts) so it can be tested.
 */

import { embedTextsInThisThread } from "./browserEmbeddings";
import { scoreInThisThread } from "./browserRerankers";
import { loadNliInThisThread } from "./browserNli";
import type { InferenceRequest } from "./inferenceWorkerClient";

/**
 * The NLI download a loadNli request started, so a cancelNliDownload request
 * can stop it. The page's AbortSignal cannot cross into the worker.
 */
let nliDownload: AbortController | undefined;

export async function handleInferenceRequest(
  request: InferenceRequest,
  onProgress: (progress: unknown) => void,
): Promise<unknown> {
  switch (request.kind) {
    case "embed":
      return embedTextsInThisThread(request.modelId, request.texts, {
        isQuery: request.isQuery,
        onProgress,
      });
    case "rerank":
      return scoreInThisThread(
        request.modelId,
        request.query,
        request.documents,
        onProgress,
      );
    case "loadNli": {
      const download = new AbortController();
      nliDownload = download;
      try {
        await loadNliInThisThread({ signal: download.signal, onProgress });
      } finally {
        if (nliDownload === download) nliDownload = undefined;
      }
      return null;
    }
    case "entails": {
      const entails = await loadNliInThisThread();
      return entails(request.premise, request.hypothesis);
    }
    case "cancelNliDownload":
      nliDownload?.abort();
      return null;
  }
}
