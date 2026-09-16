/**
 * What an edge is carrying, described independently of React.
 *
 * Kept free of `./store` (and so of the whole backend import graph) on
 * purpose: these are the parts worth unit testing, and importing the store
 * pulls in Pyodide, which CRA's CommonJS Jest cannot parse.
 */
import StorageCache, { StringLookup } from "./backend/cache";
import {
  Dict,
  isImageResponseData,
  EvaluationScore,
  LLMResponse,
  LLMResponseData,
  LLMSpec,
  StringOrHash,
  TemplateVarInfo,
} from "./backend/typing";

/** What sort of values an edge is carrying. */
export type EdgePayloadKind = "text" | "image" | "response" | "mixed" | "empty";

export interface EdgePreviewItem {
  text?: string;
  imageUid?: string;
  llmName?: string;
}

/** A normalized description of the data flowing along a single edge. */
export interface EdgePreview {
  kind: EdgePayloadKind;
  /** How many values the source hands downstream. */
  count: number;
  /** The first few values, resolved and truncated for display. */
  items: EdgePreviewItem[];
  /** Template variables carried along with the values. */
  varNames: string[];
  /** Metavariables, excluding the internal `__`-prefixed ones. */
  metavarNames: string[];
  /** The models that produced the values, most frequent first. */
  llms: { name: string; count: number }[];
  /** Whether the tallies above only looked at the first AGGREGATE_LIMIT values. */
  sampled: boolean;
  /** Whether these responses carry evaluation scores (see useEdgeScores). */
  scored: boolean;
  /** The name of the node the data comes from. */
  sourceName?: string;
}

// How many values to show in the preview card.
const PREVIEW_ITEMS = 3;
// A ceiling on how many values we'll walk to tally up vars and models, so that
// hovering an edge out of a very large table stays cheap.
export const AGGREGATE_LIMIT = 2000;

// Node types whose downstream data never passes through output(): the LLM and
// Simple evaluators write their results straight to the response cache, which
// consumers read by node id (grabResponses).
export const OPAQUE_SOURCE_TYPES = new Set(["llmeval", "simpleval"]);

// Node types that attach an eval_res to every response they pass on. A
// "processor" is a CodeEvaluatorNode in its rewrite mode, which changes text
// rather than scoring it, so it is deliberately not here.
export const SCORING_SOURCE_TYPES = new Set([
  "evaluator",
  "llmeval",
  "simpleval",
  "multieval",
]);
const TEXT_CHARS = 180;

export const EMPTY_PREVIEW: EdgePreview = {
  kind: "empty",
  count: 0,
  items: [],
  varNames: [],
  metavarNames: [],
  llms: [],
  sampled: false,
  scored: false,
};

function truncate(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > TEXT_CHARS ? t.slice(0, TEXT_CHARS) + "…" : t;
}

function llmNameOf(
  llm: StringOrHash | LLMSpec | undefined,
): string | undefined {
  if (llm === undefined || llm === null) return undefined;
  if (typeof llm === "object") return llm.name;
  return StringLookup.get(llm);
}

// Prompt and evaluator nodes tag every response with an `LLM_<n>` metavar
// naming the model that produced it, one level per prompt node upstream.
const LLM_METAVAR = /^LLM_(\d+)$/;

/** The model named by the innermost `LLM_<n>` metavar, if there is one. */
function llmNameFromMetavars(metavars: Dict | undefined): string | undefined {
  if (metavars === undefined) return undefined;
  let bestDepth = -1;
  let bestName: string | undefined;
  for (const key of Object.keys(metavars)) {
    const match = LLM_METAVAR.exec(key);
    if (match === null) continue;
    const depth = Number(match[1]);
    if (depth > bestDepth) {
      bestDepth = depth;
      bestName = StringLookup.get(metavars[key]);
    }
  }
  return bestName;
}

/** The first of an LLMResponse's generations, which Multi-Eval sends downstream. */
function firstGenerationOf(resp: LLMResponse): {
  text?: string;
  image?: string;
} {
  const generations = resp.responses;
  if (!Array.isArray(generations) || generations.length === 0) return {};
  const first: LLMResponseData = generations[0];
  if (isImageResponseData(first)) return { image: first.d };
  if (typeof first === "object")
    return { text: StringLookup.get(first.d as StringOrHash) };
  return { text: StringLookup.get(first) };
}

/** Walks an `output()` result and summarizes it. Exported for tests. */
export function describeOutput(out: unknown): EdgePreview {
  const values: unknown[] = Array.isArray(out)
    ? out
    : out === undefined || out === null
      ? []
      : [out];
  if (values.length === 0) return EMPTY_PREVIEW;

  const items: EdgePreviewItem[] = [];
  const varNames = new Set<string>();
  const metavarNames = new Set<string>();
  const llmCounts = new Map<string, number>();
  let numTexts = 0;
  let numImages = 0;

  const n = Math.min(values.length, AGGREGATE_LIMIT);
  for (let i = 0; i < n; i++) {
    const val = values[i];
    if (val === undefined || val === null) continue;

    // Plain strings (or interned string hashes), e.g. from a Text Fields node:
    if (typeof val !== "object") {
      numTexts += 1;
      if (items.length < PREVIEW_ITEMS)
        items.push({ text: truncate(StringLookup.get(val as StringOrHash)) });
      continue;
    }

    // Two shapes travel along edges: TemplateVarInfo from most nodes, and
    // LLMResponse from Multi-Eval, which keeps its text in `responses` and its
    // variables in `vars` rather than `text` and `fill_history`.
    const info = val as TemplateVarInfo & Partial<LLMResponse>;
    const generation =
      info.text === undefined && info.image === undefined
        ? firstGenerationOf(info as LLMResponse)
        : { text: StringLookup.get(info.text), image: info.image };

    if (generation.image !== undefined) numImages += 1;
    else numTexts += 1;

    Object.keys(info.fill_history ?? info.vars ?? {}).forEach((k) =>
      varNames.add(k),
    );
    Object.keys(info.metavars ?? {}).forEach((k) => {
      // `__`-prefixed metavars are internal, and the model is shown separately.
      if (!k.startsWith("__") && !LLM_METAVAR.test(k)) metavarNames.add(k);
    });

    // A flow reloaded from a file loses the `llm` spec on its responses, but
    // keeps the metavar, so fall back to that rather than losing attribution.
    const llmName =
      llmNameOf(info.llm) ?? llmNameFromMetavars(info.metavars as Dict);
    if (llmName !== undefined)
      llmCounts.set(llmName, (llmCounts.get(llmName) ?? 0) + 1);

    if (items.length < PREVIEW_ITEMS)
      items.push({
        text: truncate(generation.text),
        imageUid: generation.image,
        llmName,
      });
  }

  let kind: EdgePayloadKind;
  if (numImages > 0 && numTexts > 0) kind = "mixed";
  else if (numImages > 0) kind = "image";
  else if (llmCounts.size > 0) kind = "response";
  else if (numTexts > 0) kind = "text";
  else kind = "empty";

  return {
    kind,
    count: values.length,
    items,
    varNames: Array.from(varNames),
    metavarNames: Array.from(metavarNames),
    llms: Array.from(llmCounts, ([name, count]) => ({ name, count })).sort(
      (a, b) => b.count - a.count,
    ),
    sampled: n < values.length,
    scored: false,
  };
}

/* ------------------------------------------------------------------ *
 *  Scores, read back from the response cache on demand
 * ------------------------------------------------------------------ */

/** A short, textual read on an evaluator's scores. Charting them is the
 * response inspector's and the Vis node's job, not an edge's. */
export interface EdgeScoreSummary {
  /** How many individual scores were found. */
  n: number;
  /** Compact tallies, e.g. ["✓ 18", "✗ 6"] or ["min 41", "med 220"]. */
  parts: string[];
  /** For multi-criteria (KeyValue) results, the criteria names. */
  criteria?: string[];
}

function formatScoreNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(Math.abs(n) < 10 ? 2 : 1);
}

function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Tallies the most common values, highest first. */
function topTallies(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ name, count }) => `${name} ${count}`);
}

/** Reads an evaluator's scores out of the response cache. Exported for tests. */
export function summarizeScores(nodeId: string): EdgeScoreSummary | null {
  const key = `${nodeId}.json`;
  if (!StorageCache.has(key)) return null;

  const cached: unknown = StorageCache.get(key);
  if (!Array.isArray(cached)) return null;

  const flat: EvaluationScore[] = [];
  for (const resp of cached as LLMResponse[]) {
    const items = resp?.eval_res?.items;
    if (Array.isArray(items)) flat.push(...items);
  }
  if (flat.length === 0) return null;

  // Multi-criteria results (Multi-Eval) are dicts of criterion -> score.
  const criteriaNames = new Set<string>();
  flat.forEach((item) => {
    if (item !== null && typeof item === "object")
      Object.keys(item).forEach((k) => criteriaNames.add(k));
  });
  if (criteriaNames.size > 0)
    return {
      n: flat.length,
      parts: [],
      criteria: Array.from(criteriaNames),
    };

  const booleans = flat.filter((i) => typeof i === "boolean") as boolean[];
  if (booleans.length === flat.length) {
    const passed = booleans.filter(Boolean).length;
    return {
      n: flat.length,
      parts: [`✓ ${passed}`, `✗ ${flat.length - passed}`],
    };
  }

  const numbers = flat.filter(
    (i) => typeof i === "number" && Number.isFinite(i),
  ) as number[];
  if (numbers.length === flat.length) {
    const sorted = [...numbers].sort((a, b) => a - b);
    return {
      n: flat.length,
      parts: [
        `min ${formatScoreNumber(sorted[0])}`,
        `med ${formatScoreNumber(medianOf(sorted))}`,
        `max ${formatScoreNumber(sorted[sorted.length - 1])}`,
      ],
    };
  }

  return {
    n: flat.length,
    parts: topTallies(
      flat.map((i) => String(i)),
      3,
    ),
  };
}

/**
 * The scores an evaluator attached to the responses on this edge, read from
 * the response cache the moment `enabled` turns true.
 *
 * Evaluators write straight to the cache without touching node data, so there
 * is nothing to re-render on when their results change. Reading at the moment
 * the card opens sidesteps that: what the card shows was true when it opened.
 */
