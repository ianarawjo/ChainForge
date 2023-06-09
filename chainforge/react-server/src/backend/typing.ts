import { LLM } from "./models"; 

/** Raised when there is an error generating a single response from an LLM */
export class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMResponseError";
  }
}

export interface Dict { [key: string]: any };
export interface StringDict { [key: string]: string };

/** A JSON object describing an LLM response for the same prompt, with n responses (n>=1) */
export interface LLMResponseObject {
  prompt: string;
  query: Dict;
  responses: string[];
  raw_response: Dict;
  llm: LLM;
  info: Dict;
  metavars: Dict;
}

/** A standard async function interface for calling an LLM. */
export interface LLMAPICall {
  (prompt: string, 
   model: LLM,
   n: number,
   temperature: number,
   params?: Dict): Promise<[Dict, Dict]>
}

/** A standard response format expected by the front-end. */
export interface StandardizedLLMResponse {
  llm: string | Dict,
  prompt: string,
  responses: Array<string>,
  vars: Dict,
  metavars: Dict,
  tokens: Dict,
  eval_res?: Dict,
}