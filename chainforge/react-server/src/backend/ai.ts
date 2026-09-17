/**
 * Business logic for the AI-generated features.
 *
 * Every query goes through queryLLM, with a model from aiModels.ts. Models are
 * asked to reply in JSON, which is sturdier to parse than markdown lists or
 * tables (a cell with a "|" in it no longer breaks a row).
 */
import { v4 as uuid } from "uuid";
import { queryLLM } from "./backend";
import {
  StringTemplate,
  escapeBraces,
  containsSameTemplateVariables,
} from "./template";
import { Dict, LLMSpec } from "./typing";
import CancelTracker from "./canceler";
import { UserForcedPrematureExit } from "./errors";
import { llmResponseDataToString, sampleRandomElements } from "./utils";

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

// Input and outputs of autofill are both rows of strings.
export type Row = string;

/** A table as AI features pass it around: column names, and rows of cells. */
export interface AITable {
  cols: string[];
  rows: string[][];
}

// Tables longer than this are sampled before being sent to the model.
const MAX_TABLE_ROWS_IN_PROMPT = 30;
// Examples sent to the model are cut to fit these, so prompts fit small
// context windows (e.g. Ollama's) however long the table's cells are.
const MAX_EXAMPLE_CHARS = 500;
const MAX_EXAMPLES_PROMPT_CHARS = 12000;

export interface AIQueryOptions {
  system?: string;
  apiKeys?: Dict;
}

function withSystemMessage(model: LLMSpec, system?: string): LLMSpec {
  if (system === undefined) return model;
  return { ...model, settings: { ...model.settings, system_msg: system } };
}

function firstError(errors: Dict<string[]>): string | undefined {
  return Object.values(errors).flat()[0];
}

/**
 * Queries an AI model with a prompt, returning its reply as text.
 * @param prompt The literal prompt text (braces in it are not template variables).
 */
export async function queryAI(
  model: LLMSpec,
  prompt: string,
  options: AIQueryOptions = {},
): Promise<string> {
  const result = await queryLLM(
    `__ai-${uuid()}`,
    [withSystemMessage(model, options.system)],
    1,
    escapeBraces(prompt),
    {},
    undefined,
    options.apiKeys,
    true,
  );
  const response = result.responses[0]?.responses?.[0];
  if (response === undefined)
    throw new AIError(
      firstError(result.errors) ?? `${model.name} returned no response.`,
    );
  return llmResponseDataToString(response);
}

/** How far a batched query has got. */
export interface AIProgress {
  done: number;
  failed: number;
  total: number;
}

export interface AIForEachOptions extends AIQueryOptions {
  onProgress?: (progress: AIProgress) => void;
  /** Stops the query when added to CancelTracker. */
  cancelId?: string;
}

export interface AIForEachResult {
  /** Each input's reply, or undefined where it failed or wasn't reached. */
  replies: (string | undefined)[];
  errors: string[];
  canceled: boolean;
}

/**
 * Queries an AI model once per input, in parallel (within the provider's rate
 * limits), returning the replies in the same order as the inputs. Each input
 * is its own query, so a stop or a failed input keeps the replies already
 * finished.
 * @param template The prompt, with the literal text escaped and `{input}` where each input goes.
 * @param inputs Literal text: braces in them are not template variables.
 */
export async function queryAIForEach(
  model: LLMSpec,
  template: string,
  inputs: string[],
  options: AIForEachOptions = {},
): Promise<AIForEachResult> {
  const { onProgress, cancelId } = options;
  const spec = withSystemMessage(model, options.system);
  const total = inputs.length;
  const replies: (string | undefined)[] = inputs.map(() => undefined);
  const errors: string[] = [];
  let done = 0;
  let failed = 0;
  let canceled = false;
  // Set once this returns, after which late replies are ignored
  let returned = false;
  const isCanceled = () =>
    cancelId !== undefined && CancelTracker.has(cancelId);

  // queryLLM's rate limiter paces these; all are started at once
  const all = Promise.all(
    inputs.map(async (text, idx) => {
      if (isCanceled()) {
        canceled = true;
        return;
      }
      try {
        const result = await queryLLM(
          `__ai-${uuid()}`,
          [spec],
          1,
          template,
          { input: escapeBraces(text) },
          undefined,
          options.apiKeys,
          true,
          undefined,
          undefined,
          cancelId,
        );
        // Replies that arrive after a stop returned are ignored
        if (returned) return;
        const response = result.responses[0]?.responses?.[0];
        if (response !== undefined) {
          replies[idx] = llmResponseDataToString(response);
          done += 1;
        } else {
          failed += 1;
          errors.push(
            firstError(result.errors) ?? `${model.name} returned no response.`,
          );
        }
      } catch (err) {
        if (err instanceof UserForcedPrematureExit || isCanceled()) {
          canceled = true;
          return;
        }
        if (returned) return;
        failed += 1;
        errors.push(err instanceof Error ? err.message : String(err));
      }
      onProgress?.({ done, failed, total });
    }),
  );

  // On a stop, return the replies so far, without waiting for requests in flight
  if (cancelId !== undefined) {
    let watcher: ReturnType<typeof setInterval> | undefined;
    const stopped = new Promise<void>((resolve) => {
      watcher = setInterval(() => {
        if (isCanceled()) resolve();
      }, 200);
    });
    await Promise.race([all, stopped]);
    clearInterval(watcher);
    if (isCanceled()) canceled = true;
  } else await all;

  returned = true;
  return { replies: [...replies], errors: [...errors], canceled };
}

/**
 * Extracts the JSON value from a model's reply, whether it's bare or in a
 * code block, and whether or not the model thought out loud first.
 */
export function parseJSONReply(reply: string): unknown {
  const text = reply.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = fenced.exec(text)) !== null) candidates.push(match[1]);
  candidates.push(text);
  // The outermost array or object, if the model added words around it
  for (const [open, close] of [
    ["[", "]"],
    ["{", "}"],
  ]) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start)
      candidates.push(text.substring(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      /* try the next candidate */
    }
  }
  throw new AIError(`Could not read the model's reply as JSON: ${reply}`);
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") return cell;
  if (typeof cell === "object") return JSON.stringify(cell);
  return String(cell);
}

/** Some models wrap a list in an object, like {"items": [...]}; unwraps it. */
function unwrapList(parsed: unknown): unknown {
  if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
    const lists = Object.values(parsed).filter(Array.isArray);
    if (lists.length === 1) return lists[0];
  }
  return parsed;
}

/** Reads a JSON array of strings from a model's reply. */
function parseStringList(reply: string): string[] {
  const parsed = unwrapList(parseJSONReply(reply));
  if (!Array.isArray(parsed))
    throw new AIError(`Expected a list from the model, but got: ${reply}`);
  const items = parsed
    .map(cellToString)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // Models sometimes write template variables with double braces
    .map((s) => s.replace(/{{(.*?)}}/g, "{$1}"));
  if (items.length === 0)
    throw new AIError(`The model returned an empty list: ${reply}`);
  return items;
}

/** Reads rows (arrays of cells, or objects keyed by column) from a JSON value. */
function toRows(value: unknown, cols: string[]): string[][] {
  if (!Array.isArray(value))
    throw new AIError("Expected a list of rows from the model.");
  return value.map((row) => {
    if (Array.isArray(row))
      return cols.map((_, i) => cellToString(row[i]).trim());
    if (row && typeof row === "object")
      return cols.map((col) => cellToString((row as Dict)[col]).trim());
    return [cellToString(row).trim(), ...cols.slice(1).map(() => "")];
  });
}

const truncateExample = (text: string) =>
  text.length > MAX_EXAMPLE_CHARS
    ? text.slice(0, MAX_EXAMPLE_CHARS) + "…"
    : text;

/**
 * A random sample of examples to show the model, with long text cut short,
 * that fits the prompt's character budget (always at least one example).
 */
function sampleExamples<T>(
  examples: T[],
  maxCount: number,
  truncate: (example: T) => T,
): T[] {
  const sampled = (
    examples.length > maxCount
      ? sampleRandomElements(examples, maxCount)
      : examples
  ).map(truncate);
  const fitted: T[] = [];
  let chars = 0;
  for (const example of sampled) {
    chars += JSON.stringify(example).length;
    if (fitted.length > 0 && chars > MAX_EXAMPLES_PROMPT_CHARS) break;
    fitted.push(example);
  }
  return fitted;
}

function templateVariablesInstruction(vars: string[]): string {
  if (vars.length === 0) return "";
  const listed = vars.map((v) => `{${v}}`).join(", ");
  return ` The items are templates: each new item must use all of these template variables, in single braces: ${listed}.`;
}

/**
 * Uses an LLM to interpret the pattern from the given rows as return new rows following the pattern.
 * @param input rows for the autofilling system
 * @param n number of results to return
 */
export async function autofill(
  input: Row[],
  n: number,
  model: LLMSpec,
  apiKeys?: Dict,
): Promise<Row[]> {
  const items = input.filter((row) => row.trim().length > 0);
  const templateVariables = [
    ...new Set(new StringTemplate(items.join("\n")).get_vars()),
  ];

  const examples = sampleExamples(
    items,
    MAX_TABLE_ROWS_IN_PROMPT,
    truncateExample,
  );

  const system = `You are given a list of items. Work out the pattern they follow, then write ${n} more items that follow it, without repeating any.${templateVariablesInstruction(templateVariables)} Respond with only a JSON array of ${n} strings.`;
  const reply = await queryAI(model, JSON.stringify(examples, null, 2), {
    system,
    apiKeys,
  });
  const newItems = parseStringList(reply).slice(0, n);

  if (!containsSameTemplateVariables(items.join("\n"), newItems.join("\n")))
    throw new AIError(
      `The generated items don't use the same template variables as the existing ones: ${newItems.join(", ")}`,
    );
  return newItems;
}

/**
 * Uses an LLM to generate `n` new items based on the pattern explained in `prompt`.
 * @param creative whether to ask for unconventional items
 */
export async function generateAndReplace(
  prompt: string,
  n: number,
  creative: boolean,
  model: LLMSpec,
  apiKeys?: Dict,
): Promise<Row[]> {
  const system = `Write a list of exactly ${n} items for the user's request, without repeating any.${creative ? " Be unconventional." : ""} Each item is one of the things asked for, written plainly. Only if the user asks for prompts or commands, write each item as an instruction to an AI assistant; only if they ask for templates, placeholders or variables, write those as template variables in single braces, like {variable}. Respond with only a JSON array of ${n} strings.`;
  const reply = await queryAI(model, `Write a list of: ${prompt}`, {
    system,
    apiKeys,
  });
  return parseStringList(reply).slice(0, n);
}

/**
 * Uses an LLM to interpret the pattern in the given table and generate new rows following it.
 * @param n Number of new rows to generate.
 */
export async function autofillTable(
  input: AITable,
  n: number,
  model: LLMSpec,
  apiKeys?: Dict,
): Promise<string[][]> {
  const sampleRows = sampleExamples(
    input.rows,
    MAX_TABLE_ROWS_IN_PROMPT,
    (row) => row.map(truncateExample),
  );

  const system = `You are given a table, as JSON: its column names, and its rows as arrays of cells in column order. Work out the pattern the rows follow, then write ${n} more rows that follow it, without repeating any. Respond with only a JSON array of ${n} rows, each an array of ${input.cols.length} strings.`;
  const reply = await queryAI(
    model,
    JSON.stringify({ columns: input.cols, rows: sampleRows }, null, 2),
    { system, apiKeys },
  );
  const rows = toRows(unwrapList(parseJSONReply(reply)), input.cols).slice(
    0,
    n,
  );
  if (rows.length === 0)
    throw new AIError(`The model returned no rows: ${reply}`);
  return rows;
}

/**
 * Uses an LLM to generate a table with `n` rows based on the description in `prompt`.
 */
export async function generateAndReplaceTable(
  prompt: string,
  n: number,
  model: LLMSpec,
  apiKeys?: Dict,
): Promise<AITable> {
  const system = `Write a table for the user's request, with exactly ${n} rows. Cells hold the data asked for, written plainly. Only if the user asks for prompts or commands, write them as instructions to an AI assistant. Respond with only a JSON object with two keys: "columns", an array of short column names, and "rows", an array of ${n} rows, each an array of strings with one string per column.`;
  const reply = await queryAI(model, `Write a table of: ${prompt}`, {
    system,
    apiKeys,
  });

  const parsed = parseJSONReply(reply) as Dict;
  let cols: string[] = Array.isArray(parsed?.columns)
    ? parsed.columns.map(cellToString)
    : [];
  // Tolerate a bare list of objects keyed by column
  const rawRows = Array.isArray(parsed) ? parsed : parsed?.rows;
  if (
    cols.length === 0 &&
    Array.isArray(rawRows) &&
    rawRows[0] &&
    typeof rawRows[0] === "object" &&
    !Array.isArray(rawRows[0])
  )
    cols = Object.keys(rawRows[0]);
  if (cols.length === 0)
    throw new AIError(`The model's table has no columns: ${reply}`);

  const rows = toRows(rawRows, cols).slice(0, n);
  if (rows.length === 0)
    throw new AIError(`The model's table has no rows: ${reply}`);
  return { cols, rows };
}

/**
 * Uses an LLM to add a column to a table, filling in each row's value from `prompt`.
 * Rows are queried in parallel.
 * @returns The new column's name, and its value for each row: blank where
 * the row failed, or wasn't reached before a stop.
 */
export async function generateColumn(
  table: AITable,
  prompt: string,
  model: LLMSpec,
  apiKeys?: Dict,
  options: Pick<AIForEachOptions, "onProgress" | "cancelId"> = {},
): Promise<{
  col: string;
  rows: string[];
  failed: number;
  errors: string[];
  canceled: boolean;
}> {
  let colName = prompt.trim();
  if (colName.length > 20) {
    const reply = await queryAI(
      model,
      `Name a table column that holds: "${prompt}"`,
      {
        system:
          'You name the columns of tables. Names are short (under 20 characters) and in natural language, like "Column Name". Respond with only the name.',
        apiKeys,
      },
    );
    colName = reply.replace(/_/g, " ");
  }
  colName = colName.trim().replace(/["`]/g, "");

  const inputs = table.rows.map((row) =>
    table.cols.map((col, i) => `${col}: ${row[i] ?? ""}`).join("\n"),
  );
  const result = await queryAIForEach(
    model,
    `{input}\n${escapeBraces(prompt)}: ?`,
    inputs,
    {
      system:
        "You are given a row of a table, with its last field missing. Fill in the missing field. Respond with only its value: no explanation, quotation marks or formatting.",
      apiKeys,
      ...options,
    },
  );
  const filled = result.replies.filter((r) => r !== undefined).length;
  if (filled === 0 && !result.canceled)
    throw new AIError(
      result.errors[0] ?? `${model.name} didn't fill in any rows.`,
    );

  return {
    col: colName,
    rows: result.replies.map((r) => (r ?? "").trim()),
    failed: result.canceled ? 0 : inputs.length - filled,
    errors: result.errors,
    canceled: result.canceled,
  };
}

/**
 * Uses an LLM to write variants of a prompt template, for comparing prompts.
 * Variants that drop or add template variables are left out.
 * @param guidance How the variants should differ, if the user said.
 * @returns Between 1 and `n` variants.
 */
export async function generatePromptVariants(
  prompt: string,
  n: number,
  guidance: string,
  model: LLMSpec,
  apiKeys?: Dict,
): Promise<string[]> {
  const templateVariables = [...new Set(new StringTemplate(prompt).get_vars())];
  const vars =
    templateVariables.length > 0
      ? ` The prompt is a template: each variant must use all of its template variables, written exactly as they are, in single braces (${templateVariables.map((v) => `{${v}}`).join(", ")}), and no others.`
      : " Don't add placeholders or template variables in braces.";
  const how = guidance.trim()
    ? ` The variants should differ in this way: ${guidance.trim()}`
    : " Make the variants meaningfully different from the original and from each other, for instance in wording, structure, length or tone.";
  const system = `You write variants of a prompt, so that people can compare how the variants perform. Each variant keeps the original's purpose and asks for the same kind of output.${how}${vars} Respond with only a JSON array of ${n} strings, each a complete prompt.`;

  const reply = await queryAI(model, prompt, { system, apiKeys });
  const variants = parseStringList(reply)
    .filter((v) => v !== prompt.trim())
    .filter((v) => containsSameTemplateVariables(prompt, v))
    .slice(0, n);
  if (variants.length === 0)
    throw new AIError(
      "The model's variants didn't keep the prompt's template variables. Please try again.",
    );
  return variants;
}

/** The output formats of an LLM Scorer, as ChainForge asks the grader for them. */
export type RubricFormat = "bin" | "cat" | "num" | "open";

const RUBRIC_FORMAT_DESCRIPTIONS: Record<RubricFormat, string> = {
  bin: "true or false",
  cat: "a single category",
  num: "a number",
  open: "a short open-ended answer",
};

const RUBRIC_FORMAT_ADVICE: Record<RubricFormat, string> = {
  bin: "Say what makes a response true, and what makes it false.",
  cat: "Name every category the grader can choose from, and when to choose each.",
  num: "Give the scale (e.g. 1 to 5), and what the ends and middle of it mean.",
  open: "Say what the grader's answer should contain.",
};

/**
 * Uses an LLM to write the rubric of an LLM Scorer. The rubric is the user's
 * part of the grader's prompt: ChainForge adds the response to grade and the
 * output format instructions around it.
 * @param request What to grade, or, with `currentRubric`, how to change the rubric.
 * @param currentRubric The rubric to edit, if editing.
 */
export async function generateRubric(
  request: string,
  format: RubricFormat,
  model: LLMSpec,
  apiKeys?: Dict,
  currentRubric?: string,
): Promise<string> {
  const system = `You write rubrics for an LLM that grades responses from other LLMs. The grader sees your rubric, then the response to grade, then an instruction to answer with ${RUBRIC_FORMAT_DESCRIPTIONS[format] ?? "an answer"}. Write the rubric as instructions addressed to the grader, briefly and concretely, in plain text: no title, headings or Markdown formatting. ${RUBRIC_FORMAT_ADVICE[format] ?? ""} Don't include the response, placeholders, or instructions about the answer's format. Respond with only the rubric.`;
  const prompt =
    currentRubric !== undefined
      ? `Here is a rubric:\n\n${currentRubric}\n\nRewrite it to make this change: ${request}`
      : `Write a rubric to grade: ${request}`;
  const reply = await queryAI(model, prompt, { system, apiKeys });

  // Drop any thinking, code fences or wrapping quotation marks
  const rubric = reply
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^\s*```[a-z]*\n?|```\s*$/g, "")
    .trim()
    .replace(/^"([\s\S]*)"$/, "$1")
    .trim();
  if (!rubric) throw new AIError(`${model.name} returned an empty rubric.`);
  return rubric;
}

/** A document, or a chunk of one, to write test questions about. */
export interface AIDocument {
  text: string;
  /** The document's name, e.g. its filename. */
  source: string;
}

// Documents longer than this are cut short before being sent to the model.
const MAX_DOCUMENT_CHARS = 8000;

/** The columns of a table of RAG test questions, as the RAG example flow names them. */
export const TEST_QUESTION_COLUMNS = [
  "question",
  "reference",
  "answer_context",
  "source_doc",
];

/**
 * Uses an LLM to write question-answer pairs grounded in documents (or their
 * chunks), for evaluating a retrieval-augmented generation pipeline. Each pair
 * comes from one document; documents are queried in parallel.
 * @param n How many pairs to write. Documents are sampled, and asked for several if there are fewer than `n`.
 * @param guidance What kind of questions to write, if the user said.
 * @returns Rows with the columns in TEST_QUESTION_COLUMNS.
 */
export async function generateTestQuestions(
  documents: AIDocument[],
  n: number,
  guidance: string,
  model: LLMSpec,
  apiKeys?: Dict,
): Promise<string[][]> {
  const docs = documents.filter((d) => d.text.trim().length > 0);
  if (docs.length === 0)
    throw new AIError("There are no documents to write questions about.");

  // Spread the questions over the documents, in random order
  const shuffled = [...docs];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const picked = shuffled.slice(0, n);
  const counts = picked.map(
    (_, i) => Math.floor(n / picked.length) + (i < n % picked.length ? 1 : 0),
  );
  const passages = picked.map((d) =>
    d.text.trim().slice(0, MAX_DOCUMENT_CHARS),
  );

  // A document with several questions gets them in one request, so they differ
  const system = `You write test questions for evaluating a retrieval-augmented generation (RAG) system. You are given a passage from a document, and how many questions to write. Write questions that a user might ask, which the passage answers, and their answers, using only facts in the passage. Each question must make sense on its own, to someone who hasn't seen the passage: don't refer to "the passage", "the text" or "the document". Questions about the same passage must ask about different facts.${guidance.trim() ? ` ${guidance.trim()}` : ""} Respond with only a JSON array of objects, each with two keys, "question" and "answer".`;
  const result = await queryAIForEach(
    model,
    "{input}",
    picked.map(
      (d, i) =>
        `Questions to write: ${counts[i]}\n\nDocument: ${d.source || "(untitled)"}\n\nPassage:\n${passages[i]}`,
    ),
    { system, apiKeys },
  );

  const { replies, errors } = result;
  if (replies.every((r) => r === undefined))
    throw new AIError(errors[0] ?? `${model.name} didn't write any questions.`);

  return replies.flatMap((reply, i) => {
    // Documents whose request failed are left out
    if (reply === undefined) return [];
    let parsed = unwrapList(parseJSONReply(reply));
    if (!Array.isArray(parsed)) parsed = [parsed];
    const rows = (parsed as Dict[])
      .map((pair) => [
        cellToString(pair?.question).trim(),
        cellToString(pair?.answer).trim(),
        passages[i],
        picked[i].source,
      ])
      .filter((row) => row[0].length > 0)
      .slice(0, counts[i]);
    if (rows.length === 0)
      throw new AIError(`The model didn't write any questions: ${reply}`);
    return rows;
  });
}
