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
import {
  isOpenRouterImageModel,
  LLMProvider,
  stripHuggingFacePrefix,
  stripOpenRouterPrefix,
} from "./models";
import {
  EnergyRange,
  estimateEnergyWh,
  findModel,
} from "./ecologits/ecologits";

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
  est_energy_wh_min: "stat_est_energy_wh_min",
  est_energy_wh_max: "stat_est_energy_wh_max",
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

  // Time before output: Ollama reports loading the model and reading the prompt,
  // llama.cpp reading the prompt, and WebLLM its time to first token.
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
  if (stats.est_energy_wh !== undefined)
    res.est_energy_wh = {
      min: Number(stats.est_energy_wh.min.toPrecision(3)),
      max: Number(stats.est_energy_wh.max.toPrecision(3)),
    };
  if (Object.keys(res).length === 0) return null;
  if (stats.averaged_over !== undefined && stats.averaged_over > 1)
    res.averaged_over = stats.averaged_over;
  return res;
}

/** Estimates one request's energy in Wh from its output tokens and latency. */
export type EnergyEstimator = (
  outputTokens: number,
  latencyMs: number,
) => EnergyRange | undefined;

/**
 * Each response's stats, in the same order as `extract_responses`.
 *
 * @param response The raw reply from `call_llm`: one reply, or one per request.
 * @param elapsed_ms How long the call to `call_llm` took, in total.
 * @param count How many responses were extracted from the reply.
 * @param estimateEnergy Estimates a request's energy from its output tokens
 * and latency, where the model has an estimate (see `energyEstimator`).
 *
 * A reply with several choices (one request asked for n responses) gives each
 * the request's latency, the average of its output tokens, and the speed that
 * average makes. Several replies (a request per response) each count on their
 * own; without a per-request time, each gets the average. Averaged stats are
 * marked with `averaged_over`. A request's energy is estimated once, for the
 * whole request, and shared between its responses like its cost.
 */
export function extract_stats(
  response: unknown,
  elapsed_ms: number | undefined,
  count: number,
  estimateEnergy?: EnergyEstimator,
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
    const energy =
      estimateEnergy &&
      s.output_tokens !== undefined &&
      s.latency_ms !== undefined
        ? estimateEnergy(s.output_tokens, s.latency_ms)
        : undefined;
    for (let j = 0; j < k; j++)
      stats.push(
        finish({
          ...s,
          output_tokens:
            s.output_tokens !== undefined ? s.output_tokens / k : undefined,
          // One request's cost, shared between the responses it returned
          cost_usd: s.cost_usd !== undefined ? s.cost_usd / k : undefined,
          est_energy_wh: energy && { min: energy.min / k, max: energy.max / k },
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
  if (stats.est_energy_wh !== undefined) {
    res[STATS_METAVARS.est_energy_wh_min] = stats.est_energy_wh.min;
    res[STATS_METAVARS.est_energy_wh_max] = stats.est_energy_wh.max;
  }
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
  // The middle of the estimate's range (as EcoLogits' own mean); the tooltip has the range
  if (stats.est_energy_wh !== undefined)
    parts.push(
      `⚡ ~${formatEnergy((stats.est_energy_wh.min + stats.est_energy_wh.max) / 2)}`,
    );
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
    lines.push(
      `Before output: ${(stats.ttft_ms / 1000).toFixed(2)} s (loading the model and reading the prompt)`,
    );
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
  if (stats.est_energy_wh !== undefined)
    lines.push(
      `Energy: ${formatEnergyRange(stats.est_energy_wh)} (estimated by EcoLogits)`,
    );
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

/** The unit that keeps an energy of `wh` Wh to a few digits: mWh below 1 Wh, kWh from 1,000. */
function energyUnit(wh: number): [string, number] {
  if (wh < 1) return ["mWh", 1000];
  if (wh >= 1000) return ["kWh", 0.001];
  return ["Wh", 1];
}

/** A number to two significant digits, e.g. 7.8, 20, 0.53. */
const twoDigits = (x: number) =>
  x === 0 ? "0" : String(Number(x.toPrecision(2)));

/** An energy given in Wh, in the unit that suits its size, e.g. "14 mWh", "1.8 Wh". */
export function formatEnergy(wh: number): string {
  const [unit, scale] = energyUnit(wh);
  return `${twoDigits(wh * scale)} ${unit}`;
}

/**
 * An estimated energy range given in Wh, both ends in the unit that suits
 * the larger, e.g. "7.8–20 mWh", or "23 mWh" when it isn't a range.
 */
export function formatEnergyRange(range: { min: number; max: number }): string {
  const [unit, scale] = energyUnit(range.max);
  const min = twoDigits(range.min * scale);
  const max = twoDigits(range.max * scale);
  return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`;
}

// The labs of OpenRouter model IDs that are EcoLogits providers
const OPENROUTER_LABS: Dict<string> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google_genai",
  mistralai: "mistralai",
  cohere: "cohere",
};

/**
 * The EcoLogits provider and model name of a ChainForge model, where EcoLogits
 * has the model. EcoLogits estimates for its providers' data centres, so local
 * models, and providers it doesn't cover, have none.
 */
export function ecologitsModel(
  llm: string,
  provider: LLMProvider | undefined,
): [string, string] | undefined {
  const candidates: [string, string][] = [];
  if (provider === LLMProvider.OpenAI) candidates.push(["openai", llm]);
  else if (provider === LLMProvider.Anthropic)
    candidates.push(["anthropic", llm]);
  else if (provider === LLMProvider.Google)
    candidates.push(["google_genai", llm.replace(/^models\//, "")]);
  else if (provider === LLMProvider.HuggingFace)
    // A ":provider" suffix picks which Inference Provider serves the model
    candidates.push([
      "huggingface_hub",
      stripHuggingFacePrefix(llm).split(":")[0],
    ]);
  else if (
    provider === LLMProvider.OpenRouter &&
    !isOpenRouterImageModel(llm)
  ) {
    // e.g. "anthropic/claude-sonnet-4.5", or "meta-llama/llama-3.1-8b-instruct:free"
    const id = stripOpenRouterPrefix(llm).split(":")[0];
    const slash = id.indexOf("/");
    const lab = OPENROUTER_LABS[id.substring(0, slash).toLowerCase()];
    if (lab) candidates.push([lab, id.substring(slash + 1)]);
    // Open-weights models go by their Hugging Face ID
    candidates.push(["huggingface_hub", id]);
  }
  return candidates.find(([p, name]) => findModel(p, name) !== undefined);
}

/**
 * EcoLogits' energy estimate for a model's requests, or undefined where
 * EcoLogits doesn't cover the model. The estimate is a nicety: if it fails,
 * the response keeps its other stats rather than being lost.
 */
export function energyEstimator(
  llm: string,
  provider: LLMProvider | undefined,
): EnergyEstimator | undefined {
  const model = ecologitsModel(llm, provider);
  if (!model) return undefined;
  const [ecoProvider, name] = model;
  return (outputTokens, latencyMs) => {
    try {
      return estimateEnergyWh(
        ecoProvider,
        name,
        outputTokens,
        latencyMs / 1000,
      );
    } catch (err) {
      console.warn(`Could not estimate the energy of ${llm}:`, err);
      return undefined;
    }
  };
}
