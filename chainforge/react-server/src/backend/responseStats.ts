/**
 * Timing and token counts for each response: how long it took, how many tokens
 * went in and came out, and how fast they came. Useful for comparing models,
 * and especially local ones, where speed depends on the machine.
 *
 * Providers report these in different shapes, or not at all. What ChainForge
 * always knows is how long its own request took; the rest is read from the
 * provider's reply where it has it.
 */
import { Dict, LLMResponseData, ResponseStats } from "./typing";

/**
 * The key under which call functions that send one request per response record
 * that request's wall-clock time on its raw reply, for `extract_stats` to read.
 */
export const LATENCY_KEY = "__cf_latency_ms";

/**
 * The metavars each response's stats are exposed under, e.g. to code evaluators
 * as `response.meta["stat_tokens_per_s"]`. The prefix keeps them from colliding
 * with metavars of the user's own, which stats would otherwise overwrite.
 */
export const STATS_METAVARS = {
  latency_s: "stat_latency_s",
  ttft_s: "stat_ttft_s",
  input_tokens: "stat_input_tokens",
  output_tokens: "stat_output_tokens",
  tokens_per_s: "stat_tokens_per_s",
  decode_tokens_per_s: "stat_decode_tokens_per_s",
  averaged_over: "stat_averaged_over",
  cost_usd: "stat_cost_usd",
} as const;

const STATS_METAVAR_NAMES = new Set<string>(Object.values(STATS_METAVARS));

/** Whether a metavar holds a response's stats (and so belongs to that response alone). */
export function isStatsMetavar(name: string): boolean {
  return STATS_METAVAR_NAMES.has(name);
}

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;

const firstNum = (...vals: unknown[]): number | undefined => {
  for (const v of vals) {
    const n = num(v);
    if (n !== undefined) return n;
  }
  return undefined;
};

const NS_PER_MS = 1e6;

/**
 * Token counts, timings and speed from one raw reply, in whichever shape its
 * provider uses, before rounding. For a reply with several choices, the counts
 * are the whole reply's; see `extract_stats` for per-response stats.
 */
export function statsFromReply(reply: Dict): ResponseStats {
  // Some providers' replies are stored with the provider's own reply under `raw`
  const r: Dict =
    reply?.raw && typeof reply.raw === "object"
      ? { ...reply.raw, ...reply }
      : reply;
  const usage: Dict = r?.usage ?? {};
  const meta: Dict = r?.usageMetadata ?? {}; // Gemini
  const timings: Dict = r?.timings ?? {}; // llama.cpp server
  const extra: Dict = usage?.extra ?? {}; // WebLLM

  const stats: ResponseStats = {};

  const input = firstNum(
    usage.prompt_tokens,
    usage.input_tokens,
    usage.inputTokens, // Bedrock
    meta.promptTokenCount,
    r?.prompt_eval_count, // Ollama
  );
  if (input !== undefined) stats.input_tokens = input;

  const geminiOutput =
    num(meta.candidatesTokenCount) !== undefined
      ? meta.candidatesTokenCount + (num(meta.thoughtsTokenCount) ?? 0)
      : undefined;
  const output = firstNum(
    usage.completion_tokens,
    usage.output_tokens,
    usage.outputTokens,
    geminiOutput,
    r?.eval_count,
  );
  if (output !== undefined) stats.output_tokens = output;

  // What the request cost, where the provider says (OpenRouter, for any model it serves)
  const cost = num(usage.cost);
  if (cost !== undefined) stats.cost_usd = cost;

  const latency = firstNum(
    r?.[LATENCY_KEY],
    r?.metrics?.latencyMs, // Bedrock
    num(r?.total_duration) !== undefined
      ? r.total_duration / NS_PER_MS
      : undefined,
  );
  if (latency !== undefined) stats.latency_ms = latency;

  // Time to first token: Ollama splits out loading the model and reading the prompt.
  if (
    num(r?.load_duration) !== undefined ||
    num(r?.prompt_eval_duration) !== undefined
  )
    stats.ttft_ms =
      ((num(r?.load_duration) ?? 0) + (num(r?.prompt_eval_duration) ?? 0)) /
      NS_PER_MS;
  else if (num(timings.prompt_ms) !== undefined)
    stats.ttft_ms = timings.prompt_ms;
  else if (num(extra.time_to_first_token_s) !== undefined)
    stats.ttft_ms = extra.time_to_first_token_s * 1000;

  // Decoding speed, where the server measures it itself
  const decodeSpeed = firstNum(
    num(r?.eval_count) !== undefined && num(r?.eval_duration)
      ? r.eval_count / (r.eval_duration / 1e9)
      : undefined,
    timings.predicted_per_second,
    extra.decode_tokens_per_s,
  );
  if (decodeSpeed !== undefined) stats.decode_tokens_per_s = decodeSpeed;

  return stats;
}

/** Rounds stats for storage, and works out speed from tokens and latency. */
function finish(stats: ResponseStats): ResponseStats | null {
  const res: ResponseStats = {};
  if (stats.latency_ms !== undefined)
    res.latency_ms = Math.round(stats.latency_ms);
  if (stats.ttft_ms !== undefined) res.ttft_ms = Math.round(stats.ttft_ms);
  if (stats.input_tokens !== undefined)
    res.input_tokens = Math.round(stats.input_tokens);
  if (stats.output_tokens !== undefined)
    res.output_tokens = Math.round(stats.output_tokens);
  const round1 = (x: number) => Math.round(x * 10) / 10;
  if (
    stats.output_tokens !== undefined &&
    stats.latency_ms !== undefined &&
    stats.latency_ms > 0
  )
    res.tokens_per_s = round1(stats.output_tokens / (stats.latency_ms / 1000));
  if (stats.decode_tokens_per_s !== undefined)
    res.decode_tokens_per_s = round1(stats.decode_tokens_per_s);
  // Requests can cost fractions of a cent, so keep 9 significant digits
  if (stats.cost_usd !== undefined)
    res.cost_usd = Number(stats.cost_usd.toPrecision(9));
  if (Object.keys(res).length === 0) return null;
  if (stats.averaged_over !== undefined && stats.averaged_over > 1)
    res.averaged_over = stats.averaged_over;
  return res;
}

/**
 * Each response's stats, in the same order as `extract_responses`.
 *
 * @param response The raw reply from `call_llm`: one reply, or one per request.
 * @param elapsed_ms How long the call to `call_llm` took, in total.
 * @param count How many responses were extracted from the reply.
 *
 * A reply with several choices (one request asked for n responses) gives each
 * the request's latency, the average of its output tokens, and the speed that
 * average makes. Several replies (a request per response) each count on their
 * own; without a per-request time, each gets the average. Averaged stats are
 * marked with `averaged_over`.
 */
export function extract_stats(
  response: unknown,
  elapsed_ms: number | undefined,
  count: number,
): (ResponseStats | null)[] | undefined {
  if (count <= 0) return undefined;

  const replies: Dict[] = Array.isArray(response)
    ? (response as unknown[]).map((r) =>
        r !== null && typeof r === "object" ? (r as Dict) : {},
      )
    : response !== null && typeof response === "object"
      ? [response as Dict]
      : [];

  // WebLLM puts each completion's usage beside its choices.
  if (
    replies.length === 1 &&
    Array.isArray(replies[0]?.usages) &&
    replies[0].usages.length === count
  )
    return (replies[0].usages as Dict[]).map((u) =>
      finish(statsFromReply({ usage: u, [LATENCY_KEY]: u?.[LATENCY_KEY] })),
    );

  // How many responses each reply holds
  const sizes = replies.map((r) =>
    Array.isArray(r?.choices) && r.choices.length > 0 ? r.choices.length : 1,
  );
  const total = sizes.reduce((a, b) => a + b, 0);

  // When the replies don't line up with the responses (e.g. a custom provider
  // returning plain strings), all that's known is the total time.
  if (replies.length === 0 || total !== count) {
    if (elapsed_ms === undefined) return undefined;
    return Array.from({ length: count }, () =>
      finish({ latency_ms: elapsed_ms / count, averaged_over: count }),
    );
  }

  const stats: (ResponseStats | null)[] = [];
  replies.forEach((reply, i) => {
    const s = statsFromReply(reply);
    // Without its own time, a reply gets the average of the call's
    const latencyAveraged =
      s.latency_ms === undefined &&
      elapsed_ms !== undefined &&
      replies.length > 1;
    if (s.latency_ms === undefined && elapsed_ms !== undefined)
      s.latency_ms = elapsed_ms / replies.length;
    const k = sizes[i];
    for (let j = 0; j < k; j++)
      stats.push(
        finish({
          ...s,
          output_tokens:
            s.output_tokens !== undefined ? s.output_tokens / k : undefined,
          // One request's cost, shared between the responses it returned
          cost_usd: s.cost_usd !== undefined ? s.cost_usd / k : undefined,
          // A server-measured speed is per sequence already
          decode_tokens_per_s: k === 1 ? s.decode_tokens_per_s : undefined,
          averaged_over: Math.max(k, latencyAveraged ? replies.length : 1),
        }),
      );
  });
  return stats.some((s) => s !== null) ? stats : undefined;
}

/** The stats of the response at `index`, if it has any. */
export function statsAt(
  resp_obj: { stats?: (ResponseStats | null)[] },
  index: number,
): ResponseStats | undefined {
  return resp_obj.stats?.[index] ?? undefined;
}

/** A response's stats as metavars (see STATS_METAVARS), in seconds rather than milliseconds. */
export function statsToMetavars(
  stats: ResponseStats | undefined,
): Dict<LLMResponseData> {
  if (!stats) return {};
  const res: Dict<LLMResponseData> = {};
  const secs = (ms: number) => Math.round(ms) / 1000;
  if (stats.latency_ms !== undefined)
    res[STATS_METAVARS.latency_s] = secs(stats.latency_ms);
  if (stats.ttft_ms !== undefined)
    res[STATS_METAVARS.ttft_s] = secs(stats.ttft_ms);
  if (stats.input_tokens !== undefined)
    res[STATS_METAVARS.input_tokens] = stats.input_tokens;
  if (stats.output_tokens !== undefined)
    res[STATS_METAVARS.output_tokens] = stats.output_tokens;
  if (stats.tokens_per_s !== undefined)
    res[STATS_METAVARS.tokens_per_s] = stats.tokens_per_s;
  if (stats.decode_tokens_per_s !== undefined)
    res[STATS_METAVARS.decode_tokens_per_s] = stats.decode_tokens_per_s;
  if (stats.averaged_over !== undefined)
    res[STATS_METAVARS.averaged_over] = stats.averaged_over;
  if (stats.cost_usd !== undefined)
    res[STATS_METAVARS.cost_usd] = stats.cost_usd;
  return res;
}

/**
 * A short, human-readable summary, e.g. "2.4 s · 312 tok · 130 tok/s", marked
 * "≈" when it's an average. `compact` leaves out the token count.
 */
export function formatStats(
  stats: ResponseStats | undefined,
  compact = false,
): string {
  if (!stats) return "";
  const parts: string[] = [];
  if (stats.latency_ms !== undefined)
    parts.push(
      stats.latency_ms < 1000
        ? `${stats.latency_ms} ms`
        : `${(stats.latency_ms / 1000).toFixed(1)} s`,
    );
  if (stats.output_tokens !== undefined && !compact)
    parts.push(`${stats.output_tokens} tok`);
  if (stats.tokens_per_s !== undefined)
    parts.push(`${Math.round(stats.tokens_per_s)} tok/s`);
  const summary = parts.join(" · ");
  return stats.averaged_over && summary ? `≈ ${summary}` : summary;
}

/** Each stat on its own line with its full name, for a tooltip. */
export function describeStats(stats: ResponseStats | undefined): string[] {
  if (!stats) return [];
  const lines: string[] = [];
  if (stats.latency_ms !== undefined)
    lines.push(`Latency: ${(stats.latency_ms / 1000).toFixed(2)} s`);
  if (stats.ttft_ms !== undefined)
    lines.push(`Time to first token: ${(stats.ttft_ms / 1000).toFixed(2)} s`);
  if (stats.input_tokens !== undefined)
    lines.push(`Input tokens: ${stats.input_tokens}`);
  if (stats.output_tokens !== undefined)
    lines.push(`Output tokens: ${stats.output_tokens}`);
  if (stats.tokens_per_s !== undefined)
    lines.push(
      `Speed: ${stats.tokens_per_s} tokens/s (output tokens over latency)`,
    );
  if (stats.decode_tokens_per_s !== undefined)
    lines.push(
      `Decoding speed: ${stats.decode_tokens_per_s} tokens/s (measured by the server)`,
    );
  if (stats.cost_usd !== undefined)
    lines.push(`Cost: ${formatCost(stats.cost_usd)}`);
  if (stats.averaged_over)
    lines.push(
      `≈ Averages: the provider reported one total for ${stats.averaged_over} responses`,
    );
  return lines;
}

/**
 * A cost in US dollars, legibly at any size: "$1.24", "$0.0031", "$0.0000217".
 * Below a cent, three significant digits.
 */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  const digits = Math.max(2, 2 - Math.floor(Math.log10(usd)));
  return `$${Number(usd.toPrecision(3)).toFixed(digits).replace(/0+$/, "")}`;
}
