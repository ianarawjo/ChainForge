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
  ModelSettings,
  WebLLMSettings,
  applyModelDefaultsOnModelChange,
  fitFormDataToModel,
  getDefaultModelFormData,
  getDefaultModelSettings,
  schemaForModel,
} from "../../ModelSettingSchemas";
// eslint-disable-next-line import/first
import { NativeLLM, fitOpenAIReasoningEffort } from "../models";

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

describe("OpenAI reasoning efforts, per model", () => {
  const efforts = (model: string) =>
    schemaForModel(ModelSettings["gpt-4"], model).properties.reasoning_effort
      .enum;

  test("the form offers only the efforts OpenAI's docs list for the model", () => {
    expect(efforts("gpt-6-luna")).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(efforts("gpt-6-astra")).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(efforts("gpt-5.4")).toEqual([
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(efforts("gpt-5")).toEqual(["minimal", "low", "medium", "high"]);
    expect(efforts("gpt-5-pro")).toEqual(["high"]);
    // A dated snapshot takes its model's
    expect(efforts("gpt-5.4-2026-03-05")).toEqual(efforts("gpt-5.4"));
    // Models the docs don't cover keep the four levels offered before
    expect(efforts("o3")).toEqual(["minimal", "low", "medium", "high"]);
    // The GPT-3.5 menu entry's form is filtered too
    expect(
      schemaForModel(ModelSettings["gpt-3.5-turbo"], "gpt-5-pro").properties
        .reasoning_effort.enum,
    ).toEqual(["high"]);
  });

  test("an effort the model doesn't take becomes the nearest one it does", () => {
    const spec = ModelSettings["gpt-4"];
    const fit = (model: string, reasoning_effort: string) =>
      fitFormDataToModel(spec, { model, reasoning_effort }).reasoning_effort;
    expect(fit("gpt-5.4", "max")).toBe("xhigh");
    expect(fit("gpt-6-astra", "none")).toBe("low");
    expect(fit("gpt-5.1", "minimal")).toBe("low"); // the higher, on a tie
    expect(fit("gpt-5-pro", "medium")).toBe("high");
    expect(fit("gpt-6-luna", "max")).toBe("max");
    expect(fit("o3", "max")).toBe("high");
    // New settings start at an effort the model takes
    expect(getDefaultModelFormData("gpt-4", "gpt-5-pro").reasoning_effort).toBe(
      "high",
    );
  });

  test("the backend sends a supported effort, and leaves unknown models alone", () => {
    expect(fitOpenAIReasoningEffort("gpt-5.4-mini", "max")).toBe("xhigh");
    expect(fitOpenAIReasoningEffort("gpt-6.1-sol", "minimal")).toBe("low");
    expect(fitOpenAIReasoningEffort("gpt-6-sol", "none")).toBe("none");
    expect(fitOpenAIReasoningEffort("o3", "max")).toBe("max");
    expect(fitOpenAIReasoningEffort("some-new-model", "xhigh")).toBe("xhigh");
  });
});
