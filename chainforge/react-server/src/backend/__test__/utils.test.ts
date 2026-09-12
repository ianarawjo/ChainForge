/*
 * @jest-environment jsdom
 */
import { merge_response_objs } from "../utils";
import { NativeLLM } from "../models";
import { expect, test } from "@jest/globals";
import { RawLLMResponseObject } from "../typing";

test("merge response objects", () => {
  // Merging two response objects
  const A: RawLLMResponseObject = {
    responses: ["x", "y", "z"],
    prompt: "this is a test",
    llm: NativeLLM.OpenAI_ChatGPT,
    vars: { var1: "value1", var2: "value2" },
    metavars: { meta1: "meta1" },
    uid: "A",
  };
  const B: RawLLMResponseObject = {
    responses: ["a", "b", "c"],
    prompt: "this is a test 2",
    llm: NativeLLM.OpenAI_ChatGPT,
    vars: { varB1: "valueB1", varB2: "valueB2" },
    metavars: { metaB1: "metaB1" },
    uid: "B",
  };
  const C = merge_response_objs(A, B) as RawLLMResponseObject;
  expect(C.responses).toHaveLength(6);
  expect(JSON.stringify(C.responses)).toBe(
    JSON.stringify(["x", "y", "z", "a", "b", "c"]),
  );
  expect(Object.keys(C.vars)).toHaveLength(2);
  expect(Object.keys(C.vars)).toContain("varB1");
  expect(Object.keys(C.metavars)).toHaveLength(1);
  expect(Object.keys(C.metavars)).toContain("metaB1");

  // Merging one empty object should return the non-empty object
  expect(merge_response_objs(A, undefined)).toBe(A);
  expect(merge_response_objs(undefined, B)).toBe(B);
});
