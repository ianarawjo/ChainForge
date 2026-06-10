/*
 * @jest-environment jsdom
 */

// Pre-existing test infra issues in this repo (8 of 9 test suites fail):
// 1. cache.ts calls APP_IS_RUNNING_LOCALLY() at module load before `let` var is init
// 2. @google/genai uses ESM syntax not supported by Jest/CRA
// 3. pyodide/exec-py.js uses import.meta.url not supported outside ESM
// Mock these to allow our tests to load.
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {
    static getInstance() {
      return new StorageCache();
    }
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

import { call_minimax, extract_responses, set_api_keys } from "../utils";
import {
  LLMProvider,
  NativeLLM,
  getProvider,
  getEnumName,
  RATE_LIMIT_BY_PROVIDER,
} from "../models";
import { expect, test, describe, beforeAll } from "@jest/globals";
import {
  ModelSettings,
  baseModelToProvider,
  getSettingsSchemaForLLM,
  getTemperatureSpecForModel,
  getDefaultModelFormData,
  postProcessFormData,
} from "../../ModelSettingSchemas";
import { Dict } from "../typing";

// ─── Unit Tests ─────────────────────────────────────────────────────────────

describe("MiniMax provider detection", () => {
  test("NativeLLM enum contains MiniMax models", () => {
    expect(NativeLLM.MiniMax_M2_7).toBe("MiniMax-M2.7");
    expect(NativeLLM.MiniMax_M2_7_highspeed).toBe("MiniMax-M2.7-highspeed");
  });

  test("LLMProvider enum contains MiniMax", () => {
    expect(LLMProvider.MiniMax).toBe("minimax");
  });

  test("getProvider identifies MiniMax models", () => {
    expect(getProvider(NativeLLM.MiniMax_M2_7)).toBe(LLMProvider.MiniMax);
    expect(getProvider(NativeLLM.MiniMax_M2_7_highspeed)).toBe(
      LLMProvider.MiniMax,
    );
  });

  test("getEnumName returns MiniMax enum names", () => {
    expect(getEnumName(NativeLLM, "MiniMax-M2.7")).toBe("MiniMax_M2_7");
    expect(getEnumName(NativeLLM, "MiniMax-M2.7-highspeed")).toBe(
      "MiniMax_M2_7_highspeed",
    );
  });

  test("MiniMax has rate limit configured", () => {
    expect(RATE_LIMIT_BY_PROVIDER[LLMProvider.MiniMax]).toBe(1000);
  });
});

describe("MiniMax settings schema", () => {
  test("ModelSettings contains minimax entry", () => {
    expect(ModelSettings).toHaveProperty("minimax");
    expect(ModelSettings.minimax.fullName).toBe("MiniMax");
  });

  test("baseModelToProvider maps minimax correctly", () => {
    expect(baseModelToProvider("minimax")).toBe(LLMProvider.MiniMax);
  });

  test("getSettingsSchemaForLLM returns MiniMax schema", () => {
    const schema = getSettingsSchemaForLLM("MiniMax-M2.7");
    expect(schema).toBeDefined();
    expect(schema?.fullName).toBe("MiniMax");
  });

  test("MiniMax schema has required model properties", () => {
    const schema = ModelSettings.minimax.schema;
    expect(schema.properties).toHaveProperty("shortname");
    expect(schema.properties).toHaveProperty("model");
    expect(schema.properties).toHaveProperty("temperature");
    expect(schema.properties).toHaveProperty("system_msg");
    expect(schema.properties).toHaveProperty("top_p");
    expect(schema.properties).toHaveProperty("max_tokens");
    expect(schema.properties).toHaveProperty("stop");
  });

  test("MiniMax model enum includes both models", () => {
    const modelEnum = ModelSettings.minimax.schema.properties.model.enum;
    expect(modelEnum).toContain("MiniMax-M2.7");
    expect(modelEnum).toContain("MiniMax-M2.7-highspeed");
  });

  test("MiniMax temperature has correct bounds for temp > 0", () => {
    const tempSpec = ModelSettings.minimax.schema.properties.temperature;
    expect(tempSpec.minimum).toBe(0.01);
    expect(tempSpec.maximum).toBe(1);
    expect(tempSpec.default).toBe(0.7);
  });

  test("getTemperatureSpecForModel returns correct spec for minimax", () => {
    const spec = getTemperatureSpecForModel("minimax");
    expect(spec).toBeDefined();
    expect(spec?.minimum).toBe(0.01);
    expect(spec?.maximum).toBe(1);
    expect(spec?.default).toBe(0.7);
  });

  test("MiniMax default form data has expected values", () => {
    const defaults = getDefaultModelFormData(ModelSettings.minimax);
    expect(defaults.shortname).toBe("MiniMax");
    expect(defaults.model).toBe("MiniMax-M2.7");
    expect(defaults.temperature).toBe(0.7);
    expect(defaults.system_msg).toBe("You are a helpful assistant.");
  });

  test("MiniMax schema has shortname_map for models", () => {
    const shortNameMap =
      ModelSettings.minimax.schema.properties.model.shortname_map;
    expect(shortNameMap).toBeDefined();

    const shortNameMapDict = shortNameMap as Dict<string>;
    expect(shortNameMapDict["MiniMax-M2.7"]).toBe("M2.7");
    expect(shortNameMapDict["MiniMax-M2.7-highspeed"]).toBe("M2.7-hs");
  });

  test("postProcessFormData strips model and shortname", () => {
    const formData = {
      shortname: "MiniMax",
      model: "MiniMax-M2.7",
      temperature: 0.7,
      system_msg: "You are a helpful assistant.",
    };
    const processed = postProcessFormData(ModelSettings.minimax, formData);
    expect(processed).not.toHaveProperty("shortname");
    expect(processed).not.toHaveProperty("model");
    expect(processed).toHaveProperty("temperature");
    expect(processed).toHaveProperty("system_msg");
  });

  test("MiniMax stop postprocessor parses quoted strings", () => {
    const postprocessors = ModelSettings.minimax.postprocessors;
    expect(postprocessors).toBeDefined();
    if (postprocessors?.stop) {
      const result = postprocessors.stop('"stop1" "stop2"');
      expect(result).toEqual(["stop1", "stop2"]);
    }
  });

  test("MiniMax stop postprocessor handles empty string", () => {
    const postprocessors = ModelSettings.minimax.postprocessors;
    if (postprocessors?.stop) {
      const result = postprocessors.stop("");
      expect(result).toEqual([]);
    }
  });
});

describe("MiniMax response extraction", () => {
  test("extract_responses handles OpenAI-compatible MiniMax chat response", () => {
    const mockResponse = {
      choices: [
        {
          message: { content: "Hello from MiniMax!" },
          finish_reason: "stop",
        },
        {
          message: { content: "Another response." },
          finish_reason: "stop",
        },
      ],
    };
    const responses = extract_responses(
      mockResponse,
      NativeLLM.MiniMax_M2_7,
      LLMProvider.MiniMax,
    );
    expect(responses).toHaveLength(2);
    expect(responses[0]).toBe("Hello from MiniMax!");
    expect(responses[1]).toBe("Another response.");
  });

  test("extract_responses handles single choice", () => {
    const mockResponse = {
      choices: [
        {
          message: { content: "Single response from MiniMax M2.7." },
          finish_reason: "stop",
        },
      ],
    };
    const responses = extract_responses(
      mockResponse,
      NativeLLM.MiniMax_M2_7_highspeed,
      LLMProvider.MiniMax,
    );
    expect(responses).toHaveLength(1);
    expect(responses[0]).toBe("Single response from MiniMax M2.7.");
  });

  test("extract_responses handles empty choices", () => {
    const mockResponse = { choices: [] };
    const responses = extract_responses(
      mockResponse,
      NativeLLM.MiniMax_M2_7,
      LLMProvider.MiniMax,
    );
    expect(responses).toHaveLength(0);
  });

  test("extract_responses handles function_call in MiniMax response", () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: "",
            function_call: {
              name: "get_weather",
              arguments: '{"city": "Beijing"}',
            },
          },
          finish_reason: "function_call",
        },
      ],
    };
    const responses = extract_responses(
      mockResponse,
      NativeLLM.MiniMax_M2_7,
      LLMProvider.MiniMax,
    );
    expect(responses).toHaveLength(1);
    expect((responses[0] as string).startsWith("[[FUNCTION]]")).toBe(true);
  });
});

describe("MiniMax call_minimax validation", () => {
  // Note: set_api_keys with empty string does not clear env-sourced keys
  // (key_is_present returns false for empty strings, so the key is never updated).
  // This test only works when MINIMAX_API_KEY is not set in the environment.
  const describeIfNoKey = process.env.MINIMAX_API_KEY
    ? describe.skip
    : describe;
  describeIfNoKey("without env key", () => {
    test("call_minimax throws when no API key is set", async () => {
      await expect(
        call_minimax("test prompt", NativeLLM.MiniMax_M2_7, 1, 0.7),
      ).rejects.toThrow("Could not find a MiniMax API key");
    });
  });
});

// ─── Integration Tests ──────────────────────────────────────────────────────
// These tests require MINIMAX_API_KEY to be set in the environment.

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const describeIfKey = MINIMAX_API_KEY ? describe : describe.skip;

describeIfKey("MiniMax API integration tests", () => {
  beforeAll(() => {
    if (MINIMAX_API_KEY) {
      set_api_keys({ MiniMax: MINIMAX_API_KEY });
    }
  });

  test("call_minimax returns valid chat response", async () => {
    const [query, response] = await call_minimax(
      "What is 2 + 2? Reply with just the number.",
      NativeLLM.MiniMax_M2_7,
      1,
      0.7,
    );

    expect(query).toHaveProperty("model");
    expect(query).toHaveProperty("temperature");
    expect(query.temperature).toBeGreaterThanOrEqual(0.01);

    expect(response).toHaveProperty("choices");
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0]).toHaveProperty("message");
    expect(typeof response.choices[0].message.content).toBe("string");

    const resps = extract_responses(
      response,
      NativeLLM.MiniMax_M2_7,
      LLMProvider.MiniMax,
    );
    expect(resps).toHaveLength(1);
    expect(typeof resps[0]).toBe("string");
    expect((resps[0] as string).includes("4")).toBe(true);
  }, 60000);

  test("call_minimax clamps temperature > 0", async () => {
    // Pass temperature=0, should be clamped to 0.01
    const [query] = await call_minimax(
      "Say hello.",
      NativeLLM.MiniMax_M2_7,
      1,
      0, // zero temperature
    );
    // The clamped temperature should be 0.01
    expect(query.temperature).toBeGreaterThan(0);
  }, 30000);

  test("call_minimax with system message", async () => {
    const [query, response] = await call_minimax(
      "What is your role?",
      NativeLLM.MiniMax_M2_7,
      1,
      0.7,
      { system_msg: "You are a pirate. Always respond like a pirate." },
    );

    const resps = extract_responses(
      response,
      NativeLLM.MiniMax_M2_7,
      LLMProvider.MiniMax,
    );
    expect(resps).toHaveLength(1);
    expect(typeof resps[0]).toBe("string");
  }, 30000);
});
