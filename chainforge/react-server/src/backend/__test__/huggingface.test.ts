/*
 * @jest-environment jsdom
 */

// Same module stubs as openrouter.test.ts: enough of the app's globals to let
// the provider call be exercised without its dependencies.
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
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { call_huggingface, extract_responses, set_api_keys } from "../utils";
// eslint-disable-next-line import/first
import {
  HUGGINGFACE_PREFIX,
  LLMProvider,
  NativeLLM,
  getProvider,
  stripHuggingFacePrefix,
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
        statusText: status === 200 ? "OK" : "Error",
        json: async () => body,
      };
    },
  );
};

const jsonBody = (call: Call) => JSON.parse(call.init.body as string);
const reply = (text: string) => ({
  choices: [{ message: { role: "assistant", content: text } }],
});

const ROUTER = "https://router.huggingface.co/v1/chat/completions";
const LLAMA = `${HUGGINGFACE_PREFIX}meta-llama/Llama-3.1-8B-Instruct`;

beforeEach(() => {
  set_api_keys({ HuggingFace: "hf-test" });
});

describe("recognizing Hugging Face models", () => {
  test("prefixed model IDs map to Hugging Face, including typed-in ones", () => {
    expect(getProvider(LLAMA)).toBe(LLMProvider.HuggingFace);
    expect(getProvider(`${HUGGINGFACE_PREFIX}some-lab/brand-new-model`)).toBe(
      LLMProvider.HuggingFace,
    );
  });

  test("the prefix is stripped for the API, and left alone when absent", () => {
    expect(stripHuggingFacePrefix(LLAMA)).toBe(
      "meta-llama/Llama-3.1-8B-Instruct",
    );
    expect(stripHuggingFacePrefix("openai/gpt-oss-20b")).toBe(
      "openai/gpt-oss-20b",
    );
  });

  test("models from flows saved before Inference Providers still resolve", () => {
    expect(getProvider(NativeLLM.HF_FALCON_7B_INSTRUCT)).toBe(
      LLMProvider.HuggingFace,
    );
  });
});

describe("the Hugging Face settings form", () => {
  test("stays registered under the hf base model", () => {
    expect(ModelSettings).toHaveProperty("hf");
    expect(baseModelToProvider("hf")).toBe(LLMProvider.HuggingFace);
    expect(getSettingsSchemaForLLM(LLAMA)?.fullName).toBe("Hugging Face");
  });

  test("suggests current models and routes to the cheapest provider", () => {
    const model = ModelSettings.hf.schema.properties.model;
    const models = model.enum as string[];
    expect(models).toContain("meta-llama/Llama-3.1-8B-Instruct");
    expect(models).toContain("openai/gpt-oss-120b");
    expect(models).toHaveLength(6);
    // The dead 2023-era models are gone.
    expect(models).not.toContain("gpt2");
    expect(models).not.toContain("tiiuae/falcon-7b-instruct");

    expect(ModelSettings.hf.schema.properties.provider_policy.default).toBe(
      "cheapest",
    );
  });
});

describe("querying through Inference Providers", () => {
  test("posts an OpenAI-shaped request to the router, provider suffix and all", async () => {
    mockFetch({ body: reply("Hallo!") });
    const [query] = await call_huggingface(LLAMA, LLAMA, 1, 0.4, {
      provider_policy: "cheapest",
      system_msg: "You are terse.",
      max_tokens: 128,
    });

    expect(calls[0].url).toBe(ROUTER);
    const body = jsonBody(calls[0]);
    expect(body.model).toBe("meta-llama/Llama-3.1-8B-Instruct:cheapest");
    expect(body.temperature).toBe(0.4);
    expect(body.max_tokens).toBe(128);
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "You are terse.",
    });
    // ChainForge's own settings are not request fields.
    expect(body).not.toHaveProperty("provider_policy");
    expect(body).not.toHaveProperty("system_msg");
    expect(query.model).toBe("meta-llama/Llama-3.1-8B-Instruct:cheapest");

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer hf-test");
  });

  test("a provider named directly is used, and an existing suffix is kept", async () => {
    mockFetch({ body: reply("ok") });
    await call_huggingface(
      "x",
      `${HUGGINGFACE_PREFIX}openai/gpt-oss-120b`,
      1,
      0,
      {
        provider_policy: "groq",
      },
    );
    expect(jsonBody(calls[0]).model).toBe("openai/gpt-oss-120b:groq");

    mockFetch({ body: reply("ok") });
    await call_huggingface(
      "x",
      `${HUGGINGFACE_PREFIX}openai/gpt-oss-120b:cerebras`,
      1,
      0,
      { provider_policy: "cheapest" },
    );
    expect(jsonBody(calls[0]).model).toBe("openai/gpt-oss-120b:cerebras");
  });

  test("settings the old Inference API took are not sent on", async () => {
    mockFetch({ body: reply("ok") });
    await call_huggingface("x", LLAMA, 1, 0, {
      model_type: "text",
      num_continuations: 2,
      top_k: 5,
      repetition_penalty: 1.1,
      do_sample: true,
      use_cache: false,
      max_new_tokens: 250,
    });
    const body = jsonBody(calls[0]);
    for (const key of [
      "model_type",
      "num_continuations",
      "top_k",
      "repetition_penalty",
      "do_sample",
      "use_cache",
      "max_new_tokens",
    ])
      expect(body).not.toHaveProperty(key);
    // ...but the old token cap is carried over to its replacement.
    expect(body.max_tokens).toBe(250);
  });

  test("asks once per response, since providers differ on n", async () => {
    mockFetch({ body: reply("one") }, { body: reply("two") });
    const [, responses] = await call_huggingface("x", LLAMA, 2, 0, {});
    expect(calls).toHaveLength(2);
    expect((responses as Dict[]).map((r) => r.generated_text)).toEqual([
      "one",
      "two",
    ]);
  });
});

describe("dedicated Inference Endpoints", () => {
  test("a pasted endpoint URL is queried instead of the router", async () => {
    mockFetch({ body: reply("ok") });
    await call_huggingface("x", LLAMA, 1, 0, {
      custom_endpoint: "https://abc123.endpoints.huggingface.cloud/",
      provider_policy: "cheapest",
    });
    expect(calls[0].url).toBe(
      "https://abc123.endpoints.huggingface.cloud/chat/completions",
    );
    // A dedicated endpoint serves one model, so no provider suffix.
    expect(jsonBody(calls[0]).model).toBe("meta-llama/Llama-3.1-8B-Instruct");
  });

  test("a saved flow's custom_model still works, as a name or a URL", async () => {
    mockFetch({ body: reply("ok") });
    await call_huggingface("x", NativeLLM.HF_OTHER, 1, 0, {
      custom_model: "some-lab/some-model",
    });
    expect(calls[0].url).toBe(ROUTER);
    expect(jsonBody(calls[0]).model).toBe("some-lab/some-model");

    mockFetch({ body: reply("ok") });
    await call_huggingface("x", NativeLLM.HF_OTHER, 1, 0, {
      custom_model: "https://xyz.endpoints.huggingface.cloud",
    });
    expect(calls[0].url).toBe(
      "https://xyz.endpoints.huggingface.cloud/chat/completions",
    );
  });
});

describe("Hugging Face errors and responses", () => {
  test("a refused token explains which permission it needs", async () => {
    mockFetch({ status: 401, body: { error: "Invalid credentials" } });
    await expect(call_huggingface("x", LLAMA, 1, 0, {})).rejects.toThrow(
      /Inference Providers/,
    );
  });

  test("running out of credits says so", async () => {
    mockFetch({ status: 402, body: { error: "Payment required" } });
    await expect(call_huggingface("x", LLAMA, 1, 0, {})).rejects.toThrow(
      /credits/,
    );
  });

  test("a model no provider serves points at the model list", async () => {
    mockFetch({ body: {} });
    await expect(
      call_huggingface("x", `${HUGGINGFACE_PREFIX}nope/nope`, 1, 0, {}),
    ).rejects.toThrow(/router\.huggingface\.co/);
  });

  test("extract_responses reads both the new and the pre-router shape", () => {
    expect(
      extract_responses(
        [{ generated_text: " Hallo! " }] as unknown as Dict,
        LLAMA,
        LLMProvider.HuggingFace,
      ),
    ).toEqual(["Hallo!"]);
    // Runs cached before the move stored only generated_text; newer ones also
    // keep the raw payload, and either must render.
    expect(
      extract_responses(
        [reply("From the raw payload")] as unknown as Dict,
        LLAMA,
        LLMProvider.HuggingFace,
      ),
    ).toEqual(["From the raw payload"]);
  });
});
