/*
 * @jest-environment jsdom
 */

// Same module stubs as openrouter.test.ts.
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {
    static getInstance() {
      return new StorageCache();
    }
  },
  StringLookup: { get: (x: unknown) => x },
  MediaLookup: {
    get: async (uid: string) =>
      new (globalThis as any).Blob([`bytes of ${uid}`], { type: "image/png" }),
  },
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
  call_llm,
  call_ollama_provider,
  call_openai_compatible,
  extract_reasoning,
  extract_responses,
  set_api_keys,
  split_think_tags,
} from "../utils";
// eslint-disable-next-line import/first
import {
  DEFAULT_LOCAL_PARALLEL_REQUESTS,
  LLMProvider,
  OPENAI_COMPATIBLE_PREFIX,
  RateLimiter,
  getProvider,
  localServerAddress,
  parallelRequestsSetting,
} from "../models";
// eslint-disable-next-line import/first
import {
  ModelSettings,
  baseModelToProvider,
  getSettingsSchemaForLLM,
  setOpenAICompatibleModelSuggestions,
} from "../../ModelSettingSchemas";
// eslint-disable-next-line import/first
import { LATENCY_KEY, extract_stats } from "../responseStats";
// eslint-disable-next-line import/first
import { discoverLocalModels, localModelsMenuGroup } from "../localModels";
// eslint-disable-next-line import/first
import { setOfflineMode } from "../offlineMode";
// eslint-disable-next-line import/first
import { Dict, LLMGroup, LLMSpec } from "../typing";

type Call = { url: string; init: RequestInit; body: Dict };
let calls: Call[] = [];

/**
 * Replaces fetch with one returning the given bodies in order (repeating the
 * last), in the shape both plain fetch callers and the OpenAI SDK read.
 */
const mockFetch = (...responses: { status?: number; body: unknown }[]) => {
  calls = [];
  let i = 0;
  (globalThis as any).fetch = jest.fn(
    async (url: string | URL, init: RequestInit) => {
      calls.push({
        url: url.toString(),
        init,
        body: JSON.parse(init.body as string),
      });
      const { status = 200, body } =
        responses[Math.min(i++, responses.length - 1)];
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: "",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => body,
        text: async () => JSON.stringify(body),
      };
    },
  );
};

afterEach(() => setOfflineMode(false));

const completion = (content: string, message: Dict = {}) => ({
  choices: [
    {
      index: 0,
      message: { role: "assistant", content, ...message },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 5, completion_tokens: 12 },
});

describe("OpenAI-compatible servers", () => {
  const model = OPENAI_COMPATIBLE_PREFIX + "Qwen2.5-7B-Instruct";

  test("model IDs route to the provider, and back to its settings", () => {
    expect(getProvider(model)).toBe(LLMProvider.OpenAICompatible);
    expect(baseModelToProvider("openai-compatible")).toBe(
      LLMProvider.OpenAICompatible,
    );
    expect(getSettingsSchemaForLLM(model)).toBe(
      ModelSettings["openai-compatible"],
    );
  });

  test("are called through the OpenAI SDK, a request per response, never with the user's OpenAI key", async () => {
    set_api_keys({ OpenAI: "sk-users-real-openai-key" });
    mockFetch({ body: completion("Hello!") });
    const [query, responses] = await call_openai_compatible(
      "Hi",
      model,
      2,
      0.3,
      {
        base_url: "http://localhost:1234/v1/",
        system_msg: "",
        parallel_requests: 2,
        max_tokens: "",
        stop: [],
        response_format: "",
      },
    );

    expect(calls).toHaveLength(2);
    // A chat model, even with "instruct" in its name
    expect(calls[0].url).toBe("http://localhost:1234/v1/chat/completions");
    expect(calls[0].body).toEqual({
      model: "Qwen2.5-7B-Instruct",
      n: 1,
      temperature: 0.3,
      messages: [{ role: "user", content: "Hi" }],
    });
    const auth = new Headers(calls[0].init.headers).get("authorization");
    expect(auth).toBe("Bearer not-needed");
    expect(query).not.toHaveProperty("base_url");

    expect(responses.every((r) => typeof r[LATENCY_KEY] === "number")).toBe(
      true,
    );
    expect(
      extract_responses(responses, model, LLMProvider.OpenAICompatible),
    ).toEqual(["Hello!", "Hello!"]);
    expect(extract_stats(responses, 10, 2)?.[0]).toMatchObject({
      input_tokens: 5,
      output_tokens: 12,
    });
  });

  test("send the server's own API key when it has one", async () => {
    mockFetch({ body: completion("ok") });
    await call_openai_compatible("Q", model, 1, 1, {
      base_url: "http://gpu-box:8000/v1",
      api_key: "vllm-key",
    });
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(
      "Bearer vllm-key",
    );
  });

  test("separate reasoning the server put in <think> tags or beside the answer", async () => {
    mockFetch(
      { body: completion("<think>Let me see.</think>\n\n42") },
      { body: completion("43", { reasoning: "Counting." }) },
    );
    const [, responses] = await call_openai_compatible("Q", model, 2, 1, {
      base_url: "http://localhost:8080/v1",
    });
    expect(
      extract_responses(responses, model, LLMProvider.OpenAICompatible),
    ).toEqual(["42", "43"]);
    expect(
      extract_reasoning(responses, model, LLMProvider.OpenAICompatible),
    ).toEqual(["Let me see.", "Counting."]);
  });

  test("say what to check when the server can't be reached", async () => {
    (globalThis as any).fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(
      call_openai_compatible("Q", model, 1, 1, {
        base_url: "http://localhost:1234/v1",
      }),
    ).rejects.toThrow(/Enable CORS/);
    await expect(call_openai_compatible("Q", model, 1, 1, {})).rejects.toThrow(
      /no server URL/,
    );
  }, 20000);

  test("are refused in offline mode when the server isn't local", async () => {
    setOfflineMode(true);
    mockFetch({ body: completion("x") });
    await expect(
      call_llm(model, LLMProvider.OpenAICompatible, "Q", 1, 1, {
        base_url: "https://api.example.com/v1",
      }),
    ).rejects.toThrow(/Offline mode/);
    await expect(
      call_llm("gpt-4o", LLMProvider.OpenAI, "Q", 1, 1, {}),
    ).rejects.toThrow(/OpenAI models can't be used/);
    expect(calls).toHaveLength(0);
  });

  test("take OpenAI's chat settings, less OpenAI-only ones", () => {
    const fields = Object.keys(
      ModelSettings["openai-compatible"].schema.properties,
    );
    expect(fields).toEqual(
      expect.arrayContaining(["base_url", "tools", "seed", "max_tokens"]),
    );
    for (const openai_only of ["reasoning_summary", "max_completion_tokens"])
      expect(fields).not.toContain(openai_only);
  });

  test("list the models found on servers in their settings form", () => {
    const field = ModelSettings["openai-compatible"].schema.properties.model;
    setOpenAICompatibleModelSuggestions(["a", "b", "a"]);
    expect(field.enum).toEqual(["a", "b"]);
    setOpenAICompatibleModelSuggestions([]);
    expect(field.enum).toBeUndefined();
  });
});

describe("Ollama", () => {
  const ollamaReply = (content: string, extra: Dict = {}) => ({
    model: "qwen3:4b",
    message: { role: "assistant", content, ...extra },
    done: true,
    total_duration: 2e9,
    load_duration: 1e8,
    prompt_eval_count: 11,
    prompt_eval_duration: 2e8,
    eval_count: 60,
    eval_duration: 1.5e9,
  });

  test("keeps Ollama's timings and splits out its reasoning", async () => {
    mockFetch(
      { body: ollamaReply("<think>Hmm.</think>Paris", {}) },
      { body: ollamaReply("Paris", { thinking: "Easy." }) },
    );
    const [query, responses] = await call_ollama_provider(
      "Capital of France?",
      "ollama",
      2,
      0.5,
      {
        ollamaModel: "qwen3:4b",
        ollama_url: "http://localhost:11434/api",
        model_type: "chat",
        parallel_requests: 3,
      },
    );
    expect(calls[0].url).toBe("http://localhost:11434/api/chat");
    expect(query.options).not.toHaveProperty("parallel_requests");
    expect(extract_responses(responses, "ollama", LLMProvider.Ollama)).toEqual([
      "Paris",
      "Paris",
    ]);
    expect(extract_reasoning(responses, "ollama", LLMProvider.Ollama)).toEqual([
      "Hmm.",
      "Easy.",
    ]);
    expect(extract_stats(responses, 5000, 2)?.[0]).toMatchObject({
      ttft_ms: 300,
      input_tokens: 11,
      output_tokens: 60,
      decode_tokens_per_s: 40,
    });
  });

  test("reports Ollama's errors instead of an empty response", async () => {
    mockFetch({
      status: 404,
      body: { error: 'model "nope" not found, try pulling it first' },
    });
    await expect(
      call_ollama_provider("Q", "ollama", 1, 1, {
        ollamaModel: "nope",
        ollama_url: "http://localhost:11434",
      }),
    ).rejects.toThrow(/not found, try pulling it first/);
  });
});

test("split_think_tags", () => {
  expect(split_think_tags("<think> a </think> b")).toEqual({
    content: "b",
    reasoning: "a",
  });
  expect(split_think_tags("<think>unfinished")).toEqual({
    content: "",
    reasoning: "unfinished",
  });
  expect(split_think_tags("plain")).toEqual({ content: "plain" });
});

describe("local servers' request limits", () => {
  test("are per server, however its URL is written", () => {
    // Ollama's own API and its /v1 API, at localhost or 127.0.0.1, are one server
    const addresses = [
      localServerAddress(LLMProvider.Ollama, {
        ollama_url: "http://LocalHost:11434/api/",
      }),
      localServerAddress(LLMProvider.OpenAICompatible, {
        base_url: "http://127.0.0.1:11434/v1",
      }),
    ];
    expect(addresses).toEqual(["localhost:11434", "localhost:11434"]);
    expect(
      localServerAddress(LLMProvider.OpenAICompatible, {
        base_url: "https://gpu-box.lab/v1",
      }),
    ).toBe("gpu-box.lab:443");
    expect(
      localServerAddress(LLMProvider.OpenAI, { base_url: "x" }),
    ).toBeUndefined();
  });

  test("follow the parallel requests setting, within bounds", () => {
    expect(parallelRequestsSetting({})).toBe(DEFAULT_LOCAL_PARALLEL_REQUESTS);
    expect(parallelRequestsSetting({ parallel_requests: "2" })).toBe(2);
    expect(parallelRequestsSetting({ parallel_requests: 0 })).toBe(
      DEFAULT_LOCAL_PARALLEL_REQUESTS,
    );
    expect(parallelRequestsSetting({ parallel_requests: 1000 })).toBe(64);
  });

  test("run at most that many requests to a server at once, across its models", async () => {
    let running = 0;
    let peak = 0;
    const task = async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
    };
    const params = {
      base_url: "http://localhost:9999/v1",
      parallel_requests: 2,
    };
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        RateLimiter.throttle(
          OPENAI_COMPATIBLE_PREFIX + (i % 2 === 0 ? "model-a" : "model-b"),
          LLMProvider.OpenAICompatible,
          task,
          undefined,
          params,
        ),
      ),
    );
    expect(peak).toBe(2);
  });
});

describe("the Local models menu", () => {
  const flatten = (group: LLMGroup): LLMSpec[] =>
    group.items.flatMap((item) => ("group" in item ? flatten(item) : [item]));

  test("offers Ollama and OpenAI-compatible servers when none were found", () => {
    const group = localModelsMenuGroup([]);
    expect(flatten(group).map((i) => i.base_model)).toEqual([
      "ollama",
      "openai-compatible",
    ]);
  });

  test("lists the models found, carrying their servers' URLs", () => {
    const group = localModelsMenuGroup([
      {
        kind: "ollama",
        name: "Ollama",
        base_url: "http://localhost:11434",
        models: ["gemma3:1b"],
      },
      {
        kind: "openai-compatible",
        name: "LM Studio",
        base_url: "http://localhost:1234/v1",
        models: ["mlx-community/Qwen3-8B-4bit"],
      },
    ]);
    const items = flatten(group);
    expect(items[0]).toMatchObject({
      name: "gemma3:1b",
      settings: {
        ollamaModel: "gemma3:1b",
        ollama_url: "http://localhost:11434/api",
      },
    });
    expect(items[1]).toMatchObject({
      name: "Qwen3-8B-4bit",
      model: OPENAI_COMPATIBLE_PREFIX + "mlx-community/Qwen3-8B-4bit",
      settings: { base_url: "http://localhost:1234/v1" },
    });
    expect(group.items.map((i) => ("group" in i ? i.group : i.name))).toEqual([
      "Ollama",
      "LM Studio (localhost:1234)",
      "OpenAI-compatible server",
    ]);
  });
});

test("finds Ollama from the browser, and other servers from ChainForge's server", async () => {
  const urls: string[] = [];
  (globalThis as any).fetch = jest.fn(async (url: string) => {
    urls.push(url);
    const body = url.endsWith("app/discoverLocalModels")
      ? {
          servers: [
            {
              kind: "openai-compatible",
              name: "LM Studio",
              base_url: "http://localhost:1234/v1",
              models: ["qwen3-8b"],
            },
          ],
        }
      : { models: [{ name: "gemma3:1b" }] };
    return { ok: true, status: 200, json: async () => body };
  });
  const servers = await discoverLocalModels("http://localhost:11434/api");
  expect(urls).toContain("http://localhost:11434/api/tags");
  expect(servers.map((server) => [server.name, server.models])).toEqual([
    ["Ollama", ["gemma3:1b"]],
    ["LM Studio", ["qwen3-8b"]],
  ]);
});
