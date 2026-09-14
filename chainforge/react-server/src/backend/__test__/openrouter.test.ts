/*
 * @jest-environment jsdom
 */

// Same module stubs as imageProviders.test.ts: a MediaLookup that serves input
// images, so the provider calls can be tested without their dependencies.
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
jest.mock("@azure/openai", () => ({
  AzureKeyCredential: jest.fn(),
  OpenAIClient: jest.fn(),
}));
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: jest.fn() }),
  },
}));

// eslint-disable-next-line import/first
import { beforeAll, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  call_llm,
  call_openrouter,
  call_openrouter_image_gen,
  extract_responses,
  set_api_keys,
} from "../utils";
// eslint-disable-next-line import/first
import {
  LLMProvider,
  RATE_LIMIT_BY_PROVIDER,
  getProvider,
  isOpenRouterImageModel,
  stripOpenRouterPrefix,
} from "../models";
// eslint-disable-next-line import/first
import {
  ModelSettings,
  baseModelToProvider,
  getSettingsSchemaForLLM,
} from "../../ModelSettingSchemas";
// eslint-disable-next-line import/first
import { Dict } from "../typing";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

/** Replaces fetch with one returning the given responses in order (repeating the last). */
const mockFetch = (...responses: { status?: number; body: unknown }[]) => {
  calls = [];
  let i = 0;
  (globalThis as any).fetch = jest.fn(
    async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const { status = 200, body } =
        responses[Math.min(i++, responses.length - 1)];
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      };
    },
  );
};

const jsonBody = (call: Call) => JSON.parse(call.init.body as string);
const headers = (call: Call) => call.init.headers as Record<string, string>;

const chatReply = (message: Dict, finish_reason = "stop") => ({
  choices: [{ message: { role: "assistant", ...message }, finish_reason }],
});

beforeAll(() => {
  set_api_keys({ OpenRouter: "or-test" });
});

describe("recognizing OpenRouter models", () => {
  test("prefixed model IDs map to OpenRouter, including typed-in ones", () => {
    expect(getProvider("openrouter/anthropic/claude-sonnet-5")).toBe(
      LLMProvider.OpenRouter,
    );
    expect(getProvider("openrouter/some-lab/brand-new-model")).toBe(
      LLMProvider.OpenRouter,
    );
    expect(getProvider("openrouter-image/black-forest-labs/flux.2-pro")).toBe(
      LLMProvider.OpenRouter,
    );
    // Unprefixed names that look similar belong to their own providers.
    expect(getProvider("deepseek-chat")).toBe(LLMProvider.DeepSeek);
  });

  test("image models are told apart by prefix, which is stripped for the API", () => {
    expect(isOpenRouterImageModel("openrouter-image/openai/gpt-image-2")).toBe(
      true,
    );
    expect(isOpenRouterImageModel("openrouter/openai/gpt-5.5")).toBe(false);
    expect(stripOpenRouterPrefix("openrouter/openai/gpt-5.5")).toBe(
      "openai/gpt-5.5",
    );
    expect(
      stripOpenRouterPrefix("openrouter-image/google/gemini-3.1-flash-image"),
    ).toBe("google/gemini-3.1-flash-image");
  });

  test("base models, settings forms, and rate limit", () => {
    expect(baseModelToProvider("openrouter")).toBe(LLMProvider.OpenRouter);
    expect(baseModelToProvider("openrouter-image")).toBe(
      LLMProvider.OpenRouter,
    );
    expect(getSettingsSchemaForLLM("openrouter/some-lab/brand-new-model")).toBe(
      ModelSettings.openrouter,
    );
    expect(getSettingsSchemaForLLM("openrouter-image/recraft/recraft-v4")).toBe(
      ModelSettings["openrouter-image"],
    );
    expect(RATE_LIMIT_BY_PROVIDER[LLMProvider.OpenRouter]).toBeDefined();
  });

  test("the settings forms name every listed model, and list their defaults", () => {
    const text = ModelSettings.openrouter.schema.properties.model;
    const image = ModelSettings["openrouter-image"].schema.properties.model;
    for (const spec of [text, image]) {
      expect(spec.enum).toContain(spec.default);
      const names = spec.shortname_map as Record<string, string>;
      for (const model of spec.enum as string[])
        expect(names[model]).toBeTruthy();
    }
  });
});

describe("OpenRouter chat completions", () => {
  test("sends the stripped model ID, attribution headers, and only the settings that are set", async () => {
    mockFetch({ body: chatReply({ content: "Hi!" }) });
    const [query, responses] = await call_openrouter(
      "Hello",
      "openrouter/anthropic/claude-sonnet-5",
      1,
      0.5,
      {
        system_msg: "Be brief.",
        reasoning_effort: "default", // leaves reasoning to the model
        max_tokens: NaN, // blank number field
        stop: [],
        tools: [],
        tool_choice: "",
        top_p: 1,
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(headers(calls[0]).Authorization).toBe("Bearer or-test");
    expect(headers(calls[0])["X-OpenRouter-Title"]).toBe("ChainForge");

    const body = jsonBody(calls[0]);
    expect(body.model).toBe("anthropic/claude-sonnet-5");
    expect(body.temperature).toBe(0.5);
    expect(body.top_p).toBe(1);
    expect(body).not.toHaveProperty("n"); // OpenRouter doesn't support n
    for (const key of [
      "reasoning",
      "reasoning_effort",
      "max_tokens",
      "stop",
      "tools",
      "tool_choice",
      "system_msg",
    ])
      expect(body).not.toHaveProperty(key);
    expect(body.messages[0]).toEqual({ role: "system", content: "Be brief." });
    expect(body.messages[body.messages.length - 1].role).toBe("user");

    expect(query.model).toBe("anthropic/claude-sonnet-5");
    expect(
      extract_responses(
        responses,
        "openrouter/anthropic/claude-sonnet-5",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["Hi!"]);
  });

  test("reasoning effort is sent as OpenRouter's reasoning object", async () => {
    mockFetch({ body: chatReply({ content: "42", reasoning: "Thinking..." }) });
    await call_openrouter("Q", "openrouter/openai/gpt-5.5", 1, 1, {
      reasoning_effort: "high",
    });
    expect(jsonBody(calls[0]).reasoning).toEqual({ effort: "high" });
  });

  test("a reasoning token budget takes precedence over effort", async () => {
    mockFetch({ body: chatReply({ content: "42" }) });
    await call_openrouter("Q", "openrouter/qwen/qwen3.8-flash", 1, 1, {
      reasoning_effort: "low",
      reasoning_max_tokens: 2000,
    });
    expect(jsonBody(calls[0]).reasoning).toEqual({ max_tokens: 2000 });
  });

  test("n responses are n requests", async () => {
    mockFetch(
      { body: chatReply({ content: "one" }) },
      { body: chatReply({ content: "two" }) },
      { body: chatReply({ content: "three" }) },
    );
    const [, responses] = await call_openrouter(
      "Count",
      "openrouter/x-ai/grok-4.6",
      3,
    );
    expect(calls).toHaveLength(3);
    expect(
      extract_responses(
        responses,
        "openrouter/x-ai/grok-4.6",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["one", "two", "three"]);
  });

  test("a reasoning model that runs out of tokens before answering fails with advice", async () => {
    mockFetch({
      body: chatReply({ content: null, reasoning: "Hmm, let me..." }, "length"),
    });
    await expect(
      call_openrouter("Q", "openrouter/deepseek/deepseek-v4-pro", 1, 1, {
        max_tokens: 50,
      }),
    ).rejects.toThrow(/ran out of tokens while reasoning/);
  });

  test("a blank answer is extracted as an empty string", () => {
    expect(
      extract_responses(
        [chatReply({ content: null })],
        "openrouter/z-ai/glm-5.3",
        LLMProvider.OpenRouter,
      ),
    ).toEqual([""]);
  });

  test("tool calls are extracted like OpenAI's", () => {
    const reply = chatReply(
      {
        content: null,
        tool_calls: [
          { function: { name: "get_weather", arguments: '{"city":"Oslo"}' } },
        ],
      },
      "tool_calls",
    );
    expect(
      extract_responses(
        [reply],
        "openrouter/moonshotai/kimi-k3",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(['[[TOOLS]] get_weather {"city":"Oslo"}']);
  });

  test("API errors surface their message, even with a 200 status", async () => {
    mockFetch({ status: 401, body: { error: { message: "No auth" } } });
    await expect(
      call_openrouter("Q", "openrouter/openai/gpt-5.5"),
    ).rejects.toThrow("No auth");

    mockFetch({ body: { error: { code: 502, message: "Provider down" } } });
    await expect(
      call_openrouter("Q", "openrouter/openai/gpt-5.5"),
    ).rejects.toThrow("Provider down");
  });
});

describe("OpenRouter image generation", () => {
  test("sends settings that aren't auto to the Image API", async () => {
    mockFetch({
      body: { data: [{ b64_json: "AAAA", media_type: "image/png" }] },
    });
    const [query, data] = await call_openrouter_image_gen(
      "a cat",
      "openrouter-image/black-forest-labs/flux.2-pro",
      1,
      0,
      {
        aspect_ratio: "16:9",
        resolution: "auto",
        quality: "auto",
        output_format: "png",
        seed: NaN, // blank
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/images");
    expect(headers(calls[0]).Authorization).toBe("Bearer or-test");
    expect(jsonBody(calls[0])).toEqual({
      model: "black-forest-labs/flux.2-pro",
      prompt: "a cat",
      aspect_ratio: "16:9",
      output_format: "png",
    });
    expect(query.model).toBe("black-forest-labs/flux.2-pro");
    expect(
      extract_responses(
        data,
        "openrouter-image/black-forest-labs/flux.2-pro",
        LLMProvider.OpenRouter,
      ),
    ).toEqual([{ t: "img", d: "AAAA" }]);
  });

  test("input images are sent as data URL references, and only counted in the query", async () => {
    mockFetch(
      { body: { data: [{ b64_json: "ONE" }] } },
      { body: { data: [{ b64_json: "TWO" }] } },
    );
    const [query, data] = await call_openrouter_image_gen(
      "make it blue",
      "openrouter-image/google/gemini-3.1-flash-image",
      2,
      0,
      {},
      undefined,
      ["uid-1", "uid-2"],
    );

    expect(calls).toHaveLength(2); // one image per request, until n
    const refs = jsonBody(calls[0]).input_references;
    expect(refs).toHaveLength(2);
    expect(refs[0].type).toBe("image_url");
    expect(refs[0].image_url.url).toMatch(/^data:image\/png;base64,/);
    expect(query.input_images).toBe(2);
    expect(query).not.toHaveProperty("input_references");
    expect(data).toHaveLength(2);
  });

  test("extra images from one request are trimmed to n", async () => {
    mockFetch({
      body: { data: [{ b64_json: "A" }, { b64_json: "B" }, { b64_json: "C" }] },
    });
    const [, data] = await call_openrouter_image_gen(
      "cats",
      "openrouter-image/bytedance-seed/seedream-5-0-lite",
      2,
    );
    expect(calls).toHaveLength(1);
    expect(data).toHaveLength(2);
  });

  test("a response without images fails", async () => {
    mockFetch({ body: { data: [] } });
    await expect(
      call_openrouter_image_gen("a cat", "openrouter-image/openai/gpt-image-2"),
    ).rejects.toThrow("OpenRouter returned no images");
  });

  test("call_llm routes image models to the Image API and text models to chat", async () => {
    mockFetch({ body: { data: [{ b64_json: "AAAA" }] } });
    await call_llm(
      "openrouter-image/openai/gpt-image-2.5-flare",
      LLMProvider.OpenRouter,
      "a cat",
      1,
      0,
    );
    expect(calls[0].url).toMatch(/\/images$/);

    mockFetch({ body: chatReply({ content: "Hi" }) });
    await call_llm(
      "openrouter/openai/gpt-5.5",
      LLMProvider.OpenRouter,
      "Hello",
      1,
      1,
    );
    expect(calls[0].url).toMatch(/\/chat\/completions$/);
  });
});
