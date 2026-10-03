/**
 * A ModelClient for providers that speak OpenAI's Chat Completions API, with
 * streaming and tool calls. Supports OpenRouter and Ollama.
 *
 * Providers differ in small ways even on this shared API: where reasoning
 * streams, whether it must be sent back, which headers are allowed. Those
 * differences live in the PROFILES below, not in the streaming logic.
 */

import OpenAI from "openai";
import {
  AgentMessage,
  FinishReason,
  ModelClient,
  ModelRequest,
  ModelRequestAborted,
  ModelTurn,
  ReasoningState,
  RespondOptions,
  ToolCall,
  Usage,
} from "./types";

export type OpenAICompatibleProvider = "openrouter" | "ollama";

export interface OpenAICompatibleConfig {
  provider: OpenAICompatibleProvider;
  /** The provider's model ID, e.g. "anthropic/claude-haiku-4.5" or "qwen3.5:4b". */
  model: string;
  /** Required for OpenRouter; ignored by Ollama. */
  apiKey?: string;
  /** Overrides the provider's default address, e.g. a remote Ollama server. */
  baseURL?: string;
  /** Output token limit per turn, so a looping model can't run forever. */
  maxTokens?: number;
  /** OpenRouter only: how hard reasoning models think. */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  /** For tests: replaces the global fetch. */
  fetch?: typeof fetch;
}

const DEFAULT_MAX_TOKENS = 8192;

interface Profile {
  baseURL: string;
  headers?: Record<string, string>;
  /** Extra request body fields. */
  body(config: OpenAICompatibleConfig): Record<string, unknown>;
  /** The reasoning to send back on an assistant message, if this provider needs it. */
  reasoningFields(state: ReasoningState): Record<string, unknown> | undefined;
}

const PROFILES: Record<OpenAICompatibleProvider, Profile> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      // Optional attribution, matching ChainForge's other OpenRouter calls.
      "HTTP-Referer": "https://chainforge.ai",
      "X-OpenRouter-Title": "ChainForge",
    },
    body: (config) =>
      config.reasoningEffort
        ? { reasoning: { effort: config.reasoningEffort } }
        : {},
    // OpenRouter asks for reasoning_details back unmodified, so models like
    // Claude and Gemini can continue a tool-use conversation.
    // See https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
    reasoningFields: (state) => {
      const details = sendableReasoningDetails(state.data);
      return details.length > 0 ? { reasoning_details: details } : undefined;
    },
  },
  ollama: {
    baseURL: "http://localhost:11434/v1",
    body: () => ({}),
    // Ollama's models don't need their past reasoning to continue.
    reasoningFields: () => undefined,
  },
};

/** One entry of OpenRouter's reasoning_details. */
interface ReasoningDetail {
  type?: string;
  text?: string;
  summary?: string;
  signature?: string | null;
  format?: string | null;
  [key: string]: unknown;
}

/** The parts of a streamed Chat Completions chunk this adapter reads. */
interface CompatChunk {
  choices?: {
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_details?: ReasoningDetail[];
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
    error?: { message?: string };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  error?: { message?: string };
}

export function createOpenAICompatibleClient(
  config: OpenAICompatibleConfig,
): ModelClient {
  const profile = PROFILES[config.provider];
  if (config.provider === "openrouter" && !config.apiKey)
    throw new Error("OpenRouter needs an API key. Add one in Settings.");

  const sdk = new OpenAI({
    // The SDK refuses an empty key, and Ollama doesn't check it.
    apiKey: config.apiKey || "ollama",
    baseURL: config.baseURL ?? profile.baseURL,
    defaultHeaders: profile.headers,
    dangerouslyAllowBrowser: true,
    fetch: config.fetch,
  });

  return {
    async respond(
      request: ModelRequest,
      options: RespondOptions = {},
    ): Promise<ModelTurn> {
      const { onEvent, signal } = options;
      const body = {
        model: config.model,
        messages: toCompatMessages(request, config.provider, profile),
        ...(request.tools && request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                type: "function",
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              })),
            }
          : {}),
        max_tokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
        ...profile.body(config),
      };

      let content = "";
      let reasoningText = "";
      const reasoningDetails: ReasoningDetail[] = [];
      const calls: ToolCall[] = [];
      let finish: string | null | undefined;
      let usage: Usage | undefined;

      try {
        // The body carries provider fields the SDK's types don't know about.
        const stream = (await sdk.chat.completions.create(
          body as unknown as OpenAI.Chat.ChatCompletionCreateParamsStreaming,
          { signal },
        )) as unknown as AsyncIterable<CompatChunk>;

        for await (const chunk of stream) {
          // OpenRouter reports failures partway through a stream this way.
          const error = chunk.error ?? chunk.choices?.[0]?.error;
          if (error) throw new Error(error.message ?? "The model failed.");

          if (chunk.usage)
            usage = {
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
            };

          const choice = chunk.choices?.[0];
          if (!choice) continue;
          if (choice.finish_reason) finish = choice.finish_reason;
          const delta = choice.delta ?? {};

          // OpenRouter sends reasoning both as text and as details; read the
          // details when present, so it isn't shown twice.
          if (delta.reasoning_details && delta.reasoning_details.length > 0) {
            for (const detail of delta.reasoning_details) {
              mergeReasoningDetail(reasoningDetails, detail);
              const piece = detail.text ?? detail.summary;
              if (piece) {
                reasoningText += piece;
                onEvent?.({ type: "reasoning", delta: piece });
              }
            }
          } else if (delta.reasoning) {
            reasoningText += delta.reasoning;
            onEvent?.({ type: "reasoning", delta: delta.reasoning });
          }

          if (delta.content) {
            content += delta.content;
            onEvent?.({ type: "text", delta: delta.content });
          }

          for (const part of delta.tool_calls ?? []) {
            // Arguments arrive in pieces, tied together by index. Ollama sends
            // each call whole; a missing index means a new call when it has an id.
            const index =
              part.index ??
              (part.id || calls.length === 0 ? calls.length : calls.length - 1);
            let call = calls[index];
            if (!call) {
              call = { id: part.id ?? "", name: "", arguments: "" };
              calls[index] = call;
            }
            if (part.id && !call.id) call.id = part.id;
            if (part.function?.name && !call.name) {
              call.name = part.function.name;
              onEvent?.({
                type: "tool_call_start",
                id: call.id,
                name: call.name,
              });
            }
            call.arguments += part.function?.arguments ?? "";
          }
        }
      } catch (err) {
        if (signal?.aborted) throw new ModelRequestAborted();
        throw new Error(describeError(err, config));
      }

      const toolCalls = calls
        .filter((c) => c !== undefined)
        .map((c, i) => ({ ...c, id: c.id || `call_${i}` }));

      const message: ModelTurn["message"] = { role: "assistant", content };
      if (toolCalls.length > 0) message.toolCalls = toolCalls;
      if (reasoningText || reasoningDetails.length > 0)
        message.reasoning = {
          provider: config.provider,
          text: reasoningText,
          data: reasoningDetails.length > 0 ? reasoningDetails : undefined,
        };

      return {
        message,
        finishReason: normalizeFinish(finish, toolCalls.length > 0),
        usage,
      };
    },
  };
}

function toCompatMessages(
  request: ModelRequest,
  provider: OpenAICompatibleProvider,
  profile: Profile,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (request.system) out.push({ role: "system", content: request.system });
  for (const m of request.messages as AgentMessage[]) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "tool")
      out.push({
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      });
    else {
      const msg: Record<string, unknown> = {
        role: "assistant",
        content: m.content,
      };
      if (m.toolCalls && m.toolCalls.length > 0)
        msg.tool_calls = m.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.arguments },
        }));
      // Reasoning goes back only to the provider that produced it.
      if (m.reasoning && m.reasoning.provider === provider)
        Object.assign(msg, profile.reasoningFields(m.reasoning));
      out.push(msg);
    }
  }
  return out;
}

/**
 * Adds one streamed reasoning detail. Consecutive text pieces are one block
 * split across chunks, so they're joined; other kinds arrive whole. This
 * follows OpenRouter's own AI SDK provider.
 */
function mergeReasoningDetail(
  details: ReasoningDetail[],
  detail: ReasoningDetail,
): void {
  const last = details[details.length - 1];
  if (detail.type === "reasoning.text" && last?.type === "reasoning.text") {
    last.text = (last.text ?? "") + (detail.text ?? "");
    last.signature = last.signature || detail.signature;
    last.format = last.format || detail.format;
  } else details.push({ ...detail });
}

/**
 * The reasoning details safe to send back. Claude and Gemini reject reasoning
 * text without its signature, which a stream cut short can leave behind.
 */
function sendableReasoningDetails(data: unknown): ReasoningDetail[] {
  if (!Array.isArray(data)) return [];
  return (data as ReasoningDetail[]).filter(
    (d) =>
      d.type !== "reasoning.text" ||
      !["anthropic-claude-v1", "google-gemini-v1"].includes(d.format ?? "") ||
      !!d.signature,
  );
}

function normalizeFinish(
  reason: string | null | undefined,
  hasToolCalls: boolean,
): FinishReason {
  // Some providers say "stop" even when the turn ends in tool calls.
  if (hasToolCalls) return "tool_calls";
  if (!reason || reason === "stop" || reason === "tool_calls") return "stop";
  if (reason === "length") return "length";
  return "other";
}

function describeError(err: unknown, config: OpenAICompatibleConfig): string {
  const status = err instanceof OpenAI.APIError ? err.status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (config.provider === "ollama" && err instanceof OpenAI.APIConnectionError)
    return `Could not reach Ollama at ${config.baseURL ?? PROFILES.ollama.baseURL}. Is it running? (${message})`;
  if (config.provider === "openrouter" && status === 401)
    return "OpenRouter did not accept the API key. Check the key in Settings.";
  if (status === 404)
    return `The model "${config.model}" wasn't found. (${message})`;
  return message;
}
