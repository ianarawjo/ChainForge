import { LLM } from "./models";

/** Raised when there is an error generating a single response from an LLM */
export class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMResponseError";
  }
}

// Dictionary types
export interface Dict<T = any> {
  [key: string]: T;
}

// Function types
export type Func<T = void> = (...args: any[]) => T;

// JSON-compatible leaf types
export type JSONLeaf = string | number | boolean | null | undefined;
export type JSONCompatible<T = JSONLeaf> =
  | T
  | JSONCompatible<T>[]
  | Dict<JSONCompatible<T>>;

/** OpenAI function call format */
export interface OpenAIFunctionCall {
  name: string;
  parameters: Dict;
  description?: string;
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
  parts: [{ text: string }];
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

export type QueryProgress = {
  success: number;
  error: number;
};

/** What LLM to call, at what settings. */
export type LLMSpec = {
  name: string;
  emoji: string;
  base_model: string;
  model: string;
  temp: number;
  key?: string;
  formData?: Dict<JSONCompatible>;
  settings?: Dict<JSONCompatible>;
  progress?: QueryProgress; // only used for front-end to display progress collecting responses for this LLM
};

export type LLMGroup = {
  group: string;
  emoji: string;
  items: LLMSpec[] | LLMGroup[];
};

/** A spec for a user-defined custom LLM provider */
export type CustomLLMProviderSpec = {
  name: string;
  emoji: string;
  models?: string[];
  rate_limit?: number | string;
  settings_schema?: {
    settings: Dict<Dict<JSONCompatible>>;
    ui: Dict<Dict<JSONCompatible>>;
  };
};

/** Internal description of model settings, passed to react-json-schema */
export interface ModelSettingsDict {
  fullName: string;
  description?: string;
  schema: {
    type: "object";
    required: string[];
    properties: Dict<Dict<JSONCompatible>>;
    description?: string;
  };
  uiSchema: Dict<JSONCompatible>;
  postprocessors: Dict<(val: string | number | boolean) => any>;
}

export type ResponseUID = string;

/** What kind of data can be each individual response from the model.
 * string is basic text; but could be images or more data types in the future.
 */
export type LLMResponseData =
  | {
      t: "img"; // type
      d: string; // payload
    }
  | string;

export function isImageResponseData(
  r: LLMResponseData,
): r is { t: "img"; d: string } {
  return typeof r === "object" && r.t === "img";
}

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
  responses: LLMResponseData[];
  // Token lengths (if given)
  tokens?: Dict<number>;
}

export type EvaluationScore =
  | boolean
  | number
  | string
  | Dict<boolean | number | string>;

export type EvaluationResults = {
  items: EvaluationScore[];
  dtype:
    | "KeyValue"
    | "KeyValue_Numeric"
    | "KeyValue_Categorical"
    | "KeyValue_Mixed"
    | "Numeric"
    | "Categorical"
    | "Mixed"
    | "Unknown"
    | "Empty"
    | "Boolean";
};

/** A standard response format expected by the front-end. */
export interface LLMResponse extends BaseLLMResponseObject {
  // Extracted responses (1 or more) from raw_response
  responses: LLMResponseData[];
  // Evaluation results
  eval_res?: EvaluationResults;
  // Token lengths (if given)
  tokens?: Dict<number>;
}

export type EvaluatedResponsesResults = {
  responses?: LLMResponse[];
  logs?: string[];
  error?: string;
};

/** The outputs of prompt nodes, text fields or other data passed internally in the front-end and to the PromptTemplate backend.
 * Used to populate prompt templates and carry variables/metavariables along the chain. */
export interface TemplateVarInfo {
  text?: string;
  image?: string; // base-64 encoding
  fill_history?: Dict<string>;
  metavars?: Dict<string>;
  associate_id?: string;
  prompt?: string;
  uid?: ResponseUID;
  llm?: string | LLMSpec;
  chat_history?: ChatHistory;
}

export type LLMResponsesByVarDict = Dict<
  (BaseLLMResponseObject | LLMResponse | TemplateVarInfo | string)[]
>;

export type VarsContext = {
  vars: string[];
  metavars: string[];
};

export type PromptVarType = string | TemplateVarInfo;
export type PromptVarsDict = {
  [key: string]: PromptVarType[];
};

export type TabularDataRowType = Dict<string>;
export type TabularDataColType = {
  key: string;
  header: string;
};

export type PythonInterpreter = "flask" | "pyodide";
