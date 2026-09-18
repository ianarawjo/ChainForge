/*
 * @jest-environment jsdom
 */

// Same module stubs as reasoning.test.ts, since the metavar helpers live in utils.
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
import { describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  LATENCY_KEY,
  describeStats,
  extract_stats,
  formatStats,
  isStatsMetavar,
  statsToMetavars,
} from "../responseStats";
// eslint-disable-next-line import/first
import {
  REASONING_METAVAR,
  cleanMetavarsFilterFunc,
  merge_response_objs,
  withResponseMetavars,
  withoutResponseMetavars,
} from "../utils";
// eslint-disable-next-line import/first
import { RawLLMResponseObject } from "../typing";

describe("extract_stats", () => {
  test("reads Ollama's own timings, one reply per response", () => {
    const reply = (evalCount: number, latency: number) => ({
      generated_text: "hi",
      prompt_eval_count: 12,
      eval_count: evalCount,
      eval_duration: 2e9, // 2 s of decoding
      load_duration: 5e8,
      prompt_eval_duration: 1e8,
      total_duration: 3e9,
      [LATENCY_KEY]: latency,
    });
    const stats = extract_stats([reply(100, 3100), reply(50, 2900)], 6000, 2);
    expect(stats).toEqual([
      {
        latency_ms: 3100, // ChainForge's own measurement wins over total_duration
        ttft_ms: 600,
        input_tokens: 12,
        output_tokens: 100,
        tokens_per_s: 32.3, // over the whole request, as for every provider
        decode_tokens_per_s: 50, // as Ollama measured it
      },
      {
        latency_ms: 2900,
        ttft_ms: 600,
        input_tokens: 12,
        output_tokens: 50,
        tokens_per_s: 17.2,
        decode_tokens_per_s: 25,
      },
    ]);
  });

  test("uses llama.cpp's timings where an OpenAI-compatible server gives them", () => {
    const reply = {
      choices: [{ message: { content: "x" } }],
      usage: { prompt_tokens: 7, completion_tokens: 40 },
      timings: { prompt_ms: 35.4, predicted_per_second: 81.26 },
      [LATENCY_KEY]: 520,
    };
    expect(extract_stats([reply], 530, 1)).toEqual([
      {
        latency_ms: 520,
        ttft_ms: 35,
        input_tokens: 7,
        output_tokens: 40,
        tokens_per_s: 76.9,
        decode_tokens_per_s: 81.3,
      },
    ]);
  });

  test("speed is output tokens over latency", () => {
    const reply = {
      choices: [{ message: { content: "x" } }],
      usage: { prompt_tokens: 7, completion_tokens: 40 },
      [LATENCY_KEY]: 2000,
    };
    expect(extract_stats([reply], 2000, 1)?.[0]?.tokens_per_s).toBe(20);
  });

  test("several choices from one request share its latency, and average its output tokens", () => {
    const reply = {
      choices: [{}, {}, {}, {}],
      usage: { prompt_tokens: 10, completion_tokens: 400 },
    };
    const stats = extract_stats(reply, 4000, 4);
    expect(stats).toHaveLength(4);
    expect(stats?.[0]).toEqual({
      latency_ms: 4000,
      input_tokens: 10,
      output_tokens: 100,
      tokens_per_s: 25,
      averaged_over: 4, // the provider only reports the request's total
    });
  });

  test("replies without their own times get the average of the call's time", () => {
    const reply = { usage: { input_tokens: 5, output_tokens: 10 } }; // Anthropic's shape
    const stats = extract_stats([reply, reply], 3000, 2);
    expect(stats?.map((s) => s?.latency_ms)).toEqual([1500, 1500]);
    expect(stats?.[0]?.output_tokens).toBe(10);
    expect(stats?.[0]?.averaged_over).toBe(2);
  });

  test("stats from a reply of its own aren't marked as averages", () => {
    const reply = {
      usage: { input_tokens: 5, output_tokens: 10 },
      [LATENCY_KEY]: 800,
    };
    const stats = extract_stats([reply, reply], 3000, 2);
    expect(stats?.[0]).not.toHaveProperty("averaged_over");
    expect(stats?.[0]?.latency_ms).toBe(800);
  });

  test("reads a provider's reply kept under `raw`", () => {
    // How Bedrock and Hugging Face responses are stored
    const reply = {
      generated_text: "hi",
      raw: { usage: { inputTokens: 4, outputTokens: 8 } },
      [LATENCY_KEY]: 400,
    };
    expect(extract_stats([reply], 999, 1)?.[0]).toEqual({
      latency_ms: 400,
      input_tokens: 4,
      output_tokens: 8,
      tokens_per_s: 20,
    });
  });

  test("reads Gemini's and Bedrock's shapes", () => {
    const gemini = {
      usageMetadata: {
        promptTokenCount: 3,
        candidatesTokenCount: 20,
        thoughtsTokenCount: 30,
      },
    };
    expect(extract_stats([gemini], 1000, 1)?.[0]).toMatchObject({
      input_tokens: 3,
      output_tokens: 50,
    });
    const bedrock = {
      usage: { inputTokens: 4, outputTokens: 8 },
      metrics: { latencyMs: 640 },
    };
    expect(extract_stats([bedrock], 700, 1)?.[0]).toMatchObject({
      latency_ms: 640,
      input_tokens: 4,
      output_tokens: 8,
    });
  });

  test("reads WebLLM's per-completion usage", () => {
    const reply = {
      choices: [{}, {}],
      usages: [
        {
          prompt_tokens: 9,
          completion_tokens: 30,
          extra: { decode_tokens_per_s: 42.04, time_to_first_token_s: 0.25 },
          [LATENCY_KEY]: 900,
        },
        { prompt_tokens: 9, completion_tokens: 10, [LATENCY_KEY]: 500 },
      ],
    };
    expect(extract_stats(reply, 1400, 2)).toEqual([
      {
        latency_ms: 900,
        ttft_ms: 250,
        input_tokens: 9,
        output_tokens: 30,
        tokens_per_s: 33.3,
        decode_tokens_per_s: 42,
      },
      { latency_ms: 500, input_tokens: 9, output_tokens: 10, tokens_per_s: 20 },
    ]);
  });

  test("replies that don't line up with the responses only give the time", () => {
    // e.g. a custom provider returning plain strings
    expect(extract_stats(["a", "b"], 1000, 2)).toEqual([
      { latency_ms: 500, averaged_over: 2 },
      { latency_ms: 500, averaged_over: 2 },
    ]);
    // A single response's time is its own
    expect(extract_stats(["a"], 1000, 1)).toEqual([{ latency_ms: 1000 }]);
    expect(extract_stats(["a"], undefined, 1)).toBeUndefined();
  });
});

describe("stats as metavars", () => {
  const stats = {
    latency_ms: 2345,
    ttft_ms: 120,
    input_tokens: 10,
    output_tokens: 99,
    tokens_per_s: 42.5,
    decode_tokens_per_s: 60,
  };

  test("are in seconds, under names evaluators can read", () => {
    expect(statsToMetavars(stats)).toEqual({
      stat_latency_s: 2.345,
      stat_ttft_s: 0.12,
      stat_input_tokens: 10,
      stat_output_tokens: 99,
      stat_tokens_per_s: 42.5,
      stat_decode_tokens_per_s: 60,
    });
    expect(statsToMetavars({ ...stats, averaged_over: 4 })).toMatchObject({
      stat_averaged_over: 4,
    });
    expect(statsToMetavars(undefined)).toEqual({});
  });

  test("belong to their response alone", () => {
    const obj = {
      metavars: { topic: "math" },
      reasoning: ["because", null],
      stats: [stats, null],
    };
    const first = withResponseMetavars(obj.metavars, obj, 0);
    expect(first).toMatchObject({
      topic: "math",
      [REASONING_METAVAR]: "because",
      stat_tokens_per_s: 42.5,
    });
    // Without reasoning or stats, the metavars are returned as they are
    expect(withResponseMetavars(obj.metavars, obj, 1)).toBe(obj.metavars);
    // ...and a later response doesn't carry them as its own
    expect(withoutResponseMetavars(first)).toEqual({ topic: "math" });
  });

  test("aren't offered to group by", () => {
    for (const name of Object.keys(statsToMetavars(stats))) {
      expect(isStatsMetavar(name)).toBe(true);
      expect(cleanMetavarsFilterFunc(name)).toBe(false);
    }
    expect(cleanMetavarsFilterFunc("topic")).toBe(true);
    // A metavar of the user's own with a stat's plain name is theirs
    expect(cleanMetavarsFilterFunc("output_tokens")).toBe(true);
    expect(withoutResponseMetavars({ output_tokens: 5 })).toEqual({
      output_tokens: 5,
    });
  });

  test("line up with responses when response objects merge", () => {
    const base = { prompt: "p", llm: "m", vars: {}, metavars: {}, uid: "u" };
    const A = {
      ...base,
      responses: ["a1", "a2"],
      stats: [{ latency_ms: 1 }, { latency_ms: 2 }],
    } as RawLLMResponseObject;
    const B = { ...base, responses: ["b1"] } as RawLLMResponseObject;
    expect(merge_response_objs(A, B)?.stats).toEqual([
      { latency_ms: 1 },
      { latency_ms: 2 },
      null,
    ]);
  });
});

test("formats stats for display", () => {
  const stats = { latency_ms: 2400, output_tokens: 312, tokens_per_s: 130.4 };
  expect(formatStats(stats)).toBe("2.4 s · 312 tok · 130 tok/s");
  expect(formatStats(stats, true)).toBe("2.4 s · 130 tok/s");
  expect(formatStats({ latency_ms: 850 })).toBe("850 ms");
  expect(describeStats({ ...stats, decode_tokens_per_s: 150 })).toEqual([
    "Latency: 2.40 s",
    "Output tokens: 312",
    "Speed: 130.4 tokens/s (output tokens over latency)",
    "Decoding speed: 150 tokens/s (measured by the server)",
  ]);
  // Averages are marked
  const averaged = { ...stats, averaged_over: 4 };
  expect(formatStats(averaged, true)).toBe("≈ 2.4 s · 130 tok/s");
  expect(describeStats(averaged).at(-1)).toBe(
    "≈ Averages: the provider reported one total for 4 responses",
  );
});
