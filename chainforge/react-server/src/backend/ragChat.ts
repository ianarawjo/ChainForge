/**
 * The logic behind chatting with a RAG flow, kept free of React and the store.
 *
 * A RAG Chat node sits where queries enter a pipeline. When someone sends a
 * message it writes the message as its output, runs everything downstream
 * (see runDownstream.ts), then reads the answers the pipeline's Prompt nodes
 * produced. This module turns those raw Prompt node outputs into chat turns:
 * which answers belong to this question, how each is labelled, and what went
 * wrong when nothing came back.
 *
 * One question can produce several answers. A flow comparing two chunkers
 * against two retrievers yields four, and comparing models multiplies that
 * again. That is ChainForge's point, so every answer is kept and labelled by
 * the configuration that produced it rather than collapsed into one.
 *
 * Text arrives interned (StringLookup indices) and is resolved through a
 * function the caller passes in, which keeps this module free of the cache and
 * straightforward to test.
 */

import { NodeRunResult, RunOutcome } from "./runGraph";

type Dict = Record<string, unknown>;

/** Turns stored response data -- a string, an intern index -- into text. */
export type ResolveText = (value: unknown) => string | undefined;

/** The subset of a Prompt node output entry this module reads. */
export interface PromptOutputLike {
  text?: unknown;
  fill_history?: Dict;
  metavars?: Dict;
  llm?: unknown;
}

/**
 * Variables that record how an answer was produced, rather than what went into
 * the prompt. Shown as the answer's label, not as its inputs.
 */
export const PIPELINE_CONFIG_KEYS = [
  "chunkMethod",
  "retrievalMethod",
  "rerankMethod",
] as const;

export interface ChatAnswer {
  promptNodeId: string;
  /** The model that answered. */
  llm: string;
  text: string;
  /** How the pipeline produced this answer, e.g. which retrieval method. */
  config: Record<string, string>;
  /** The other values filled into the prompt, such as the retrieved context. */
  inputs: Record<string, string>;
}

export interface ChatProblem {
  nodeId: string;
  nodeLabel: string;
  outcome: RunOutcome;
  error?: string;
}

export type ChatTurnStatus =
  /** At least one answer came back. */
  | "answered"
  /** The run stopped at a node that failed. */
  | "failed"
  /** The user stopped the run. */
  | "cancelled"
  /** Everything ran, but no Prompt node downstream produced an answer. */
  | "no-answer";

export interface ChatTurn {
  id: string;
  query: string;
  askedAt: number;
  status: ChatTurnStatus;
  answers: ChatAnswer[];
  problems: ChatProblem[];
}

/** Node types whose output is an answer to show. */
const ANSWERING_NODE_TYPES = new Set(["prompt", "chat"]);

function asString(value: unknown, resolveText: ResolveText): string {
  if (value === undefined || value === null) return "";
  return resolveText(value) ?? String(value);
}

/** The model name for an output entry, however it was recorded. */
function llmNameOf(output: PromptOutputLike, resolveText: ResolveText): string {
  const llm = output.llm;
  if (llm && typeof llm === "object" && "name" in llm) {
    const name = (llm as { name?: unknown }).name;
    if (typeof name === "string" && name.length > 0) return name;
  }
  if (typeof llm === "string" || typeof llm === "number") {
    const name = resolveText(llm);
    if (name) return name;
  }
  return "LLM";
}

/**
 * The answers one Prompt node gave to this question.
 *
 * Filters on the recorded `query` when there is one. A Retrieval node can have
 * a Tabular node wired into its queries alongside the chat, and those rows'
 * answers are not replies to this message. Entries with no recorded query are
 * kept, since there is nothing to rule them out by.
 */
export function answersFromPromptOutput(
  promptNodeId: string,
  outputs: PromptOutputLike[] | undefined,
  query: string,
  resolveText: ResolveText,
): ChatAnswer[] {
  if (!Array.isArray(outputs)) return [];

  const answers: ChatAnswer[] = [];
  for (const output of outputs) {
    if (!output) continue;
    const text =
      output.text === undefined ? undefined : resolveText(output.text);
    if (text === undefined) continue;

    const vars = output.fill_history ?? {};
    const askedQuery =
      "query" in vars ? asString(vars.query, resolveText) : undefined;
    if (askedQuery !== undefined && askedQuery.trim() !== query.trim())
      continue;

    const config: Record<string, string> = {};
    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (key === "query") continue;
      if ((PIPELINE_CONFIG_KEYS as readonly string[]).includes(key))
        config[key] = asString(value, resolveText);
      else inputs[key] = asString(value, resolveText);
    }

    answers.push({
      promptNodeId,
      llm: llmNameOf(output, resolveText),
      text,
      config,
      inputs,
    });
  }
  return answers;
}

/**
 * A short label saying how an answer was produced, e.g.
 * "Markdown Headers · BM25 Retrieval · Cross-encoder (in-browser) · gpt-oss:20b".
 * Ordered to follow the pipeline, so labels line up when compared.
 */
export function answerLabel(answer: ChatAnswer): string {
  const parts = PIPELINE_CONFIG_KEYS.map((k) => answer.config[k]).filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  parts.push(answer.llm);
  return parts.join(" · ");
}

/** The Prompt nodes in a run that finished and so have answers to read. */
export function answeringNodeIds(
  results: NodeRunResult[],
  typeOf: (nodeId: string) => string | undefined,
): string[] {
  return results
    .filter((r) => r.outcome === "ok")
    .map((r) => r.nodeId)
    .filter((id) => ANSWERING_NODE_TYPES.has(typeOf(id) ?? ""));
}

export interface BuildChatTurnArgs {
  id: string;
  query: string;
  askedAt: number;
  results: NodeRunResult[];
  /** Output entries of each answering node, keyed by node id. */
  promptOutputs: Record<string, PromptOutputLike[] | undefined>;
  typeOf: (nodeId: string) => string | undefined;
  nodeLabel: (nodeId: string) => string;
  resolveText: ResolveText;
}

/** Assembles one chat turn from a finished run. */
export function buildChatTurn(args: BuildChatTurnArgs): ChatTurn {
  const answers = answeringNodeIds(args.results, args.typeOf).flatMap((id) =>
    answersFromPromptOutput(
      id,
      args.promptOutputs[id],
      args.query,
      args.resolveText,
    ),
  );

  const problems: ChatProblem[] = args.results
    .filter((r) => r.outcome === "failed" || r.outcome === "cancelled")
    .map((r) => ({
      nodeId: r.nodeId,
      nodeLabel: args.nodeLabel(r.nodeId),
      outcome: r.outcome,
      error: r.error,
    }));

  let status: ChatTurnStatus;
  if (problems.some((p) => p.outcome === "cancelled")) status = "cancelled";
  else if (answers.length > 0) status = "answered";
  else if (problems.length > 0) status = "failed";
  else status = "no-answer";

  return {
    id: args.id,
    query: args.query,
    askedAt: args.askedAt,
    status,
    answers,
    problems,
  };
}

/** What to show while a node of this type is running. */
export function progressMessage(nodeType: string | undefined): string {
  switch (nodeType) {
    case "chunk":
      return "Chunking documents…";
    case "retrieval":
      return "Retrieving relevant passages…";
    case "rerank":
      return "Reranking passages…";
    case "join":
      return "Assembling context…";
    case "prompt":
    case "chat":
      return "Asking the model…";
    default:
      return "Running…";
  }
}

/** Why a turn produced nothing, in words a workshop attendee can act on. */
export function explainTurn(turn: ChatTurn): string | undefined {
  switch (turn.status) {
    case "answered":
      return undefined;
    case "cancelled":
      return "Stopped.";
    case "no-answer":
      return (
        "The pipeline ran, but no Prompt node downstream of this chat " +
        "produced an answer. Connect a Prompt node after your retrieval."
      );
    case "failed": {
      const first = turn.problems[0];
      if (!first) return "The pipeline could not finish.";
      return (
        `${first.nodeLabel} could not run` +
        (first.error ? `: ${first.error}` : ". Check that node for details.")
      );
    }
  }
}
