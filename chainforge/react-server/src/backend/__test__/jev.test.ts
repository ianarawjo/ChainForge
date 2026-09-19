/*
 * @jest-environment jsdom
 */
// Same stubs as llmScorerJudges.test.ts: Pyodide can't load under CRA's Jest,
// and the real store imports ModelSettingSchemas mid-cycle.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));

// eslint-disable-next-line import/first
import { beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { call_llm, extract_responses, set_api_keys } from "../utils";
// eslint-disable-next-line import/first
import { LLMProvider, isDecisionModel, openRouterEmoji } from "../models";
// eslint-disable-next-line import/first
import { evalWithLLM } from "../backend";
// eslint-disable-next-line import/first
import StorageCache, { StringLookup } from "../cache";
// eslint-disable-next-line import/first
import { Dict, LLMResponse, LLMSpec } from "../typing";
// eslint-disable-next-line import/first
import {
  decisionQuestion,
  formatInstruction,
  scoreSpecFrom,
} from "../scorerFormat";

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";
const JEV = "openrouter/~typesafe/jev-latest";

type Call = { url: string; body: Dict };
let calls: Call[] = [];

/**
 * Replaces fetch with a fake OpenRouter: the decisions endpoint answers with
 * `decide(body)`, and chat completions with `chat(body)`.
 */
const mockOpenRouter = (
  decide: (body: Dict) => Dict,
  chat: (body: Dict) => string = () => "?",
) => {
  calls = [];
  (globalThis as any).fetch = jest.fn(
    async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push({ url, body });
      const payload =
        url === DECISIONS_URL
          ? {
              model: "typesafe/jev-1.13-20260917",
              answers: { score: decide(body) },
              usage: { input_tokens: 120, output_tokens: 30, cost: 5e-6 },
            }
          : {
              choices: [
                {
                  message: { role: "assistant", content: chat(body) },
                  finish_reason: "stop",
                },
              ],
            };
      return { ok: true, status: 200, json: async () => payload };
    },
  );
};

const judge = (name: string, model: string): LLMSpec => ({
  key: `key-${name}`,
  name,
  emoji: "🔀",
  model,
  base_model: "openrouter",
  temp: 0,
  settings: {},
});

beforeAll(() => {
  set_api_keys({ OpenRouter: "sk-or-test" });
});

describe("recognizing Jev", () => {
  test("TypeSafe's models on OpenRouter are decision models", () => {
    expect(isDecisionModel(JEV)).toBe(true);
    expect(isDecisionModel("openrouter/typesafe/jev-1.13")).toBe(true);
    expect(isDecisionModel("openrouter/anthropic/claude-sonnet-5")).toBe(false);
    expect(isDecisionModel("typesafe/jev-1.13")).toBe(false); // not through OpenRouter
    expect(openRouterEmoji(JEV)).toBe("⚖️");
  });
});

describe("asking Jev a question", () => {
  test("sends the text as state to the decisions endpoint, and reads each answer type", async () => {
    const answers: Dict[] = [
      { type: "noul", noul: 0.93 },
      { type: "noul", noul: 0.2 },
      {
        type: "choice",
        choice: "billing",
        probabilities: { billing: 0.84, technical: 0.16 },
      },
      { type: "score", score: 1.3, confidence: 0.54 },
    ];
    let i = 0;
    mockOpenRouter(() => answers[i++]);
    const question = {
      type: "noul",
      instructions: "Is this a refund request?",
    };
    const [query, replies] = await call_llm(
      JEV,
      LLMProvider.OpenRouter,
      "I was charged twice.",
      4,
      1.0,
      { decision_question: question },
    );
    expect(calls[0].url).toBe(DECISIONS_URL);
    expect(calls[0].body).toEqual({
      model: "~typesafe/jev-latest",
      state: { response: "I was charged twice." },
      questions: { score: question },
    });
    expect(query.questions.score).toEqual(question);
    // Yes/no at 0.5, the chosen category, and the scale position numbered
    // from 1, each with how likely Jev thinks it's right (where that's one number)
    expect(
      extract_responses(replies, JEV, LLMProvider.OpenRouter).map((r) =>
        JSON.parse(r as string),
      ),
    ).toEqual([
      { answer: "true", p: 0.93 },
      { answer: "false", p: 0.8 },
      { answer: "billing", p: 0.84 },
      { answer: "2.3" },
    ]);
  });

  test("asked about an image, it says it reads text only, and sends nothing", async () => {
    mockOpenRouter(() => ({ type: "noul", noul: 0.9 }));
    await expect(
      call_llm(
        JEV,
        LLMProvider.OpenRouter,
        "",
        1,
        1.0,
        { decision_question: { type: "noul", instructions: "A cat?" } },
        undefined,
        ["media-uid-1"],
      ),
    ).rejects.toThrow(/reads text only/);
    expect(calls).toHaveLength(0);
  });

  test("used outside an LLM Scorer, it says it can't write text", async () => {
    mockOpenRouter(() => ({}));
    await expect(
      call_llm(JEV, LLMProvider.OpenRouter, "Write a poem.", 1, 1.0, {}),
    ).rejects.toThrow(/makes decisions rather than writing text/);
    expect(calls).toHaveLength(0);
  });
});

describe("building Jev's question from a scorer", () => {
  test("maps each format to a question type", () => {
    expect(decisionQuestion({ format: "bin" }, "Is it polite?", "Jev")).toEqual(
      { type: "noul", instructions: "Is it polite?" },
    );
    expect(
      decisionQuestion(
        scoreSpecFrom("cat", "billing: charges\ntechnical"),
        "Which team?",
        "Jev",
      ),
    ).toEqual({
      type: "choice",
      instructions: "Which team?",
      criteria: { billing: "charges", technical: "" },
    });
    expect(
      decisionQuestion(
        scoreSpecFrom("num", undefined, "Rude\nNeutral\nWarm"),
        "How warm?",
        "Jev",
      ),
    ).toEqual({
      type: "score",
      instructions: "How warm?",
      criteria: ["Rude", "Neutral", "Warm"],
    });
  });

  test("explains what's missing when a format can't be asked", () => {
    expect(() => decisionQuestion({ format: "open" }, "Why?", "Jev")).toThrow(
      /open-ended/,
    );
    expect(() => decisionQuestion({ format: "cat" }, "Which?", "Jev")).toThrow(
      /at least two/,
    );
    expect(() => decisionQuestion({ format: "num" }, "How?", "Jev")).toThrow(
      /2 to 10 levels/,
    );
    expect(() => decisionQuestion({ format: "bin" }, "  ", "Jev")).toThrow(
      /rubric/,
    );
  });
});

describe("Jev as a judge beside an LLM", () => {
  const TICKETS = [
    "I was charged twice for order A-104.",
    "The app crashes when I upload a photo.",
  ];
  const SPEC = scoreSpecFrom("cat", "billing: charges\ntechnical: bugs");
  const RUBRIC = "Which team should handle this ticket?";

  beforeEach(() => {
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

  test("Jev gets the response and a typed question; the LLM gets the full prompt", async () => {
    mockOpenRouter(
      (body) => {
        const choice = body.state.response.includes("charged")
          ? "billing"
          : "technical";
        return {
          type: "choice",
          choice,
          probabilities: {
            billing: choice === "billing" ? 0.9 : 0.3,
            technical: choice === "billing" ? 0.1 : 0.7,
          },
        };
      },
      (body) =>
        body.messages.at(-1).content.includes("charged")
          ? "Billing"
          : "billing",
    );

    const { responses, errors, judge_stats } = await evalWithLLM(
      "llmeval-jev",
      [
        judge("Jev", JEV),
        judge("Sonnet", "openrouter/anthropic/claude-sonnet-5"),
      ],
      `You are evaluating text that will be pasted below. ${RUBRIC}\n\`\`\`\n{__input}\n\`\`\`\n\n${formatInstruction(SPEC, false)}`,
      ["prompt-1"],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      SPEC,
      RUBRIC,
    );

    expect(errors).toEqual([]);
    expect(responses?.[0].eval_res).toEqual({
      items: [
        { Jev: "billing", Sonnet: "billing" },
        { Jev: "technical", Sonnet: "billing" },
      ],
      // Only Jev states probabilities
      probs: [{ Jev: 0.9 }, { Jev: 0.7 }],
      dtype: "KeyValue_Categorical",
    });
    // Jev's replies report their cost; the mocked chat replies don't
    const jev = judge_stats?.find((s) => s.judge === "Jev");
    expect(jev).toMatchObject({ judge: "Jev", answers: 2, priced: 2 });
    expect(jev?.cost_usd).toBeCloseTo(1e-5);
    expect(jev?.input_tokens).toBe(240);
    expect(judge_stats?.find((s) => s.judge === "Sonnet")).toMatchObject({
      answers: 2,
      priced: 0,
    });

    const decisions = calls.filter((c) => c.url === DECISIONS_URL);
    expect(decisions.map((c) => c.body.state.response).sort()).toEqual(
      [...TICKETS].sort(),
    );
    expect(decisions[0].body.questions.score).toEqual({
      type: "choice",
      instructions: RUBRIC,
      criteria: { billing: "charges", technical: "bugs" },
    });
    // The LLM judge still got the full grader prompt, with the categories
    const chats = calls.filter((c) => c.url !== DECISIONS_URL);
    expect(chats).toHaveLength(2);
    expect(chats[0].body.messages.at(-1).content).toContain(
      "exactly one of these categories",
    );
  });

  test("editing the rubric and changing it back reuses Jev's earlier answers", async () => {
    mockOpenRouter(() => ({ type: "choice", choice: "billing" }));
    const run = (rubric: string) =>
      evalWithLLM(
        "llmeval-jev-cache",
        judge("Jev", JEV),
        "{__input}",
        ["prompt-1"],
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        SPEC,
        rubric,
      );
    await run("Which team?");
    expect(calls).toHaveLength(2);
    await run("Which team should take this?"); // a new question: asked again
    expect(calls).toHaveLength(4);
    await run("Which team?"); // back to the first: from the cache
    expect(calls).toHaveLength(4);
  });

  test("an open-ended scorer with Jev fails with a clear message, before any request", async () => {
    mockOpenRouter(() => ({}));
    await expect(
      evalWithLLM(
        "llmeval-jev-2",
        judge("Jev", JEV),
        "{__input}",
        ["prompt-1"],
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        { format: "open" },
        "Why?",
      ),
    ).rejects.toThrow(/open-ended/);
    expect(calls).toHaveLength(0);
  });
});
