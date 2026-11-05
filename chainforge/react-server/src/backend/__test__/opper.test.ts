/*
 * @jest-environment jsdom
 */

// Same module stubs as openrouter.test.ts, so the provider calls can be
// tested without their dependencies.
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
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: jest.fn() }),
  },
}));

// eslint-disable-next-line import/first
import { beforeAll, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  call_llm,
  call_opper,
  clear_api_keys,
  extract_responses,
  set_api_keys,
} from "../utils";
// eslint-disable-next-line import/first
import {
  LLMProvider,
  RATE_LIMIT_BY_PROVIDER,
  getProvider,
  stripOpperPrefix,
} from "../models";
// eslint-disable-next-line import/first
import {
  ModelSettings,
  baseModelToProvider,
  getDefaultModelSettings,
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
  set_api_keys({ Opper: "op-test" });
});

describe("recognizing Opper models", () => {
  test("prefixed model IDs map to Opper, including typed-in ones", () => {
    expect(getProvider("opper/claude-sonnet-5-5")).toBe(LLMProvider.Opper);
    expect(getProvider("opper/anthropic/claude-sonnet-5-5")).toBe(
      LLMProvider.Opper,
    );
    expect(getProvider("opper/some-brand-new-model")).toBe(LLMProvider.Opper);
    // The same names without the prefix belong to their own providers.
    expect(getProvider("claude-sonnet-5-5")).toBe(LLMProvider.Anthropic);
  });

  test("the prefix is stripped for the API", () => {
    expect(stripOpperPrefix("opper/gpt-5.4-mini")).toBe("gpt-5.4-mini");
    expect(stripOpperPrefix("opper/anthropic/claude-sonnet-5-5")).toBe(
      "anthropic/claude-sonnet-5-5",
    );
  });

  test("base model, settings form, and rate limit", () => {
    expect(baseModelToProvider("opper")).toBe(LLMProvider.Opper);
    expect(getSettingsSchemaForLLM("opper/some-brand-new-model")).toBe(
      ModelSettings.opper,
    );
    expect(RATE_LIMIT_BY_PROVIDER[LLMProvider.Opper]).toBeDefined();
  });

  test("the settings form names every listed model, and lists its default", () => {
    const spec = ModelSettings.opper.schema.properties.model;
    expect(spec.enum).toContain(spec.default);
    const names = spec.shortname_map as Record<string, string>;
    for (const model of spec.enum as string[])
      expect(names[model]).toBeTruthy();
  });
});

describe("Opper chat completions", () => {
  test("sends the stripped model ID, the key, and only the settings that are set", async () => {
    mockFetch({ body: chatReply({ content: "Hi!" }) });
    const [query, responses] = await call_opper(
      "Hello",
      "opper/claude-sonnet-5-5",
      1,
      0.5,
      {
        system_msg: "Be brief.",
        max_tokens: NaN, // blank number field
        stop: [],
        tools: [],
        tool_choice: "",
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.opper.ai/v3/compat/chat/completions",
    );
    expect(headers(calls[0]).Authorization).toBe("Bearer op-test");

    const body = jsonBody(calls[0]);
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body.temperature).toBe(0.5);
    expect(body).not.toHaveProperty("n");
    for (const key of [
      "max_tokens",
      "stop",
      "tools",
      "tool_choice",
      "system_msg",
    ])
      expect(body).not.toHaveProperty(key);
    expect(body.messages[0]).toEqual({ role: "system", content: "Be brief." });
    expect(body.messages[body.messages.length - 1].role).toBe("user");

    expect(query.model).toBe("claude-sonnet-5-5");
    expect(
      extract_responses(
        responses,
        "opper/claude-sonnet-5-5",
        LLMProvider.Opper,
      ),
    ).toEqual(["Hi!"]);
  });

  test("the form's defaults send only the model, temperature and messages", async () => {
    const settings = getDefaultModelSettings("opper");
    expect(settings.max_tokens).toBeNull();
    mockFetch({ body: chatReply({ content: "Hi!" }) });
    await call_opper("Q", "opper/gpt-5.4-mini", 1, 1, settings);
    expect(Object.keys(jsonBody(calls[0])).sort()).toEqual([
      "messages",
      "model",
      "temperature",
    ]);
  });

  test("a plain-text response_format is left out, but a JSON one is sent", async () => {
    mockFetch({ body: chatReply({ content: "Hi!" }) });
    await call_opper("Q", "opper/gpt-5.4-mini", 1, 1, {
      response_format: { type: "text" },
    });
    expect(jsonBody(calls[0])).not.toHaveProperty("response_format");

    mockFetch({ body: chatReply({ content: "{}" }) });
    await call_opper("Q", "opper/gpt-5.4-mini", 1, 1, {
      response_format: { type: "json_object" },
    });
    expect(jsonBody(calls[0]).response_format).toEqual({ type: "json_object" });
  });

  test("n responses are n requests", async () => {
    mockFetch(
      { body: chatReply({ content: "one" }) },
      { body: chatReply({ content: "two" }) },
      { body: chatReply({ content: "three" }) },
    );
    const [, responses] = await call_opper("Count", "opper/kimi-k3", 3);
    expect(calls).toHaveLength(3);
    expect(
      extract_responses(responses, "opper/kimi-k3", LLMProvider.Opper),
    ).toEqual(["one", "two", "three"]);
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
      extract_responses([reply], "opper/gpt-6-luna", LLMProvider.Opper),
    ).toEqual(['[[TOOLS]] get_weather {"city":"Oslo"}']);
  });

  test("a model that runs out of tokens before answering fails with advice", async () => {
    mockFetch({ body: chatReply({ content: null }, "length") });
    await expect(
      call_opper("Q", "opper/deepseek-v4-pro", 1, 1, { max_tokens: 50 }),
    ).rejects.toThrow(/ran out of tokens before it answered/);
  });

  test("API errors surface their message", async () => {
    mockFetch({
      status: 400,
      body: { error: { code: "bad_request", message: "Unknown model" } },
    });
    await expect(call_opper("Q", "opper/not-a-model")).rejects.toThrow(
      "Unknown model",
    );
  });

  test("a rejected key is named as the problem", async () => {
    mockFetch({ status: 401, body: undefined });
    await expect(call_opper("Q", "opper/gpt-5.4-mini")).rejects.toThrow(
      "Opper did not accept the API key",
    );
  });

  test("a missing key is named as the problem, before any request", async () => {
    const env = process.env.OPPER_API_KEY;
    delete process.env.OPPER_API_KEY;
    clear_api_keys();
    mockFetch({ body: chatReply({ content: "Hi!" }) });
    try {
      await expect(call_opper("Q", "opper/gpt-5.4-mini")).rejects.toThrow(
        "Could not find an Opper API key",
      );
      expect(calls).toHaveLength(0);
    } finally {
      if (env !== undefined) process.env.OPPER_API_KEY = env;
      set_api_keys({ Opper: "op-test" });
    }
  });

  test("call_llm routes Opper models to its chat completions", async () => {
    mockFetch({ body: chatReply({ content: "Hi" }) });
    await call_llm("opper/gemini-3.8-flash", LLMProvider.Opper, "Hello", 1, 1);
    expect(calls[0].url).toBe(
      "https://api.opper.ai/v3/compat/chat/completions",
    );
  });
});
