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

    static store() {
      // Evaluators cache their results; nothing to keep in these tests.
    }
  },
  StringLookup: {
    get: (x: unknown) => x,
    concretizeDict: (d: unknown) => d,
  },
  MediaLookup: { get: async () => undefined },
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
import { describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  REASONING_METAVAR,
  cleanMetavarsFilterFunc,
  extract_reasoning,
  merge_response_objs,
  withReasoningMetavar,
} from "../utils";
// eslint-disable-next-line import/first
import { executejs } from "../backend";
// eslint-disable-next-line import/first
import { LLMProvider } from "../models";
// eslint-disable-next-line import/first
import { Dict, LLMResponse, RawLLMResponseObject } from "../typing";

const chatReply = (message: Dict) => ({
  choices: [{ message: { role: "assistant", ...message } }],
});

const respObj = (
  responses: string[],
  reasoning?: (string | null)[],
): RawLLMResponseObject => ({
  uid: "uid",
  prompt: "Q",
  vars: {},
  metavars: { topic: "math" },
  llm: "Model",
  responses,
  ...(reasoning && { reasoning }),
});

describe("extracting reasoning", () => {
  test("OpenRouter reasoning per response, with null where there is none", () => {
    const responses = [
      chatReply({ content: "A", reasoning: "Thinking about A" }),
      chatReply({ content: "B", reasoning: null }),
    ];
    expect(
      extract_reasoning(
        responses,
        "openrouter/qwen/qwen3.8-max-0902",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["Thinking about A", null]);
  });

  test("falls back to readable reasoning details: text and summaries, not encrypted ones", () => {
    const responses = [
      chatReply({
        content: "A",
        reasoning_details: [
          { type: "reasoning.summary", summary: "A summary." },
          { type: "reasoning.text", text: "Some steps." },
          { type: "reasoning.encrypted", data: "opaque" },
        ],
      }),
    ];
    expect(
      extract_reasoning(
        responses,
        "openrouter/openai/gpt-5.5",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["A summary.\n\nSome steps."]);
  });

  test("undefined when nothing is readable, and for image models and other providers", () => {
    const encryptedOnly = [
      chatReply({
        content: "A",
        reasoning_details: [{ type: "reasoning.encrypted", data: "opaque" }],
      }),
    ];
    expect(
      extract_reasoning(
        encryptedOnly,
        "openrouter/openai/gpt-5.5",
        LLMProvider.OpenRouter,
      ),
    ).toBeUndefined();
    expect(
      extract_reasoning(
        [{ b64_json: "AAAA" }],
        "openrouter-image/black-forest-labs/flux.2-klein-4b",
        LLMProvider.OpenRouter,
      ),
    ).toBeUndefined();
    expect(
      extract_reasoning(
        chatReply({ content: "A", reasoning: "Thinking" }),
        "gpt-4o",
        LLMProvider.OpenAI,
      ),
    ).toBeUndefined();
  });
});

describe("merging cached responses keeps reasoning lined up", () => {
  test("a side without reasoning gets nulls", () => {
    const merged = merge_response_objs(
      respObj(["new"]),
      respObj(["old 1", "old 2"], ["thought 1", null]),
    );
    expect(merged?.responses).toEqual(["new", "old 1", "old 2"]);
    expect(merged?.reasoning).toEqual([null, "thought 1", null]);
  });

  test("no reasoning on either side adds none", () => {
    const merged = merge_response_objs(respObj(["a"]), respObj(["b"]));
    expect(merged).not.toHaveProperty("reasoning");
  });
});

describe("the reasoning metavar", () => {
  test("is added for the response at an index, and left out otherwise", () => {
    const obj = respObj(["a", "b"], ["thought a", null]);
    expect(withReasoningMetavar(obj.metavars, obj, 0)).toEqual({
      topic: "math",
      [REASONING_METAVAR]: "thought a",
    });
    // Without reasoning, the same metavars object comes back untouched.
    expect(withReasoningMetavar(obj.metavars, obj, 1)).toBe(obj.metavars);
    const noReasoning = respObj(["a"]);
    expect(withReasoningMetavar(noReasoning.metavars, noReasoning, 0)).toBe(
      noReasoning.metavars,
    );
    expect(obj.metavars).not.toHaveProperty(REASONING_METAVAR);
  });

  test("is hidden from group-by and plot menus", () => {
    expect(cleanMetavarsFilterFunc(REASONING_METAVAR)).toBe(false);
    expect(cleanMetavarsFilterFunc("topic")).toBe(true);
  });

  test("JavaScript evaluators see each response's own reasoning in r.meta", async () => {
    const obj = respObj(
      ["answer 1", "answer 2"],
      ["because 1", null],
    ) as LLMResponse;
    // Evaluator code runs in the Code Evaluator node's hidden iframe.
    const iframe = document.createElement("iframe");
    iframe.id = "reasoning-test-iframe";
    document.body.appendChild(iframe);

    const { responses, error } = await executejs(
      "reasoning-test",
      "function evaluate(r) { return r.meta.reasoning || 'none'; }",
      [obj],
      "response",
      "evaluator",
    );
    expect(error).toBeUndefined();
    expect(responses?.[0].eval_res?.items).toEqual(["because 1", "none"]);
  });
});
