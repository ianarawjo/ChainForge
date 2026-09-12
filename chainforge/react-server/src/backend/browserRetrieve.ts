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
  canRetrieveInBrowser,
  retrieveInBrowser,
} from "./browserRetrievers";

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

/** Whether every requested method can run client-side. */
export function canRetrieveRequestInBrowser(
  methods: RetrieveMethodSpec[],
): boolean {
  return (
    methods.length > 0 &&
    methods.every(
      (m) => !m.embeddingProvider && canRetrieveInBrowser(m.baseMethod),
    )
  );
}

/** Names the methods that would need a backend, for an error message. */
export function methodsNeedingBackend(methods: RetrieveMethodSpec[]): string[] {
  return methods
    .filter((m) => m.embeddingProvider || !canRetrieveInBrowser(m.baseMethod))
    .map((m) => m.methodName || m.baseMethod);
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

/** Weighted average of raw scores, ported from rerankers.weighted_avg_fuse. */
export function weightedAvgFuse(
  methodLists: Dict<StagedHit[]>,
  weightsByMethod: Dict<number> = {},
): [string, number, RetrieveResponseRow][] {
  const allDocs = new Set<string>();
  const rawScore: Dict<Dict<number>> = {};
  for (const [mid, items] of Object.entries(methodLists)) {
    rawScore[mid] = {};
    for (const it of items) {
      allDocs.add(it.doc_id);
      rawScore[mid][it.doc_id] = Number(it.score);
    }
  }

  const fused: [string, number, RetrieveResponseRow][] = [];
  for (const doc of allDocs) {
    let sum = 0;
    for (const [mid, scores] of Object.entries(rawScore))
      sum += (weightsByMethod[mid] ?? 1.0) * (scores[doc] ?? 0.0);

    // _best_obj_for_doc: the method ranking this doc highest supplies the row.
    let bestMid: string | undefined;
    let bestScore = -Infinity;
    for (const [mid, scores] of Object.entries(rawScore)) {
      const s = scores[doc];
      if (s !== undefined && s > bestScore) {
        bestScore = s;
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
export function retrieveRequestInBrowser(
  request: RetrieveRequest,
): RetrieveResponseRow[] {
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
  const methodNameById: Dict<string> = {};
  for (const m of methods) methodNameById[m.id] = m.methodName;

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

  const fusionEnabled = Boolean(request.fusion_enabled);
  const linkedGroups = fusionEnabled ? request.linked_groups ?? [] : [];
  const groupByMethodId: Dict<string> = {};
  const groupConfig: Dict<FusionGroup> = {};
  for (const group of linkedGroups) {
    if (!group.id) continue;
    groupConfig[group.id] = group;
    for (const mid of group.methodKeys ?? []) groupByMethodId[mid] = group.id;
  }

  // (queryText, chunkMethod) -> methodId -> staged hits
  const staging: Dict<Dict<StagedHit[]>> = {};
  const rows: RetrieveResponseRow[] = [];
  const errors: string[] = [];

  for (const [chunkMethod, chunkGroup] of Object.entries(chunksByMethod)) {
    if (chunkGroup.length === 0) continue;

    for (const method of methods) {
      try {
        const results = retrieveInBrowser(
          method.baseMethod,
          chunkGroup,
          normalizedQueries,
          method.settings ?? {},
        );

        for (const result of results) {
          const queryObject = result.query_object as Dict<any>;
          const queryText = String(queryObject.text ?? "");

          result.retrieved_chunks.forEach((hit: RetrievalHit, i: number) => {
            const row: RetrieveResponseRow = {
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
            };

            if (fusionEnabled) {
              const key = `${queryText} ${chunkMethod}`;
              ((staging[key] ??= {})[method.id] ??= []).push({
                doc_id: hit.chunkId ?? "",
                rank: i + 1,
                score: Number(hit.similarity ?? 0),
                obj: row,
              });
            }

            rows.push(row);
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

  // Fusion, over the staged per-method rankings.
  if (fusionEnabled && linkedGroups.length > 0) {
    for (const [key, perMethod] of Object.entries(staging)) {
      const chunkMethod = key.split(" ")[1];
      const groups: Dict<Dict<StagedHit[]>> = {};
      for (const [mid, items] of Object.entries(perMethod)) {
        const gid = groupByMethodId[mid];
        if (gid) (groups[gid] ??= {})[mid] = items;
      }

      for (const [gid, methodLists] of Object.entries(groups)) {
        const config = groupConfig[gid] ?? { id: gid };
        const weights = weightsFor(config);
        let fused: [string, number, RetrieveResponseRow][];
        let signature: string;

        if (config.fusionMethod === "reciprocal_rank_fusion") {
          const settings = config.fusionSettings ?? {};
          const k = Math.trunc(Number(settings.k ?? settings.K ?? 60));
          fused = rrfFuse(methodLists, k, weights);
          signature = "fusion:rrf";
        } else {
          fused = weightedAvgFuse(methodLists, weights);
          signature = "fusion:weighted_average";
        }

        const groupMethodIds = (config.methodKeys ?? []).filter(
          (mid) => mid in methodLists,
        );
        const label = `Fused (${groupMethodIds
          .map((mid) => methodNameById[mid])
          .join(" + ")})`;

        fused.forEach(([, fusedScore, baseRow], index) => {
          const row: RetrieveResponseRow = JSON.parse(JSON.stringify(baseRow));
          row.eval_res.items = [{ similarity: fusedScore, rank: index + 1 }];
          row.vars.retrievalMethod = label;
          row.metavars = {
            ...row.metavars,
            methodId: `group:${gid}`,
            retrievalMethodSignature: signature,
            signature: `${chunkMethod}-FUSED-${gid}`,
          };
          rows.push(row);
        });
      }
    }
  }

  if (rows.length === 0 && errors.length > 0)
    throw new Error(`No retrieval method succeeded.\n${errors.join("\n")}`);

  return rows;
}
