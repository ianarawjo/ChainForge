/**
 * What an LLM Scorer's judges may answer, and how their answers are read.
 *
 * A scorer can spell out its possible answers: the categories a categorical
 * judge picks from, or the levels of a numeric scale. Judges are then told
 * exactly what to answer, and an answer outside those bounds is kept as the
 * judge wrote it and counted as invalid, rather than silently plotted as one
 * more category (or turning every score in the run into a string).
 */
import { Dict, EvaluationScore, LLMResponse } from "./typing";
import { StringLookup } from "./cache";

export type ScoreFormat = "bin" | "cat" | "num" | "open";

export interface ScoreCategory {
  label: string;
  description?: string;
}

export interface ScoreSpec {
  format: ScoreFormat;
  /** For "cat": the categories a judge must pick from. None means any answer. */
  categories?: ScoreCategory[];
  /** For "num": the scale's levels, lowest first, scored 1 to N. None means any number. */
  scale?: string[];
}

export const OUTPUT_FORMAT_PROMPTS: Record<ScoreFormat, string> = {
  bin: "Only reply with boolean values true or false, nothing else.",
  cat: "Only reply with your categorization, nothing else.",
  num: "Only reply with a numeric value (a number), nothing else.",
  open: "",
};

export const OUTPUT_FORMAT_PROMPTS_REASONING: Record<ScoreFormat, string> = {
  bin: "First, explain your reasoning for the classification. Then, output your final answer in the following format on a new line: SCORE: true or SCORE: false",
  cat: "First, explain your reasoning for the categorization. Then, output your final answer in the following format on a new line: SCORE: your_category",
  num: "First, explain your reasoning for the numeric value. Then, output your final answer in the following format on a new line: SCORE: numeric_value",
  open: "First, explain your reasoning. Then, output your final answer in the following format on a new line: SCORE: your_answer",
};

/**
 * Categories as the user types them: one per line, optionally followed by a
 * colon and a description (e.g. "billing: charges, invoices, refunds").
 */
export function parseCategories(text?: string): ScoreCategory[] {
  if (!text) return [];
  const seen = new Set<string>();
  const cats: ScoreCategory[] = [];
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    const label = (colon >= 0 ? line.slice(0, colon) : line).trim();
    const description = colon >= 0 ? line.slice(colon + 1).trim() : "";
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    cats.push(description ? { label, description } : { label });
  }
  return cats;
}

/** Scale levels as the user types them: one per line, lowest first. */
export function parseScale(text?: string): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Builds a scorer's spec from its stored settings. */
export function scoreSpecFrom(
  format: string | undefined,
  categoriesText?: string,
  scaleText?: string,
): ScoreSpec {
  const f = (
    ["bin", "cat", "num", "open"].includes(format ?? "") ? format : "bin"
  ) as ScoreFormat;
  const spec: ScoreSpec = { format: f };
  if (f === "cat") {
    const categories = parseCategories(categoriesText);
    if (categories.length > 0) spec.categories = categories;
  } else if (f === "num") {
    const scale = parseScale(scaleText);
    if (scale.length > 0) spec.scale = scale;
  }
  return spec;
}

function categoryList(categories: ScoreCategory[]): string {
  return categories
    .map((c) => `- ${c.label}${c.description ? `: ${c.description}` : ""}`)
    .join("\n");
}

function scaleList(scale: string[]): string {
  return scale.map((level, i) => `${i + 1}: ${level}`).join("\n");
}

/** The instruction appended to a judge's prompt, telling it how to answer. */
export function formatInstruction(
  spec: ScoreSpec,
  useReasoning: boolean,
): string {
  const cats = spec.format === "cat" ? spec.categories ?? [] : [];
  const scale = spec.format === "num" ? spec.scale ?? [] : [];

  if (cats.length > 0) {
    const labels = "Answer with the category's name exactly as written.";
    return useReasoning
      ? `First, explain your reasoning for the categorization. Then, output your final answer in the following format on a new line: SCORE: category, where category is exactly one of:\n${categoryList(cats)}\n${labels}`
      : `Only reply with exactly one of these categories, nothing else:\n${categoryList(cats)}\n${labels}`;
  }
  if (scale.length > 0) {
    const range = `a whole number from 1 to ${scale.length}`;
    return useReasoning
      ? `First, explain your reasoning for the score. Then, output your final answer in the following format on a new line: SCORE: number, where number is ${range} on this scale:\n${scaleList(scale)}`
      : `Only reply with ${range}, nothing else, using this scale:\n${scaleList(scale)}`;
  }
  return useReasoning
    ? OUTPUT_FORMAT_PROMPTS_REASONING[spec.format]
    : OUTPUT_FORMAT_PROMPTS[spec.format];
}

/** A judge's final answer: the text after its last "SCORE:" line, if any, cleaned up. */
function finalAnswer(raw: string): string {
  let s = raw.trim();
  const lines = s.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^\W*score\W*?:[\s*_]*(.+)$/i);
    if (m) {
      s = m[1];
      break;
    }
  }
  s = s.trim();
  // Strip wrapping quotes, backticks and markdown emphasis, and a trailing period
  let prev;
  do {
    prev = s;
    s = s
      .replace(/^(["'`*_]+)(.*?)\1$/s, "$2")
      .replace(/\.$/, "")
      .trim();
  } while (s !== prev);
  return s;
}

export interface ParsedScore {
  value: EvaluationScore;
  valid: boolean;
}

/**
 * Reads one judge answer (or a ground-truth label) under a bounded spec.
 * Invalid answers are returned as the judge wrote them.
 */
export function parseScore(raw: string, spec: ScoreSpec): ParsedScore {
  const ans = finalAnswer(raw);
  const lower = ans.toLowerCase();
  switch (spec.format) {
    case "bin":
      if (lower === "true" || lower === "yes")
        return { value: true, valid: true };
      if (lower === "false" || lower === "no")
        return { value: false, valid: true };
      return { value: raw.trim(), valid: false };
    case "cat": {
      const cats = spec.categories ?? [];
      if (cats.length === 0) return { value: ans, valid: true };
      const match = cats.find((c) => c.label.toLowerCase() === lower);
      return match
        ? { value: match.label, valid: true }
        : { value: raw.trim(), valid: false };
    }
    case "num": {
      const n = /^-?\d+(\.\d+)?$/.test(ans) ? parseFloat(ans) : NaN;
      const levels = spec.scale?.length ?? 0;
      if (isNaN(n)) return { value: raw.trim(), valid: false };
      if (levels > 0 && (n < 1 || n > levels))
        return { value: raw.trim(), valid: false };
      return { value: n, valid: true };
    }
    default:
      return { value: raw, valid: true };
  }
}

/** A ground-truth label, read the same way as judges' answers. Booleans and numbers pass through. */
function parseLabel(
  label: unknown,
  spec: ScoreSpec,
): EvaluationScore | undefined {
  if (label === undefined || label === null) return undefined;
  if (spec.format === "bin" && typeof label === "boolean") return label;
  if (spec.format === "num" && typeof label === "number") return label;
  const s = String(label).trim();
  if (s === "") return undefined;
  const parsed = parseScore(s, spec);
  return parsed.valid ? parsed.value : undefined;
}

/** Reads a response's value for a template variable, or a metavariable when prefixed with "__meta_". */
export function getVarOrMetavar(resp: LLMResponse, varname: string): unknown {
  const v = varname.startsWith("__meta_")
    ? resp.metavars?.[varname.slice("__meta_".length)]
    : resp.vars?.[varname];
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" || typeof v === "number")
    return StringLookup.get(v) ?? v;
  return v;
}

/** One judge's answers for every response, in order, with the judge name as key (or "" for a single judge). */
function judgeScores(
  responses: LLMResponse[],
  judge: string | undefined,
): EvaluationScore[][] {
  return responses.map((r) =>
    (r.eval_res?.items ?? []).map((item) =>
      judge !== undefined && typeof item === "object" && item !== null
        ? (item as Dict<EvaluationScore>)[judge]
        : item,
    ),
  );
}

export interface AgreementRow {
  /** The judge, or "a vs. b" for a pair of judges. */
  name: string;
  /** Share of exact matches (binary, categorical), 0–1. */
  agreement?: number;
  /** Mean absolute difference (numeric). */
  meanAbsDiff?: number;
  /** Scores compared. */
  n: number;
  /** Scores left out: a missing or unreadable label, or an invalid answer. */
  excluded: number;
}

export interface AgreementSummary {
  withLabel: AgreementRow[];
  betweenJudges: AgreementRow[];
}

/**
 * How often each judge agrees with a ground-truth label, and with each other
 * judge. Descriptive only: exact-match rates for binary and categorical
 * scores, mean absolute difference for numeric ones. Pairs where either
 * side is missing or invalid are left out and counted.
 *
 * @param judges the judges' names, when scores are keyed by judge; a single-judge scorer passes [name] with keyed=false.
 */
export function judgeAgreement(
  responses: LLMResponse[],
  judges: string[],
  keyed: boolean,
  spec: ScoreSpec,
  labelVar?: string,
): AgreementSummary {
  const numeric = spec.format === "num";
  const scores = judges.map((j) =>
    judgeScores(responses, keyed ? j : undefined),
  );
  const isValid = (v: EvaluationScore | undefined) =>
    v !== undefined &&
    (spec.format === "bin"
      ? typeof v === "boolean"
      : numeric
        ? typeof v === "number"
        : spec.format === "cat" && spec.categories?.length
          ? spec.categories.some((c) => c.label === v)
          : typeof v === "string" || typeof v === "boolean");

  const compare = (
    name: string,
    a: (i: number, j: number) => EvaluationScore | undefined,
    b: (i: number, j: number) => EvaluationScore | undefined,
  ): AgreementRow => {
    let n = 0;
    let excluded = 0;
    let matches = 0;
    let absDiff = 0;
    responses.forEach((r, i) => {
      const count = r.eval_res?.items.length ?? 0;
      for (let j = 0; j < count; j++) {
        const va = a(i, j);
        const vb = b(i, j);
        if (!isValid(va) || !isValid(vb)) {
          excluded++;
          continue;
        }
        n++;
        if (numeric) absDiff += Math.abs((va as number) - (vb as number));
        else if (
          typeof va === "string" && typeof vb === "string"
            ? va.toLowerCase() === vb.toLowerCase()
            : va === vb
        )
          matches++;
      }
    });
    const row: AgreementRow = { name, n, excluded };
    if (n > 0) {
      if (numeric) row.meanAbsDiff = absDiff / n;
      else row.agreement = matches / n;
    }
    return row;
  };

  const withLabel: AgreementRow[] = [];
  if (labelVar) {
    const labels = responses.map((r) =>
      parseLabel(getVarOrMetavar(r, labelVar), spec),
    );
    judges.forEach((judge, k) => {
      withLabel.push(
        compare(
          judge,
          (i, j) => scores[k][i][j],
          (i) => labels[i],
        ),
      );
    });
  }

  const betweenJudges: AgreementRow[] = [];
  for (let a = 0; a < judges.length; a++)
    for (let b = a + 1; b < judges.length; b++)
      betweenJudges.push(
        compare(
          `${judges[a]} vs. ${judges[b]}`,
          (i, j) => scores[a][i][j],
          (i, j) => scores[b][i][j],
        ),
      );

  return { withLabel, betweenJudges };
}

export interface Disagreement {
  /** The response object's uid, and which of its responses was scored. */
  uid: string;
  index: number;
  /** The scored response (text, or a placeholder for media). */
  response: string;
  /** The ground-truth label, when there is one. */
  label?: EvaluationScore;
  /** Each judge's answer, by judge name. */
  answers: Dict<EvaluationScore | undefined>;
  /** The judges whose answer differs from the label (or, without one, from the most common answer). */
  outliers: string[];
}

/**
 * The scored responses where judges disagree with each other or with the
 * ground-truth label. Answers that don't fit the format count as
 * disagreeing, so they show up here too.
 */
export function findDisagreements(
  responses: LLMResponse[],
  judges: string[],
  keyed: boolean,
  spec: ScoreSpec,
  labelVar?: string,
): Disagreement[] {
  const scores = judges.map((j) =>
    judgeScores(responses, keyed ? j : undefined),
  );
  const key = (v: EvaluationScore | undefined) =>
    typeof v === "string" ? v.toLowerCase() : JSON.stringify(v);
  const out: Disagreement[] = [];
  responses.forEach((r, i) => {
    const label = labelVar
      ? parseLabel(getVarOrMetavar(r, labelVar), spec)
      : undefined;
    const count = r.eval_res?.items.length ?? 0;
    for (let j = 0; j < count; j++) {
      const answers: Dict<EvaluationScore | undefined> = {};
      judges.forEach((judge, k) => (answers[judge] = scores[k][i][j]));
      // What each answer is compared against: the label, or else the most common answer
      let reference: string;
      if (label !== undefined) reference = key(label);
      else {
        const tally: Dict<number> = {};
        Object.values(answers).forEach(
          (v) => (tally[key(v)] = (tally[key(v)] ?? 0) + 1),
        );
        reference = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
      }
      const outliers = judges.filter(
        (judge) => key(answers[judge]) !== reference,
      );
      if (outliers.length === 0) continue;
      const resp = r.responses[j];
      out.push({
        uid: r.uid ?? String(i),
        index: j,
        response:
          typeof resp === "string" || typeof resp === "number"
            ? StringLookup.get(resp) ?? String(resp)
            : "(media)",
        ...(label !== undefined ? { label } : {}),
        answers,
        outliers,
      });
    }
  });
  return out;
}
