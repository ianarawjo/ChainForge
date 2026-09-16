/*
 * @jest-environment jsdom
 */

// Covers the move from the 2023 `openai` v3 SDK to the current one, which also
// made Azure a plain OpenAI client pointed at Azure's v1 API. Nothing here
// needs a key: the SDK sends through global fetch, so the URL and body it
// builds are what the tests assert on.
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
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  call_azure_openai,
  call_chatgpt,
  call_together,
  set_api_keys,
} from "../utils";
// eslint-disable-next-line import/first
import { TOGETHER_PREFIX } from "../models";

let calls: { url: string; init: any }[] = [];

const mockFetch = (
  body: unknown = { choices: [{ message: { content: "hi" } }] },
) => {
  calls = [];
  (globalThis as any).fetch = jest.fn(async (url: any, init: any) => {
    calls.push({ url: url?.toString?.() ?? String(url), init });
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
      size: 0,
    };
  });
};

const sentBody = () => JSON.parse(calls[0].init.body as string);

beforeEach(() => {
  mockFetch();
});

describe("OpenAI through the current SDK", () => {
  test("posts to OpenAI's chat completions endpoint", async () => {
    set_api_keys({ OpenAI: "sk-test" });
    await call_chatgpt("Say hi", "gpt-4o-mini", 1, 0.5, {});

    expect(calls[0].url).toBe("https://api.openai.com/v1/chat/completions");
    const body = sentBody();
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "Say hi" });
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(
      "Bearer sk-test",
    );
  });

  test("an OpenAI-compatible gateway base URL is honoured", async () => {
    set_api_keys({
      OpenAI: "sk-test",
      OpenAI_BaseURL: "https://gateway.example.com/v1",
    });
    await call_chatgpt("Say hi", "gpt-4o-mini", 1, 1, {});
    expect(calls[0].url).toBe(
      "https://gateway.example.com/v1/chat/completions",
    );
    set_api_keys({ OpenAI: "sk-test", OpenAI_BaseURL: "" });
  });
});

describe("Azure OpenAI on the v1 API", () => {
  test("calls the deployment through the endpoint's /openai/v1 path", async () => {
    set_api_keys({
      Azure_OpenAI: "azure-key",
      Azure_OpenAI_Endpoint: "https://my-resource.openai.azure.com/",
    });
    await call_azure_openai("Say hi", "azure-openai", 1, 0.3, {
      deployment_name: "my-deployment",
      model_type: "chat-completion",
    });

    // The trailing slash on the endpoint must not double up.
    expect(calls[0].url).toBe(
      "https://my-resource.openai.azure.com/openai/v1/chat/completions",
    );
    const body = sentBody();
    // Azure routes on the deployment name, which stands in for the model.
    expect(body.model).toBe("my-deployment");
    // api-version is not part of the v1 API.
    expect(calls[0].url).not.toContain("api-version");
    expect(body).not.toHaveProperty("api_version");
    expect(body).not.toHaveProperty("deployment_name");
    expect(body).not.toHaveProperty("model_type");
  });

  test("an api_version left in a saved flow is not sent on", async () => {
    set_api_keys({
      Azure_OpenAI: "azure-key",
      Azure_OpenAI_Endpoint: "https://my-resource.openai.azure.com",
    });
    await call_azure_openai("Say hi", "azure-openai", 1, 1, {
      deployment_name: "d",
      model_type: "chat-completion",
      api_version: "2023-05-15",
    });
    expect(sentBody()).not.toHaveProperty("api_version");
  });
});

describe("Together through the same client", () => {
  test("posts to Together with the prefix stripped from the model", async () => {
    set_api_keys({ Together: "together-key" });
    await call_together(
      "Say hi",
      `${TOGETHER_PREFIX}openai/gpt-oss-120b`,
      1,
      0.7,
      {},
    );
    expect(calls[0].url).toBe("https://api.together.xyz/v1/chat/completions");
    expect(sentBody().model).toBe("openai/gpt-oss-120b");
  });
});
