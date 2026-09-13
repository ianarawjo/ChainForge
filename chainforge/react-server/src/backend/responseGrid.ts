/**
 * Layout logic for the inspector's grid view: which variables can be axes,
 * sensible default axes, grouping responses (text or images) into
 * split -> row -> column cells, and reading evaluation scores for badges and
 * heatmap coloring.
 *
 * Kept free of React and of value lookups (passed in as accessors), so it can
 * be tested directly.
 */
import type {
  Dict,
  EvaluationScore,
  LLMResponse,
  LLMResponseData,
} from "./typing";

/** Axis id for the model that produced a response (vs. a prompt variable). */
export const MODEL_AXIS = "$LLM";

/** Shown for a response that has no value for an axis variable. */
export const UNSPECIFIED = "(unspecified)";

/** Metric name for responses scored with a single value, not named metrics. */
export const SCORE_METRIC = "Score";

export interface GridAccessors {
  /** Name of the model that produced a response. */
  modelOf: (response: LLMResponse) => string;
  /** A prompt variable's value as text, or undefined if the response lacks it. */
  valueOf: (response: LLMResponse, varName: string) => string | undefined;
  /** A text response as a string (text may be stored interned). */
  textOf: (data: LLMResponseData) => string;
}

/** Axis ids (a prompt variable name or MODEL_AXIS); undefined = not used. */
export interface GridAxes {
  rows?: string;
  cols?: string;
  split?: string;
}

/**
 * One response shown in the grid. `index` is its position in
 * `response.responses`, which is also where its evaluation score sits.
 */
export type GridItem =
  | { kind: "image"; uid: string; response: LLMResponse; index: number }
  | { kind: "text"; text: string; response: LLMResponse; index: number };

export interface GridSection {
  /** Value of the split axis for this section; undefined when not splitting. */
  value?: string;
  /** cells[row][col] = the items there, in response order. */
  cells: GridItem[][][];
}

export interface Grid {
  /** Row header values; [""] when there is no row axis. */
  rowValues: string[];
  /** Column header values; [""] when there is no column axis. */
  colValues: string[];
  sections: GridSection[];
  /** Every shown item, in reading order (section, row, column, cell). */
  ordered: GridItem[];
}

const isMedia = (v: LLMResponseData | undefined): boolean =>
  typeof v === "object" && v !== null && "t" in v;

const distinct = (values: string[]): string[] => Array.from(new Set(values));

/**
 * Every text and image response, in response order. Other media (documents)
 * are skipped.
 */
export function collectGridItems(
  responses: LLMResponse[],
  accessors: GridAccessors,
): GridItem[] {
  const items: GridItem[] = [];
  for (const response of responses)
    response.responses.forEach((r, index) => {
      if (typeof r === "object" && r !== null) {
        if (r.t === "img")
          items.push({ kind: "image", uid: r.d, response, index });
      } else
        items.push({
          kind: "text",
          text: accessors.textOf(r),
          response,
          index,
        });
    });
  return items;
}

/**
 * Candidate axes: prompt variables, in first-seen order, and the models
 * involved. Variables holding media (e.g. an input image) are left out; their
 * values are file ids, meaningless as headers.
 */
export function gridAxisOptions(
  items: GridItem[],
  accessors: GridAccessors,
): { vars: string[]; models: string[] } {
  const vars: string[] = [];
  const mediaVars = new Set<string>();
  const models: string[] = [];
  for (const { response } of items) {
    for (const [name, value] of Object.entries(response.vars ?? {})) {
      if (isMedia(value)) mediaVars.add(name);
      else if (!vars.includes(name)) vars.push(name);
    }
    const model = accessors.modelOf(response);
    if (!models.includes(model)) models.push(model);
  }
  return { vars: vars.filter((v) => !mediaVars.has(v)), models };
}

/**
 * Default axes. The first two variables go on rows and columns. With several
 * models and at least two variables, the models become the split, so each
 * model gets its own grid of the two variables. With fewer variables, several
 * models go on the columns instead.
 */
export function defaultGridAxes(vars: string[], numModels: number): GridAxes {
  const multipleModels = numModels > 1;
  if (vars.length >= 2)
    return {
      rows: vars[0],
      cols: vars[1],
      split: multipleModels ? MODEL_AXIS : undefined,
    };
  return {
    rows: vars[0],
    cols: multipleModels ? MODEL_AXIS : undefined,
  };
}

/** An item's value on an axis. */
export function axisValue(
  item: GridItem,
  axis: string,
  accessors: GridAccessors,
): string {
  if (axis === MODEL_AXIS) return accessors.modelOf(item.response);
  return accessors.valueOf(item.response, axis) ?? UNSPECIFIED;
}

/** The distinct values an axis takes across the items, in first-seen order. */
export function axisValues(
  items: GridItem[],
  axis: string,
  accessors: GridAccessors,
): string[] {
  return distinct(items.map((item) => axisValue(item, axis, accessors)));
}

/**
 * Lays items out on the given axes.
 *
 * @param filters Axis -> required value, for variables not on an axis. An
 *   empty or missing value means no filtering on that axis.
 */
export function buildGrid(
  items: GridItem[],
  axes: GridAxes,
  filters: Dict<string>,
  accessors: GridAccessors,
): Grid {
  const shown = items.filter((item) =>
    Object.entries(filters).every(
      ([axis, required]) =>
        !required || axisValue(item, axis, accessors) === required,
    ),
  );

  const valuesOn = (axis?: string) =>
    axis ? axisValues(shown, axis, accessors) : [""];
  const rowValues = valuesOn(axes.rows);
  const colValues = valuesOn(axes.cols);
  const splitValues: (string | undefined)[] = axes.split
    ? axisValues(shown, axes.split, accessors)
    : [undefined];

  const sections: GridSection[] = splitValues.map((value) => ({
    value,
    cells: rowValues.map(() => colValues.map(() => [] as GridItem[])),
  }));

  const indexOn = (
    item: GridItem,
    axis: string | undefined,
    values: string[],
  ) => (axis ? values.indexOf(axisValue(item, axis, accessors)) : 0);

  for (const item of shown) {
    const s = indexOn(item, axes.split, splitValues as string[]);
    const r = indexOn(item, axes.rows, rowValues);
    const c = indexOn(item, axes.cols, colValues);
    sections[s].cells[r][c].push(item);
  }

  const ordered: GridItem[] = [];
  for (const section of sections)
    for (const row of section.cells)
      for (const cell of row) ordered.push(...cell);

  return { rowValues, colValues, sections, ordered };
}

// ---------------------------------------------------------------------------
// Evaluation scores

/** The evaluation score for an item, if it has been scored. */
export function scoreOf(item: GridItem): EvaluationScore | undefined {
  const score = item.response.eval_res?.items?.[item.index];
  return score === null ? undefined : score;
}

/**
 * The metrics the items are scored on: SCORE_METRIC for single-value scores,
 * then any named metrics (from multi-metric evaluators), in first-seen order.
 */
export function scoreMetrics(items: GridItem[]): string[] {
  const named: string[] = [];
  let hasSingle = false;
  for (const item of items) {
    const score = scoreOf(item);
    if (score === undefined || Array.isArray(score)) continue;
    if (typeof score === "object") {
      for (const name of Object.keys(score))
        if (!named.includes(name)) named.push(name);
    } else hasSingle = true;
  }
  return hasSingle ? [SCORE_METRIC, ...named] : named;
}

/** An item's value for a metric, or undefined if it wasn't scored on it. */
export function metricValue(
  item: GridItem,
  metric: string,
): boolean | number | string | undefined {
  const score = scoreOf(item);
  if (score === undefined || Array.isArray(score)) return undefined;
  if (typeof score === "object") return score[metric];
  return metric === SCORE_METRIC ? score : undefined;
}

const PASS_WORDS = new Set(["true", "yes", "pass", "passed"]);
const FAIL_WORDS = new Set(["false", "no", "fail", "failed"]);

/** true/false for a pass/fail-like value (booleans, "yes", "fail", ...). */
export function passFail(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const word = value.trim().toLowerCase();
    if (PASS_WORDS.has(word)) return true;
    if (FAIL_WORDS.has(word)) return false;
  }
  return undefined;
}

export type HeatScale =
  | { kind: "numeric"; min: number; max: number }
  | { kind: "passfail" };

/**
 * How to color items by a metric: a numeric scale if every scored value is a
 * number, pass/fail if every one reads as pass or fail, and none otherwise
 * (e.g. categories, which have no natural order).
 */
export function heatScaleFor(
  items: GridItem[],
  metric: string,
): HeatScale | undefined {
  const values = items
    .map((item) => metricValue(item, metric))
    .filter((v) => v !== undefined);
  if (values.length === 0) return undefined;

  if (values.every((v) => typeof v === "number" && Number.isFinite(v))) {
    const nums = values as number[];
    return {
      kind: "numeric",
      min: nums.reduce((a, b) => Math.min(a, b)),
      max: nums.reduce((a, b) => Math.max(a, b)),
    };
  }
  if (values.every((v) => passFail(v) !== undefined))
    return { kind: "passfail" };
  return undefined;
}

/**
 * Where a value falls on a scale, from 0 (lowest, or fail) to 1 (highest, or
 * pass). Undefined for unscored or off-scale values.
 */
export function heatLevel(
  value: boolean | number | string | undefined,
  scale: HeatScale,
): number | undefined {
  if (value === undefined) return undefined;
  if (scale.kind === "numeric") {
    if (typeof value !== "number") return undefined;
    return scale.max === scale.min
      ? 1
      : (value - scale.min) / (scale.max - scale.min);
  }
  const outcome = passFail(value);
  return outcome === undefined ? undefined : outcome ? 1 : 0;
}

/** A short label for a score value, for badges. */
export function formatScore(value: boolean | number | string): string {
  if (typeof value === "number")
    return Number.isInteger(value)
      ? String(value)
      : String(parseFloat(value.toFixed(2)));
  if (typeof value === "boolean") return String(value);
  return value.length > 14 ? value.slice(0, 13) + "…" : value;
}
