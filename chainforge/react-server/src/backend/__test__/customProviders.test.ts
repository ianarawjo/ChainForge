/*
 * @jest-environment jsdom
 */

// Same module stubs as responseStats.test.ts, since the calls live in utils.
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {
    static getInstance() {
      return new StorageCache();
    }
  },
  StringLookup: { get: (x: unknown) => x },
  MediaLookup: { get: async () => undefined },
}));
jest.mock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: jest.fn() }),
  },
}));

// eslint-disable-next-line import/first
import { afterEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  LATENCY_KEY,
  describeStats,
  extract_stats,
  plottableStat,
} from "../responseStats";
// eslint-disable-next-line import/first
import {
  call_llm,
  custom_provider_reply,
  extract_reasoning,
  extract_responses,
} from "../utils";
// eslint-disable-next-line import/first
import {
  LLMProvider,
  MAX_CONCURRENT,
  RateLimiter,
  rateLimitKey,
} from "../models";
// eslint-disable-next-line import/first
import { Dict } from "../typing";

const LLM = "__custom/LabServer/gemma3:1b";

/** Calls the provider as a Prompt Node does, with the server's replies faked. */
async function run(replies: unknown[], n = replies.length) {
  const queue = [...replies];
  const fetchMock = jest.fn(async (_url: unknown, init?: RequestInit) => ({
    json: async () => ({ response: queue.shift() }),
    body: init?.body,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  const [, response] = await call_llm(LLM, LLMProvider.Custom, "Hi", n, 0.5);
  return {
    sent: JSON.parse(fetchMock.mock.calls[0][1]?.body as string),
    responses: extract_responses(response, LLM, LLMProvider.Custom),
    reasoning: extract_reasoning(response, LLM, LLMProvider.Custom),
    stats: extract_stats(response, 10_000, n, undefined),
  };
}

afterEach(() => {
  // @ts-expect-error reset between tests
  delete global.fetch;
});

describe("custom providers", () => {
  test("a reply that's just text works as it always has", async () => {
    const { sent, responses, reasoning, stats } = await run(["A", "B"]);
    expect(sent).toMatchObject({
      name: "LabServer",
      params: { prompt: "Hi", model: "gemma3:1b", temperature: 0.5 },
    });
    expect(responses).toEqual(["A", "B"]);
    expect(reasoning).toBeUndefined();
    // Each gets its own call's time, as ChainForge timed it
    expect(stats).toHaveLength(2);
    stats?.forEach((s) => {
      expect(s?.latency_ms).toBeGreaterThanOrEqual(0);
      expect(s?.averaged_over).toBeUndefined();
    });
  });

  test("a reply with what the provider knows is read under ChainForge's names", async () => {
    const { responses, reasoning, stats } = await run([
      {
        text: "Hello!",
        reasoning: "They said hi.",
        input_tokens: 12,
        output_tokens: 40,
        latency_ms: 2000,
        ttft_ms: 180,
        decode_tokens_per_s: 31.24,
        cost_usd: 0.0001,
        energy: {
          energy_wh: 0.081,
          noise_wh: 0.002,
          components_wh: { gpu0: 0.06, gpu1: 0.021 },
          conditions: { power_source: "AC power" },
        },
      },
    ]);
    expect(responses).toEqual(["Hello!"]);
    expect(reasoning).toEqual(["They said hi."]);
    expect(stats?.[0]).toEqual({
      input_tokens: 12,
      output_tokens: 40,
      latency_ms: 2000, // the server's, not ChainForge's timing of the call
      ttft_ms: 180,
      tokens_per_s: 20,
      decode_tokens_per_s: 31.2,
      cost_usd: 0.0001,
      energy_wh: 0.081,
      energy_noise_wh: 0.002,
      energy_parts_wh: { gpu0: 0.06, gpu1: 0.021 },
      energy_conditions: { power_source: "AC power" },
      energy_reported_by: "LabServer",
    });
    const lines = describeStats(stats?.[0] ?? undefined);
    expect(lines).toContain("Energy: 81 mWh (reported by LabServer, ± 2 mWh)");
    expect(plottableStat("__stat_energy_mwh")!.describe(stats![0]!)).toBe(
      "Energy: 81 mWh (reported by LabServer)",
    );
  });

  test("a provider's own energy estimate says whose it is", async () => {
    const { stats } = await run([
      { text: "x", output_tokens: 10, est_energy_wh: { min: 0.01, max: 0.03 } },
    ]);
    expect(stats?.[0]?.est_energy_wh).toEqual({ min: 0.01, max: 0.03 });
    expect(describeStats(stats?.[0] ?? undefined)).toContain(
      "Energy: 10–30 mWh (estimated by LabServer)",
    );
  });

  test("what isn't a number ChainForge can use is left out", async () => {
    const { stats } = await run([
      { text: "x", output_tokens: -3, latency_ms: "fast", input_tokens: 5 },
    ]);
    expect(stats?.[0]?.input_tokens).toBe(5);
    expect(stats?.[0]?.output_tokens).toBeUndefined();
    // ChainForge's own timing, in place of the provider's
    expect(stats?.[0]?.latency_ms).toBeGreaterThanOrEqual(0);
    expect(stats?.[0]?.energy_reported_by).toBeUndefined();
  });

  test("responses saved before replies could say more still read", () => {
    const old: unknown = ["A", { t: "img", d: "aGk=" }];
    expect(extract_responses(old as Dict, LLM, LLMProvider.Custom)).toEqual([
      "A",
      { t: "img", d: "aGk=" },
    ]);
  });

  test("an image reply is kept as an image", () => {
    const image = { t: "img", d: "aGk=" };
    const reply = custom_provider_reply(image, "LabServer", 12);
    expect(reply).toEqual({ [LATENCY_KEY]: 12, image });
    expect(extract_responses([reply], LLM, LLMProvider.Custom)).toEqual([
      image,
    ]);
  });

  test("a dict without its text is an error", () => {
    expect(() =>
      custom_provider_reply({ output_tokens: 3 }, "LabServer", 1),
    ).toThrow('a dict with the response\'s "text"');
  });
});

describe("a custom provider's rate limit", () => {
  test("is its own, shared by all its models", () => {
    expect(rateLimitKey("__custom/LabServer/gemma3:1b")).toBe(
      "__custom/LabServer",
    );
    expect(rateLimitKey("__custom/LabServer")).toBe("__custom/LabServer");
    expect(rateLimitKey("gpt-4o")).toBe("gpt-4o");
  });

  test('"sequential" sends one request at a time, whichever model', async () => {
    // As setCustomProvider registers a provider with rate_limit="sequential"
    MAX_CONCURRENT["__custom/Seq"] = 1;
    let running = 0;
    let most = 0;
    const request = async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 30));
      running -= 1;
    };
    await Promise.all(
      ["__custom/Seq/a", "__custom/Seq/b", "__custom/Seq/a"].map((m) =>
        RateLimiter.throttle(m, LLMProvider.Custom, request),
      ),
    );
    expect(most).toBe(1);
  });
});
