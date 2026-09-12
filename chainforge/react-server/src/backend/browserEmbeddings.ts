/**
 * Sentence embeddings in the browser, with no backend.
 *
 * This is what makes RAG-lite actually about RAG. The ported keyword
 * retrievers (browserRetrievers.ts) are lexical: they can only match words a
 * query literally shares with a chunk. Semantic retrieval is the idea the
 * workshops exist to teach, and it needs a real embedding model.
 *
 * Small ONNX embedding models are 23-34MB quantized and run on an ordinary
 * laptop, so the model runs client-side via transformers.js rather than
 * calling an embedding API -- no key, no server, no per-chunk billing.
 *
 * Nothing here is loaded at page load. The transformers.js bundle and the
 * model weights are both fetched on first use, from inside `loadEmbedder`,
 * so a flow that never retrieves semantically never pays for either. Weights
 * land in the browser's Cache API, so the download is once per model per
 * browser, not once per run.
 *
 * These results do NOT match the backend's embedding retrieval, which uses
 * different models through sentence-transformers or a hosted API. That is why
 * this is offered as its own retrieval method rather than as a browser
 * implementation of the existing one -- see browserRetrievers.ts for the
 * parity rules the lexical ports follow, which this deliberately does not
 * claim.
 */

/** How a model wants its inputs prepared. Getting these wrong degrades
 * ranking quality quietly, so they live with the model rather than at the
 * call site. */
export interface BrowserEmbeddingModel {
  /** HuggingFace repo id, passed straight to transformers.js. */
  id: string;
  label: string;
  /** Embedding width, for sizing the vector cache. */
  dim: number;
  /** Approximate quantized download, MB, so the UI can warn before fetching. */
  sizeMB: number;
  /** Sentence-embedding pooling this model was trained with. */
  pooling: "cls" | "mean";
  /**
   * Instruction prefix the model's authors specify for queries. Asymmetric
   * models are trained with it on the query side only; passages get nothing.
   * Its effect is modest -- a ranking-quality nuance, not a correctness gate.
   */
  queryPrefix: string;
  /** One-line orientation for the model picker. */
  note: string;
}

/**
 * The models offered client-side.
 *
 * All are 384-dimensional and 23-34MB quantized, listed best-first. all-MiniLM-L6-v2 is kept
 * deliberately: it is the model most RAG tutorials still use, and being able
 * to switch to it and watch retrieval get worse is a lesson in itself.
 */
export const BROWSER_EMBEDDING_MODELS: Record<string, BrowserEmbeddingModel> = {
  "Xenova/bge-small-en-v1.5": {
    id: "Xenova/bge-small-en-v1.5",
    label: "BGE small en v1.5",
    dim: 384,
    sizeMB: 34,
    pooling: "cls",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    note: "Strong retrieval quality for its size. The default.",
  },
  "mixedbread-ai/mxbai-embed-xsmall-v1": {
    id: "mixedbread-ai/mxbai-embed-xsmall-v1",
    label: "mxbai-embed-xsmall v1",
    dim: 384,
    sizeMB: 24,
    pooling: "cls",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    note: "Smallest good option, at a little quality cost.",
  },
  "Snowflake/snowflake-arctic-embed-xs": {
    id: "Snowflake/snowflake-arctic-embed-xs",
    label: "Arctic Embed XS",
    dim: 384,
    sizeMB: 23,
    pooling: "cls",
    queryPrefix: "Represent this sentence for searching relevant passages: ",
    note: "Tuned for retrieval specifically.",
  },
  "Xenova/all-MiniLM-L6-v2": {
    id: "Xenova/all-MiniLM-L6-v2",
    label: "all-MiniLM-L6-v2 (older baseline)",
    dim: 384,
    sizeMB: 23,
    pooling: "mean",
    queryPrefix: "",
    note: "The classic tutorial model. Useful for comparison.",
  },
};

export const DEFAULT_BROWSER_EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";

/** The model config for an id, falling back to the default. */
export function browserEmbeddingModel(id?: string): BrowserEmbeddingModel {
  return (
    BROWSER_EMBEDDING_MODELS[id ?? ""] ??
    BROWSER_EMBEDDING_MODELS[DEFAULT_BROWSER_EMBEDDING_MODEL]
  );
}

/** Progress while fetching weights, for the node's progress ring. */
export interface EmbeddingLoadProgress {
  /** "download" while fetching weights, "embed" while running the model. */
  phase: "download" | "embed";
  /** 0-100, or undefined when the total size isn't known yet. */
  percent?: number;
  detail?: string;
}

export type ProgressFn = (p: EmbeddingLoadProgress) => void;

/** A loaded feature-extraction pipeline. */
type Extractor = (
  text: string | string[],
  opts: { pooling: "cls" | "mean"; normalize: boolean },
) => Promise<{ data: ArrayLike<number>; dims: number[] }>;

/**
 * One in-flight or settled load per model, so two nodes running at once share
 * a single download instead of racing and fetching the weights twice.
 */
const extractors = new Map<string, Promise<Extractor>>();

/** Whether a model's weights are already loaded in this tab. */
export function isEmbedderLoaded(modelId: string): boolean {
  return extractors.has(modelId);
}

/**
 * Loads an embedding model, fetching transformers.js and the weights on first
 * use. Safe to call repeatedly; the work happens once per model per tab.
 */
export function loadEmbedder(
  modelId: string,
  onProgress?: ProgressFn,
): Promise<Extractor> {
  const existing = extractors.get(modelId);
  if (existing) return existing;

  const loading = (async () => {
    // Dynamic, so the ~13MB library stays out of the main bundle and is only
    // fetched by someone who actually retrieves semantically.
    const { pipeline, env } = await import("@huggingface/transformers");

    // Without this transformers.js first probes /models/<id> on our own
    // origin, which 404s noisily before it falls back to the Hub.
    env.allowLocalModels = false;

    const extractor = await pipeline("feature-extraction", modelId, {
      // q8 keeps the download in the 23-34MB range quoted in the model list.
      dtype: "q8",
      progress_callback: (report: {
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
      },
    });
    return extractor as unknown as Extractor;
  })();

  extractors.set(modelId, loading);
  // A failed load must not be cached, or the node can never retry.
  loading.catch(() => extractors.delete(modelId));
  return loading;
}

/** L2-normalized vectors come back from the model, so cosine is a dot product. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Embeds texts with a browser model.
 *
 * `isQuery` selects whether the model's instruction prefix is applied; the
 * asymmetric models above want it on queries only.
 */
export async function embedTexts(
  modelId: string,
  texts: string[],
  opts: { isQuery?: boolean; onProgress?: ProgressFn } = {},
): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const model = browserEmbeddingModel(modelId);
  const extract = await loadEmbedder(model.id, opts.onProgress);
  const prefix = opts.isQuery ? model.queryPrefix : "";

  const out: Float32Array[] = [];
  // One at a time, reporting as we go: a workshop corpus can be hundreds of
  // chunks, and a silent multi-second freeze reads as a hang.
  for (let i = 0; i < texts.length; i++) {
    const result = await extract(prefix + (texts[i] ?? ""), {
      pooling: model.pooling,
      normalize: true,
    });
    out.push(new Float32Array(result.data as unknown as number[]));
    opts.onProgress?.({
      phase: "embed",
      percent: ((i + 1) / texts.length) * 100,
      detail: `Embedding ${i + 1} of ${texts.length}`,
    });
  }
  return out;
}
