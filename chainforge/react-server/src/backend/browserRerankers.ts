/**
 * Cross-encoder reranking in the browser, with no backend.
 *
 * This is the step the lexical and semantic retrievers cannot do. Both of
 * those score a query against a document representation built *before* the
 * query was seen -- BM25 against term statistics, the embedder against a
 * vector. A cross-encoder reads the query and the passage together, so it can
 * weigh how they relate rather than how similar they look. That is why a
 * reranker routinely fixes a retriever's ordering, and why it belongs in a
 * workshop: it makes the two-stage shape of RAG visible.
 *
 * The models are small enough to run client-side -- 23MB quantized for the
 * default -- and are fetched on first use like the embedding models, from
 * inside `loadReranker`. Nothing is downloaded by a flow that never reranks.
 *
 * As with browser semantic retrieval, this is registered as its own method
 * rather than as a browser implementation of the backend's `cross_encoder`.
 * The weights are quantized conversions run through a different runtime, so
 * scores are close to but not identical to the sentence-transformers path,
 * and claiming parity would be a lie.
 */

import { Dict } from "./typing";
import { ProgressFn } from "./browserEmbeddings";

/** A cross-encoder that can run client-side. */
export interface BrowserRerankModel {
  /** HuggingFace repo id, passed straight to transformers.js. */
  id: string;
  label: string;
  /** Approximate quantized download, MB, so the UI can warn before fetching. */
  sizeMB: number;
  /** One-line orientation for the model picker. */
  note: string;
}

/**
 * The rerankers offered client-side.
 *
 * All are MS MARCO-trained cross-encoders in the 23-34MB range. The larger
 * ones score a little better and cost proportionally more time per pair,
 * which is the trade worth showing rather than hiding.
 */
export const BROWSER_RERANK_MODELS: Record<string, BrowserRerankModel> = {
  "Xenova/ms-marco-MiniLM-L-6-v2": {
    id: "Xenova/ms-marco-MiniLM-L-6-v2",
    label: "MiniLM-L-6-v2",
    sizeMB: 23,
    note: "The standard reranker baseline. The default.",
  },
  "Xenova/ms-marco-MiniLM-L-12-v2": {
    id: "Xenova/ms-marco-MiniLM-L-12-v2",
    label: "MiniLM-L-12-v2",
    sizeMB: 34,
    note: "Twice the layers; slower per pair, slightly better ordering.",
  },
  "jinaai/jina-reranker-v1-tiny-en": {
    id: "jinaai/jina-reranker-v1-tiny-en",
    label: "Jina reranker v1 tiny",
    sizeMB: 33,
    note: "Tuned for long documents.",
  },
};

export const DEFAULT_BROWSER_RERANK_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2";

/** The model config for an id, falling back to the default. */
export function browserRerankModel(id?: string): BrowserRerankModel {
  return (
    BROWSER_RERANK_MODELS[id ?? ""] ??
    BROWSER_RERANK_MODELS[DEFAULT_BROWSER_RERANK_MODEL]
  );
}

/** How big this model's download is. */
export function rerankModelDownloadLabel(model: BrowserRerankModel): string {
  return `~${model.sizeMB}MB`;
}

/** The `baseMethod` of the client-side reranker. */
export const BROWSER_RERANK_METHOD = "browser_cross_encoder";

/** Whether this reranking method can run without a backend. */
export function canRerankInBrowser(baseMethod: string): boolean {
  return baseMethod === BROWSER_RERANK_METHOD;
}

/** One reranked document, in the shape the /rerank response uses. */
export interface RerankedDocument {
  document: string;
  score: number;
  /** Position in the input list, so callers can map back to their own rows. */
  index: number;
}

/** A loaded tokenizer plus sequence-classification model. */
interface Reranker {
  score(query: string, documents: string[]): Promise<number[]>;
}

/** One in-flight or settled load per model, so two nodes share a download. */
const rerankers = new Map<string, Promise<Reranker>>();

/** Whether a reranker's weights are already loaded in this tab. */
export function isRerankerLoaded(modelId: string): boolean {
  return rerankers.has(modelId);
}

/**
 * Loads a cross-encoder, fetching transformers.js and the weights on first
 * use. Safe to call repeatedly; the work happens once per model per tab.
 */
export function loadReranker(
  modelId: string,
  onProgress?: ProgressFn,
): Promise<Reranker> {
  const existing = rerankers.get(modelId);
  if (existing) return existing;

  const loading = (async () => {
    // Dynamic, so the library stays out of the main bundle and is only
    // fetched by someone who actually reranks.
    const { AutoTokenizer, AutoModelForSequenceClassification, env } =
      await import("@huggingface/transformers");

    // Without this transformers.js probes our own origin for the weights
    // first, which 404s noisily before falling back to the Hub.
    env.allowLocalModels = false;

    const progress_callback = (report: {
      status?: string;
      progress?: number;
      file?: string;
    }) => {
      if (!onProgress || report?.status !== "progress") return;
      onProgress({
        phase: "download",
        percent:
          typeof report.progress === "number" ? report.progress : undefined,
        detail: report.file,
      });
    };

    const tokenizer = await AutoTokenizer.from_pretrained(modelId, {
      progress_callback,
    });
    const model = await AutoModelForSequenceClassification.from_pretrained(
      modelId,
      {
        // q8 on wasm, matching the embedding path. See browserEmbeddings for
        // why the GPU formats are not used.
        dtype: "q8",
        device: "wasm",
        progress_callback,
      },
    );

    return {
      async score(query: string, documents: string[]): Promise<number[]> {
        if (documents.length === 0) return [];
        // The query is paired with every document in one batch: a
        // cross-encoder scores the pair, not either side alone.
        const inputs = await tokenizer(
          new Array(documents.length).fill(query),
          { text_pair: documents, padding: true, truncation: true },
        );
        const { logits } = await model(inputs);
        // These models emit a single logit per pair. It is unbounded and
        // frequently negative; only the ordering is meaningful, and the
        // backend returns it raw too, so it is not squashed here.
        return (logits.tolist() as number[][]).map((row) => Number(row[0]));
      },
    };
  })();

  rerankers.set(modelId, loading);
  // A failed load must not be cached, or the node can never retry.
  loading.catch(() => rerankers.delete(modelId));
  return loading;
}

function num(settings: Dict<any>, key: string, fallback: number): number {
  const raw = settings?.[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Reranks documents against a query, entirely client-side.
 *
 * Mirrors the backend's cross_encoder handler: documents come back sorted by
 * descending score, each carrying the index it had on the way in, and an
 * empty query returns the original order with synthetic descending scores
 * rather than pretending to have judged anything.
 */
export async function rerankInBrowser(
  documents: string[],
  query: string,
  settings: Dict<any> = {},
  onProgress?: ProgressFn,
): Promise<RerankedDocument[]> {
  if (documents.length === 0) return [];

  // Matches the backend: with nothing to compare against, preserve the input
  // order instead of inventing a ranking.
  if (!query)
    return documents.map((document, index) => ({
      document,
      score: 1.0 - index / documents.length,
      index,
    }));

  const modelId = browserRerankModel(
    (settings?.browserRerankModel as string) ?? (settings?.model as string),
  ).id;
  const topK = Math.floor(
    num(settings, "top_k", Math.min(5, documents.length)),
  );

  const reranker = await loadReranker(modelId, onProgress);
  onProgress?.({
    phase: "embed",
    percent: 0,
    detail: `Scoring ${documents.length} documents`,
  });

  const scores = await reranker.score(query, documents);
  onProgress?.({ phase: "embed", percent: 100 });

  return documents
    .map((document, index) => ({ document, score: scores[index] ?? 0, index }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, topK));
}
