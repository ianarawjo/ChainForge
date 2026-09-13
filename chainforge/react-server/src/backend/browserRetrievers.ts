/**
 * Keyword retrieval in the browser, with no backend.
 *
 * These are deliberate ports of the Python implementations in
 * chainforge/rag/retrievers.py -- BM25, boolean overlap and keyword overlap --
 * so a flow retrieves identically whether or not a local server is running.
 * tests/fixtures/keyword_retrieval_cases.json holds cases shared by both test
 * suites, so a divergence fails a build.
 *
 * TF-IDF is deliberately NOT here. Its Python implementation is
 * scikit-learn's TfidfVectorizer: a 318-word English stop list, smoothed idf,
 * l2 normalization, and max_features selection by corpus frequency.
 * Reproducing that faithfully is not reasonable, and an approximation that
 * silently ranked differently would be worse than not offering it -- so TF-IDF
 * stays server-side.
 */

import { Dict } from "./typing";

/** A chunk as the retrieval handlers receive it. */
export interface RetrievalChunk {
  text?: string;
  docTitle?: string;
  chunkId?: string;
  [key: string]: unknown;
}

/** One retrieved chunk, in the shape the /retrieve response uses. */
export interface RetrievalHit {
  text: string;
  similarity: number;
  docTitle: string;
  chunkId: string;
}

export interface RetrievalResult {
  query_object: Dict<unknown>;
  retrieved_chunks: RetrievalHit[];
}

export type BrowserRetriever = (
  chunks: RetrievalChunk[],
  queries: unknown[],
  settings: Dict<any>,
) => RetrievalResult[];

/**
 * Token pattern matching Python's `(((?![\d])\w)+)` under re.UNICODE.
 *
 * Both details matter. JavaScript's `\w` is ASCII-only, so it would split
 * "café" into "caf" and "na"/"ve"; and JavaScript's `\d` is ASCII-only, so a
 * `(?!\d)` lookahead would wrongly accept Arabic-Indic digits that Python
 * rejects. Verified against Python over a set of unicode inputs.
 */
const TOKEN_PATTERN = /((?!\p{Nd})[\p{L}\p{N}_])+/gu;

/**
 * Port of chainforge/rag/simple_preprocess.simple_preprocess.
 *
 * Lowercases, splits into maximal non-digit word runs, then keeps tokens of
 * length [minLen, maxLen] that don't start with an underscore.
 */
export function simplePreprocess(
  doc: string,
  minLen = 2,
  maxLen = 15,
): string[] {
  const matches = (doc ?? "").toLowerCase().match(TOKEN_PATTERN) ?? [];
  return matches.filter(
    (t) => t.length >= minLen && t.length <= maxLen && !t.startsWith("_"),
  );
}

/** Port of retrievers.normalize_query. */
export function normalizeQuery(raw: unknown): [Dict<unknown>, string] {
  const obj: Dict<unknown> =
    raw !== null && typeof raw === "object"
      ? (raw as Dict<unknown>)
      : { text: String(raw) };
  const text = String(obj.text || obj.query || obj.prompt || "");
  return [obj, text];
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

/** Indices ordered by descending score, stably (as Python's sorted() is). */
function rankedIndices(scores: number[]): number[] {
  return scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.index);
}

/**
 * BM25 Okapi, ported from the `rank_bm25` package that the backend uses.
 *
 * Includes its epsilon floor: idf goes negative for a term appearing in more
 * than half the corpus, and rank_bm25 replaces those with
 * `epsilon * average_idf` rather than letting them subtract.
 */
class BM25Okapi {
  private readonly docFreqs: Map<string, number>[] = [];
  private readonly docLen: number[] = [];
  private readonly idf = new Map<string, number>();
  private readonly corpusSize: number;
  private readonly avgdl: number;

  constructor(
    corpus: string[][],
    private readonly k1 = 1.5,
    private readonly b = 0.75,
    epsilon = 0.25,
  ) {
    const nd = new Map<string, number>();
    let totalLen = 0;

    for (const document of corpus) {
      this.docLen.push(document.length);
      totalLen += document.length;

      const frequencies = new Map<string, number>();
      for (const word of document)
        frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
      this.docFreqs.push(frequencies);

      for (const word of frequencies.keys())
        nd.set(word, (nd.get(word) ?? 0) + 1);
    }

    this.corpusSize = corpus.length;
    this.avgdl = this.corpusSize > 0 ? totalLen / this.corpusSize : 0;

    // _calc_idf
    let idfSum = 0;
    const negative: string[] = [];
    for (const [word, freq] of nd.entries()) {
      const idf = Math.log(this.corpusSize - freq + 0.5) - Math.log(freq + 0.5);
      this.idf.set(word, idf);
      idfSum += idf;
      if (idf < 0) negative.push(word);
    }
    const averageIdf = this.idf.size > 0 ? idfSum / this.idf.size : 0;
    const eps = epsilon * averageIdf;
    for (const word of negative) this.idf.set(word, eps);
  }

  getScores(query: string[]): number[] {
    const scores = new Array<number>(this.corpusSize).fill(0);
    for (const q of query) {
      const idf = this.idf.get(q) ?? 0;
      for (let i = 0; i < this.corpusSize; i++) {
        const freq = this.docFreqs[i].get(q) ?? 0;
        scores[i] +=
          (idf * (freq * (this.k1 + 1))) /
          (freq +
            this.k1 * (1 - this.b + (this.b * this.docLen[i]) / this.avgdl));
      }
    }
    return scores;
  }
}

/** Port of retrievers.handle_bm25. */
export const bm25Retriever: BrowserRetriever = (chunks, queries, settings) => {
  const empty = () =>
    queries.map((q) => ({
      query_object: normalizeQuery(q)[0],
      retrieved_chunks: [],
    }));
  if (chunks.length === 0) return empty();

  const corpus = chunks.map((c) => simplePreprocess(String(c.text ?? "")));
  const bm25 = new BM25Okapi(
    corpus,
    num(settings, "bm25_k1", 1.5),
    num(settings, "bm25_b", 0.75),
  );
  const topK = Math.floor(num(settings, "top_k", 5));

  return queries.map((raw) => {
    const [queryObject, queryText] = normalizeQuery(raw);
    const scores = bm25.getScores(simplePreprocess(queryText));
    if (scores.length === 0)
      return { query_object: queryObject, retrieved_chunks: [] };

    // Matches Python's `float(scores.max()) or 1.0`: an all-zero corpus
    // normalizes against 1 rather than dividing by zero.
    const maxScore = Math.max(...scores) || 1.0;
    const normalized = scores.map((s) => s / maxScore);

    return {
      query_object: queryObject,
      retrieved_chunks: rankedIndices(normalized)
        .slice(0, topK)
        .map((idx) => hit(chunks[idx], normalized[idx])),
    };
  });
};

/** Port of retrievers.handle_boolean. */
export const booleanRetriever: BrowserRetriever = (
  chunks,
  queries,
  settings,
) => {
  const topK = Math.floor(num(settings, "top_k", 5));
  const required = Math.floor(num(settings, "required_match_count", 1));
  const tokenized = chunks.map(
    (c) => new Set(simplePreprocess(String(c.text ?? ""))),
  );

  return queries.map((raw) => {
    const [queryObject, queryText] = normalizeQuery(raw);
    const qTokens = new Set(simplePreprocess(queryText));

    // Too few query tokens to ever satisfy the requirement.
    if (qTokens.size < required)
      return { query_object: queryObject, retrieved_chunks: [] };

    const scored: { index: number; score: number }[] = [];
    tokenized.forEach((cTokens, index) => {
      let matches = 0;
      for (const t of qTokens) if (cTokens.has(t)) matches++;
      if (matches >= required)
        scored.push({ index, score: matches / (cTokens.size || 1) });
    });
    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0)
      return { query_object: queryObject, retrieved_chunks: [] };

    const topScore = scored[0].score || 1.0;
    return {
      query_object: queryObject,
      retrieved_chunks: scored
        .slice(0, topK)
        .map(({ index, score }) => hit(chunks[index], score / topScore)),
    };
  });
};

/** Port of retrievers.handle_keyword_overlap. */
export const overlapRetriever: BrowserRetriever = (
  chunks,
  queries,
  settings,
) => {
  const topK = Math.floor(num(settings, "top_k", 5));
  const tokenized = chunks.map(
    (c) => new Set(simplePreprocess(String(c.text ?? ""))),
  );

  return queries.map((raw) => {
    const [queryObject, queryText] = normalizeQuery(raw);
    const qTokens = new Set(simplePreprocess(queryText));

    // Unlike the boolean method, every chunk is scored, including zeros.
    const scored = tokenized.map((cTokens, index) => {
      let overlap = 0;
      for (const t of qTokens) if (cTokens.has(t)) overlap++;
      return { index, score: overlap };
    });
    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score <= 0)
      return { query_object: queryObject, retrieved_chunks: [] };

    const maxOverlap = scored[0].score;
    return {
      query_object: queryObject,
      retrieved_chunks: scored
        .slice(0, topK)
        .map(({ index, score }) => hit(chunks[index], score / maxOverlap)),
    };
  });
};

/** Retrieval methods runnable client-side, keyed by their `baseMethod`. */
export const BROWSER_RETRIEVERS: Dict<BrowserRetriever> = {
  bm25: bm25Retriever,
  boolean: booleanRetriever,
  overlap: overlapRetriever,
};

/** Whether this retrieval method can run without a backend. */
export function canRetrieveInBrowser(baseMethod: string): boolean {
  return BROWSER_RETRIEVERS[baseMethod] !== undefined;
}

/**
 * Runs a retrieval method in the browser.
 * @throws If the method has no browser implementation.
 */
export function retrieveInBrowser(
  baseMethod: string,
  chunks: RetrievalChunk[],
  queries: unknown[],
  settings: Dict<any>,
): RetrievalResult[] {
  const retriever = BROWSER_RETRIEVERS[baseMethod];
  if (!retriever)
    throw new Error(
      `The "${baseMethod}" retrieval method needs the local ChainForge server.`,
    );
  return retriever(chunks, queries, settings ?? {});
}
