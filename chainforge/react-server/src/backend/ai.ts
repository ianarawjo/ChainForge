/**
 * Business logic for the AI-generated features.
 */
import { ConsoleView } from "react-device-detect";
import { queryLLM } from "./backend";
import { StringTemplate, escapeBraces, containsSameTemplateVariables } from "./template";
import { ChatHistoryInfo, Dict } from "./typing";
import { fromMarkdown } from "mdast-util-from-markdown";

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

// Input and outputs of autofill are both rows of strings.
export type Row = string;

// LLM to use for AI features.
const LLM = "gpt-3.5-turbo";

/**
 * Flattens markdown AST to text
 */
function compileTextFromMdAST(md: Dict): string {
  if (md?.type === "text")
    return md.value ?? "";
  else if (md?.children?.length > 0)
    return md.children.map(compileTextFromMdAST).join("\n");
  return "";
}

/**
 * Removes trailing quotation marks
 */
function trimQuotationMarks(s: string): string {
  if (s.length <= 1) return s;
  const [c0, c1] = [s.charAt(0), s.charAt(s.length-1)];
  if ((c0 === '"' && c1 === '"') || (c0 === "'" && c1 === "'"))
    return s.slice(1, s.length-1);
  return s;
}

/** 
 * Converts any double-brace variables like {{this}} to single-braces, like {this}
 */
function convertDoubleToSingleBraces(s: string): string {
  // Use a regular expression to find all double-brace template variables
  const regex = /{{(.*?)}}/g;
  
  // Replace each double-brace variable with single braces
  return s.replace(regex, '{$1}');
}

/**
 * A message to instruct the LLM to handle template variables properly, mentioning the given variables.
 */
function templateVariableMessage(vars: string[]): string {
  const stringed = vars.map(v => `{${v}}`).join(", ") ?? "";
  const varMessage = vars.length > 0 ? `Each item must use all of these variables: ${stringed}` : "";
  return `Your output is a template in Jinja format, with single braces {} around the masked variables. ${varMessage}`;
}

/**
 * Generate the system message used for autofilling.
 * @param n number of rows to generate
 */
function autofillSystemMessage(n: number, templateVariables?: string[]): string {
  return `Here is a list of commands or items. Say what the pattern seems to be in a single sentence. Then, generate ${n} more commands or items following the pattern, as an unordered markdown list. ${templateVariables && templateVariables.length > 0 ? templateVariableMessage(templateVariables) : ""}`;
}

/**
 * Generate the system message used for generate and replace (GAR).
 */
function GARSystemMessage(n: number, creative?: boolean, generatePrompts?: boolean): string {
  return `Generate a list of exactly ${n} items. Format your response as an unordered markdown list using "-". Do not ever repeat anything.${creative ? "Be unconventional with your outputs." : ""} ${generatePrompts ? "Your outputs should be commands that can be given to an AI chat assistant." : ""} If the user has specified items or inputs to their command, generate a template in Jinja format, with single braces {} around the masked variables.`;
}

/**
 * Returns a string representing the given rows as a markdown list
 * @param rows to encode
 */
function encode(rows: Row[]): string {
  return escapeBraces(rows.map(row => `- ${row}`).join('\n'));
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

  if (md?.children.length > 0 && md.children.some(c => c.type === 'list')) {
    // Find the first list that appears in the markdown text, if any
    const md_list = md.children.filter(c => c.type === 'list')[0];

    // Extract and iterate over the list items, converting them to text 
    const md_list_items = "children" in md_list ? md_list.children : [];
    for (const item of md_list_items) {
      const text = trimQuotationMarks(
                      compileTextFromMdAST(item).trim());
      if (text && text.length > 0)
        result.push(text);
    }
  }

  if (result.length === 0)
    throw new AIError(`Failed to decode output: ${mdText}`);

  // Convert any double-brace template variables to single-braces:
  result = result.map(convertDoubleToSingleBraces);
  
  return result;
}

/**
 * Uses an LLM to interpret the pattern from the given rows as return new rows following the pattern.
 * @param input rows for the autofilling system
 * @param n number of results to return
 */
export async function autofill(input: Row[], n: number, apiKeys?: Dict): Promise<Row[]> {
  // hash the arguments to get a unique id
  let id = JSON.stringify([input, n]);

  let encoded = encode(input);

  let templateVariables = [...new Set(new StringTemplate(input.join('\n')).get_vars())];

  console.log("System message: ", autofillSystemMessage(n, templateVariables));

  let history: ChatHistoryInfo[] = [{
    messages: [{
      "role": "system",
      "content": autofillSystemMessage(n, templateVariables)
    }],
    fill_history: {},
  }];

  let result = await queryLLM(
    /*id=*/ id,
    /*llm=*/ LLM,
    /*n=*/ 1,
    /*prompt=*/ encoded,
    /*vars=*/ {},
    /*chat_history=*/ history,
    /*api_keys=*/ apiKeys,
    /*no_cache=*/ true);
  
  if (result.errors && Object.keys(result.errors).length > 0) 
    throw new Error(Object.values(result.errors)[0].toString());

  const output = result.responses[0].responses[0];

  console.log("LLM said: ", output);

  if (!containsSameTemplateVariables(input.join('\n'), output))
    throw new AIError(`Generated output does not use template variables properly with respect to the input. Output: ${output}`);

  const new_items = decode(output);
  return new_items.slice(0, n);
}

/**
 * Uses an LLM to generate `n` new rows based on the pattern explained in `prompt`.
 * @param prompt 
 * @param n 
 * @param templateVariables list of template variables to use
 */
export async function generateAndReplace(prompt: string, n: number, creative?: boolean, apiKeys?: Dict): Promise<Row[]> {
  // hash the arguments to get a unique id
  let id = JSON.stringify([prompt, n]);

  // True if `prompt` contains the word 'prompt'
  let generatePrompts = prompt.toLowerCase().includes('prompt');

  let history: ChatHistoryInfo[] = [{
    messages: [{
      "role": "system",
      "content": GARSystemMessage(n, creative, generatePrompts),
    }],
    fill_history: {},
  }];

  let input = `Generate a list of ${escapeBraces(prompt)}`;

  const result = await queryLLM(
    /*id=*/ id,
    /*llm=*/ LLM,
    /*n=*/ 1,
    /*prompt=*/ input,
    /*vars=*/ {},
    /*chat_history=*/ history,
    /*api_keys=*/ apiKeys,
    /*no_cache=*/ true);
  
  if (result.errors && Object.keys(result.errors).length > 0) 
    throw new Error(Object.values(result.errors)[0].toString());

  console.log("LLM said: ", result.responses[0].responses[0]);

  const new_items = decode(result.responses[0].responses[0]);
  return new_items.slice(0, n);
}