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
  extract_reasoning,
  extract_responses,
  split_webllm_thinking,
} from "../utils";
// eslint-disable-next-line import/first
import { LLMProvider, NativeLLM } from "../models";

const choice = (content: string) => ({
  index: 0,
  message: { role: "assistant", content },
  finish_reason: "stop",
});

describe("reasoning from in-browser models", () => {
  test("a leading think block becomes the reasoning", () => {
    expect(
      split_webllm_thinking(
        choice("<think>\nRecall the novel.\n</think>\n\nIt is a truth..."),
      ).message,
    ).toEqual({
      role: "assistant",
      content: "It is a truth...",
      reasoning_content: "Recall the novel.",
    });
  });

  test("an empty think block is dropped, with no reasoning", () => {
    const { message } = split_webllm_thinking(
      choice("<think>\n\n</think>\n\nThe answer."),
    );
    expect(message).toEqual({ role: "assistant", content: "The answer." });
  });

  test("a think block that never closes is all reasoning", () => {
    const { message } = split_webllm_thinking(choice("<think>Step 1..."));
    expect(message.content).toBe("");
    expect(message.reasoning_content).toBe("Step 1...");
  });

  test("replies without a think block are unchanged", () => {
    const c = choice("Plain answer mentioning <think> later.");
    expect(split_webllm_thinking(c)).toBe(c);
  });

  test("the reasoning is extracted beside the answer", () => {
    const response = {
      choices: [split_webllm_thinking(choice("<think>Hmm.</think>Answer."))],
    };
    const model = NativeLLM.WebLLM_Qwen3_1_7B;
    expect(extract_responses(response, model, LLMProvider.WebLLM)).toEqual([
      "Answer.",
    ]);
    expect(extract_reasoning(response, model, LLMProvider.WebLLM)).toEqual([
      "Hmm.",
    ]);
  });
});
