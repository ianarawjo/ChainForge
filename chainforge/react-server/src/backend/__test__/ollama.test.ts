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
    expect(responses).toEqual([{ generated_text: "Paris" }]);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:11434/api/chat",
    );
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
