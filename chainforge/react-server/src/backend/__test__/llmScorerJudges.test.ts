/*
 * @jest-environment jsdom
 */
// Same stubs as llmScorerStringTable.test.ts: Pyodide can't load under CRA's
// Jest, and the real store imports ModelSettingSchemas mid-cycle.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));
// Each judge's model answers from its own script, keyed by the response it grades.
const mockAnswers: Record<string, Record<string, string>> = {};
const mockPrompts: string[] = [];
jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  call_llm: async (llm: string, _provider: string, prompt: string) => {
    mockPrompts.push(prompt);
    const script = mockAnswers[llm] ?? {};
    const key = Object.keys(script).find((k) => prompt.includes(k));
    const content = key !== undefined ? script[key] : "?";
    return [
      { prompt },
      [{ choices: [{ message: { role: "assistant", content } }] }],
    ];
  },
}));

// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { evalWithLLM } from "../backend";
// eslint-disable-next-line import/first
import StorageCache, { StringLookup } from "../cache";
// eslint-disable-next-line import/first
import { LLMResponse, LLMSpec } from "../typing";
// eslint-disable-next-line import/first
import { formatInstruction, scoreSpecFrom } from "../scorerFormat";

const judge = (name: string, model: string): LLMSpec => ({
  key: `key-${name}`,
  name,
  emoji: "🔀",
  model: `openrouter/${model}`,
  base_model: "openrouter",
  temp: 0,
  settings: {},
});

const TICKETS = [
  "I was charged twice for order A-104.",
  "The app crashes when I upload a photo.",
];
const SPEC = scoreSpecFrom("cat", "billing: charges\ntechnical: bugs");
const root = (spec = SPEC) =>
  `Which team should handle this ticket?\n{__input}\n${formatInstruction(spec, false)}`;

beforeEach(() => {
  mockPrompts.length = 0;
  for (const k of Object.keys(mockAnswers)) delete mockAnswers[k];
  StorageCache.clear();
  StringLookup.restoreFrom([]);
  StorageCache.store("prompt-1.json", [
    {
      uid: "r1",
      prompt: "Write a ticket.",
      vars: {},
      metavars: {},
      llm: "GPT",
      responses: TICKETS,
    },
  ] as LLMResponse[]);
});

describe("several judges in one LLM Scorer", () => {
  test("scores each response once per judge, keyed by judge name", async () => {
    mockAnswers["openrouter/a"] = {
      "charged twice": "Billing.",
      crashes: "technical",
    };
    mockAnswers["openrouter/b"] = {
      "charged twice": "billing",
      crashes: "Sales",
    };

    const { responses, errors, invalid } = await evalWithLLM(
      "llmeval-1",
      [judge("A", "a"), judge("B", "b")],
      root(),
      ["prompt-1"],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      SPEC,
    );

    expect(errors).toEqual([]);
    expect(mockPrompts).toHaveLength(4);
    expect(responses?.[0].eval_res).toEqual({
      items: [
        { A: "billing", B: "billing" },
        { A: "technical", B: "Sales" },
      ],
      dtype: "KeyValue_Categorical",
    });
    expect(invalid).toEqual([
      { judge: "B", count: 1, total: 2, examples: ["Sales"] },
    ]);
    // Saved once, under the scorer's id
    expect(StorageCache.get("llmeval-1.json")?.[0].eval_res.items).toHaveLength(
      2,
    );
  });

  test("a single judge still gets plain scores", async () => {
    mockAnswers["openrouter/a"] = { "charged twice": "yes", crashes: "No" };
    const { responses, invalid } = await evalWithLLM(
      "llmeval-2",
      judge("A", "a"),
      root({ format: "bin" }),
      ["prompt-1"],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      { format: "bin" },
    );
    expect(responses?.[0].eval_res).toEqual({
      items: [true, false],
      dtype: "Categorical",
    });
    expect(invalid).toBeUndefined();
  });

  test("numeric scores stay numbers when one answer doesn't parse", async () => {
    mockAnswers["openrouter/a"] = { "charged twice": "2", crashes: "unsure" };
    const spec = scoreSpecFrom("num", undefined, "Low\nMedium\nHigh");
    const { responses, invalid } = await evalWithLLM(
      "llmeval-3",
      judge("A", "a"),
      root(spec),
      ["prompt-1"],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      spec,
    );
    expect(responses?.[0].eval_res).toEqual({
      items: [2, "unsure"],
      dtype: "Numeric",
    });
    expect(invalid?.[0]).toMatchObject({ judge: "A", count: 1, total: 2 });
  });

  test("without a format, several judges' answers are still inferred as booleans", async () => {
    mockAnswers["openrouter/a"] = { "charged twice": "true", crashes: "false" };
    mockAnswers["openrouter/b"] = { "charged twice": "yes", crashes: "true" };
    const { responses } = await evalWithLLM(
      "llmeval-4",
      [judge("A", "a"), judge("B", "b")],
      "Is this urgent?\n{__input}",
      ["prompt-1"],
    );
    expect(responses?.[0].eval_res).toEqual({
      items: [
        { A: true, B: true },
        { A: false, B: true },
      ],
      dtype: "KeyValue_Categorical",
    });
  });
});
