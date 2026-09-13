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
  return labelParts(answer)
    .map(([, value]) => value)
    .join(" · ");
}

/** An answer's label as [dimension, value] pairs, in pipeline order. */
function labelParts(answer: ChatAnswer): [string, string][] {
  const parts: [string, string][] = [];
  for (const key of PIPELINE_CONFIG_KEYS) {
    const value = answer.config[key];
    if (typeof value === "string" && value.length > 0) parts.push([key, value]);
  }
  parts.push(["llm", answer.llm]);
  return parts;
}

export interface AnswerLabels {
  /** What every answer has in common, e.g. "Cross-encoder · Qwen2.5 0.5B". */
  shared: string;
  /** For each answer, only what sets it apart, e.g. "Markdown Headers · BM25". */
  distinct: string[];
}

/**
 * Splits the labels of one turn's answers into what they share and what
 * differs.
 *
 * Full labels repeat the same stages on every answer, burying the one or two
 * choices that actually vary -- which are the point of the comparison. So the
 * common part is said once and each answer keeps only its own.
 *
 * A stage counts as shared only if every answer has it with the same value.
 * Answers left with identical labels, such as several samples from the same
 * configuration, are numbered so they can be told apart.
 */
export function splitAnswerLabels(answers: ChatAnswer[]): AnswerLabels {
  if (answers.length === 0) return { shared: "", distinct: [] };

  const parts = answers.map((a) => new Map(labelParts(a)));
  const keys = [...PIPELINE_CONFIG_KEYS, "llm"];
  const isShared = (key: string) => {
    const first = parts[0].get(key);
    return first !== undefined && parts.every((p) => p.get(key) === first);
  };

  const shared = keys
    .filter(isShared)
    .map((k) => parts[0].get(k))
    .join(" · ");

  const distinct = parts.map((p) =>
    keys
      .filter((k) => !isShared(k) && p.has(k))
      .map((k) => p.get(k))
      .join(" · "),
  );

  // Number labels that would otherwise be indistinguishable (or empty).
  const counts = new Map<string, number>();
  for (const label of distinct) counts.set(label, (counts.get(label) ?? 0) + 1);
  const seen = new Map<string, number>();
  const numbered = distinct.map((label) => {
    if (label !== "" && counts.get(label) === 1) return label;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return label === "" ? `Response ${n}` : `${label} #${n}`;
  });

  return { shared, distinct: numbered };
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

/*
 * Whether answers agree.
 *
 * Grouping answers that say the same thing shows at a glance which choices
 * changed the answer. But grouping two answers that actually differ hides the
 * very disagreement the comparison exists to show, which is far worse than
 * leaving two paraphrases apart. So the test is deliberately strict: answers
 * agree only if they mention the same numbers, match on yes/no and negation,
 * and share nearly all their content words.
 */

/** Share of content words two answers must have in common to agree. */
export const AGREEMENT_THRESHOLD = 0.7;

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  fifteen: "15",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  ninety: "90",
  hundred: "100",
};

/** Words that flip or settle an answer; "may" and "may not" must not agree. */
const POLARITY_WORDS = new Set([
  "yes",
  "no",
  "not",
  "never",
  "none",
  "nothing",
  "neither",
  "nor",
  "without",
]);

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "and",
  "or",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "as",
  "from",
  "after",
  "per",
  "each",
  "their",
  "your",
  "you",
  "they",
  "there",
  "which",
  "who",
  "so",
  "do",
  "does",
  "did",
  "has",
  "have",
  "had",
  "will",
  "would",
  "can",
  "could",
  "should",
]);

function answerTokens(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/n't\b/g, " not")
    .replace(/\bcannot\b/g, "can not")
    .replace(/(\d),(\d{3})\b/g, "$1$2");
  const tokens = normalized.match(/\d+(?:\.\d+)?|\p{L}+/gu) ?? [];
  return tokens.map((t) => NUMBER_WORDS[t] ?? t);
}

function sameSet(a: Iterable<string>, b: Iterable<string>): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

/** Whether two answers say the same thing. Strict; see above. */
export function answersAgree(a: string, b: string): boolean {
  const ta = answerTokens(a);
  const tb = answerTokens(b);
  if (ta.join(" ") === tb.join(" ")) return true;

  const isNumber = (t: string) => /^\d/.test(t);
  if (!sameSet(ta.filter(isNumber), tb.filter(isNumber))) return false;

  const isPolar = (t: string) => POLARITY_WORDS.has(t);
  if (!sameSet(ta.filter(isPolar), tb.filter(isPolar))) return false;

  const ca = new Set(ta.filter((t) => !STOPWORDS.has(t)));
  const cb = new Set(tb.filter((t) => !STOPWORDS.has(t)));
  if (ca.size === 0 || cb.size === 0) return false;
  const shared = [...ca].filter((t) => cb.has(t)).length;
  return shared / (ca.size + cb.size - shared) >= AGREEMENT_THRESHOLD;
}

/**
 * Groups one turn's answers by agreement, as lists of indices into `answers`.
 *
 * An answer joins a group only if it agrees with every answer already in it,
 * so a chain of near-paraphrases cannot pull two different answers together.
 * Larger groups come first; otherwise groups keep the order answers arrived in.
 */
export function groupAgreeingAnswers(
  answers: ChatAnswer[],
  agree: (a: string, b: string) => boolean = answersAgree,
): number[][] {
  const groups: number[][] = [];
  answers.forEach((answer, i) => {
    const home = groups.find((g) =>
      g.every((j) => agree(answers[j].text, answer.text)),
    );
    if (home) home.push(i);
    else groups.push([i]);
  });
  // Array.prototype.sort is stable, so equal-sized groups keep their order.
  return groups.sort((x, y) => y.length - x.length);
}
