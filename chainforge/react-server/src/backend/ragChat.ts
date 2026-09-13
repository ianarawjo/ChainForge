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

/** A stage that ran several methods whose results were merged together. */
export interface MixedStage {
  /** The variable naming the stage's method, e.g. "chunkMethod". */
  key: string;
  /** The methods that were merged, in the order first seen. */
  values: string[];
}

export interface ChatTurn {
  id: string;
  query: string;
  askedAt: number;
  status: ChatTurnStatus;
  answers: ChatAnswer[];
  problems: ChatProblem[];
  /**
   * Stages that ran several methods whose results the answers merged. Absent
   * on turns saved before this was checked.
   */
  mixed?: MixedStage[];
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
  /** Every method each stage ran this turn; see collectStageValues. */
  stageValues?: Record<string, string[]>;
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
    mixed: args.stageValues ? mixedStages(args.stageValues, answers) : [],
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
 * Grouping answers that say the same thing.
 *
 * Grouping shows at a glance which choices changed the answer. But grouping
 * two answers that actually differ hides the very difference the comparison
 * exists to show, which is far worse than leaving two paraphrases apart. So
 * every way of grouping errs towards leaving answers apart.
 */

/** How the chat groups one turn's answers. */
export type AnswerGrouping =
  /** Identical text, ignoring case, punctuation and spacing. */
  | "exact"
  /** Similar meaning by embedding, unless the answers visibly conflict. */
  | "meaning"
  /** Every answer on its own. */
  | "off";

export const DEFAULT_ANSWER_GROUPING: AnswerGrouping = "exact";

/** An answer as exact grouping compares it. */
export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whether two answers have the same text, ignoring case and punctuation. */
export function answersMatchExactly(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}

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

/**
 * Words that flip an answer; "may" and "may not" must not agree.
 *
 * "yes" is deliberately absent. "Yes, dogs are allowed" says the same as
 * "Dogs are permitted", and counting it split them; "no" and the negations
 * are what turn an answer around.
 */
const POLARITY_WORDS = new Set([
  "no",
  "not",
  "never",
  "none",
  "nothing",
  "neither",
  "nor",
  "without",
]);

function answerTokens(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
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

/**
 * Whether two answers visibly conflict: they mention different numbers, or
 * differ on yes/no or negation.
 *
 * Meaning never overrides this. Embeddings place "kept for 7 years" and
 * "kept for 30 days" almost on top of each other, because the sentences are
 * alike in everything but the fact that matters.
 */
export function answersConflict(a: string, b: string): boolean {
  const ta = answerTokens(a);
  const tb = answerTokens(b);
  const isNumber = (t: string) => /^\d/.test(t);
  const isPolar = (t: string) => POLARITY_WORDS.has(t);
  return (
    !sameSet(ta.filter(isNumber), tb.filter(isNumber)) ||
    !sameSet(ta.filter(isPolar), tb.filter(isPolar))
  );
}

/**
 * Groups one turn's answers, as lists of indices into `answers`.
 *
 * An answer joins a group only if it agrees with every answer already in it,
 * so a chain of near-paraphrases cannot pull two different answers together.
 * Larger groups come first; otherwise groups keep the order answers arrived in.
 */
export function groupAnswers(
  answers: ChatAnswer[],
  agree: (i: number, j: number) => boolean,
): number[][] {
  const groups: number[][] = [];
  answers.forEach((_, i) => {
    const home = groups.find((g) => g.every((j) => agree(j, i)));
    if (home) home.push(i);
    else groups.push([i]);
  });
  // Array.prototype.sort is stable, so equal-sized groups keep their order.
  return groups.sort((x, y) => y.length - x.length);
}

/** Every answer on its own. */
export function ungroupedAnswers(answers: ChatAnswer[]): number[][] {
  return answers.map((_, i) => [i]);
}

/** Groups answers with the same text, ignoring case and punctuation. */
export function groupAnswersExactly(answers: ChatAnswer[]): number[][] {
  return groupAnswers(answers, (i, j) =>
    answersMatchExactly(answers[i].text, answers[j].text),
  );
}

/**
 * Judges whether one text entails another: whether, if the premise is true,
 * the hypothesis must be too.
 */
export type EntailmentJudge = (
  premise: string,
  hypothesis: string,
) => Promise<boolean>;

/**
 * Groups answers that say the same thing.
 *
 * Two answers agree if their text matches exactly, or if they do not visibly
 * conflict (see answersConflict) and each entails the other. Entailment both
 * ways is the test because it is what "the same meaning" is: an answer that
 * adds a condition ("only with manager approval") entails the plain one, but
 * not the reverse, so they stay apart.
 *
 * Embedding similarity was tried first and could not be made safe. On
 * labelled answer pairs, near-misses embedded closer than most paraphrases:
 * "deleted automatically" / "manually" scored 0.983 and "90 days" /
 * "90 months" 0.975, against paraphrases from 0.87. A small NLI model grouped
 * every paraphrase and none of the near-misses.
 *
 * Each ordered pair of distinct texts is judged at most once.
 */
export async function groupAnswersByMeaning(
  answers: ChatAnswer[],
  entails: EntailmentJudge,
): Promise<number[][]> {
  if (answers.length < 2) return ungroupedAnswers(answers);

  const judged = new Map<string, Promise<boolean>>();
  const judge = (premise: string, hypothesis: string) => {
    const key = JSON.stringify([premise, hypothesis]);
    let verdict = judged.get(key);
    if (!verdict) {
      verdict = entails(premise, hypothesis);
      judged.set(key, verdict);
    }
    return verdict;
  };

  const agree = async (a: string, b: string) => {
    if (answersMatchExactly(a, b)) return true;
    if (answersConflict(a, b)) return false;
    return (await judge(a, b)) && (await judge(b, a));
  };

  // groupAnswers, but awaiting each judgement. An answer joins the first
  // group whose every member it agrees with.
  const groups: number[][] = [];
  for (let i = 0; i < answers.length; i++) {
    let home: number[] | undefined;
    for (const group of groups) {
      let fits = true;
      for (const j of group)
        if (!(await agree(answers[j].text, answers[i].text))) {
          fits = false;
          break;
        }
      if (fits) {
        home = group;
        break;
      }
    }
    if (home) home.push(i);
    else groups.push([i]);
  }
  return groups.sort((x, y) => y.length - x.length);
}

/*
 * Catching merged configurations.
 *
 * To compare chunkers or retrievers, a Join node has to group by each of
 * them. Grouping by retrievalMethod alone quietly puts both chunkers' chunks
 * into every prompt: the flow still runs and answers, just not the comparison
 * it was built for, and nothing looks wrong. The Join drops a variable whose
 * value differs within a group, so the tell is a stage that ran several
 * methods while an answer no longer records which one it used.
 */

/**
 * Every method each pipeline stage ran, read from node outputs.
 *
 * Accepts anything a node stores as output and skips what is not a list of
 * entries, so callers can pass node data fields without checking them first.
 */
export function collectStageValues(
  outputs: unknown[],
  resolveText: ResolveText,
): Record<string, string[]> {
  const seen: Record<string, Set<string>> = {};
  for (const output of outputs) {
    if (!Array.isArray(output)) continue;
    for (const entry of output) {
      const vars = (entry as PromptOutputLike | undefined)?.fill_history;
      if (!vars) continue;
      for (const key of PIPELINE_CONFIG_KEYS) {
        if (!(key in vars)) continue;
        const value = asString(vars[key], resolveText);
        if (value.length === 0) continue;
        (seen[key] ??= new Set()).add(value);
      }
    }
  }
  const values: Record<string, string[]> = {};
  for (const [key, set] of Object.entries(seen)) values[key] = [...set];
  return values;
}

/** Stages that ran several methods but that some answer does not record. */
export function mixedStages(
  stageValues: Record<string, string[]>,
  answers: ChatAnswer[],
): MixedStage[] {
  if (answers.length === 0) return [];
  return PIPELINE_CONFIG_KEYS.filter(
    (key) =>
      (stageValues[key]?.length ?? 0) > 1 &&
      answers.some((a) => a.config[key] === undefined),
  ).map((key) => ({ key, values: stageValues[key] }));
}

const STAGE_NOUNS: Record<string, string> = {
  chunkMethod: "chunkers",
  retrievalMethod: "retrieval methods",
  rerankMethod: "rerankers",
};

/** A warning about a merged stage, saying what to change. */
export function explainMixedStage(stage: MixedStage): string {
  const noun = STAGE_NOUNS[stage.key] ?? stage.key;
  return (
    `Answers mix results from ${stage.values.length} ${noun} ` +
    `(${stage.values.join(", ")}). To compare them, group the Join node by ` +
    `${stage.key} too.`
  );
}
