/**
 * Statistics for the Vis Node: confidence intervals, pairwise differences and
 * rank bands, computed by the Flask backend with the optional `evalstats`
 * package (`pip install chainforge[stats]`, see chainforge/stats.py). Only
 * available when ChainForge runs locally with that extra installed.
 */
import { StringLookup } from "./cache";
import { Dict, EvaluationScore, LLMResponse, LLMResponseData } from "./typing";
import {
  APP_IS_RUNNING_LOCALLY,
  call_flask_backend,
  llmResponseDataToString,
} from "./utils";

/** One score, in the form the backend expects. */
export interface EvalStatsRow {
  group: string;
  group2?: string;
  /** Which input this scores. Results for the same item are paired across groups. */
  item: string;
  /** Which of several responses to the same input this scores. */
  run: number;
  /** null when the result isn't a number or true/false, which counts as missing. */
  score: number | null;
}

export interface EvalStatsEntity {
  group: string;
  group2?: string;
  mean: number | null;
  ci_low: number | null;
  ci_high: number | null;
  /** evalstats' rank band: 1 is the top entity and all tied with it. null if unknown. */
  band: number | null;
  verdict: "likely_best" | "tied_for_best" | "significant_drop_off" | null;
}

export interface EvalStatsPair {
  /** Indices into `entities`. `diff` is a's mean minus b's. */
  a: number;
  b: number;
  diff: number | null;
  ci_low: number | null;
  ci_high: number | null;
  p_value: number | null;
  /** Whether the difference is significant, by the test evalstats' rank bands use. */
  significant: boolean;
}

interface EvalStatsReport {
  alpha: number;
  n_items: number;
  n_runs: number;
  n_excluded: number;
  /** Readable names of (at most 50 of) the excluded items. */
  excluded_items: string[];
}

export type EvalStatsResult =
  | (EvalStatsReport & {
      ok: true;
      /** The groupings that were compared, best entity first in `entities`. */
      factors: ("group" | "group2")[];
      entities: EvalStatsEntity[];
      pairwise: EvalStatsPair[];
      /** What evalstats ran (CI methods, tests, corrections), for reporting. */
      methods: { label: string; value: string }[];
      notes: string[];
    })
  | (EvalStatsReport & { ok: false; message: string });

let _evalStatsAvailable: Promise<boolean> | undefined;

/** Whether the backend can compute statistics (running locally, [stats] extra installed). */
export function isEvalStatsAvailable(): Promise<boolean> {
  if (_evalStatsAvailable === undefined) {
    const flag = (window as any).__EVALSTATS_AVAILABLE;
    if (flag !== undefined)
      _evalStatsAvailable = Promise.resolve(flag === true);
    else if (!APP_IS_RUNNING_LOCALLY())
      _evalStatsAvailable = Promise.resolve(false);
    // A front-end dev server has no injected flag, so ask the backend.
    else
      _evalStatsAvailable = call_flask_backend("checkEvalStatsAvailable", {})
        .then((resp) => resp.available === true)
        .catch(() => false);
  }
  return _evalStatsAvailable;
}

export async function compareEvalStats(
  rows: EvalStatsRow[],
  itemLabels: Dict<string>,
): Promise<EvalStatsResult> {
  const resp = await call_flask_backend("compareEvalStats", {
    rows,
    item_labels: itemLabels,
  });
  if (resp.error) throw new Error(resp.error);
  return resp as EvalStatsResult;
}

/** A score as a number for statistics: true/false as 1/0, anything non-numeric as null. */
export function toStatsScore(
  score: EvaluationScore | undefined,
): number | null {
  if (typeof score === "boolean") return score ? 1 : 0;
  if (typeof score === "number" && Number.isFinite(score)) return score;
  return null;
}

/**
 * A grouping to compare, named the way the Vis Node names them: "LLM", a
 * prompt variable's name, or `__meta_<name>` for a metavariable.
 */
export interface EvalStatsFactor {
  key: string;
  valueOf: (resp: LLMResponse) => string;
}

const dataToString = (v: LLMResponseData | undefined) =>
  v === undefined ? "(missing)" : llmResponseDataToString(v).trim();

const llmNameOf = (resp: LLMResponse) =>
  typeof resp.llm === "string" || typeof resp.llm === "number"
    ? StringLookup.get(resp.llm) ?? String(resp.llm)
    : resp.llm?.name ?? "(missing)";

/**
 * Turns responses into rows for `compareEvalStats`.
 *
 * Results are paired across groups by item: what was fed into the prompt,
 * that is, the response's LLM, vars and metavars, minus the groupings being
 * compared. Also left out are values that only ever occur within one group,
 * such as an upstream LLM's response text when comparing upstream LLMs: they
 * describe the group, not the input, and would keep every item unpaired.
 */
export function buildEvalStatsRows(
  responses: LLMResponse[],
  factors: EvalStatsFactor[],
  scoresOf: (resp: LLMResponse) => (number | null)[],
): { rows: EvalStatsRow[]; itemLabels: Dict<string> } {
  const factorKeys = new Set(factors.map((f) => f.key));
  const cellOf = (resp: LLMResponse) =>
    JSON.stringify(factors.map((f) => f.valueOf(resp)));

  // Every candidate dimension of each response's input, by Vis Node key.
  const dimsOf = (resp: LLMResponse): Dict<string> => {
    const dims: Dict<string> = { LLM: llmNameOf(resp) };
    Object.entries(resp.vars ?? {}).forEach(([k, v]) => {
      dims[k] = dataToString(v);
    });
    Object.entries(resp.metavars ?? {}).forEach(([k, v]) => {
      dims[`__meta_${k}`] = dataToString(v);
    });
    factorKeys.forEach((k) => delete dims[k]);
    return dims;
  };
  const allDims = responses.map(dimsOf);

  // Drop dimensions whose values each occur within only one group, checking
  // each grouping on its own and (with two) their combination. A grouping
  // with a single group can't tell inputs from groups, so it's skipped.
  const groupings = factors.map((f) => f.valueOf);
  if (factors.length > 1) groupings.push(cellOf);
  const groupSpecific = new Set<string>();
  groupings.forEach((groupOf) => {
    const groupsByDimValue: Dict<Dict<Set<string>>> = {};
    const allGroups = new Set<string>();
    responses.forEach((resp, i) => {
      const group = groupOf(resp);
      allGroups.add(group);
      Object.entries(allDims[i]).forEach(([k, v]) => {
        const byValue = (groupsByDimValue[k] ??= {});
        (byValue[v] ??= new Set()).add(group);
      });
    });
    if (allGroups.size < 2) return;
    Object.entries(groupsByDimValue).forEach(([k, byValue]) => {
      if (
        Object.keys(byValue).length > 1 &&
        Object.values(byValue).every((groups) => groups.size === 1)
      )
        groupSpecific.add(k);
    });
  });

  const rows: EvalStatsRow[] = [];
  const itemIds: Dict<string> = {};
  const itemLabels: Dict<string> = {};
  responses.forEach((resp, i) => {
    const dims = Object.entries(allDims[i])
      .filter(([k]) => !groupSpecific.has(k))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const itemKey = JSON.stringify(dims);
    let item = itemIds[itemKey];
    if (item === undefined) {
      item = itemIds[itemKey] = `item${Object.keys(itemIds).length}`;
      // Name items by their prompt variables where there are any.
      const named = dims.filter(([k]) => k !== "LLM" && !k.startsWith("__"));
      const label = (named.length > 0 ? named : dims)
        .map(([k, v]) => `${k.replace(/^__meta_/, "")}: ${v}`)
        .join("; ");
      itemLabels[item] =
        label.length > 120
          ? label.slice(0, 117) + "..."
          : label || "(no inputs)";
    }

    const groups = factors.map((f) => f.valueOf(resp));
    scoresOf(resp).forEach((score, run) => {
      const row: EvalStatsRow = { group: groups[0], item, run, score };
      if (groups.length > 1) row.group2 = groups[1];
      rows.push(row);
    });
  });
  return { rows, itemLabels };
}
