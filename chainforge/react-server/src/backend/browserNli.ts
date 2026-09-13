/**
 * Natural language inference in the browser, for grouping chat answers by
 * meaning.
 *
 * The RAG chat groups answers that say the same thing. Deciding that takes a
 * model that reads two sentences together and judges whether one follows
 * from the other; embedding similarity cannot tell "deleted automatically"
 * from "deleted manually" (see groupAnswersByMeaning in ragChat.ts).
 *
 * The model is fetched on first use, like the embedding and reranking models,
 * and nothing is downloaded by someone who never groups by meaning. Unlike
 * those, its download can be cancelled: it is roughly 96MB, large enough that
 * someone who chose "Meaning" out of curiosity should be able to back out.
 */

import type { EntailmentJudge } from "./ragChat";

export const BROWSER_NLI_MODEL = {
  id: "Xenova/nli-deberta-v3-xsmall",
  /** Approximate download, MB: an 87MB q8 model plus a 9MB tokenizer. */
  sizeMB: 96,
};

export interface NliDownloadProgress {
  loadedMB: number;
  totalMB: number;
  /** 0-100. */
  percent: number;
}

/** Thrown when a download is cancelled through its AbortSignal. */
export class DownloadCancelled extends Error {
  constructor() {
    super("Download cancelled");
    this.name = "DownloadCancelled";
  }
}

/**
 * How sure the model must be that one answer entails the other.
 *
 * Taking "entailment" whenever it was the model's top label merged answers
 * that differ in ways the conflict check cannot see: reversed cause and
 * effect ("stress causes poor sleep" / "poor sleep causes stress", at 0.89
 * and 0.98) and small technical differences ("a list" / "a set" of IDs,
 * "len(my_list)" / "my_list.length"). Requiring 0.95 both ways removed those
 * merges on the answer sets they were found in.
 */
export const ENTAILMENT_THRESHOLD = 0.95;

/** The model's probability that the premise entails the hypothesis. */
export function entailmentProbability(
  logits: ArrayLike<number>,
  id2label: Record<string | number, string>,
): number {
  const values = Array.from(logits);
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0);
  const index = values.findIndex((_, i) =>
    (id2label[i] ?? id2label[String(i)] ?? "")
      .toLowerCase()
      .startsWith("entail"),
  );
  return index < 0 || total === 0 ? 0 : exps[index] / total;
}

/** Whether the model is sure enough that the premise entails the hypothesis. */
export function isEntailment(
  logits: ArrayLike<number>,
  id2label: Record<string | number, string>,
  threshold: number = ENTAILMENT_THRESHOLD,
): boolean {
  return entailmentProbability(logits, id2label) >= threshold;
}

/**
 * Overall progress across a model's files.
 *
 * The tokenizer and the model are separate downloads that each report their
 * own bytes, and a file's size is only known once it starts. So the total is
 * never shown below the known size of the whole, or the bar would jump back
 * when the second file begins.
 */
export function downloadProgress(
  files: Record<string, { loaded: number; total: number }>,
  expectedMB: number,
): NliDownloadProgress {
  let loaded = 0;
  let total = 0;
  for (const f of Object.values(files)) {
    loaded += f.loaded;
    total += f.total;
  }
  const loadedMB = loaded / 1e6;
  const totalMB = Math.max(total / 1e6, expectedMB, loadedMB);
  return {
    loadedMB,
    totalMB,
    percent: totalMB > 0 ? Math.min(100, (loadedMB / totalMB) * 100) : 0,
  };
}

let loading: Promise<EntailmentJudge> | undefined;
let loaded = false;

/** The signal of the download in flight, if it can be cancelled. */
let activeSignal: AbortSignal | undefined;
let fetchWrapped = false;

/** Whether the model is loaded and ready in this tab. */
export function isNliLoaded(): boolean {
  return loaded;
}

/**
 * Loads the NLI model, fetching transformers.js and the weights on first use,
 * and resolves to a judge of entailment. Safe to call repeatedly.
 *
 * Aborting `signal` cancels the download and rejects with DownloadCancelled.
 * Only the first caller's signal governs a load in flight.
 */
export function loadNli(
  opts: {
    signal?: AbortSignal;
    onProgress?: (p: NliDownloadProgress) => void;
  } = {},
): Promise<EntailmentJudge> {
  if (loading) return loading;

  const { signal, onProgress } = opts;
  // Left in place after a cancel, so a request the abandoned load still
  // makes is refused too; replaced by the next load.
  activeSignal = signal;
  const stopIfCancelled = () => {
    if (signal?.aborted) throw new DownloadCancelled();
  };

  const load = (async (): Promise<EntailmentJudge> => {
    const { AutoTokenizer, AutoModelForSequenceClassification, env } =
      await import("@huggingface/transformers");
    env.allowLocalModels = false;
    stopIfCancelled();

    // transformers.js downloads through env.fetch. Wrapped once, so this
    // model's requests carry the signal; other models' downloads, which may
    // be running at the same time, are left alone.
    if (!fetchWrapped) {
      const baseFetch = env.fetch;
      env.fetch = (input: string | URL, init?: any) => {
        const url = typeof input === "string" ? input : input.toString();
        return activeSignal && url.includes(BROWSER_NLI_MODEL.id)
          ? baseFetch(input, { ...init, signal: activeSignal })
          : baseFetch(input, init);
      };
      fetchWrapped = true;
    }

    const files: Record<string, { loaded: number; total: number }> = {};
    const progress_callback = (report: {
      status?: string;
      file?: string;
      loaded?: number;
      total?: number;
    }) => {
      if (report?.status !== "progress" || !report.file) return;
      files[report.file] = {
        loaded: report.loaded ?? 0,
        total: report.total ?? 0,
      };
      onProgress?.(downloadProgress(files, BROWSER_NLI_MODEL.sizeMB));
    };

    const tokenizer = await AutoTokenizer.from_pretrained(
      BROWSER_NLI_MODEL.id,
      { progress_callback },
    );
    // A cancel between files aborts no request, since none is in flight; it
    // must stop the 87MB model from starting.
    stopIfCancelled();
    const model = await AutoModelForSequenceClassification.from_pretrained(
      BROWSER_NLI_MODEL.id,
      // q8 on wasm, matching the embedding and reranking models.
      { dtype: "q8", device: "wasm", progress_callback },
    );
    stopIfCancelled();
    const id2label = (model.config as any).id2label as Record<string, string>;

    return async (premise: string, hypothesis: string) => {
      const inputs = await tokenizer(premise, {
        text_pair: hypothesis,
        truncation: true,
      });
      const { logits } = await model(inputs);
      return isEntailment(logits.data as ArrayLike<number>, id2label);
    };
  })();
  // Once cancelled, nobody awaits this; its rejection is expected.
  load.catch(() => undefined);

  // An abort may land while nothing is fetching (between files, or while the
  // weights initialise), so it must end the wait by itself too.
  const cancelled = new Promise<never>((_resolve, reject) => {
    if (!signal) return;
    if (signal.aborted) reject(new DownloadCancelled());
    signal.addEventListener("abort", () => reject(new DownloadCancelled()), {
      once: true,
    });
  });

  const current: Promise<EntailmentJudge> = Promise.race([load, cancelled])
    .then((judge) => {
      loaded = true;
      if (activeSignal === signal) activeSignal = undefined;
      return judge;
    })
    .catch((err) => {
      // A failed or cancelled load must not be cached, or it can never retry.
      if (loading === current) loading = undefined;
      throw signal?.aborted ? new DownloadCancelled() : err;
    });
  loading = current;
  return current;
}
