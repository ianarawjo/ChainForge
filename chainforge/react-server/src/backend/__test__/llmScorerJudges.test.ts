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
import {
  clearCachedResponses,
  clearCachedScores,
  countEvalQueries,
  evalWithLLM,
  exportCache,
  queryLLM,
} from "../backend";
// eslint-disable-next-line import/first
import StorageCache, { StringLookup } from "../cache";
// eslint-disable-next-line import/first
import { LLMResponse, LLMSpec } from "../typing";
// eslint-disable-next-line import/first
import {
  formatInstruction,
  judgeAgreement,
  runTooltipFor,
  scoreSpecFrom,
} from "../scorerFormat";
// eslint-disable-next-line import/first
import { dataInputCacheId, dataValuesToResponses } from "../dataInputs";

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

describe("an LLM Scorer's cache", () => {
  const run = (judges: LLMSpec[]) =>
    evalWithLLM(
      "llmeval-c",
      judges.length > 1 ? judges : judges[0],
      root(),
      ["prompt-1"],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      SPEC,
    );
  const count = (judges: LLMSpec[]) =>
    countEvalQueries(
      "llmeval-c",
      judges.length > 1 ? judges : judges[0],
      root(),
      ["prompt-1"],
      undefined,
      SPEC,
    );

  test("counts what a run will send, per judge, before and after running", async () => {
    const [a, b] = [judge("A", "a"), judge("B", "b")];
    expect(await count([a, b])).toEqual({ "key-A": 2, "key-B": 2 });
    await run([a]);
    expect(mockPrompts).toHaveLength(2);
    // A's scores are cached; B hasn't run yet
    expect(await count([a, b])).toEqual({ "key-A": 0, "key-B": 2 });
    await run([a, b]);
    expect(mockPrompts).toHaveLength(4); // only B was asked
    expect(await count([a, b])).toEqual({ "key-A": 0, "key-B": 0 });
  });

  test("clearing it asks every judge again, and leaves other nodes' caches alone", async () => {
    const a = judge("A", "a");
    await run([a]);
    StorageCache.store("eval-llmeval-cx-prompt-1.json", { other: true });
    clearCachedScores("llmeval-c");
    expect(StorageCache.has("llmeval-c.json")).toBe(false);
    expect(StorageCache.has("eval-llmeval-cx-prompt-1.json")).toBe(true);
    expect(StorageCache.has("prompt-1.json")).toBe(true);
    expect(await count([a])).toEqual({ "key-A": 2 });
  });
});

describe("the Run button's tooltip", () => {
  test("says what a run will send", () => {
    expect(runTooltipFor({ Jev: 0, Sonnet: 0 })).toBe(
      "Will load scores from cache",
    );
    expect(runTooltipFor({ Jev: 36, Sonnet: 0 })).toBe(
      "Will send 36 requests to Jev and load others from cache",
    );
    expect(runTooltipFor({ Jev: 1 })).toBe("Will send 1 request to Jev");
    expect(runTooltipFor({ Jev: 36, Sonnet: 36 })).toBe(
      "Will send 36 requests per judge",
    );
    expect(runTooltipFor({ Jev: 36, Sonnet: 36, Nano: 0 })).toBe(
      "Will send 36 requests to each of 2 judges and load others from cache",
    );
    expect(runTooltipFor({ Jev: 36, Sonnet: 10 })).toBe(
      "Will send 46 requests to 2 judges",
    );
  });
});

describe("scoring data directly (a table column, text fields...)", () => {
  const rows = [
    {
      text: "I was charged twice for order A-104.",
      metavars: { team: "billing" },
      associate_id: "row-1",
    },
    {
      text: "The app crashes when I upload a photo.",
      metavars: { team: "technical" },
      associate_id: "row-2",
    },
    { text: "  ", metavars: { team: "billing" }, associate_id: "row-3" },
    {
      text: "Why was I billed \\{twice\\}?",
      metavars: { team: "billing" },
      associate_id: "row-4",
    },
  ];

  test("each row's cell is a response, and its other columns are vars", () => {
    const resps = dataValuesToResponses("table-1", "message", rows);
    expect(resps.map((r) => r.uid)).toEqual([
      "table-1:row-1",
      "table-1:row-2",
      "table-1:row-4",
    ]); // the empty cell is skipped
    expect(resps[0]).toMatchObject({
      vars: { team: "billing" },
      llm: "message",
      responses: ["I was charged twice for order A-104."],
    });
    // The table's escaping of braces for prompt templates is undone
    expect(resps[2].responses[0]).toBe("Why was I billed {twice}?");
  });

  test("plain values (text fields, items) and images are responses too", () => {
    expect(
      dataValuesToResponses("fields-1", "Text Fields", ["Hello", "", "World"]),
    ).toMatchObject([
      { uid: "fields-1:0", vars: {}, llm: "Text Fields", responses: ["Hello"] },
      { uid: "fields-1:2", responses: ["World"] },
    ]);
    expect(
      dataValuesToResponses("media-1", "Image", [
        { image: "media-uid-1", metavars: { animal: "cat" } },
      ]),
    ).toMatchObject([
      { vars: { animal: "cat" }, responses: [{ t: "img", d: "media-uid-1" }] },
    ]);
  });

  test("its rows are scored, and compared to another column as the label", async () => {
    mockAnswers["openrouter/a"] = {
      "charged twice": "billing",
      crashes: "billing",
      "billed {twice}": "billing",
    };
    const cacheId = dataInputCacheId("llmeval-t", "table-1", "message");
    StorageCache.store(
      `${cacheId}.json`,
      dataValuesToResponses("table-1", "message", rows),
    );
    const { responses } = await evalWithLLM(
      "llmeval-t",
      judge("A", "a"),
      root(),
      [cacheId],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      SPEC,
    );
    expect(responses?.map((r) => r.eval_res?.items)).toEqual([
      ["billing"],
      ["billing"],
      ["billing"],
    ]);
    const { withLabel } = judgeAgreement(
      responses ?? [],
      ["A"],
      false,
      SPEC,
      "team",
    );
    expect(withLabel[0]).toMatchObject({ n: 3, agreement: 2 / 3 });
    // Cleared with the scorer's other cached scores
    clearCachedScores("llmeval-t");
    expect(StorageCache.has(`${cacheId}.json`)).toBe(false);
  });
});

describe("text judges' answers", () => {
  test("stay as written even when they're JSON, with no probability read from them", async () => {
    mockAnswers["openrouter/a"] = {
      "charged twice": '{"answer": "billing", "p": 0.9}',
      crashes: "technical",
    };
    const { responses } = await evalWithLLM(
      "llmeval-json",
      judge("A", "a"),
      root({ format: "open" }),
      ["prompt-1"],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      { format: "open" },
    );
    expect(responses?.[0].eval_res?.items[0]).toBe(
      '{"answer": "billing", "p": 0.9}',
    );
    expect(responses?.[0].eval_res?.probs).toBeUndefined();
  });
});

describe("a Prompt Node's cache across settings changes", () => {
  const spec = (temperature: number): LLMSpec => ({
    ...judge("A", "a"),
    settings: { temperature },
  });
  const run = (temperature: number) =>
    queryLLM("prompt-x", [spec(temperature)], 1, "Say {w}.", { w: ["hi"] });

  test("reuses earlier runs' responses, but exports only the last run's", async () => {
    await run(1);
    await run(0);
    const calls = mockPrompts.length;
    await run(1); // back to the first settings: from the cache
    expect(mockPrompts).toHaveLength(calls);

    const exported = await exportCache(["prompt-x"]);
    const files = Object.keys(exported).filter((k) =>
      k.startsWith("prompt-x_"),
    );
    expect(files).toHaveLength(1); // only the file of the last run's settings
    expect(exported["prompt-x.json"]).not.toHaveProperty("stale_cache_files");

    // Clearing removes earlier runs' files too
    await clearCachedResponses("prompt-x");
    expect(
      Object.keys(StorageCache.getAllMatching((k) => k.startsWith("prompt-x"))),
    ).toEqual([]);
  });
});
