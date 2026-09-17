/**
 * AI-suggested plots for the Vis Node.
 *
 * A model sees a description of the responses' fields and a few representative
 * rows, suggests plots, and writes a JavaScript function `plot(rows, context)`
 * that returns a Plotly figure. The function runs in a sandbox (plotSandbox.ts)
 * over all the rows, so the full data never has to be sent to the model.
 */
import { AIError, parseJSONReply, queryAI } from "./ai";
import { StringLookup } from "./cache";
import { Dict, LLMResponse, LLMSpec, StringOrHash } from "./typing";
import { cleanMetavarsFilterFunc, llmResponseDataToString } from "./utils";

/** One response, as the plot code receives it. */
export interface PlotRow {
  llm: string;
  prompt: string;
  response: string;
  vars: Dict<string>;
  metavars: Dict<string>;
  /** The evaluation result, if the responses were evaluated. */
  eval?: boolean | number | string | Dict<boolean | number | string>;
}

/** What the plot code gets besides the rows. */
export interface PlotContext {
  /** The color ChainForge shows each LLM in. */
  llmColors: Dict<string>;
  theme: "light" | "dark";
}

/** A plot the AI suggested or wrote. */
export interface AIPlot {
  title: string;
  description: string;
  code?: string;
}

// How many rows the model sees, and how much of their text
const NUM_SAMPLE_ROWS = 8;
const MAX_SAMPLE_TEXT = 300;
// How many distinct values of a field are described to the model
const MAX_DESCRIBED_VALUES = 12;

const resolve = (v: unknown): string =>
  v === undefined || v === null
    ? ""
    : typeof v === "string" || typeof v === "number"
      ? String(StringLookup.get(v as StringOrHash) ?? v)
      : llmResponseDataToString(v as never);

/** Flattens responses into rows: one per response, with its evaluation result. */
export function buildPlotRows(responses: LLMResponse[]): PlotRow[] {
  const rows: PlotRow[] = [];
  for (const resp of responses) {
    const llm =
      typeof resp.llm === "string" || typeof resp.llm === "number"
        ? resolve(resp.llm)
        : resp.llm?.name ?? "";
    const vars: Dict<string> = {};
    Object.entries(resp.vars ?? {}).forEach(([k, v]) => (vars[k] = resolve(v)));
    const metavars: Dict<string> = {};
    Object.entries(resp.metavars ?? {})
      .filter(([k]) => cleanMetavarsFilterFunc(k))
      .forEach(([k, v]) => (metavars[k] = resolve(v)));

    resp.responses.forEach((r, i) => {
      rows.push({
        llm,
        prompt: resolve(resp.prompt),
        response: llmResponseDataToString(r),
        vars,
        metavars,
        eval: resp.eval_res?.items?.[i],
      });
    });
  }
  return rows;
}

function describeValues(values: string[]): Dict {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return {
    distinct: counts.size,
    values: Object.fromEntries(
      entries
        .slice(0, MAX_DESCRIBED_VALUES)
        .map(([v, n]) => [v.slice(0, 60), n]),
    ),
  };
}

function describeEval(rows: PlotRow[]): Dict | string {
  const evals = rows.map((r) => r.eval).filter((e) => e !== undefined);
  if (evals.length === 0) return "none (the responses weren't evaluated)";

  const describeScalars = (vals: unknown[]): Dict => {
    if (vals.every((v) => typeof v === "boolean"))
      return {
        type: "boolean",
        true: vals.filter((v) => v === true).length,
        false: vals.filter((v) => v === false).length,
      };
    if (vals.every((v) => typeof v === "number")) {
      const nums = vals as number[];
      return {
        type: "number",
        min: Math.min(...nums),
        max: Math.max(...nums),
      };
    }
    return { type: "string", ...describeValues(vals.map(String)) };
  };

  if (evals.every((e) => typeof e === "object")) {
    const keys = new Set<string>();
    evals.forEach((e) => Object.keys(e as Dict).forEach((k) => keys.add(k)));
    return {
      type: "object",
      keys: Object.fromEntries(
        Array.from(keys).map((k) => [
          k,
          describeScalars(
            evals.map((e) => (e as Dict)[k]).filter((v) => v !== undefined),
          ),
        ]),
      ),
    };
  }
  return describeScalars(evals);
}

/** A description of the rows' fields, for the model. */
export function describePlotData(rows: PlotRow[]): Dict {
  const fieldValues = (get: (r: PlotRow) => Dict<string>) => {
    const names = new Set<string>();
    rows.forEach((r) => Object.keys(get(r)).forEach((k) => names.add(k)));
    return Object.fromEntries(
      Array.from(names).map((name) => [
        name,
        describeValues(rows.map((r) => get(r)[name] ?? "")),
      ]),
    );
  };
  return {
    rows: rows.length,
    llm: describeValues(rows.map((r) => r.llm)),
    vars: fieldValues((r) => r.vars),
    metavars: fieldValues((r) => r.metavars),
    eval: describeEval(rows),
  };
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A few rows that represent the data: every LLM, as many combinations of
 * variables as fit, and each kind of evaluation result.
 */
export function sampleRepresentativeRows(
  rows: PlotRow[],
  n = NUM_SAMPLE_ROWS,
): PlotRow[] {
  if (rows.length <= n) return rows;
  const picked = new Set<PlotRow>();
  // Picks a row of the group, unless one is already picked
  const pickFrom = (group: PlotRow[]) => {
    if (picked.size >= n || group.some((r) => picked.has(r))) return;
    picked.add(group[Math.floor(Math.random() * group.length)]);
  };
  const groupBy = (key: (r: PlotRow) => string) => {
    const groups = new Map<string, PlotRow[]>();
    rows.forEach((r) => {
      const k = key(r);
      const group = groups.get(k);
      if (group) group.push(r);
      else groups.set(k, [r]);
    });
    return shuffled(Array.from(groups.values()));
  };

  // One of each LLM, of each kind of evaluation result (e.g. true and false),
  // and of each value of each variable, where there are few enough to cover
  const coverAll = (groups: PlotRow[][]) => {
    if (groups.length <= n) groups.forEach(pickFrom);
  };
  coverAll(groupBy((r) => r.llm));
  coverAll(groupBy((r) => (typeof r.eval === "object" ? "" : String(r.eval))));
  const varNames = new Set(rows.flatMap((r) => Object.keys(r.vars)));
  varNames.forEach((name) => coverAll(groupBy((r) => r.vars[name] ?? "")));

  // Then spread the rest over the combinations of LLM and variables
  const strata = groupBy((r) => r.llm + JSON.stringify(r.vars));
  strata.forEach(pickFrom);
  shuffled(rows).forEach((r) => {
    if (picked.size < n) picked.add(r);
  });
  return Array.from(picked);
}

const truncate = (s: string) =>
  s.length > MAX_SAMPLE_TEXT ? s.slice(0, MAX_SAMPLE_TEXT) + "…" : s;

function dataForPrompt(rows: PlotRow[]): string {
  const samples = sampleRepresentativeRows(rows).map((r) => ({
    ...r,
    prompt: truncate(r.prompt),
    response: truncate(r.response),
  }));
  return `Fields of the data (value: count):\n${JSON.stringify(describePlotData(rows), null, 1)}\n\nSample rows:\n${JSON.stringify(samples, null, 1)}`;
}

/**
 * How ChainForge's plots should show data: the distribution and its
 * variation, with descriptive statistics but no inferential ones.
 */
const PLOT_PRINCIPLES = `Show the distribution of the data, not only a summary of it:
- Prefer plots that show individual responses or the spread of scores: strip or dot plots with jittered points, box plots with the points overlaid, violins, histograms.
- Descriptive statistics are fine: counts, medians, quartiles, ranges, and means shown alongside the points they summarize.
- Don't add inferential statistics: no standard errors, confidence intervals, error bars, p-values, or claims that a difference is significant.
- For an average: draw the individual values too, e.g. a \`box\` trace with \`boxpoints: "all"\` and \`boxmean: true\`, or a \`scatter\` trace with \`mode: "markers"\` over the bar of the average.
- For a proportion (e.g. the share of true scores, or of scores above a threshold): when the data has several inputs (values of a variable, or prompts), compute the proportion for each input, and plot those as points grouped by model, with the overall proportion as a bar or line behind them. Always show the counts behind a proportion as text on the chart, like "7 of 9" (e.g. \`text\` with \`textposition: "outside"\`), not only in hover text.
- Start the value axis of bar charts at zero.
- If a specific kind of chart is asked for (e.g. "a bar chart"), make that kind of chart, following these principles where it allows.`;

const ROW_DOCS = `Each row is one response from an LLM, in ChainForge, a tool for comparing prompts and models:
{ llm: string, // the model's name
  prompt: string, // the prompt sent
  response: string, // the model's response
  vars: { [name]: string }, // the values of the prompt template's variables
  metavars: { [name]: string }, // metadata carried along with the inputs, e.g. table columns
  eval?: boolean | number | string | { [key]: boolean | number | string } // the response's evaluation score, if evaluated
}`;

/** Uses an LLM to suggest plots that suit the data. */
export async function suggestPlots(
  rows: PlotRow[],
  model: LLMSpec,
  apiKeys?: Dict,
  n = 3,
): Promise<AIPlot[]> {
  const system = `You suggest charts for exploring the results of experiments with LLMs. ${ROW_DOCS}

Suggest ${n} different charts that answer questions someone comparing prompts or models would ask of this data, such as which model or prompt variable scores best, how scores are distributed, or how responses differ (e.g. in length). Each chart must be possible to build from the fields given. Prefer charts of evaluation scores when there are some.

${PLOT_PRINCIPLES}

Respond with only a JSON array of ${n} objects, each with the keys "title" (a short chart title) and "description" (a phrase of at most 12 words on what the chart shows).`;
  const reply = await queryAI(model, dataForPrompt(rows), { system, apiKeys });

  let parsed = parseJSONReply(reply);
  if (!Array.isArray(parsed) && parsed && typeof parsed === "object")
    parsed = Object.values(parsed).find(Array.isArray) ?? parsed;
  if (!Array.isArray(parsed))
    throw new AIError(`Could not read the model's suggestions: ${reply}`);
  const suggestions = parsed
    .map((s: Dict) => ({
      title: String(s?.title ?? "").trim(),
      description: String(s?.description ?? "").trim(),
    }))
    .filter((s) => s.title);
  if (suggestions.length === 0)
    throw new AIError(`The model didn't suggest any plots: ${reply}`);
  return suggestions.slice(0, n);
}

/** Pulls the JavaScript out of a model's reply. */
export function extractCode(reply: string): string | undefined {
  const blocks = Array.from(
    reply.matchAll(/```(?:javascript|js)?\s*\n([\s\S]*?)```/g),
  ).map((m) => m[1]);
  const code = blocks.find((b) => /function\s+plot\s*\(/.test(b)) ?? blocks[0];
  if (code) return code.trim();
  return /function\s+plot\s*\(/.test(reply) ? reply.trim() : undefined;
}

/**
 * Uses an LLM to write the code for a plot.
 * @param previousAttempt Code that failed, and its error, for the model to fix.
 */
export async function writePlotCode(
  plot: AIPlot,
  rows: PlotRow[],
  model: LLMSpec,
  apiKeys?: Dict,
  previousAttempt?: { code: string; error: string },
): Promise<string> {
  const system = `You write JavaScript that plots data with Plotly. ${ROW_DOCS}

Write a function \`plot(rows, context)\` that returns a Plotly figure, as an object \`{ data, layout }\`. \`context\` is \`{ llmColors: { [llm]: color }, theme: "light" | "dark" }\`: color traces for LLMs with context.llmColors.
- Plain JavaScript only: no imports, network requests or DOM. Compute any aggregates (counts, means, percentages) yourself.
- Return only JSON values: no functions.
- Handle rows missing a field or an evaluation result.
- Set a title and axis titles, but not background or font colors.

${PLOT_PRINCIPLES}

Respond with the code in a single \`\`\`javascript code block.`;
  let prompt = `Chart to make: ${plot.title}${plot.description ? `: ${plot.description}` : ""}\n\n${dataForPrompt(rows)}`;
  if (previousAttempt)
    prompt += `\n\nThis code failed:\n\`\`\`javascript\n${previousAttempt.code}\n\`\`\`\nError: ${previousAttempt.error}\nFix it.`;

  const reply = await queryAI(model, prompt, { system, apiKeys });
  const code = extractCode(reply);
  if (!code)
    throw new AIError(`The model didn't write a plot function: ${reply}`);
  return code;
}
