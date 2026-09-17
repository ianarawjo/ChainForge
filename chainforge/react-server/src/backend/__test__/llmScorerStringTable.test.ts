/*
 * @jest-environment jsdom
 */
// Same stubs as backend.test.ts: Pyodide can't load under CRA's Jest, and the
// real store imports ModelSettingSchemas mid-cycle.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));
// Every model call answers "true", as OpenRouter would.
const mockModelCalls: string[] = [];
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  call_llm: async (_llm: string, _provider: string, prompt: string) => {
    mockModelCalls.push(prompt);
    return [
      { prompt },
      [{ choices: [{ message: { role: "assistant", content: "true" } }] }],
    ];
  },
}));

// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { evalWithLLM, queryLLM } from "../backend";
// eslint-disable-next-line import/first
import StorageCache, { StringLookup } from "../cache";
// eslint-disable-next-line import/first
import { LLMResponse, LLMSpec } from "../typing";

const model = (name: string): LLMSpec => ({
  key: `key-${name}`,
  name,
  emoji: "🔀",
  model: "openrouter/openai/gpt-5.4-mini",
  base_model: "openrouter",
  temp: 0,
  settings: {},
});

const RUBRIC = "Respond with 'true' if the response mentions a cat.";
const RESPONSE = "My cat, Biscuit, sleeps in the sun all afternoon.";

beforeEach(() => {
  mockModelCalls.length = 0;
  StorageCache.clear();
  StringLookup.restoreFrom([]);
});

describe("the StringLookup table after LLM scoring", () => {
  test("keeps each response once, not again inside a grader prompt", async () => {
    // A prompt node's saved responses, interned as the app stores them.
    const saved: LLMResponse[] = [
      {
        uid: "r1",
        prompt: StringLookup.intern("Tell me about your pet."),
        vars: {},
        metavars: {},
        llm: "GPT",
        responses: [StringLookup.intern(RESPONSE)],
      },
    ];
    StorageCache.store("prompt-1.json", saved);

    const { responses, errors } = await evalWithLLM(
      "llmeval-1",
      model("Judge"),
      `You are evaluating text that will be pasted below. ${RUBRIC}\n\`\`\`\n{__input}\n\`\`\``,
      ["prompt-1"],
    );

    expect(errors).toEqual([]);
    expect(responses?.[0].eval_res?.items).toEqual([true]);
    // The scores are saved and still point at the original response.
    expect(StringLookup.get(responses?.[0].responses[0])).toBe(RESPONSE);

    // No entry in the table is a grader prompt (rubric + pasted response).
    const table = StringLookup.toJSON();
    expect(table.filter((s) => s.includes(RUBRIC))).toEqual([]);
    expect(table.filter((s) => s === RESPONSE)).toHaveLength(1);
  });

  test("re-scoring reuses the session's cached grades", async () => {
    StorageCache.store("prompt-1.json", [
      {
        uid: "r1",
        prompt: "Tell me about your pet.",
        vars: {},
        metavars: {},
        llm: "GPT",
        responses: [RESPONSE],
      },
    ]);
    const root = `${RUBRIC}\n{__input}`;
    await evalWithLLM("llmeval-1", model("Judge"), root, ["prompt-1"]);
    expect(mockModelCalls).toHaveLength(1);
    const again = await evalWithLLM("llmeval-1", model("Judge"), root, [
      "prompt-1",
    ]);
    expect(again.responses?.[0].eval_res?.items).toEqual([true]);
    expect(mockModelCalls).toHaveLength(1); // graded from the cache
  });

  test("a prompt node's own responses are still interned", async () => {
    const { responses } = await queryLLM(
      "prompt-2",
      [model("GPT")],
      1,
      "Describe {animal}.",
      { animal: ["a cat"] },
    );
    expect(typeof responses[0].responses[0]).toBe("number");
    expect(StringLookup.toJSON()).toContain("Describe a cat.");
  });
});
