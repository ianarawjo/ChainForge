/*
 * @jest-environment jsdom
 */

// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
// The store and ModelSettingSchemas import each other (see backend.test.ts).
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: jest.fn() }),
  },
}));

// eslint-disable-next-line import/first
import { expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { executejs } from "../backend";
// eslint-disable-next-line import/first
import { LLMResponse } from "../typing";

/** Runs evaluator code over one prompt's responses, as the Evaluator Node does. */
async function evaluate(code: string, texts: string[]) {
  // Evaluator code runs in the Code Evaluator node's hidden iframe.
  const id = `types-test-${Math.random().toString(36).slice(2)}`;
  const iframe = document.createElement("iframe");
  iframe.id = `${id}-iframe`;
  document.body.appendChild(iframe);

  const response: LLMResponse = {
    uid: "uid",
    prompt: "Q",
    vars: {},
    metavars: {},
    llm: "Model",
    responses: texts,
  };
  return await executejs(id, code, [response], "response", "evaluator");
}

test("object scores work with several responses per prompt", async () => {
  const { responses, error } = await evaluate(
    `function evaluate(r) {
      return { length: r.text.length, has_word: r.text.includes("cat") };
    }`,
    ["a cat", "a dog", "no"],
  );

  expect(error).toBeUndefined();
  expect(responses?.[0].eval_res).toEqual({
    items: [
      { length: 5, has_word: true },
      { length: 5, has_word: false },
      { length: 2, has_word: false },
    ],
    dtype: "KeyValue_Mixed",
  });
});

test.each([
  ["numbers", "Numeric", "return r.text.length;", ["ab", "abc"]],
  ["the same number", "Numeric", "return 1;", ["ab", "abc"]],
  ["booleans", "Categorical", "return r.text === 'ab';", ["ab", "abc"]],
  ["strings", "Categorical", "return r.text;", ["ab", "abc"]],
  [
    "numbers and strings",
    "Mixed",
    "return r.text === 'ab' ? 1 : 'x';",
    ["ab", "abc"],
  ],
  ["one number", "Numeric", "return 3;", ["ab"]],
  ["one object", "KeyValue_Numeric", "return { n: 1, m: 2 };", ["ab"]],
  [
    "objects of strings",
    "KeyValue_Categorical",
    "return { word: r.text };",
    ["ab", "abc"],
  ],
])("%s are scored as %s", async (_, dtype, body, texts) => {
  const { responses, error } = await evaluate(
    `function evaluate(r) { ${body} }`,
    texts,
  );
  expect(error).toBeUndefined();
  expect(responses?.[0].eval_res?.dtype).toBe(dtype);
});

test("objects with different keys are still an error", async () => {
  const { error } = await evaluate(
    `function evaluate(r) {
      return r.text === "ab" ? { a: 1 } : { b: 1 };
    }`,
    ["ab", "abc"],
  );
  expect(error).toMatch(/keys and size of dicts/);
});

test("objects with different value types are still an error", async () => {
  const { error } = await evaluate(
    `function evaluate(r) {
      return { a: r.text === "ab" ? 1 : "one" };
    }`,
    ["ab", "abc"],
  );
  expect(error).toMatch(/Types of values in dicts/);
});

test("a null score is reported as an unsupported type", async () => {
  // typeof null is "object", which used to be mistaken for a key-value score.
  const { error } = await evaluate(`function evaluate(r) { return null; }`, [
    "ab",
  ]);
  expect(error).toMatch(/Unsupported types/);
});

test("objects mixed with numbers are still an error", async () => {
  const { error } = await evaluate(
    `function evaluate(r) {
      return r.text === "ab" ? { a: 1 } : 1;
    }`,
    ["ab", "abc"],
  );
  expect(error).toMatch(/Unsupported types/);
});
