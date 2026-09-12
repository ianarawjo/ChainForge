/*
 * @jest-environment jsdom
 */
// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));

// The app's store and ModelSettingSchemas import each other, so importing the
// real store during a test evaluates it mid-cycle and its schema-derived
// constants come back undefined. These tests don't exercise the store, so stub
// it (same approach as minimax.test.ts).
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));

// eslint-disable-next-line import/first
import { NativeLLM } from "../models";
import { expect, test } from "@jest/globals";
import {
  queryLLM,
  executejs,
  countQueries,
  ResponseInfo,
  grabResponses,
} from "../backend";
import { LLMResponse, Dict, StringOrHash, LLMSpec } from "../typing";
import StorageCache from "../cache";

test("count queries required", async () => {
  // Setup params to call
  const prompt = "What is the {timeframe} when {person} was born?";
  const vars: { [key: string]: any } = {
    timeframe: ["year", "decade", "century"],
    person: ["Howard Hughes", "Toni Morrison", "Otis Redding"],
  };

  // Double-check the queries required (not loading from cache)
  const test_count_queries = async (
    llms: Array<StringOrHash | LLMSpec>,
    n: number,
  ) => {
    const { counts, total_num_responses } = await countQueries(
      prompt,
      vars,
      llms,
      n,
    );

    Object.values(total_num_responses).forEach((v) => {
      expect(v).toBe(n * 3 * 3);
    });
    Object.keys(counts).forEach((llm) => {
      expect(Object.keys(counts[llm])).toHaveLength(3 * 3);
      Object.values(counts[llm]).forEach((num) => {
        expect(num).toBe(n);
      });
    });
  };

  // Try a number of different inputs
  await test_count_queries([NativeLLM.OpenAI_ChatGPT, NativeLLM.Claude_v1], 3);
  await test_count_queries(
    [
      {
        name: "Claude",
        key: "claude-test",
        emoji: "📚",
        model: "claude-v1",
        base_model: "claude-v1",
        temp: 0.5,
      },
    ],
    5,
  );
});
