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

/** OpenAI function call format */
export interface OpenAIFunctionCall {
  name: string,
  parameters: Dict,
  description?: string,
}

/** OpenAI chat message format */
export interface ChatMessage {
  role: string,
  content: string,
  name?: string,
  function_call?: OpenAIFunctionCall,
}
export type ChatHistory = ChatMessage[];

export function isEqualChatHistory(A: ChatHistory | undefined, B: ChatHistory | undefined): boolean {
  if (A === undefined && B === undefined) return true;
  if (A === undefined || B === undefined) return false;
  if (A.length !== B.length) return false;
  if (A.length === 0) return true;  // both empty
  return A.every((a, i) => {
    const b = B[i];
    return (a.role === b.role && a.content === b.content && 
            a.name === b.name && a.function_call === b.function_call);
  });
}

/** A JSON object describing an LLM response for the same prompt, with n responses (n>=1) */
export interface LLMResponseObject {
  prompt: string;
  query: Dict;
  responses: string[];
  raw_response: Dict;
  llm: LLM;
  info: Dict;
  metavars: Dict;
  chat_history?: ChatHistory;
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