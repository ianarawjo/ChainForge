/**
 * The /retrieve endpoint, client-side.
 *
 * The Flask endpoint does more than call a retriever: it groups chunks by the
 * chunking method that produced them, runs each retrieval method over each
 * group, wraps every hit into the response object the rest of ChainForge
 * consumes, and optionally fuses linked methods' rankings. Running retrieval
 * without a backend means reproducing that, not just the ranking.
 *
 * This mirrors `retrieve()` in chainforge/flask_app.py for the methods that
 * have browser implementations. The response array is compared against the
 * real endpoint's output in tests, so the shape cannot drift.
 */

import { Dict } from "./typing";
import {
  RetrievalChunk,
  RetrievalHit,
  RetrievalResult,
  canRetrieveInBrowser,
  retrieveInBrowser,
} from "./browserRetrievers";
import { ProgressFn } from "./browserEmbeddings";
import { semanticRetriever } from "./browserSemanticRetriever";

/**
 * Separates the two halves of a staging key. Written as an escape rather than
 * a literal NUL so the file stays text as far as git and grep are concerned.
 */
const KEY_SEP = "\u0000";

/**
 * The `baseMethod` of the client-side semantic retriever.
 *
 * It is registered here rather than in BROWSER_RETRIEVERS because the
 * semantic module imports from browserRetrievers, and registering it there
 * would close an import cycle.
 */
export const BROWSER_SEMANTIC_METHOD = "browser_embedding";

/**
 * The chunkMethod of rows from a server method that loaded an existing index,
 * which ignores the connected chunks. Matches EXISTING_INDEX_LABEL in
 * chainforge/rag/retrievers.py.
 */
export const EXISTING_INDEX_CHUNK_METHOD = "(existing index)";

/** A retrieval method as the Retrieval node sends it. */
export interface RetrieveMethodSpec {
  id: string;
  baseMethod: string;
  methodName: string;
  library?: string;
  settings?: Dict<any>;
  embeddingProvider?: string | null;
}

/** A linked group of methods whose rankings get fused. */
export interface FusionGroup {
  id: string;
  methodKeys?: string[];
  fusionMethod?: string;
  fusionSettings?: Dict<any>;
}

export interface RetrieveRequest {
  methods: RetrieveMethodSpec[];
  chunks: Dict<any>[];
  queries: unknown[];
  fusion_enabled?: boolean;
  linked_groups?: FusionGroup[];
}

/** One row of the /retrieve response. */
export interface RetrieveResponseRow {
  text: string;
  prompt: string;
  eval_res: { items: { similarity: number; rank: number }[]; dtype: string };
  vars: Dict<any>;
  metavars: Dict<any>;
  llm: string;
}

/** Whether one method can run client-side. */
function supportsMethod(m: RetrieveMethodSpec): boolean {
  if (m.baseMethod === BROWSER_SEMANTIC_METHOD) return true;
  // An embeddingProvider means the backend would compute the vectors.
  return !m.embeddingProvider && canRetrieveInBrowser(m.baseMethod);
}

/** Runs one method, whether its implementation is sync or async. */
function runMethod(
  method: RetrieveMethodSpec,
  chunkGroup: RetrievalChunk[],
  queries: Dict<any>[],
  onProgress?: ProgressFn,
): Promise<RetrievalResult[]> {
  if (method.baseMethod === BROWSER_SEMANTIC_METHOD)
    return semanticRetriever(
      chunkGroup,
      queries,
      method.settings ?? {},
      onProgress,
    );
  return Promise.resolve(
    retrieveInBrowser(
      method.baseMethod,
      chunkGroup,
      queries,
      method.settings ?? {},
    ),
  );
}

/** Whether every requested method can run client-side. */
export function canRetrieveRequestInBrowser(
  methods: RetrieveMethodSpec[],
): boolean {
  return methods.length > 0 && methods.every(supportsMethod);
}

/** Names the methods that would need a backend, for an error message. */
export function methodsNeedingBackend(methods: RetrieveMethodSpec[]): string[] {
  return methods
    .filter((m) => !supportsMethod(m))
    .map((m) => m.methodName || m.baseMethod);
}

/**
 * Where a request's methods run: all in the browser, all on the local server,
 * or split between the two (see retrieveAcrossBrowserAndServer).
 */
export function retrievalLocation(
  methods: RetrieveMethodSpec[],
): "browser" | "server" | "both" {
  const inBrowser = methods.filter(supportsMethod).length;
  if (inBrowser === 0) return "server";
  return inBrowser === methods.length ? "browser" : "both";
}

/** One staged hit, kept so a fusion group can re-rank across methods. */
interface StagedHit {
  doc_id: string;
  rank: number;
  score: number;
  obj: RetrieveResponseRow;
}

/**
 * Reciprocal rank fusion, ported from rerankers.rrf_fuse.
 *
 * Rank-based: a document's contribution is 1/(k + rank) per method, weighted,
 * so raw score scales don't matter.
 */
export function rrfFuse(
  methodLists: Dict<StagedHit[]>,
  k = 60,
  weightsByMethod: Dict<number> = {},
): [string, number, RetrieveResponseRow][] {
  const rankMaps: Dict<Dict<number>> = {};
  for (const [mid, items] of Object.entries(methodLists)) {
    rankMaps[mid] = {};
    for (const it of items) rankMaps[mid][it.doc_id] = Math.trunc(it.rank);
  }

  const allDocs = new Set<string>();
  for (const items of Object.values(methodLists))
    for (const it of items) allDocs.add(it.doc_id);

  const fused: [string, number, RetrieveResponseRow][] = [];
  for (const doc of allDocs) {
    let score = 0;
    const contributors: string[] = [];
    for (const [mid, rmap] of Object.entries(rankMaps)) {
      const rank = rmap[doc];
      if (rank !== undefined) {
        score += (weightsByMethod[mid] ?? 1.0) * (1.0 / (k + rank));
        contributors.push(mid);
      }
    }
    const bestMid = contributors.reduce((best, m) =>
      rankMaps[m][doc] < rankMaps[best][doc] ? m : best,
    );
    const bestObj = methodLists[bestMid].find((it) => it.doc_id === doc)?.obj;
    // Unreachable: doc came out of bestMid's own ranking.
    if (bestObj === undefined) continue;
    fused.push([doc, score, bestObj]);
  }

  // Python sorts by (-score, doc_id); match that tie-break exactly.
  fused.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return fused;
}

/**
 * Identifies one chunk across the rankings being fused, as
 * rerankers.fusion_doc_key does.
 *
 * chunkId alone is only unique within a document, so it would fuse chunk 0 of
 * one document with chunk 0 of another. chunkId leads so ties still sort by it.
 */
export function fusionDocKey(row: RetrieveResponseRow): string {
  return [
    row.metavars.chunkId ?? "",
    row.metavars.docTitle ?? "",
    row.text ?? "",
  ]
    .map(String)
    .join(KEY_SEP);
}

/**
 * Rescales one method's scores to [0, 1], as rerankers._min_max_scaled does,
 * so methods scoring on larger scales don't dominate the sum.
 */
function minMaxScaled(scores: Dict<number>): Dict<number> {
  const values = Object.values(scores);
  if (values.length === 0) return {};
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const scaled: Dict<number> = {};
  for (const [doc, s] of Object.entries(scores))
    scaled[doc] = hi === lo ? 1.0 : (s - lo) / (hi - lo);
  return scaled;
}

/**
 * Weighted sum of each method's scores after scaling each to [0, 1], ported
 * from rerankers.weighted_avg_fuse.
 */
export function weightedAvgFuse(
  methodLists: Dict<StagedHit[]>,
  weightsByMethod: Dict<number> = {},
): [string, number, RetrieveResponseRow][] {
  const allDocs = new Set<string>();
  const scaledScore: Dict<Dict<number>> = {};
  const rankOf: Dict<Dict<number>> = {};
  for (const [mid, items] of Object.entries(methodLists)) {
    const raw: Dict<number> = {};
    rankOf[mid] = {};
    for (const it of items) {
      allDocs.add(it.doc_id);
      raw[it.doc_id] = Number(it.score);
      rankOf[mid][it.doc_id] ??= it.rank;
    }
    scaledScore[mid] = minMaxScaled(raw);
  }

  const fused: [string, number, RetrieveResponseRow][] = [];
  for (const doc of allDocs) {
    let sum = 0;
    for (const [mid, scores] of Object.entries(scaledScore))
      sum += (weightsByMethod[mid] ?? 1.0) * (scores[doc] ?? 0.0);

    // _best_obj_for_doc: the method ranking this doc highest supplies the row;
    // on a tie, the method listed first.
    let bestMid: string | undefined;
    let bestRank = Infinity;
    for (const [mid, ranks] of Object.entries(rankOf)) {
      const r = ranks[doc];
      if (r !== undefined && r < bestRank) {
        bestRank = r;
        bestMid = mid;
      }
    }
    const obj = bestMid
      ? methodLists[bestMid].find((it) => it.doc_id === doc)?.obj
      : undefined;
    if (obj) fused.push([doc, sum, obj]);
  }

  fused.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return fused;
}

/** Maps a group's per-method weights array onto its method ids. */
function weightsFor(group: FusionGroup): Dict<number> {
  const keys = group.methodKeys ?? [];
  const weights = (group.fusionSettings?.weights ?? []) as unknown[];
  const map: Dict<number> = {};
  keys.forEach((mid, i) => {
    const w = weights[i];
    if (typeof w === "number" && Number.isFinite(w)) map[mid] = w;
  });
  return map;
}

/**
 * Runs a /retrieve request entirely in the browser.
 *
 * @throws If any method needs the backend; check with
 *   canRetrieveRequestInBrowser first.
 */
export async function retrieveRequestInBrowser(
  request: RetrieveRequest,
  onProgress?: ProgressFn,
): Promise<RetrieveResponseRow[]> {
  const { methods, chunks, queries } = request;

  if (!methods || methods.length === 0)
    throw new Error("No retrieval methods provided");
  if (!chunks || chunks.length === 0) throw new Error("No chunks provided");
  if (!queries || queries.length === 0) throw new Error("No queries provided");

  const needsBackend = methodsNeedingBackend(methods);
  if (needsBackend.length > 0)
    throw new Error(
      `These retrieval methods need the local ChainForge server: ` +
        `${needsBackend.join(", ")}. Run ChainForge locally, or choose a ` +
        `keyword method (BM25, Boolean, Keyword Overlap).`,
    );

  const normalizedQueries = queries.map((q) =>
    typeof q === "string" ? { text: q } : (q as Dict<any>),
  );
  // Group chunks by the chunking method that produced them, as the endpoint
  // does, so each chunking strategy is retrieved over independently.
  const chunksByMethod: Dict<RetrievalChunk[]> = {};
  for (const chunk of chunks) {
    const chunkMethod =
      (chunk.fill_history?.chunkMethod as string) ?? "unknown";
    (chunksByMethod[chunkMethod] ??= []).push({
      text: (chunk.text as string) ?? "",
      docTitle: chunk.metavars?.docTitle ?? "",
      chunkId: chunk.metavars?.chunkId ?? "",
      chunkMethod,
      chunkLibrary: chunk.metavars?.chunkLibrary ?? "",
    });
  }

  const rows: RetrieveResponseRow[] = [];
  const errors: string[] = [];

  for (const [chunkMethod, chunkGroup] of Object.entries(chunksByMethod)) {
    if (chunkGroup.length === 0) continue;

    for (const method of methods) {
      try {
        const results = await runMethod(
          method,
          chunkGroup,
          normalizedQueries,
          onProgress,
        );

        for (const result of results) {
          const queryObject = result.query_object as Dict<any>;
          const queryText = String(queryObject.text ?? "");

          result.retrieved_chunks.forEach((hit: RetrievalHit, i: number) => {
            rows.push({
              text: hit.text,
              prompt: queryText,
              eval_res: {
                items: [{ similarity: hit.similarity, rank: i + 1 }],
                dtype: "KeyValue_Mixed",
              },
              vars: {
                ...(queryObject.vars ?? {}),
                ...(queryObject.fill_history ?? {}),
                query: queryText,
                retrievalMethod: method.methodName,
                chunkMethod,
              },
              metavars: {
                ...(queryObject.metavars ?? {}),
                methodId: method.id,
                retrievalMethodSignature: method.baseMethod,
                signature: `${chunkMethod}-${method.methodName}`,
                docTitle: hit.docTitle ?? "",
                chunkId: hit.chunkId ?? "",
                // NOTE: the retrievers do not carry chunkLibrary onto a hit,
                // so this is "" -- matching the backend rather than quietly
                // improving on it.
                chunkLibrary: (hit as Dict<any>).chunkLibrary ?? "",
              },
              llm: (hit as Dict<any>).llm ?? "(none)",
            });
          });
        }
      } catch (err) {
        // Skip just this method, as the endpoint does, and report below if
        // nothing at all succeeded.
        errors.push(
          `Error with ${method.methodName} on ${chunkMethod}: ${
            (err as Error).message
          }`,
        );
      }
    }
  }

  if (rows.length === 0 && errors.length > 0)
    throw new Error(`No retrieval method succeeded.\n${errors.join("\n")}`);

  return [...rows, ...fusedRows(rows, request)];
}

/**
 * The fused rows for a request's linked method groups, from its per-method
 * rows.
 *
 * Mirrors the endpoint's fusion step. Hits are staged per (query, chunking
 * method) in the order the rows were produced, which is the order the
 * endpoint stages them in, so ties break the same way.
 */
export function fusedRows(
  rows: RetrieveResponseRow[],
  request: RetrieveRequest,
): RetrieveResponseRow[] {
  const linkedGroups = request.fusion_enabled
    ? request.linked_groups ?? []
    : [];
  if (linkedGroups.length === 0) return [];

  const methodNameById: Dict<string> = {};
  for (const m of request.methods) methodNameById[m.id] = m.methodName;

  const groupByMethodId: Dict<string> = {};
  const groupConfig: Dict<FusionGroup> = {};
  for (const group of linkedGroups) {
    if (!group.id) continue;
    groupConfig[group.id] = group;
    for (const mid of group.methodKeys ?? []) groupByMethodId[mid] = group.id;
  }

  // A loaded index ignores the connected chunks, so its hits fuse with every
  // chunking method's rankings, as in retrieve() in flask_app.py.
  const chunkMethods = [
    ...new Set(
      (request.chunks ?? []).map(
        (chunk) => (chunk.fill_history?.chunkMethod as string) ?? "unknown",
      ),
    ),
  ];

  // (queryText, chunkMethod) -> methodId -> staged hits
  const staging: Dict<Dict<StagedHit[]>> = {};
  for (const row of rows) {
    const item = row.eval_res.items[0];
    const staged: StagedHit = {
      doc_id: fusionDocKey(row),
      rank: item.rank,
      score: Number(item.similarity ?? 0),
      obj: row,
    };
    const stagedChunkMethods =
      row.vars.chunkMethod === EXISTING_INDEX_CHUNK_METHOD &&
      chunkMethods.length > 0
        ? chunkMethods
        : [row.vars.chunkMethod];
    for (const chunkMethod of stagedChunkMethods) {
      const key = `${row.prompt}${KEY_SEP}${chunkMethod}`;
      ((staging[key] ??= {})[row.metavars.methodId] ??= []).push(staged);
    }
  }

  const fused: RetrieveResponseRow[] = [];
  for (const [key, perMethod] of Object.entries(staging)) {
    const chunkMethod = key.split(KEY_SEP)[1];
    const groups: Dict<Dict<StagedHit[]>> = {};
    for (const [mid, items] of Object.entries(perMethod)) {
      const gid = groupByMethodId[mid];
      if (gid) (groups[gid] ??= {})[mid] = items;
    }

    for (const [gid, methodLists] of Object.entries(groups)) {
      const config = groupConfig[gid] ?? { id: gid };
      const weights = weightsFor(config);
      let ranking: [string, number, RetrieveResponseRow][];
      let signature: string;

      if (config.fusionMethod === "reciprocal_rank_fusion") {
        const settings = config.fusionSettings ?? {};
        const k = Math.trunc(Number(settings.k ?? settings.K ?? 60));
        ranking = rrfFuse(methodLists, k, weights);
        signature = "fusion:rrf";
      } else {
        ranking = weightedAvgFuse(methodLists, weights);
        signature = "fusion:weighted_average";
      }

      const groupMethodIds = (config.methodKeys ?? []).filter(
        (mid) => mid in methodLists,
      );
      const label = `Fused (${groupMethodIds
        .map((mid) => methodNameById[mid])
        .join(" + ")})`;

      ranking.forEach(([, fusedScore, baseRow], index) => {
        const row: RetrieveResponseRow = JSON.parse(JSON.stringify(baseRow));
        row.eval_res.items = [{ similarity: fusedScore, rank: index + 1 }];
        row.vars.retrievalMethod = label;
        row.vars.chunkMethod = chunkMethod;
        row.metavars = {
          ...row.metavars,
          methodId: `group:${gid}`,
          retrievalMethodSignature: signature,
          signature: `${chunkMethod}-FUSED-${gid}`,
        };
        fused.push(row);
      });
    }
  }
  return fused;
}

/**
 * Runs a /retrieve request whose methods may be split between the browser and
 * the local server.
 *
 * Some methods exist only in the browser (Semantic Search (in-browser)) and
 * some only on the server (TF-IDF, the server's embedding methods), so a
 * request that mixes them is split: each side retrieves with its own methods,
 * the rows are merged in the order a single endpoint would have returned them,
 * and linked groups are fused here, since a group can span both sides.
 *
 * @param runOnServer Sends a request to the server's /retrieve endpoint.
 * @param runsOnServer Which methods go to the server. By default, those with
 *   no browser implementation.
 */
export async function retrieveAcrossBrowserAndServer(
  request: RetrieveRequest,
  runOnServer: (request: RetrieveRequest) => Promise<RetrieveResponseRow[]>,
  onProgress?: ProgressFn,
  runsOnServer: (method: RetrieveMethodSpec) => boolean = (m) =>
    !supportsMethod(m),
): Promise<RetrieveResponseRow[]> {
  const methods = request.methods ?? [];
  const serverMethods = methods.filter(runsOnServer);
  const browserMethods = methods.filter((m) => !runsOnServer(m));
  if (serverMethods.length === 0)
    return retrieveRequestInBrowser(request, onProgress);
  if (browserMethods.length === 0) return runOnServer(request);

  // Each side retrieves without fusing; fusion happens below, over both.
  const part = (partMethods: RetrieveMethodSpec[]): RetrieveRequest => ({
    ...request,
    methods: partMethods,
    fusion_enabled: false,
    linked_groups: [],
  });
  const [browserRows, serverRows] = await Promise.all([
    retrieveRequestInBrowser(part(browserMethods), onProgress),
    runOnServer(part(serverMethods)),
  ]);

  // The endpoint returns one chunking method's rows before the next one's,
  // and within those, one retrieval method's before the next.
  const chunkMethodOrder = new Map<string, number>();
  for (const chunk of request.chunks) {
    const chunkMethod =
      (chunk.fill_history?.chunkMethod as string) ?? "unknown";
    if (!chunkMethodOrder.has(chunkMethod))
      chunkMethodOrder.set(chunkMethod, chunkMethodOrder.size);
  }
  const methodOrder = new Map(methods.map((m, i) => [m.id, i]));
  const position = (row: RetrieveResponseRow): [number, number] => [
    chunkMethodOrder.get(row.vars.chunkMethod) ?? chunkMethodOrder.size,
    methodOrder.get(row.metavars.methodId) ?? methods.length,
  ];
  const rows = [...browserRows, ...serverRows]
    .map((row, index) => ({ row, index, at: position(row) }))
    .sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1] || a.index - b.index)
    .map(({ row }) => row);

  return [...rows, ...fusedRows(rows, request)];
}
