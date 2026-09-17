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
import { Dict, LLMSpec, StringOrHash } from "./typing";
import { StringLookup } from "./cache";
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

// Metavar that carries each row's index through a batched query.
const ROW_INDEX_METAVAR = "__ai_row";

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

/**
 * Queries an AI model once per input, in parallel (within the provider's rate
 * limits), returning the replies in the same order as the inputs.
 * @param template The prompt, with the literal text escaped and `{input}` where each input goes.
 */
export async function queryAIForEach(
  model: LLMSpec,
  template: string,
  inputs: string[],
  options: AIQueryOptions = {},
): Promise<string[]> {
  if (inputs.length === 0) return [];
  const result = await queryLLM(
    `__ai-${uuid()}`,
    [withSystemMessage(model, options.system)],
    1,
    template,
    {
      input: inputs.map((text, idx) => ({
        text,
        metavars: { [ROW_INDEX_METAVAR]: idx.toString() },
      })),
    },
    undefined,
    options.apiKeys,
    true,
  );

  const replies: (string | undefined)[] = inputs.map(() => undefined);
  for (const resp of result.responses) {
    // queryLLM returns strings interned, as StringLookup hashes
    const idx = Number(
      StringLookup.get(resp.metavars?.[ROW_INDEX_METAVAR] as StringOrHash),
    );
    if (Number.isInteger(idx) && resp.responses.length > 0)
      replies[idx] = llmResponseDataToString(resp.responses[0]);
  }
  if (replies.some((r) => r === undefined))
    throw new AIError(
      firstError(result.errors) ??
        `${model.name} did not respond to every request.`,
    );
  return replies as string[];
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

/** Reads a JSON array of strings from a model's reply. */
function parseStringList(reply: string): string[] {
  let parsed = parseJSONReply(reply);
  // Some models wrap the list in an object, like {"items": [...]}
  if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
    const lists = Object.values(parsed).filter(Array.isArray);
    if (lists.length === 1) parsed = lists[0];
  }
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

  const system = `You are given a list of items. Work out the pattern they follow, then write ${n} more items that follow it, without repeating any.${templateVariablesInstruction(templateVariables)} Respond with only a JSON array of ${n} strings.`;
  const reply = await queryAI(model, JSON.stringify(items, null, 2), {
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
  const system = `Write a list of exactly ${n} items for the user's request, without repeating any.${creative ? " Be unconventional." : ""} If the request asks for prompts or commands, write each item as an instruction that could be given to an AI assistant. If items need placeholders for inputs, write them as template variables in single braces, like {variable}. Respond with only a JSON array of ${n} strings.`;
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
  const sampleRows =
    input.rows.length > MAX_TABLE_ROWS_IN_PROMPT
      ? sampleRandomElements(input.rows, MAX_TABLE_ROWS_IN_PROMPT)
      : input.rows;

  const system = `You are given a table, as JSON: its column names, and its rows as arrays of cells in column order. Work out the pattern the rows follow, then write ${n} more rows that follow it, without repeating any. Respond with only a JSON array of ${n} rows, each an array of ${input.cols.length} strings.`;
  const reply = await queryAI(
    model,
    JSON.stringify({ columns: input.cols, rows: sampleRows }, null, 2),
    { system, apiKeys },
  );
  const rows = toRows(parseJSONReply(reply), input.cols).slice(0, n);
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
  const system = `Write a table for the user's request, with exactly ${n} rows. If the request asks for prompts or commands, write them as instructions that could be given to an AI assistant. If cells need placeholders for inputs, write them as template variables in single braces, like {variable}. Respond with only a JSON object with two keys: "columns", an array of short column names, and "rows", an array of ${n} rows, each an array of strings with one string per column.`;
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
 * @returns The new column's name, and its value for each row.
 */
export async function generateColumn(
  table: AITable,
  prompt: string,
  model: LLMSpec,
  apiKeys?: Dict,
): Promise<{ col: string; rows: string[] }> {
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
  const values = await queryAIForEach(
    model,
    `{input}\n${escapeBraces(prompt)}: ?`,
    inputs,
    {
      system:
        "You are given a row of a table, with its last field missing. Fill in the missing field. Respond with only its value: no explanation, quotation marks or formatting.",
      apiKeys,
    },
  );

  return { col: colName, rows: values.map((v) => v.trim()) };
}
