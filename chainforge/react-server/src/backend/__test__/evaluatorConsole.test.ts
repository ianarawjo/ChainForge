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

test("evaluator code can log undefined and null", async () => {
  // Evaluator code runs in the Code Evaluator node's hidden iframe.
  const iframe = document.createElement("iframe");
  iframe.id = "console-test-iframe";
  document.body.appendChild(iframe);

  const response: LLMResponse = {
    uid: "uid",
    prompt: "Q",
    vars: {},
    metavars: {},
    llm: "Model",
    responses: ["A"],
  };
  const { responses, logs, error } = await executejs(
    "console-test",
    `function evaluate(r) {
      console.log(r.meta.missing);
      console.warn(null);
      console.error(undefined, "and text");
      return 1;
    }`,
    [response],
    "response",
    "evaluator",
  );

  expect(error).toBeUndefined();
  expect(responses?.[0].eval_res?.items).toEqual([1]);
  expect(logs).toEqual([
    "undefined",
    "warn: null",
    ["error: undefined", "error: and text"],
  ]);
});
