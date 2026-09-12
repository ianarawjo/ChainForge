/**
 * Semantic retrieval in the browser: the "vector store" for RAG-lite.
 *
 * Deliberately a brute-force cosine scan, not an approximate index. At
 * workshop scale -- a handful of documents, tens to a few thousand chunks --
 * scanning every vector takes milliseconds, and an ANN index would add real
 * complexity while teaching nothing. The thing being demonstrated is that
 * relevance can come from meaning rather than shared words; HNSW is a
 * separate lesson about scale, and the backend's LanceDB and FAISS stores are
 * there when someone wants it.
 *
 * Embedding is the expensive step, so vectors are cached per (model, text).
 * Re-running a flow, or adding one query to an existing corpus, re-embeds
 * only what actually changed.
 */

import { Dict } from "./typing";
import {
  RetrievalChunk,
  RetrievalHit,
  RetrievalResult,
  normalizeQuery,
} from "./browserRetrievers";
import {
  ProgressFn,
  browserEmbeddingModel,
  cosineSimilarity,
  embedTexts,
} from "./browserEmbeddings";

/** Separates the two parts of a cache key; cannot occur in either. */
const KEY_SEP = "\u0000";

/**
 * Cached vectors, keyed by model, role and exact text.
 *
 * Keyed on text rather than chunk id on purpose: re-chunking a document with
 * the same settings produces the same strings with fresh ids, and the point of
 * the cache is to not re-embed text we have already embedded.
 *
 * The role is part of the key because the asymmetric models prepend an
 * instruction to queries only. The same string embedded as a query and as a
 * passage is therefore two different vectors, and conflating them would serve
 * a query the passage vector -- wrong, and invisibly so.
 */
const vectorCache = new Map<string, Float32Array>();

function cacheKey(modelId: string, text: string, isQuery: boolean): string {
  return `${modelId}${KEY_SEP}${isQuery ? "q" : "d"}${KEY_SEP}${text}`;
}

/** How many vectors are cached, for the storage readout. */
export function cachedVectorCount(): number {
  return vectorCache.size;
}

/** Approximate bytes held by cached vectors. */
export function cachedVectorBytes(): number {
  let total = 0;
  for (const v of vectorCache.values()) total += v.byteLength;
  return total;
}

/** Drops cached vectors. Exposed so the UI can free memory deliberately. */
export function clearVectorCache(): void {
  vectorCache.clear();
}

/**
 * Embeds texts, consulting and filling the cache.
 *
 * Only cache misses reach the model, and duplicate texts within one call are
 * embedded once.
 */
async function embedCached(
  modelId: string,
  texts: string[],
  opts: { isQuery?: boolean; onProgress?: ProgressFn } = {},
): Promise<Float32Array[]> {
  const isQuery = Boolean(opts.isQuery);

  // Distinct misses only, so a corpus with repeated chunks costs one pass.
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    const key = cacheKey(modelId, text, isQuery);
    if (vectorCache.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push(text);
  }

  if (missing.length > 0) {
    const vectors = await embedTexts(modelId, missing, opts);
    missing.forEach((text, i) =>
      vectorCache.set(cacheKey(modelId, text, isQuery), vectors[i]),
    );
  }

  return texts.map(
    (text) => vectorCache.get(cacheKey(modelId, text, isQuery)) as Float32Array,
  );
}

function num(settings: Dict<any>, key: string, fallback: number): number {
  const raw = settings?.[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function hit(chunk: RetrievalChunk, similarity: number): RetrievalHit {
  return {
    text: chunk.text ?? "",
    similarity,
    docTitle: chunk.docTitle ?? "",
    chunkId: chunk.chunkId ?? "",
  };
}

/**
 * Retrieves by embedding similarity, entirely client-side.
 *
 * Unlike the lexical retrievers, scores are raw cosine similarity rather than
 * rescaled so the best hit is 1.0. A cosine of 0.72 is meaningful on its own
 * and comparable across queries, which is most of the value when the point is
 * to *show* people how semantic similarity behaves.
 */
export async function semanticRetriever(
  chunks: RetrievalChunk[],
  queries: unknown[],
  settings: Dict<any>,
  onProgress?: ProgressFn,
): Promise<RetrievalResult[]> {
  const modelId = browserEmbeddingModel(
    (settings?.browserEmbeddingModel as string) ??
      (settings?.embeddingModel as string),
  ).id;
  const topK = Math.floor(num(settings, "top_k", 5));

  if (chunks.length === 0)
    return queries.map((q) => ({
      query_object: normalizeQuery(q)[0],
      retrieved_chunks: [] as RetrievalHit[],
    }));

  // The corpus first: it is the bulk of the work, and it is what the download
  // and embedding progress is really reporting on.
  const chunkVectors = await embedCached(
    modelId,
    chunks.map((c) => String(c.text ?? "")),
    { onProgress },
  );

  const results: RetrievalResult[] = [];
  for (const raw of queries) {
    const [queryObject, queryText] = normalizeQuery(raw);
    if (!queryText) {
      results.push({ query_object: queryObject, retrieved_chunks: [] });
      continue;
    }

    const [queryVector] = await embedCached(modelId, [queryText], {
      isQuery: true,
      onProgress,
    });

    const scored = chunkVectors.map((vector, index) => ({
      index,
      score: cosineSimilarity(queryVector, vector),
    }));
    // Descending, stably, matching the lexical retrievers' ordering.
    scored.sort((a, b) => b.score - a.score);

    results.push({
      query_object: queryObject,
      retrieved_chunks: scored
        .slice(0, topK)
        .map(({ index, score }) => hit(chunks[index], score)),
    });
  }
  return results;
}
