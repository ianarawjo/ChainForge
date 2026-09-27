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
// Measuring energy through the ChainForge server: off, unless a test says otherwise
jest.mock("../localEnergy", () => ({
  beginEnergy: jest.fn(async () => undefined),
  endEnergy: jest.fn(async () => undefined),
  isLoopbackUrl: jest.requireActual("../localEnergy").isLoopbackUrl,
}));

// eslint-disable-next-line import/first
import { afterEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { call_ollama_provider } from "../utils";
// eslint-disable-next-line import/first
import { UserForcedPrematureExit } from "../errors";
// eslint-disable-next-line import/first
import { extract_stats } from "../responseStats";
// eslint-disable-next-line import/first
import { beginEnergy, endEnergy } from "../localEnergy";

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

describe("Ollama energy", () => {
  const begin = beginEnergy as jest.Mock;
  const end = endEnergy as jest.Mock;
  afterEach(() => {
    begin.mockReset().mockResolvedValue(undefined);
    end.mockReset().mockResolvedValue(undefined);
  });

  test("each request's measured energy reaches its stats", async () => {
    begin.mockResolvedValue("req-1");
    end.mockResolvedValue({
      energy_wh: 0.08534,
      noise_wh: 0.00035,
      components_wh: { gpu: 0.0464, cpu: 0.0198, dram: 0.0192, ane: 0 },
      load_energy_wh: 0.00303,
      shared: false,
    });
    globalThis.fetch = jest.fn(async () => ({
      text: async () =>
        JSON.stringify({
          message: { content: "Paris" },
          total_duration: 7.1e9,
          load_duration: 1.58e9,
          prompt_eval_duration: 9e7,
          eval_count: 507,
          eval_duration: 5.4e9,
        }),
    })) as any;

    const [, responses] = await call_ollama_provider(
      "Capital of France?",
      "ollama",
      1,
      1.0,
      params(),
      () => false,
    );
    // The server gets Ollama's own timings, in seconds
    expect(begin).toHaveBeenCalledWith("http://localhost:11434/api/chat");
    expect(end.mock.calls[0][0]).toBe("req-1");
    expect(end.mock.calls[0][2]).toEqual({
      load_s: 1.58,
      generation_s: expect.closeTo(5.49, 6),
      total_s: 7.1,
    });
    const [stats] = extract_stats(responses, 999, 1) ?? [];
    expect(stats).toMatchObject({
      energy_wh: 0.0853,
      energy_noise_wh: 0.00035,
      energy_parts_wh: { gpu: 0.0464, cpu: 0.0198, dram: 0.0192, ane: 0 },
      load_energy_wh: 0.00303,
    });
    expect(stats).not.toHaveProperty("energy_shared");
  });

  test("a failed request is dropped, so it isn't left running", async () => {
    begin.mockResolvedValue("req-2");
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as any;
    await expect(
      call_ollama_provider("Q", "ollama", 1, 1.0, params(), () => false),
    ).rejects.toThrow("Failed to fetch");
    // Ended without timings, i.e. dropped
    expect(end).toHaveBeenCalledWith("req-2", expect.any(Number));
  });

  test("an error reply has no timings, so it's dropped too", async () => {
    begin.mockResolvedValue("req-3");
    globalThis.fetch = jest.fn(async () => ({
      text: async () => JSON.stringify({ error: "model not found" }),
    })) as any;
    await call_ollama_provider("Q", "ollama", 1, 1.0, params(), () => false);
    expect(end).toHaveBeenCalledWith("req-3", expect.any(Number), undefined);
  });
});

describe("Ollama requests", () => {
  test("run one at a time, even across models and calls", async () => {
    let running = 0;
    let most = 0;
    globalThis.fetch = jest.fn(async (_url: any, init: any) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      const model = JSON.parse(init.body).model;
      return { text: async () => JSON.stringify({ response: model }) };
    }) as any;
    const call = (model: string, n: number) =>
      call_ollama_provider(
        "Q",
        "ollama",
        n,
        1.0,
        { ...params(), ollamaModel: model, model_type: "text" },
        () => false,
      );
    const results = await Promise.all([
      call("a", 2),
      call("b", 2),
      call("c", 1),
    ]);
    expect(most).toBe(1);
    expect(results.map(([, r]) => r.map((x: any) => x.generated_text))).toEqual(
      [["a", "a"], ["b", "b"], ["c"]],
    );
  });

  test("one failing doesn't hold up the next", async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({
        text: async () => JSON.stringify({ response: "ok" }),
      }) as any;
    const call = () =>
      call_ollama_provider("Q", "ollama", 1, 1.0, params(), () => false);
    const [first, second] = await Promise.allSettled([call(), call()]);
    expect(first.status).toBe("rejected");
    expect(second.status).toBe("fulfilled");
  });

  test("cancelling one waiting its turn leaves the queue at once", async () => {
    // The first request takes a while; the second is cancelled while it waits
    let finishFirst!: () => void;
    const firstDone = new Promise<void>((r) => (finishFirst = r));
    let running = 0;
    let most = 0;
    globalThis.fetch = jest.fn(async (_url: any, init: any) => {
      running++;
      most = Math.max(most, running);
      if (JSON.parse(init.body).model === "slow") await firstDone;
      running--;
      return { text: async () => JSON.stringify({ response: "ok" }) };
    }) as any;
    const call = (model: string, cancel: () => boolean) =>
      call_ollama_provider(
        "Q",
        "ollama",
        1,
        1.0,
        { ...params(), ollamaModel: model, model_type: "text" },
        cancel,
      );
    let cancelSecond = false;
    let firstFinished = false;
    const first = call("slow", () => false).then((r) => {
      firstFinished = true;
      return r;
    });
    const second = call("b", () => cancelSecond);
    const third = call("c", () => false);
    cancelSecond = true;
    // Rejected within the cancel check's interval, while the first still runs
    await expect(second).rejects.toBeInstanceOf(UserForcedPrematureExit);
    expect(firstFinished).toBe(false);
    finishFirst();
    await first;
    await third;
    expect(most).toBe(1); // the third still waited for the first
  });

  test("one server's endpoints share its queue", async () => {
    let running = 0;
    let most = 0;
    globalThis.fetch = jest.fn(async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      return {
        text: async () =>
          JSON.stringify({ response: "ok", message: { content: "ok" } }),
      };
    }) as any;
    const remote = (model_type: string) =>
      call_ollama_provider(
        "Q",
        "ollama",
        1,
        1.0,
        { ...params(), ollama_url: "http://gpu-box.lab:11434/api", model_type },
        () => false,
      );
    // /api/chat and /api/generate on the same remote server
    await Promise.all([remote("chat"), remote("text"), remote("chat")]);
    expect(most).toBe(1);
  });

  test("a request after a cancelled one still waits for those before it", async () => {
    let finishFirst!: () => void;
    const firstDone = new Promise<void>((r) => (finishFirst = r));
    let running = 0;
    let most = 0;
    globalThis.fetch = jest.fn(async (_url: any, init: any) => {
      running++;
      most = Math.max(most, running);
      if (JSON.parse(init.body).model === "slow") await firstDone;
      running--;
      return { text: async () => JSON.stringify({ response: "ok" }) };
    }) as any;
    const call = (model: string, cancel: () => boolean) =>
      call_ollama_provider(
        "Q",
        "ollama",
        1,
        1.0,
        { ...params(), ollamaModel: model, model_type: "text" },
        cancel,
      );
    const first = call("slow", () => false);
    let cancelSecond = false;
    const second = call("b", () => cancelSecond);
    await new Promise((r) => setTimeout(r, 10)); // it's waiting its turn now
    cancelSecond = true;
    await expect(second).rejects.toBeInstanceOf(UserForcedPrematureExit);
    // Arrives after the cancelled one has left: must still wait for the first
    const third = call("c", () => false);
    await new Promise((r) => setTimeout(r, 50));
    finishFirst();
    await Promise.all([first, third]);
    expect(most).toBe(1);
  });
});
