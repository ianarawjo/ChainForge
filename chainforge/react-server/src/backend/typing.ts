import { FileWithPath } from "@mantine/dropzone";
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

/** A string or a number representing the index to a hash table (`StringLookup`). */
export type StringOrHash = string | number;

export type ResponseUID = string;

/** What kind of data can be each individual response from the model.
 * string is basic text and number is a hash table index in the `StringLookup` table.
 * The object type is used for images and documents ("media") that are accessed via the `MediaLookup` table.
 * The `d` field is the unique ID in the `MediaLookup` table, NOT the raw data.
 */
export type LLMResponseData =
  | {
      t: "img" | "doc"; // type of Media
      d: string; // the unique ID in the MediaLookup table, NOT the raw data
    }
  | StringOrHash;

export function isImageResponseData(
  r: LLMResponseData,
): r is { t: "img"; d: string } {
  return typeof r === "object" && r.t === "img" && typeof r.d === "string";
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

// =================== Multimodal Chat Types ===================

/** ------ Anthropic chat message format */

export type ImageTypeAnthropic = string;
// | "image/jpeg"
// | "image/png"
// | "image/gif"
// | "image/webp";

export type ImageContentAnthropic =
  | { type: "base64"; media_type: ImageTypeAnthropic; data: string } // data: base64 encoded image
  | { type: "url"; url: string }; // url: image url

export type MultiModalContentAnthropic =
  | { type: "text"; text?: string; source?: never }
  | { type: "image"; source?: ImageContentAnthropic; text?: never };

/** ------ OpenAI chat message format */

export type ImageContentOpenAI = {
  url: string; // base64 encoded image OR image http-url
  detail?: "low" | "high" | "auto";
};

export type MultiModalContentOpenAI =
  | { type: "text"; text?: string; image_url?: never }
  | { type: "image_url"; image_url?: ImageContentOpenAI; text?: never };

/** ------ Gemini chat message format */

export type ImageContentGemini = {
  mimeType: string;
  // | "image/png"
  // | "image/jpeg"
  // | "image/webp"
  // | "image/heic"
  // | "image/heif";
  data: string; // base64 encoded image OR image http-url
};

export type MultiModalContentGemini =
  | { text: string }
  | { inlineData: ImageContentGemini };

// ===================

export interface ChatMessage {
  role: string;
  content: string;
  images?: string[]; // MediaLookup UIDs
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
  fill_history: Dict<LLMResponseData>;
  metavars?: Dict<LLMResponseData>;
  llm?: string;
  uid?: ResponseUID;
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
    images?: string[],
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

/** Standard properties that every LLM response object must have. */
export interface BaseLLMResponseObject {
  /** A unique ID to refer to this response */
  uid: ResponseUID;
  /** The concrete prompt that led to this response. */
  prompt: StringOrHash;
  /** The variables fed into the prompt. */
  vars: Dict<LLMResponseData>;
  /** Any associated metavariables. */
  metavars: Dict<LLMResponseData>;
  /** The LLM to query (usually a dict of settings) */
  llm: StringOrHash | LLMSpec;
  /** Optional: The chat history to pass the LLM */
  chat_history?: ChatHistory;
}

/** A JSON object describing an LLM response for the same prompt, with n responses (n>=1) */
export interface RawLLMResponseObject extends BaseLLMResponseObject {
  // A snapshot of the exact query (payload) sent to the LLM's API
  // DEPRECATED: This is now deprecated since it wastes precious storage space.
  // query: Dict;
  // The raw JSON response from the LLM
  // NOTE: This is now deprecated since it wastes precious storage space.
  // raw_response: Dict;
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
  text?: StringOrHash;
  image?: string; // MediaLookup UID or a base64 image (NOTE: It may currently only use the UID.)
  fill_history?: Dict<LLMResponseData>;
  metavars?: Dict<LLMResponseData>;
  associate_id?: StringOrHash;
  prompt?: StringOrHash;
  uid?: ResponseUID;
  llm?: StringOrHash | LLMSpec;
  chat_history?: ChatHistory;
}

export type LLMResponsesByVarDict = Dict<
  (BaseLLMResponseObject | LLMResponse | TemplateVarInfo | StringOrHash)[]
>;

export type VarsContext = {
  vars: string[];
  metavars: string[];
};

export type PromptVarType = LLMResponseData | TemplateVarInfo;
export type PromptVarsDict = {
  [key: string]: PromptVarType[] | LLMResponseData;
};

export type TabularDataRowType = Dict<StringOrHash>;
export type TabularDataColType = {
  key: string;
  header: string;
};

export type PythonInterpreter = "flask" | "pyodide";

export type RatingDict = Record<number, boolean | string | null | undefined>;

export interface FileWithContent extends FileWithPath {
  content?: string;
}
