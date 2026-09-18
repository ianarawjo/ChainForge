/**
 * The tool-use loop: ask the model, run the tools it calls, send back the
 * results, and repeat until it answers without calling a tool.
 *
 * Knows nothing about providers (see model/) or about the canvas (tools are
 * passed in), so the same loop can drive any model and any set of tools.
 */

import {
  AgentMessage,
  FinishReason,
  JsonSchema,
  ModelClient,
  ModelRequestAborted,
  ToolCall,
  Usage,
} from "../model/types";
import { AgentTool, isPlainObject, schemaProblems } from "./tools";

/** What happened during a run, for a chat panel or a log. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call"; call: ToolCall }
  | {
      type: "tool_result";
      callId: string;
      name: string;
      ok: boolean;
      content: string;
    }
  | {
      type: "step_finish";
      step: number;
      finishReason: FinishReason;
      usage?: Usage;
    };

export type StopReason =
  /** The model answered without calling a tool. */
  | "done"
  /** The model hit its output token limit mid-answer. */
  | "length"
  /** The model kept calling tools past the step limit. */
  | "max_steps"
  | "cancelled"
  | "error";

export interface AgentRunOptions {
  client: ModelClient;
  system?: string;
  /** The conversation so far, ending with the user's new message. */
  messages: AgentMessage[];
  tools: AgentTool[];
  /** Model requests allowed in this run. */
  maxSteps?: number;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void;
}

export interface AgentRunResult {
  /** Messages added during this run, to append to the conversation. */
  messages: AgentMessage[];
  stopReason: StopReason;
  error?: string;
  usage: Usage;
}

const DEFAULT_MAX_STEPS = 10;

export async function runAgent(
  options: AgentRunOptions,
): Promise<AgentRunResult> {
  const { client, system, tools, signal, onEvent } = options;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const added: AgentMessage[] = [];
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  const result = (stopReason: StopReason, error?: string): AgentRunResult => ({
    messages: added,
    stopReason,
    error,
    usage,
  });

  const specs = tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));

  for (let step = 1; step <= maxSteps; step++) {
    if (signal?.aborted) return result("cancelled");

    let turn;
    try {
      turn = await client.respond(
        { system, messages: [...options.messages, ...added], tools: specs },
        { signal, onEvent },
      );
    } catch (err) {
      if (err instanceof ModelRequestAborted || signal?.aborted)
        return result("cancelled");
      return result("error", err instanceof Error ? err.message : String(err));
    }

    added.push(turn.message);
    if (turn.usage) {
      usage.inputTokens += turn.usage.inputTokens;
      usage.outputTokens += turn.usage.outputTokens;
    }
    onEvent?.({
      type: "step_finish",
      step,
      finishReason: turn.finishReason,
      usage: turn.usage,
    });

    const calls = turn.message.toolCalls ?? [];
    if (calls.length === 0)
      return result(turn.finishReason === "length" ? "length" : "done");

    // One at a time, in order: a later call may depend on an earlier one.
    for (const call of calls) {
      if (signal?.aborted) return result("cancelled");
      onEvent?.({ type: "tool_call", call });
      const { ok, content } = await runToolCall(call, tools, signal);
      added.push({ role: "tool", toolCallId: call.id, content });
      onEvent?.({
        type: "tool_result",
        callId: call.id,
        name: call.name,
        ok,
        content,
      });
    }
  }

  return result("max_steps");
}

/** Runs one tool call. Problems become a message the model can correct. */
async function runToolCall(
  call: ToolCall,
  tools: AgentTool[],
  signal?: AbortSignal,
): Promise<{ ok: boolean; content: string }> {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool)
    return fail(
      `There is no tool named "${call.name}". Available tools: ${tools.map((t) => t.name).join(", ")}.`,
    );

  let parsed: unknown;
  try {
    parsed = call.arguments.trim() === "" ? {} : JSON.parse(call.arguments);
  } catch {
    return fail(
      `The arguments for ${call.name} were not valid JSON. Send them again as a JSON object.`,
    );
  }
  if (!isPlainObject(parsed))
    return fail(`The arguments for ${call.name} must be a JSON object.`);
  const args = unwrapStringifiedArgs(parsed, tool.parameters);

  const problems = schemaProblems(args, tool.parameters);
  if (problems.length > 0)
    return fail(
      `The arguments for ${call.name} don't match its parameters:\n- ${problems.join("\n- ")}`,
    );

  try {
    const out = await tool.run(args, { signal });
    return {
      ok: true,
      content: typeof out === "string" ? out : JSON.stringify(out, null, 2),
    };
  } catch (err) {
    return fail(
      `${call.name} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Small models often send an array or object argument as a JSON string, e.g.
 * "changes": "[{...}]". When the string parses to exactly the type the
 * parameter expects, use the parsed value. Anything else is left for the
 * schema check to report.
 */
function unwrapStringifiedArgs(
  args: Record<string, unknown>,
  schema: JsonSchema,
): Record<string, unknown> {
  const out = { ...args };
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    const value = out[key];
    if (
      typeof value !== "string" ||
      (sub.type !== "array" && sub.type !== "object")
    )
      continue;
    try {
      const parsed = JSON.parse(value);
      if (sub.type === "array" ? Array.isArray(parsed) : isPlainObject(parsed))
        out[key] = parsed;
    } catch {
      // Not JSON; the schema check will say what's wrong.
    }
  }
  return out;
}

function fail(content: string) {
  return { ok: false, content: `Error: ${content}` };
}
