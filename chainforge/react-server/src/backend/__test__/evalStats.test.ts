/*
 * @jest-environment jsdom
 */
// Same stubs as backend.test.ts, for modules utils.ts pulls in.
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
import { expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  buildEvalStatsRows,
  EvalStatsFactor,
  toStatsScore,
} from "../evalStats";
// eslint-disable-next-line import/first
import { LLMResponse } from "../typing";

const response = (
  llm: string,
  vars: Record<string, string>,
  scores: (boolean | number | string)[],
  metavars: Record<string, string> = {},
): LLMResponse =>
  ({
    uid: `${llm}-${JSON.stringify(vars)}`,
    prompt: "",
    vars,
    metavars,
    llm: { name: llm, model: llm, base_model: llm, temp: 1 },
    responses: scores.map(() => "response"),
    eval_res: { items: scores, dtype: "Numeric" },
  }) as unknown as LLMResponse;

const byLLM: EvalStatsFactor = {
  key: "LLM",
  valueOf: (r) => (r.llm as { name: string }).name,
};
const byVar = (name: string): EvalStatsFactor => ({
  key: name,
  valueOf: (r) => String(r.vars[name]),
});
const scoresOf = (r: LLMResponse) =>
  (r.eval_res?.items ?? []).map(toStatsScore);

test("scores become numbers, and anything else counts as missing", () => {
  expect([true, false, 0.5, "yes", NaN, undefined].map(toStatsScore)).toEqual([
    1,
    0,
    0.5,
    null,
    null,
    null,
  ]);
});

test("pairs results for the same inputs across LLMs, one row per run", () => {
  const resps = [
    response("gpt", { q: "one" }, [true, false]),
    response("claude", { q: "one" }, [true, true]),
    response("gpt", { q: "two" }, [false, "error"]),
    response("claude", { q: "two" }, [true, false]),
  ];
  const { rows, itemLabels } = buildEvalStatsRows(resps, [byLLM], scoresOf);

  expect(rows).toEqual([
    { group: "gpt", item: "item0", run: 0, score: 1 },
    { group: "gpt", item: "item0", run: 1, score: 0 },
    { group: "claude", item: "item0", run: 0, score: 1 },
    { group: "claude", item: "item0", run: 1, score: 1 },
    { group: "gpt", item: "item1", run: 0, score: 0 },
    { group: "gpt", item: "item1", run: 1, score: null },
    { group: "claude", item: "item1", run: 0, score: 1 },
    { group: "claude", item: "item1", run: 1, score: 0 },
  ]);
  expect(itemLabels).toEqual({ item0: "q: one", item1: "q: two" });
});

test("comparing a variable pairs within each LLM", () => {
  const resps = [
    response("gpt", { q: "one", style: "terse" }, [1]),
    response("gpt", { q: "one", style: "chatty" }, [2]),
    response("claude", { q: "one", style: "terse" }, [3]),
    response("claude", { q: "one", style: "chatty" }, [4]),
  ];
  const { rows } = buildEvalStatsRows(resps, [byVar("style")], scoresOf);
  const itemOf = (score: number) => rows.find((r) => r.score === score)?.item;
  expect(itemOf(1)).toBe(itemOf(2));
  expect(itemOf(3)).toBe(itemOf(4));
  expect(itemOf(1)).not.toBe(itemOf(3));
});

test("leaves out inputs that only describe one group, like an upstream response", () => {
  // A scorer prompt run on two upstream LLMs' answers: the answer text and
  // the upstream LLM's metavar differ with the upstream LLM being compared.
  const resps = ["one", "two"].flatMap((q) =>
    ["gpt", "claude"].map((upstream) =>
      response(
        "judge",
        { q, answer: `${upstream}'s answer to ${q}` },
        [upstream === "gpt"],
        { LLM_0: upstream },
      ),
    ),
  );
  const byUpstream: EvalStatsFactor = {
    key: "__meta_LLM_0",
    valueOf: (r) => String(r.metavars.LLM_0),
  };
  const { rows, itemLabels } = buildEvalStatsRows(
    resps,
    [byUpstream],
    scoresOf,
  );
  expect(rows.map((r) => [r.group, r.item])).toEqual([
    ["gpt", "item0"],
    ["claude", "item0"],
    ["gpt", "item1"],
    ["claude", "item1"],
  ]);
  expect(itemLabels.item0).toBe("q: one");
});

test("with two groupings, leaves out inputs that describe either one", () => {
  // A chat turn continues with the same LLM, so the earlier turn's LLM
  // metavar follows the LLM being compared, whatever the complaint.
  const resps = ["one", "two"].flatMap((question) =>
    ["gpt", "claude"].flatMap((llm) =>
      ["wrong", "incorrect"].map((complaint) =>
        response(llm, { question, complaint }, [true], { LLM_0: llm }),
      ),
    ),
  );
  const { rows, itemLabels } = buildEvalStatsRows(
    resps,
    [byLLM, byVar("complaint")],
    scoresOf,
  );
  expect(new Set(rows.map((r) => r.item))).toEqual(new Set(["item0", "item1"]));
  expect(itemLabels).toEqual({
    item0: "question: one",
    item1: "question: two",
  });
});

test("a grouping with a single group doesn't hide the inputs", () => {
  const resps = ["one", "two"].flatMap((question) =>
    ["gpt", "claude"].map((llm) =>
      response(llm, { question, style: "terse" }, [1]),
    ),
  );
  const { rows } = buildEvalStatsRows(resps, [byLLM, byVar("style")], scoresOf);
  expect(new Set(rows.map((r) => r.item)).size).toBe(2);
});

test("a second factor fills group2", () => {
  const resps = [
    response("gpt", { q: "one", style: "terse" }, [1]),
    response("claude", { q: "one", style: "chatty" }, [2]),
  ];
  const { rows } = buildEvalStatsRows(resps, [byLLM, byVar("style")], scoresOf);
  expect(rows.map((r) => [r.group, r.group2])).toEqual([
    ["gpt", "terse"],
    ["claude", "chatty"],
  ]);
});
