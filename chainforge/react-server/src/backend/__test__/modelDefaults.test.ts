/*
 * @jest-environment jsdom
 */
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {},
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
import { describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  WebLLMSettings,
  applyModelDefaultsOnModelChange,
  getDefaultModelFormData,
  getDefaultModelSettings,
} from "../../ModelSettingSchemas";
// eslint-disable-next-line import/first
import { NativeLLM } from "../models";

const QWEN3 = NativeLLM.WebLLM_Qwen3_1_7B;
const QWEN3_5 = NativeLLM.WebLLM_Qwen3_5_0_8B;
const GEMMA = NativeLLM.WebLLM_Gemma3_1B;

describe("per-model defaults for in-browser models", () => {
  test("the reasoning Qwen models default to a higher token limit", () => {
    expect(getDefaultModelSettings("webllm", QWEN3).max_tokens).toBe(2048);
    expect(getDefaultModelSettings("webllm", QWEN3_5).max_tokens).toBe(2048);
    expect(getDefaultModelFormData("webllm", QWEN3)).toMatchObject({
      model: QWEN3,
      max_tokens: 2048,
    });
  });

  test("other models, or no model, keep the form's default", () => {
    expect(getDefaultModelSettings("webllm", GEMMA).max_tokens).toBe(512);
    expect(getDefaultModelSettings("webllm").max_tokens).toBe(512);
  });

  test("switching model moves fields still at the old model's default", () => {
    const form = { model: GEMMA, max_tokens: 512, temperature: 0.7 };
    expect(
      applyModelDefaultsOnModelChange(WebLLMSettings, form, GEMMA, QWEN3),
    ).toEqual({ model: GEMMA, max_tokens: 2048, temperature: 0.7 });
    expect(
      applyModelDefaultsOnModelChange(
        WebLLMSettings,
        { ...form, max_tokens: 2048 },
        QWEN3,
        GEMMA,
      ).max_tokens,
    ).toBe(512);
  });

  test("a token limit the user set is kept when switching model", () => {
    const form = { model: GEMMA, max_tokens: 1000 };
    expect(
      applyModelDefaultsOnModelChange(WebLLMSettings, form, GEMMA, QWEN3)
        .max_tokens,
    ).toBe(1000);
  });
});
