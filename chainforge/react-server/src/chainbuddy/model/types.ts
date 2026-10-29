/**
 * The contract between ChainBuddy's agent loop and whatever model drives it.
 *
 * Nothing here names a provider. Each adapter (see openaiCompatible.ts)
 * translates these types to and from one provider's API, so the loop, the
 * tools, and the chat panel never depend on a provider's message format.
 */

/** A tool call the model made. `arguments` is the raw JSON text it sent. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * A model's reasoning from one turn, kept so it can be sent back on the next
 * request. Some providers reject a tool-use conversation whose past reasoning
 * is missing or altered, so `data` is stored exactly as the provider sent it
 * and only ever sent back to that same provider.
 */
export interface ReasoningState {
  /** Which adapter produced this, e.g. "openrouter". */
  provider: string;
  /** Readable reasoning text, for display. */
  text: string;
  /** The provider's own reasoning payload, opaque to everything but its adapter. */
  data?: unknown;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
  reasoning?: ReasoningState;
}

export interface ToolResultMessage {
  role: "tool";
  toolCallId: string;
  content: string;
}

export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage;

/** A JSON Schema, as tool parameters are described to models. */
export type JsonSchema = {
  type?: "object" | "array" | "string" | "integer" | "number" | "boolean";
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number)[];
};

/** A tool as the model sees it. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ModelRequest {
  system?: string;
  messages: AgentMessage[];
  tools?: ToolSpec[];
}

/** Pieces of a response, as they stream in. */
export type ModelStreamEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  /** The model started a tool call. Its arguments are still streaming. */
  | { type: "tool_call_start"; id: string; name: string };

export type FinishReason =
  /** Finished its answer. */
  | "stop"
  /** Stopped to have tools run. */
  | "tool_calls"
  /** Hit the output token limit, so the response may be cut off. */
  | "length"
  /** Anything else the provider reported, such as a content filter. */
  | "other";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelTurn {
  message: AssistantMessage;
  finishReason: FinishReason;
  usage?: Usage;
}

export interface RespondOptions {
  onEvent?: (event: ModelStreamEvent) => void;
  signal?: AbortSignal;
}

/** One model, ready to answer a conversation. */
export interface ModelClient {
  /** Streams one assistant turn. Rejects if the request fails or is aborted. */
  respond(request: ModelRequest, options?: RespondOptions): Promise<ModelTurn>;
}

/** Thrown when a request is stopped through its AbortSignal. */
export class ModelRequestAborted extends Error {
  constructor() {
    super("The request was cancelled.");
    this.name = "ModelRequestAborted";
  }
}
