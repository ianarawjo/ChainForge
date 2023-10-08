/**
 * Business logic for the AI-generated autofill feature.
 */

import { queryLLM } from "./backend";
import { ChatHistoryInfo } from "./typing";

// Input and outputs of autofill are both rows of strings.
export type Row = string;

// LLM to use for autofilling.
const LLM = "gpt-3.5-turbo";

/**
 * Generate the system message used for autofilling.
 * @param n number of rows to generate
 */
function systemMessage(n: number): string {
  return `Pretend you are an autofill system helping to fill out a spreadsheet column. Here are the first few rows of that column in XML, with each row marked with the tag <row>. First, tell me what the general pattern seems to be. Put your guess in a <guess> tag. Second, generate exactly ${n} more rows following the pattern you guessed. Format your response in XML using the <row> and <rows> tag. Do not ever repeat anything. Here is an example of the structure that your response should follow:

  <guess>your guess goes here</guess>
  <rows>
    <row>first row</row>
    <row>second row</row>
    <row>third row</row>
    <row>fourth row</row>
    <row>fifth row</row>
  </rows>`;
}

/**
 * Returns an XML string representing the given rows using the <rows> and <row> tags. 
 * @param rows to encode
 */
function encode(rows: Row[]): string {
    let xml = '<rows>';
    for (let row of rows) {
        xml += `<row>${row}</row>`
    }
    xml += '</rows>';
    return xml;
}

/**
 * Returns the rows represented by the given XML string using the <rows> and <row> tags.
 * @param rows to decode
 */
function decode(rows: string): Row[] {
    const xml = new DOMParser().parseFromString(
      `<wrapper>${rows}</wrapper>`,
      'text/xml');
    const rowElements = xml.getElementsByTagName('row');
    const result: Row[] = [];
    for (let i = 0; i < rowElements.length; i++) {
        result.push(rowElements[i].textContent);
    }
    return result;
}

/**
 * Uses an LLM to interpret the pattern from the given rows as return new rows following the pattern.
 * @param input rows for the autofilling system
 * @param n number of results to return
 */
export async function autofill(input: Row[], n: number): Promise<Row[]> {
  // TODO, use an id
  let id = "id";

  let history: ChatHistoryInfo[] = [{
    messages: [{
      "role": "system",
      "content": systemMessage(n),
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