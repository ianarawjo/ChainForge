/*
 * @jest-environment jsdom
 */
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {
    static getInstance() {
      return new StorageCache();
    }
  },
  StringLookup: { get: (x: unknown) => x },
  MediaLookup: {},
}));
jest.mock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => ({
  __esModule: true,
  default: { getState: () => ({ AvailableLLMs: [] }) },
}));

// eslint-disable-next-line import/first
import { afterEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { call_ollama_provider } from "../utils";
// eslint-disable-next-line import/first
import { UserForcedPrematureExit } from "../errors";
// eslint-disable-next-line import/first
import { extract_stats } from "../responseStats";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const params = () => ({
  ollama_url: "http://localhost:11434/api",
  ollamaModel: "gemma3:1b",
  model_type: "chat",
});

describe("Ollama", () => {
  test("replies are read from the chat endpoint", async () => {
    const fetchMock = jest.fn(async (..._args: any[]) => ({
      text: async () => JSON.stringify({ message: { content: "Paris" } }),
    }));
    globalThis.fetch = fetchMock as any;

    const [, responses] = await call_ollama_provider(
      "Capital of France?",
      "ollama",
      1,
      1.0,
      params(),
      () => false,
    );
    expect(responses).toEqual([
      expect.objectContaining({ generated_text: "Paris" }),
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:11434/api/chat",
    );
  });

  test("replies keep Ollama's timings and token counts, for response stats", async () => {
    globalThis.fetch = jest.fn(async () => ({
      text: async () =>
        JSON.stringify({
          message: { content: "Paris" },
          prompt_eval_count: 11,
          prompt_eval_duration: 2e8,
          load_duration: 1e8,
          eval_count: 60,
          eval_duration: 1.5e9,
          context: [1, 2, 3], // not kept
        }),
    })) as any;

    const [, responses] = await call_ollama_provider(
      "Capital of France?",
      "ollama",
      2,
      1.0,
      params(),
      () => false,
    );
    expect(responses[0]).not.toHaveProperty("context");
    const stats = extract_stats(responses, 999, 2);
    expect(stats).toHaveLength(2);
    expect(stats?.[0]).toMatchObject({
      ttft_ms: 300,
      input_tokens: 11,
      output_tokens: 60,
      decode_tokens_per_s: 40,
    });
    // Each request's own time, rather than a share of the whole call's
    expect(stats?.[0]?.latency_ms).toBeLessThan(999);
  });

  test("canceling aborts a request Ollama is still working on", async () => {
    // A request that never finishes, unless aborted
    let signal: AbortSignal | undefined;
    globalThis.fetch = jest.fn(
      (_url: any, init: any) =>
        new Promise((_resolve, reject) => {
          signal = init.signal;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ) as any;

    let canceled = false;
    setTimeout(() => (canceled = true), 100);
    await expect(
      call_ollama_provider(
        "Capital of France?",
        "ollama",
        1,
        1.0,
        params(),
        () => canceled,
      ),
    ).rejects.toBeInstanceOf(UserForcedPrematureExit);
    expect(signal?.aborted).toBe(true);
  });
});
