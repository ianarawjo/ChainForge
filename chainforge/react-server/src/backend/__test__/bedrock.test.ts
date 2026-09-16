/*
 * @jest-environment jsdom
 */

// Same module stubs as openrouter.test.ts, plus a stand-in for the AWS SDK:
// utils.ts imports it lazily, so the mock stands in for that dynamic import.
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

/** Commands the mocked client was asked to send, and what it should reply. */
const mockSent: any[] = [];
let mockNextReply: any = null;
let mockNextError: Error | null = null;

jest.mock("@aws-sdk/client-bedrock-runtime", () => ({
  __esModule: true,
  BedrockRuntimeClient: class {
    config: any;
    constructor(config: any) {
      this.config = config;
      (globalThis as any).__lastBedrockConfig = config;
    }

    async send(command: any) {
      mockSent.push(command.input);
      if (mockNextError) throw mockNextError;
      return mockNextReply;
    }
  },
  ConverseCommand: class {
    input: any;
    constructor(input: any) {
      this.input = input;
    }
  },
}));

// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { call_bedrock, extract_responses, set_api_keys } from "../utils";
// eslint-disable-next-line import/first
import {
  BEDROCK_PREFIX,
  LLMProvider,
  getProvider,
  stripBedrockPrefix,
} from "../models";
// eslint-disable-next-line import/first
import {
  ModelSettings,
  baseModelToProvider,
  getSettingsSchemaForLLM,
} from "../../ModelSettingSchemas";
// eslint-disable-next-line import/first
import { Dict } from "../typing";

const SONNET = `${BEDROCK_PREFIX}us.anthropic.claude-sonnet-5`;
const reply = (text: string) => ({
  output: { message: { role: "assistant", content: [{ text }] } },
  stopReason: "end_turn",
});

beforeEach(() => {
  mockSent.length = 0;
  mockNextReply = reply("Hello from Bedrock");
  mockNextError = null;
  set_api_keys({
    AWS_Access_Key_ID: "AKIA-test",
    AWS_Secret_Access_Key: "secret-test",
    AWS_Region: "us-east-1",
  });
});

describe("recognizing Bedrock models", () => {
  test("prefixed IDs map to Bedrock, including inference profiles", () => {
    expect(getProvider(SONNET)).toBe(LLMProvider.Bedrock);
    expect(getProvider(`${BEDROCK_PREFIX}eu.meta.llama4-scout-17b-v1:0`)).toBe(
      LLMProvider.Bedrock,
    );
  });

  test("the prefix is stripped for the API", () => {
    expect(stripBedrockPrefix(SONNET)).toBe("us.anthropic.claude-sonnet-5");
    expect(stripBedrockPrefix("us.amazon.nova-2-lite-v1:0")).toBe(
      "us.amazon.nova-2-lite-v1:0",
    );
  });
});

describe("the unified Bedrock settings form", () => {
  test("one form replaces the per-vendor ones, and old keys still open it", () => {
    expect(ModelSettings.bedrock.fullName).toBe("Amazon Bedrock");
    for (const legacy of [
      "br.anthropic.claude",
      "br.ai21.j2",
      "br.amazon.titan",
      "br.cohere.command",
      "br.mistral.mistral",
      "br.mistral.mixtral",
      "br.meta.llama2",
      "br.meta.llama3",
    ]) {
      expect(ModelSettings[legacy]).toBe(ModelSettings.bedrock);
      expect(baseModelToProvider(legacy)).toBe(LLMProvider.Bedrock);
    }
    expect(getSettingsSchemaForLLM(SONNET)?.fullName).toBe("Amazon Bedrock");
  });

  test("suggests inference profile IDs, not bare model IDs", () => {
    const models = ModelSettings.bedrock.schema.properties.model
      .enum as string[];
    expect(models).toContain("us.anthropic.claude-sonnet-5");
    expect(models).toContain("us.amazon.nova-2-lite-v1:0");
    // Every suggestion carries a geography prefix, which on-demand requires.
    for (const m of models) expect(m.startsWith("us.")).toBe(true);
    // The retired models are gone.
    expect(models).not.toContain("anthropic.claude-v2");
    expect(models).not.toContain("ai21.j2-ultra");
    expect(models).not.toContain("amazon.titan-tg1-large");
  });
});

describe("calling Converse", () => {
  test("sends one Converse request in the shape the API documents", async () => {
    await call_bedrock("Say hi", SONNET, 1, 0.5, {
      system_msg: "You are terse.",
      max_tokens: 256,
      top_p: 0.9,
      stop_sequences: ["END"],
    });

    expect(mockSent).toHaveLength(1);
    const req = mockSent[0];
    expect(req.modelId).toBe("us.anthropic.claude-sonnet-5");
    expect(req.messages).toEqual([
      { role: "user", content: [{ text: "Say hi" }] },
    ]);
    // Converse carries the system prompt beside the messages, not inside them.
    expect(req.system).toEqual([{ text: "You are terse." }]);
    expect(req.inferenceConfig).toEqual({
      temperature: 0.5,
      maxTokens: 256,
      topP: 0.9,
      stopSequences: ["END"],
    });
  });

  test("passes model-specific parameters through additionalModelRequestFields", async () => {
    await call_bedrock("x", SONNET, 1, 1, {
      additional_model_request_fields: '{"top_k": 200}',
    });
    expect(mockSent[0].additionalModelRequestFields).toEqual({ top_k: 200 });
  });

  test("rejects additionalModelRequestFields that is not JSON", async () => {
    await expect(
      call_bedrock("x", SONNET, 1, 1, {
        additional_model_request_fields: "top_k=200",
      }),
    ).rejects.toThrow(/must be a JSON object/);
  });

  test("asks once per response", async () => {
    const [, responses] = await call_bedrock("x", SONNET, 3, 1, {});
    expect(mockSent).toHaveLength(3);
    expect(responses as Dict[]).toHaveLength(3);
  });

  test("a session token is only mockSent when there is one", async () => {
    await call_bedrock("x", SONNET, 1, 1, {});
    expect(
      (globalThis as any).__lastBedrockConfig.credentials.sessionToken,
    ).toBeUndefined();

    set_api_keys({
      AWS_Access_Key_ID: "AKIA-test",
      AWS_Secret_Access_Key: "secret-test",
      AWS_Session_Token: "session-test",
      AWS_Region: "us-east-1",
    });
    await call_bedrock("x", SONNET, 1, 1, {});
    expect(
      (globalThis as any).__lastBedrockConfig.credentials.sessionToken,
    ).toBe("session-test");
  });
});

describe("Bedrock errors and responses", () => {
  test("a bare model ID rejected on-demand suggests the inference profile", async () => {
    mockNextError = new Error(
      "Invocation of model ID anthropic.claude-sonnet-5 with on-demand throughput isn't supported.",
    );
    await expect(
      call_bedrock("x", `${BEDROCK_PREFIX}anthropic.claude-sonnet-5`, 1, 1, {}),
    ).rejects.toThrow(/us\.anthropic\.claude-sonnet-5/);
  });

  test("a response with no text says why it stopped", async () => {
    mockNextReply = {
      output: { message: { content: [] } },
      stopReason: "max_tokens",
    };
    await expect(call_bedrock("x", SONNET, 1, 1, {})).rejects.toThrow(
      /max_tokens/,
    );
  });

  test("extract_responses reads Converse output and older cached strings", () => {
    expect(
      extract_responses(
        [{ generated_text: " Hello " }] as unknown as Dict,
        SONNET,
        LLMProvider.Bedrock,
      ),
    ).toEqual(["Hello"]);
    // Runs cached before Converse stored the text as a plain string.
    expect(
      extract_responses(
        [" Older cached "] as unknown as Dict,
        SONNET,
        LLMProvider.Bedrock,
      ),
    ).toEqual(["Older cached"]);
  });
});
