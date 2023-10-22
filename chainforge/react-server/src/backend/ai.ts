/**
 * Business logic for the AI-generated features.
 */

import { queryLLM } from "./backend";
import { ChatHistoryInfo } from "./typing";

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
 * Generate the system message used for autofilling.
 * @param n number of rows to generate
 */
function autofillSystemMessage(n: number): string {
  return `First, tell me what the general pattern seems to be. Second, generate exactly ${n} more rows following the pattern you guessed. Format your response as a markdown list. Do not ever repeat anything.`;
}

/**
 * Generate the system message used for generate and replace (GAR).
 */
function GARSystemMessage(n: number, creative?: boolean): string {
  return `Here is the pattern you should follow in <pattern>. Generate exactly ${n} rows following the pattern. Format your response as a markdown list. Do not ever repeat anything.${creative ? "Be unconventional with your outputs." : ""}`;
}

/**
 * Returns a string representing the given rows as a markdown list
 * @param rows to encode
 */
function encode(rows: Row[]): string {
    return rows.map(row => `- ${row}`).join('\n');
}

/**
 * Returns the rows encoded by the given string, assuming the string is in markdown list format. Throws an AIError if the string is not in markdown list format.
 * @param rows to decode
 */
function decode(rows: string): Row[] {
    let lines = rows.split('\n');
    let result: Row[] = [];
    for (let line of lines) {
        if (line.startsWith('- ')) {
            result.push(line.slice(2));
        } else {
            continue;
        }
    }
    if (result.length === 0) {
        throw new AIError("Failed to decode rows.");
    }
    return result;
}

/**
 * Uses an LLM to interpret the pattern from the given rows as return new rows following the pattern.
 * @param input rows for the autofilling system
 * @param n number of results to return
 */
export async function autofill(input: Row[], n: number): Promise<Row[]> {
  // hash the arguments to get a unique id
  let id = JSON.stringify([input, n]);

  let history: ChatHistoryInfo[] = [{
    messages: [{
      "role": "system",
      "content": autofillSystemMessage(n),
    }],
    fill_history: {},
  }]

  let encoded = encode(input);

  let result = await queryLLM(
    /*id=*/ id,
    /*llm=*/ LLM,
    /*n=*/ 1,
    /*prompt=*/ encoded,
    /*vars=*/ {},
    /*chat_history=*/ history);

  return decode(result.responses[0].responses[0])
}

/**
 * Uses an LLM to generate `n` new rows based on the pattern explained in `prompt`.
 * @param prompt 
 * @param n 
 */
export async function generateAndReplace(prompt: string, n: number, creative?: boolean): Promise<Row[]> {
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
  }]

  let input = `<pattern>${prompt}</pattern>`;

  let result = await queryLLM(
    /*id=*/ id,
    /*llm=*/ LLM,
    /*n=*/ 1,
    /*prompt=*/ input,
    /*vars=*/ {},
    /*chat_history=*/ history);

  return decode(result.responses[0].responses[0])
}