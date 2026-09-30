/*
 * @jest-environment jsdom
 */
// Same stubs as jev.test.ts: Pyodide can't load under CRA's Jest, and the
// real store imports ModelSettingSchemas mid-cycle.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));
// Measuring energy through the ChainForge server: off, unless a test says otherwise
jest.mock("../localEnergy", () => ({
  beginEnergy: jest.fn(async () => undefined),
  endEnergy: jest.fn(async () => undefined),
  isLoopbackUrl: jest.requireActual("../localEnergy").isLoopbackUrl,
}));

// eslint-disable-next-line import/first
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { call_llm, call_ollama_provider, extract_responses } from "../utils";
// eslint-disable-next-line import/first
import {
  LLMProvider,
  NativeLLM,
  getProvider,
  isDecisionModel,
  isOllamaDecisionModelName,
  offeredInMenu,
} from "../models";
// eslint-disable-next-line import/first
import { evalWithLLM } from "../backend";
// eslint-disable-next-line import/first
import StorageCache, { StringLookup } from "../cache";
// eslint-disable-next-line import/first
import { Dict, LLMGroup, LLMResponse, LLMSpec } from "../typing";
// eslint-disable-next-line import/first
import { scoreSpecFrom } from "../scorerFormat";
// eslint-disable-next-line import/first
import { describeStats, extract_stats } from "../responseStats";
// eslint-disable-next-line import/first
import { beginEnergy, endEnergy } from "../localEnergy";
// eslint-disable-next-line import/first
import { UserForcedPrematureExit } from "../errors";

const DECISION = NativeLLM.Ollama_Decision;
const SYSTEMONE_URL = "http://localhost:11434/v1/systemone";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Call = { url: string; body: Dict };
let calls: Call[] = [];

/**
 * Replaces fetch with a fake Ollama: /v1/systemone answers with `decide(body)`
 * (or, given a status and body, replies with those), other endpoints with text.
 */
const mockOllama = (
  decide: (body: Dict) => Dict | { status: number; body: string },
) => {
  calls = [];
  globalThis.fetch = jest.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    calls.push({ url, body });
    if (!url.endsWith("/v1/systemone"))
      return { status: 200, text: async () => '{"response":"text"}' };
    const out = decide(body);
    if ("status" in out && typeof out.body === "string")
      return { status: out.status, text: async () => out.body };
    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          model: body.model,
          answers: { score: out },
          usage: { input_tokens: 90, output_tokens: 1 },
        }),
    };
  }) as any;
};

const params = (extra: Dict = {}) => ({
  ollama_url: "http://localhost:11434",
  ollamaModel: "nimble",
  decision_question: { type: "noul", instructions: "Is it polite?" },
  ...extra,
});

const ask = (p: Dict, n = 1, images?: string[]) =>
  call_llm(
    DECISION,
    LLMProvider.OllamaDecision,
    "Thanks so much!",
    n,
    1.0,
    p,
    () => false,
    images,
  );

describe("recognizing Ollama's decision models", () => {
  test("its own provider, a decision model, and pulled models by name", () => {
    expect(getProvider(DECISION)).toBe(LLMProvider.OllamaDecision);
    expect(getProvider(NativeLLM.Ollama)).toBe(LLMProvider.Ollama);
    expect(isDecisionModel(DECISION)).toBe(true);
    expect(isDecisionModel(NativeLLM.Ollama)).toBe(false);
    for (const name of ["nimble", "nimble:latest", "tev1", "tev1:0.8b"])
      expect(isOllamaDecisionModelName(name)).toBe(true);
    for (const name of ["gemma4:e4b", "nimbler", "llama3", "tevatron"])
      expect(isOllamaDecisionModelName(name)).toBe(false);
  });

  test("model menus offer them only where decisions are allowed", () => {
    const spec = (base_model: string): LLMSpec => ({
      name: base_model,
      emoji: "🦙",
      model: base_model,
      base_model,
      temp: 0,
    });
    const group: LLMGroup = {
      group: "Ollama (decision model)",
      emoji: "🦙",
      items: [spec(DECISION)],
    };
    expect(offeredInMenu(spec(DECISION), false)).toBe(false);
    expect(offeredInMenu(group, false)).toBe(false);
    expect(offeredInMenu(spec("ollama"), false)).toBe(true);
    expect(offeredInMenu(spec(DECISION), true)).toBe(true);
    expect(offeredInMenu(group, true)).toBe(true);
    // Jev shares OpenRouter's form with text models, so is offered as before
    expect(offeredInMenu(spec("openrouter"), false)).toBe(true);
  });
});

describe("asking an Ollama decision model", () => {
  test("posts the text as state to /v1/systemone, and reads each answer type", async () => {
    const answers: Dict[] = [
      { type: "noul", noul: 0.9 },
      {
        type: "choice",
        choice: "praise",
        probabilities: { praise: 0.75, complaint: 0.25 },
        confidence: 0.5,
      },
      { type: "score", score: 3, legend: {}, confidence: 0.4 },
    ];
    let i = 0;
    mockOllama(() => answers[i++]);
    const [query, replies] = await ask(params(), 3);
    expect(calls[0].url).toBe(SYSTEMONE_URL);
    expect(calls[0].body).toEqual({
      model: "nimble",
      state: { response: "Thanks so much!" },
      questions: {
        score: { type: "noul", instructions: "Is it polite?" },
      },
    });
    expect(query.model).toBe("nimble");
    expect(
      extract_responses(replies, DECISION, LLMProvider.OllamaDecision).map(
        (r) => JSON.parse(r as string),
      ),
    ).toEqual([
      { answer: "true", p: 0.9 },
      { answer: "praise", p: 0.75 },
      { answer: "4" },
    ]);
  });

  test("a base URL ending in /api (as the Ollama form's does) works too", async () => {
    mockOllama(() => ({ type: "noul", noul: 0.9 }));
    await ask(params({ ollama_url: "http://localhost:11434/api/" }));
    expect(calls[0].url).toBe(SYSTEMONE_URL);
  });

  test("asked about an image, it says it reads text only, and sends nothing", async () => {
    mockOllama(() => ({ type: "noul", noul: 0.9 }));
    await expect(ask(params(), 1, ["media-uid-1"])).rejects.toThrow(
      /nimble reads text only/,
    );
    expect(calls).toHaveLength(0);
  });

  test("used outside an LLM Scorer, it says it can't write text", async () => {
    mockOllama(() => ({}));
    await expect(ask(params({ decision_question: undefined }))).rejects.toThrow(
      /nimble makes decisions rather than writing text/,
    );
    expect(calls).toHaveLength(0);
  });

  test("without a model name, it says to enter one", async () => {
    mockOllama(() => ({}));
    await expect(ask(params({ ollamaModel: "" }))).rejects.toThrow(
      /Enter the decision model/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("Ollama's errors, explained", () => {
  const failWith = (status: number, body: string) =>
    mockOllama(() => ({ status, body }));

  // The error bodies below are what Ollama 0.35.0 answers
  test("a model that isn't pulled: pull it", async () => {
    failWith(
      404,
      JSON.stringify({
        error: 'model "nimble" not found, try pulling it first',
      }),
    );
    await expect(ask(params())).rejects.toThrow("`ollama pull nimble`");
  });

  test("an Ollama without the endpoint: update it", async () => {
    // What Ollama 0.34 answers, as plain text
    failWith(404, "404 page not found");
    await expect(ask(params())).rejects.toThrow(/0\.35 or later/);
  });

  test("a text model: it isn't a decision model", async () => {
    failWith(
      400,
      JSON.stringify({
        error:
          'model "gemma3:1b" is not supported by System One; use a local Nimble or Tev GGUF model',
      }),
    );
    await expect(ask(params({ ollamaModel: "gemma3:1b" }))).rejects.toThrow(
      "gemma3:1b isn't a decision model",
    );
  });

  test("an invalid question: Ollama's own message", async () => {
    failWith(
      400,
      JSON.stringify({
        error: 'question "score": criteria must contain 2–26 candidates',
      }),
    );
    await expect(ask(params())).rejects.toThrow(/2–26 candidates/);
  });

  test("a response too long for the endpoint", async () => {
    failWith(
      413,
      JSON.stringify({ error: "request body must not exceed 64 KiB" }),
    );
    await expect(ask(params())).rejects.toThrow(/at most 64 KiB/);
  });

  test("the model failing", async () => {
    failWith(500, JSON.stringify({ error: "failed to load model" }));
    await expect(ask(params())).rejects.toThrow(/failed to load model/);
  });

  test("Ollama not running", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as any;
    await expect(ask(params())).rejects.toThrow(/Could not reach Ollama/);
  });
});

describe("an Ollama decision model's stats", () => {
  const begin = beginEnergy as jest.Mock;
  const end = endEnergy as jest.Mock;
  afterEach(() => {
    begin.mockReset().mockResolvedValue(undefined);
    end.mockReset().mockResolvedValue(undefined);
  });

  test("time and tokens, without server timings to read", async () => {
    mockOllama(() => ({ type: "noul", noul: 0.9 }));
    const [, replies] = await ask(params(), 2);
    const stats = extract_stats(replies, 99999, 2);
    expect(stats).toHaveLength(2);
    expect(stats?.[0]).toMatchObject({ input_tokens: 90, output_tokens: 1 });
    // Each request's own wall-clock time, rather than a share of the call's
    expect(stats?.[0]?.latency_ms).toBeLessThan(99999);
    expect(stats?.[0]).not.toHaveProperty("averaged_over");
    // Nothing made up from timings the reply doesn't have
    expect(stats?.[0]).not.toHaveProperty("ttft_ms");
    expect(stats?.[0]).not.toHaveProperty("decode_tokens_per_s");
    expect(stats?.[0]).not.toHaveProperty("energy_wh");
  });

  test("energy is measured over the request as timed here, load included", async () => {
    begin.mockResolvedValue("req-1");
    end.mockResolvedValue({
      energy_wh: 0.0123,
      noise_wh: 0.0002,
      components_wh: { gpu: 0.01, cpu: 0.0023 },
      load_energy_wh: null,
      shared: false,
    });
    mockOllama(() => ({ type: "noul", noul: 0.9 }));
    const [, replies] = await ask(params());
    expect(begin).toHaveBeenCalledWith(SYSTEMONE_URL);
    const timings = end.mock.calls[0][2] as Dict;
    expect(timings.load_s).toBe(0);
    expect(timings.generation_s).toBe(timings.total_s);
    expect(timings.total_s).toBeCloseTo(replies[0].__cf_latency_ms / 1000, 6);
    const [stats] = extract_stats(replies, undefined, 1) ?? [];
    expect(stats).toMatchObject({
      energy_wh: 0.0123,
      energy_includes_load: true,
    });
    expect(stats).not.toHaveProperty("load_energy_wh");
    expect(describeStats(stats ?? undefined).join("\n")).toMatch(
      /includes loading the model/,
    );
  });

  test("a failed request is dropped, not measured", async () => {
    begin.mockResolvedValue("req-2");
    mockOllama(() => ({ status: 500, body: '{"error":"boom"}' }));
    await expect(ask(params())).rejects.toThrow(/boom/);
    expect(end).toHaveBeenCalledWith("req-2", expect.any(Number));
  });
});

describe("Ollama decision requests", () => {
  test("wait in the same one-at-a-time queue as Ollama's text models", async () => {
    let running = 0;
    let most = 0;
    globalThis.fetch = jest.fn(async (url: string) => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      const body = url.endsWith("/v1/systemone")
        ? { answers: { score: { type: "noul", noul: 1 } } }
        : { response: "text" };
      return { status: 200, text: async () => JSON.stringify(body) };
    }) as any;
    await Promise.all([
      ask(params(), 2),
      call_ollama_provider(
        "Q",
        NativeLLM.Ollama,
        2,
        1.0,
        { ollama_url: "http://localhost:11434/api", ollamaModel: "gemma4" },
        () => false,
      ),
      ask(params({ ollamaModel: "tev1:0.8b" }), 1),
    ]);
    expect(most).toBe(1);
  });

  test("canceling aborts the request Ollama is working on", async () => {
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
      call_llm(
        DECISION,
        LLMProvider.OllamaDecision,
        "Q",
        1,
        1.0,
        params(),
        () => canceled,
      ),
    ).rejects.toBeInstanceOf(UserForcedPrematureExit);
    expect(signal?.aborted).toBe(true);
  });
});

describe("an Ollama decision model as a judge", () => {
  const judge = (name: string, ollamaModel: string): LLMSpec => ({
    key: `key-${name}`,
    name,
    emoji: "🦙",
    model: DECISION,
    base_model: DECISION,
    temp: 0,
    settings: { ollamaModel, ollama_url: "http://localhost:11434" },
  });
  const run = (id: string, spec: Dict, rubric: string) =>
    evalWithLLM(
      id,
      judge("nimble", "nimble"),
      "{__input}",
      ["prompt-1"],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      spec as any,
      rubric,
    );

  beforeEach(() => {
    StorageCache.clear();
    StringLookup.restoreFrom([]);
    StorageCache.store("prompt-1.json", [
      {
        uid: "r1",
        prompt: "Write a reply.",
        vars: {},
        metavars: {},
        llm: "GPT",
        responses: ["Thanks so much!", "Go away."],
      },
    ] as LLMResponse[]);
  });

  test("gets each response and a typed question, and its answers are scores", async () => {
    mockOllama((body) =>
      body.state.response.includes("Thanks")
        ? { type: "noul", noul: 0.95 }
        : { type: "noul", noul: 0.1 },
    );
    const { responses, errors } = await run(
      "llmeval-nimble",
      scoreSpecFrom("bin"),
      "Is it polite?",
    );
    expect(errors).toEqual([]);
    expect(calls.map((c) => c.url)).toEqual([SYSTEMONE_URL, SYSTEMONE_URL]);
    expect(calls[0].body.model).toBe("nimble");
    expect(calls[0].body.questions.score).toEqual({
      type: "noul",
      instructions: "Is it polite?",
    });
    expect(responses?.[0].eval_res?.items).toEqual([true, false]);
  });

  test("takes up to 26 levels on a scale, more than Jev", async () => {
    mockOllama(() => ({ type: "score", score: 12 }));
    const levels = (k: number) =>
      Array.from({ length: k }, (_, i) => `Level ${i + 1}`).join("\n");
    const { errors } = await run(
      "llmeval-nimble-26",
      scoreSpecFrom("num", undefined, levels(26)),
      "How polite?",
    );
    expect(errors).toEqual([]);
    expect(calls[0].body.questions.score.criteria).toHaveLength(26);
    await expect(
      run(
        "llmeval-nimble-27",
        scoreSpecFrom("num", undefined, levels(27)),
        "How polite?",
      ),
    ).rejects.toThrow(/2 to 26 levels/);
  });
});
