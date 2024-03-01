import { LLM } from "./models";

/** Raised when there is an error generating a single response from an LLM */
export class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMResponseError";
  }
}

// Dictionary types
export interface Dict {
  [key: string]: any;
}
export interface TypedDict<T> {
  [key: string]: T;
}

/** OpenAI function call format */
export interface OpenAIFunctionCall {
  name: string;
  parameters: Dict;
  description?: string;
}

/** The outputs of prompt nodes, text fields or other data passed internally in the front-end and to the PromptTemplate backend.
 * Used to populate prompt templates and carry variables/metavariables along the chain. */
export interface TemplateVarInfo {
  text: string;
  fill_history: TypedDict<string>;
  metavars?: TypedDict<string>;
  associate_id?: string;
}

export interface PromptVarType {
  [key: string]: Array<string | TemplateVarInfo>;
}

/** OpenAI chat message format */
export interface ChatMessage {
  role: string;
  content: string;
  name?: string;
  function_call?: OpenAIFunctionCall;
}
export type ChatHistory = ChatMessage[];

/** Google PaLM chat message format */
export interface PaLMChatMessage {
  author: string; // usually, 0=user and 1=AI
  content: string;
}
export interface PaLMChatContext {
  messages: PaLMChatMessage[];
  context?: string;
  examples?: Dict[];
}

export interface GeminiChatMessage {
  role: string;
  parts: string;
}

export interface GeminiChatContext {
  history: GeminiChatMessage[];
}

/** HuggingFace conversation models format */
export interface HuggingFaceChatHistory {
  past_user_inputs: string[];
  generated_responses: string[];
}

// Chat history with 'carried' variable metadata
export interface ChatHistoryInfo {
  messages: ChatHistory;
  fill_history: Dict;
  metavars?: Dict;
  llm?: string;
}

export function isEqualChatHistory(
  A: ChatHistory | undefined,
  B: ChatHistory | undefined,
): boolean {
  if (A === undefined && B === undefined) return true;
  if (A === undefined || B === undefined) return false;
  if (A.length !== B.length) return false;
  if (A.length === 0) return true; // both empty
  return A.every((a, i) => {
    const b = B[i];
    return (
      a.role === b.role &&
      a.content === b.content &&
      a.name === b.name &&
      a.function_call === b.function_call
    );
  });
}

export type ResponseUID = string;

/** Standard properties that every LLM response object must have. */
export interface BaseLLMResponseObject {
  /** A unique ID to refer to this response */
  uid: ResponseUID;
  /** The concrete prompt that led to this response. */
  prompt: string;
  /** The variables fed into the prompt. */
  vars: Dict;
  /** Any associated metavariables. */
  metavars: Dict;
  /** The LLM to query (usually a dict of settings) */
  llm: string | LLMSpec;
  /** Optional: The chat history to pass the LLM */
  chat_history?: ChatHistory;
}

/** A JSON object describing an LLM response for the same prompt, with n responses (n>=1) */
export interface RawLLMResponseObject extends BaseLLMResponseObject {
  // A snapshot of the exact query (payload) sent to the LLM's API
  query: Dict;
  // The raw JSON response from the LLM
  raw_response: Dict;
  // Extracted responses (1 or more) from raw_response
  responses: string[];
  // Token lengths (if given)
  tokens?: TypedDict<number>;
}

export type EvaluationResults = {
  items: (boolean | number | string)[];
  dtype:
    | "KeyValue"
    | "KeyValue_Numeric"
    | "KeyValue_Categorical"
    | "KeyValue_Mixed"
    | "Numeric"
    | "Categorical"
    | "Mixed"
    | "Unknown"
    | "Empty";
};

/** A standard response format expected by the front-end. */
export interface StandardizedLLMResponse extends BaseLLMResponseObject {
  // Extracted responses (1 or more) from raw_response
  responses: string[];
  // Evaluation results
  eval_res?: EvaluationResults;
  // Token lengths (if given)
  tokens?: TypedDict<number>;
}

export type LLMResponsesByVarDict = TypedDict<(BaseLLMResponseObject | StandardizedLLMResponse)[]>;

/** A standard async function interface for calling an LLM. */
export interface LLMAPICall {
  (
    prompt: string,
    model: LLM,
    n: number,
    temperature: number,
    params?: Dict,
    should_cancel?: () => boolean,
  ): Promise<[Dict, Dict]>;
}

/** What LLM to call, at what settings. */
export type LLMSpec = {
  name: string;
  emoji: string;
  base_model: string;
  model: string;
  temp: number;
  key?: string;
  formData?: Dict;
  settings?: Dict;
  progress?: TypedDict<number>; // only used for front-end to display progress collecting responses for this LLM
};
