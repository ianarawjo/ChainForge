/**
 * Business logic for the AI-generated features.
 */
import { queryLLM } from "./backend";
import {
  StringTemplate,
  escapeBraces,
  containsSameTemplateVariables,
} from "./template";
import { ChatHistoryInfo, Dict, TabularDataColType } from "./typing";
import { fromMarkdown } from "mdast-util-from-markdown";
import { llmResponseDataToString, sampleRandomElements } from "./utils";

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

// Input and outputs of autofill are both rows of strings.
export type Row = string;

// The list of LLMs models that can be used with AI features
const AIFeaturesLLMs = [
  {
    provider: "OpenAI",
    small: { value: "gpt-4o", label: "OpenAI GPT4o" },
    large: { value: "gpt-4", label: "OpenAI GPT4" },
  },
  {
    provider: "Bedrock",
    small: {
      value: "anthropic.claude-3-haiku-20240307-v1:0",
      label: "Claude 3 Haiku",
    },
    large: {
      value: "anthropic.claude-3-sonnet-20240229-v1:0",
      label: "Claude 3 Sonnet",
    },
  },
];

export function getAIFeaturesModelProviders() {
  return AIFeaturesLLMs.map((m) => m.provider);
}

export function getAIFeaturesModels(provider: string): {
  small: string;
  large: string;
} {
  const model =
    AIFeaturesLLMs.find((m) => m.provider === provider) ?? AIFeaturesLLMs[0];
  return {
    small: model.small.value,
    large: model.large.value,
  };
}

/**
 * Flattens markdown AST to text
 */
function compileTextFromMdAST(md: Dict): string {
  if (md?.type === "text") return md.value ?? "";
  else if (md?.children?.length > 0)
    return md.children.map(compileTextFromMdAST).join("\n");
  return "";
}

/**
 * Removes trailing quotation marks
 */
function trimQuotationMarks(s: string): string {
  if (s.length <= 1) return s;
  const [c0, c1] = [s.charAt(0), s.charAt(s.length - 1)];
  if ((c0 === '"' && c1 === '"') || (c0 === "'" && c1 === "'"))
    return s.slice(1, s.length - 1);
  return s;
}

/**
 * Converts any double-brace variables like {{this}} to single-braces, like {this}
 */
function convertDoubleToSingleBraces(s: string): string {
  // Use a regular expression to find all double-brace template variables
  const regex = /{{(.*?)}}/g;

  // Replace each double-brace variable with single braces
  return s.replace(regex, "{$1}");
}

/**
 * A message to instruct the LLM to handle template variables properly, mentioning the given variables.
 */
function templateVariableMessage(vars: string[]): string {
  const stringed = vars.map((v) => `{${v}}`).join(", ") ?? "";
  const varMessage =
    vars.length > 0
      ? `Each item must use all of these variables: ${stringed}`
      : "";
  return `Your output is a template in Jinja format, with single braces {} around the masked variables. ${varMessage}`;
}

/**
 * Generate the system message used for autofilling.
 * @param n number of rows to generate
 */
function autofillSystemMessage(
  n: number,
  templateVariables?: string[],
): string {
  return `Here is a list of commands or items. Say what the pattern seems to be in a single sentence. Then, generate ${n} more commands or items following the pattern, as an unordered markdown list. ${templateVariables && templateVariables.length > 0 ? templateVariableMessage(templateVariables) : ""}`;
}

/**
 * Generate the system message used for autofillingTables.
 * @param n number of rows to generate
 * @param templateVariables list of template variables to use
 */
function autofillTableSystemMessage(n: number): string {
  return `Here is a table. Generate ${n} more commands or items following the pattern. You must format your response as a markdown table with labeled columns and a divider with only the next ${n} generated commands or items of the table.`;
}

/**
 * Generate the system message used for generate column.
 * @param templateVariables list of template variables to use
 * @param prompt description or pattern for the column content
 */
function generateColumnSystemMessage(): string {
  return `You are a helpful assistant. Given partial row data and a prompt for a missing field, produce only the new field's value. No extra formatting or explanations, just the value itself.`;
}

/**
 * Generate the system message used for generate and replace (GAR).
 */
function GARSystemMessage(
  n: number,
  creative?: boolean,
  generatePrompts?: boolean,
): string {
  return `Generate a list of exactly ${n} items. Format your response as an unordered markdown list using "-". Do not ever repeat anything.${creative ? "Be unconventional with your outputs." : ""} ${generatePrompts ? "Your outputs should be commands that can be given to an AI chat assistant." : ""} If the user has specified items or inputs to their command, generate a template in Jinja format, with single braces {} around the masked variables.`;
}

/**
 * Generate the system message used for generate and replace table (GART).
 * @param n number of rows to generate
 * @param creative whether the output should be diverse
 * @param generatePrompts whether the output should be commands
 * @returns the system message
 */
function GARTSystemMessage(n: number, generatePrompts?: boolean): string {
  return `Generate a table with exactly ${n} rows. Format your response as a markdown table using. Do not ever repeat anything. ${generatePrompts ? "Your outputs should be commands that can be given to an AI chat assistant." : ""} If the user has specified items or inputs to their command, generate a template in Jinja format, with single braces {} around the masked variables.`;
}

/**
 * Returns a string representing the given rows as a markdown list
 * @param rows to encode
 */
function encode(rows: Row[]): string {
  return escapeBraces(rows.map((row) => `- ${row}`).join("\n"));
}

/**
 * Returns a string representing the given rows and columns as a markdown table
 * @param cols to encode as headers
 * @param rows to encode as table rows
 * @returns a string representing the table in markdown format
 */
function encodeTable(cols: string[], rows: Row[]): string {
  const header = `| ${cols.join(" | ")} |`;
  const divider = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row} |`).join("\n");
  return escapeBraces(`${header}\n${divider}\n${body}`);
}

/**
 * Returns a list of items that appears in the given markdown text. Throws an AIError if the string is not in markdown list format.
 * @param mdText raw text to decode (in markdown format)
 * @param templateVariables to check for
 */
function decode(mdText: string): Row[] {
  let result: Row[] = [];

  // Parse string as markdown
  const md = fromMarkdown(mdText);

  if (md?.children.length > 0 && md.children.some((c) => c.type === "list")) {
    // Find the first list that appears in the markdown text, if any
    const md_list = md.children.filter((c) => c.type === "list")[0];

    // Extract and iterate over the list items, converting them to text
    const md_list_items = "children" in md_list ? md_list.children : [];
    for (const item of md_list_items) {
      const text = trimQuotationMarks(compileTextFromMdAST(item).trim());
      if (text && text.length > 0) result.push(text);
    }
  }

  if (result.length === 0)
    throw new AIError(`Failed to decode output: ${mdText}`);

  // Convert any double-brace template variables to single-braces:
  result = result.map(convertDoubleToSingleBraces);

  return result;
}

/**
 * Returns an object containing the columns and rows of the table decoded from the given markdown text. Throws an AIError if the string is not in "markdown table format".
 * @param mdText markdown text to decode
 * @returns an object containing the columns and rows of the table
 */
function decodeTable(mdText: string): { cols: string[]; rows: Row[] } {
  // Remove code block markers and trim the text
  const mdTextCleaned = mdText
    .replace(/```markdown/g, "")
    .replace(/```/g, "")
    .trim();

  // Split into lines and clean up whitespace
  const lines = mdTextCleaned.split("\n").map((line) => line.trim());

  // If lines have less than 1 line, throw an error
  if (lines.length < 1) {
    throw new AIError(`Invalid table format: ${mdText}`);
  }

  let cols: string[];
  let dataLines: string[];

  // Check if a proper header exists
  if (/^(\|\s*-+\s*)+\|$/.test(lines[1])) {
    // If valid header and divider exist
    cols = lines[0]
      .split("|")
      .map((col) => col.trim())
      .filter((col) => col.length > 0);
    dataLines = lines.slice(2); // Skip header and divider lines
  } else {
    // If no valid header/divider, generate default column names
    const firstRowCells = lines[0]
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    // Generate default column names (col_1, col_2, ...)
    cols = firstRowCells.map((_, idx) => `col_${idx + 1}`);
    dataLines = lines; // Treat all lines as data rows
  }

  // Parse the rows
  const rows = lines.slice(2).map((line) => {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .slice(1, -1); // Remove leading/trailing "|" splits
    if (cells.length !== cols.length) {
      throw new AIError(`Row column mismatch: ${line}`);
    }
    return cells.join(" | ");
  });

  // Validate the parsed content
  if (cols.length === 0 || rows.length === 0) {
    throw new AIError(`Failed to decode output: ${mdText}`);
  }

  return { cols, rows };
}

/**
 * Uses an LLM to interpret the pattern from the given rows as return new rows following the pattern.
 * @param input rows for the autofilling system
 * @param n number of results to return
 */
export async function autofill(
  input: Row[],
  n: number,
  provider: string,
  apiKeys?: Dict,
): Promise<Row[]> {
  // hash the arguments to get a unique id
  const id = JSON.stringify([input, n]);
  const encoded = encode(input);
  const templateVariables = [
    ...new Set(new StringTemplate(input.join("\n")).get_vars()),
  ];

  console.log("System message: ", autofillSystemMessage(n, templateVariables));

  const history: ChatHistoryInfo[] = [
    {
      messages: [
        {
          role: "system",
          content: autofillSystemMessage(n, templateVariables),
        },
      ],
      fill_history: {},
    },
  ];

  const result = await queryLLM(
    /* id= */ id,
    /* llm= */ getAIFeaturesModels(provider).small,
    /* n= */ 1,
    /* prompt= */ encoded,
    /* vars= */ {},
    /* chat_history= */ history,
    /* api_keys= */ apiKeys,
    /* no_cache= */ true,
  );

  if (result.errors && Object.keys(result.errors).length > 0)
    throw new Error(Object.values(result.errors)[0].toString());

  const output = llmResponseDataToString(result.responses[0].responses[0]);

  console.log("LLM said: ", output);

  if (!containsSameTemplateVariables(input.join("\n"), output))
    throw new AIError(
      `Generated output does not use template variables properly with respect to the input. Output: ${output}`,
    );

  const new_items = decode(output);
  return new_items.slice(0, n);
}

/**
 * Uses an LLM to interpret the pattern from the given table (columns and rows) and generate new rows following the pattern.
 * @param input Object containing the columns and rows of the input table.
 * @param n Number of new rows to generate.
 * @param provider The LLM provider to use.
 * @param apiKeys API keys required for the LLM query.
 * @returns A promise resolving to an object containing updated columns and rows.
 */
export async function autofillTable(
  input: { cols: string[]; rows: Row[] },
  n: number,
  provider: string,
  apiKeys: Dict,
): Promise<{ cols: string[]; rows: Row[] }> {
  // Get a random sample of the table rows, if there are more than 30 (as an estimate):
  // TODO: This is a temporary solution to avoid sending large tables to the LLM. In future, check the number of characters too.
  const sampleRows =
    input.rows.length > 30 ? sampleRandomElements(input.rows, 30) : input.rows;

  // Hash the arguments to get a unique id
  const id = JSON.stringify([input.cols, sampleRows, n]);

  // Encode the input table to a markdown table
  const encoded = encodeTable(input.cols, sampleRows);

  const history: ChatHistoryInfo[] = [
    {
      messages: [
        {
          role: "system",
          content: autofillTableSystemMessage(n),
        },
      ],
      fill_history: {},
    },
  ];

  try {
    // Query the LLM
    const result = await queryLLM(
      id,
      getAIFeaturesModels(provider).small,
      1,
      encoded,
      {},
      history,
      apiKeys,
      true,
    );

    if (result.errors && Object.keys(result.errors).length > 0)
      throw new Error(Object.values(result.errors)[0].toString());

    // Extract the output from the LLM response
    const output = llmResponseDataToString(result.responses[0].responses[0]);
    console.log("LLM said: ", output);
    const newRows = decodeTable(output).rows;

    // Return the updated table with "n" number of rows
    return {
      cols: input.cols,
      rows: newRows, // Return the new rows generated by the LLM
    };
  } catch (error) {
    console.error("Error in autofillTable:", error);
    throw new AIError(
      `Failed to autofill table. Details: ${(error as Error).message || error}`,
    );
  }
}

// Queries the model for a single row’s missing field:
async function fillMissingFieldForRow(
  existingRowData: Record<string, string>, // Key-value pairs for the row
  prompt: string, // The user prompt describing what the missing field should be
  provider: string,
  apiKeys: Dict,
): Promise<string> {
  // Generate a user prompt for the LLM pass over existing row data in list format
  //   const userPrompt = `You are given partial data for a row of a table. Here is the data:
  // ${Object.entries(existingRowData)
  //   .map(([key, val]) => `- ${key}: ${val}`)
  //   .join("\n")}

  // This is the requirement of the new column: "${prompt}". Produce an appropriate value for the item. Respond with just the new field's value, and nothing else.`;

  const userPrompt = `Fill in the last piece of information. Respond with just the missing information, nothing else.
${Object.entries(existingRowData)
  .map(([key, val]) => `${key}: ${val}`)
  .join("\n")}
${prompt}: ?`;

  const history: ChatHistoryInfo[] = [
    {
      messages: [
        {
          role: "system",
          content: generateColumnSystemMessage(),
        },
      ],
      fill_history: {},
    },
  ];

  const id = JSON.stringify([existingRowData, prompt]);

  const result = await queryLLM(
    id,
    getAIFeaturesModels(provider).small,
    1,
    userPrompt,
    {},
    history,
    apiKeys,
    true,
  );

  console.log(
    "LLM said: ",
    llmResponseDataToString(result.responses[0].responses[0]),
  );

  // Handle any errors in the response
  if (result.errors && Object.keys(result.errors).length > 0) {
    throw new AIError(Object.values(result.errors)[0].toString());
  }

  const output = llmResponseDataToString(result.responses[0].responses[0]);
  return output.trim();
}

/**
 * Uses an LLM to generate one new column with data based on the pattern explained in `prompt`.
 * @param prompt Description or pattern for the column content.
 * @param provider The LLM provider to use (e.g., OpenAI, Bedrock).
 * @param apiKeys API keys required for the LLM query.
 * @returns A promise resolving to an array of strings (column values).
 */
export async function generateColumn(
  tableData: { cols: TabularDataColType[]; rows: string[] },
  prompt: string,
  provider: string,
  apiKeys: Dict,
): Promise<{ col: string; rows: string[] }> {
  // If the length of the prompt is less than 20 characters, use the prompt
  // Else, use the LLM to generate an appropriate column name for the prompt
  let colName: string;
  if (prompt.length <= 20) {
    colName = prompt;
  } else {
    const result = await queryLLM(
      JSON.stringify([prompt]),
      getAIFeaturesModels(provider).small,
      1,
      `You produce column names for a table. The column names must be short, less than 20 characters, and in natural language, like "Column Name." Return only the column name. Generate an appropriate column name for the prompt: "${prompt}"`,
      {},
      [],
      apiKeys,
      true,
    );
    colName = llmResponseDataToString(result.responses[0].responses[0]).replace(
      "_",
      " ",
    );
  }

  // Remove any leading/trailing whitespace from the column name as well as any double quotes
  colName = colName.trim().replace(/"/g, "");

  // Parse the existing table into mark down row objects
  const columnNames = tableData.cols.map((col) => col.header);
  const parsedRows = tableData.rows.map((rowStr) => {
    // Remove leading/trailing "|" along with any whitespace
    const cells = rowStr
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    const rowData: Record<string, string> = {};
    columnNames.forEach((colName, index) => {
      rowData[colName] = cells[index] || "";
    });
    return rowData;
  });

  const newColumnValues: string[] = [];

  for (const rowData of parsedRows) {
    // For each row, we request a new field from the LLM:
    const newValue = await fillMissingFieldForRow(
      rowData,
      prompt,
      provider,
      apiKeys,
    );
    newColumnValues.push(newValue);
  }

  // Return the new column name and values
  return {
    col: colName,
    rows: newColumnValues,
  };
}

/**
 * Uses an LLM to generate `n` new rows based on the pattern explained in `prompt`.
 * @param prompt
 * @param n
 * @param templateVariables list of template variables to use
 */
export async function generateAndReplace(
  prompt: string,
  n: number,
  creative: boolean,
  provider: string,
  apiKeys: Dict,
): Promise<Row[]> {
  // hash the arguments to get a unique id
  const id = JSON.stringify([prompt, n]);

  // True if `prompt` contains the word 'prompt'
  const generatePrompts = prompt.toLowerCase().includes("prompt");

  const history: ChatHistoryInfo[] = [
    {
      messages: [
        {
          role: "system",
          content: GARSystemMessage(n, creative, generatePrompts),
        },
      ],
      fill_history: {},
    },
  ];

  const input = `Generate a list of ${escapeBraces(prompt)}`;

  const result = await queryLLM(
    /* id= */ id,
    /* llm= */ getAIFeaturesModels(provider).small,
    /* n= */ 1,
    /* prompt= */ input,
    /* vars= */ {},
    /* chat_history= */ history,
    /* api_keys= */ apiKeys,
    /* no_cache= */ true,
  );

  if (result.errors && Object.keys(result.errors).length > 0)
    throw new Error(Object.values(result.errors)[0].toString());

  const resp = llmResponseDataToString(result.responses[0].responses[0]);
  console.log("LLM said: ", resp);

  const new_items = decode(resp);
  return new_items.slice(0, n);
}

/**
 * Uses an LLM to generate a table with `n` rows based on the pattern explained in `prompt`.
 * @param prompt Description or pattern for the table content.
 * @param n Number of rows to generate.
 * @param provider The LLM provider to use.
 * @param apiKeys API keys required for the LLM query.
 * @returns A promise resolving to an object containing the columns and rows of the generated table.
 */
export async function generateAndReplaceTable(
  prompt: string,
  n: number,
  provider: string,
  apiKeys: Dict,
): Promise<{ cols: string[]; rows: Row[] }> {
  // Hash the arguments to get a unique id
  const id = JSON.stringify([prompt, n]);

  // Determine if the prompt includes the word "prompt"
  const generatePrompts = prompt.toLowerCase().includes("prompt");

  const history: ChatHistoryInfo[] = [
    {
      messages: [
        {
          role: "system",
          content: GARTSystemMessage(n, generatePrompts),
        },
      ],
      fill_history: {},
    },
  ];

  const input = `Generate a table with data of ${escapeBraces(prompt)}`;

  try {
    // Query the LLM
    const result = await queryLLM(
      id,
      getAIFeaturesModels(provider).small,
      1,
      input,
      {},
      history,
      apiKeys,
      true,
    );

    if (result.errors && Object.keys(result.errors).length > 0)
      throw new Error(Object.values(result.errors)[0].toString());

    console.log("LLM result: ", result);
    console.log(
      "LLM said: ",
      llmResponseDataToString(result.responses[0].responses[0]),
    );

    const { cols: new_cols, rows: new_rows } = decodeTable(
      llmResponseDataToString(result.responses[0].responses[0]),
    );

    // Return the generated table with "n" number of rows
    return {
      cols: new_cols,
      rows: new_rows.slice(0, n),
    };
  } catch (error) {
    console.error("Error in generateAndReplaceTable:", error);
    throw new AIError(
      `Failed to generate and replace table. Details: ${(error as Error).message || error}`,
    );
  }
}
