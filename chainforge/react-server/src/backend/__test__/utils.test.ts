/*
 * @jest-environment jsdom
 */
import {
  call_alephalpha,
  call_anthropic,
  call_chatgpt,
  call_google_palm,
  extract_responses,
  merge_response_objs,
} from "../utils";
import { LLMProvider, NativeLLM } from "../models";
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

// test('UNCOMMENT BELOW API CALL TESTS WHEN READY', () => {
//   // NOTE: API CALL TESTS ASSUME YOUR ENVIRONMENT VARIABLE IS SET!
// });

test("openai chat completions", async () => {
  // Call ChatGPT with a basic question, and n=2
  const [query, response] = await call_chatgpt(
    "Who invented modern playing cards? Keep your answer brief.",
    NativeLLM.OpenAI_ChatGPT,
    2,
    1.0,
  );
  console.log(response.choices[0].message);
  expect(response.choices).toHaveLength(2);
  expect(query).toHaveProperty("temperature");

  // Extract responses, check their type
  const resps = extract_responses(
    response,
    NativeLLM.OpenAI_ChatGPT,
    LLMProvider.OpenAI,
  );
  expect(resps).toHaveLength(2);
  expect(typeof resps[0]).toBe("string");
}, 20000);

test("openai text completions", async () => {
  // Call OpenAI template with a basic question, and n=2
  const [query, response] = await call_chatgpt(
    "Who invented modern playing cards? The answer is ",
    NativeLLM.OpenAI_Davinci003,
    2,
    1.0,
  );
  console.log(response.choices[0].text);
  expect(response.choices).toHaveLength(2);
  expect(query).toHaveProperty("n");

  // Extract responses, check their type
  const resps = extract_responses(
    response,
    NativeLLM.OpenAI_Davinci003,
    LLMProvider.OpenAI,
  );
  expect(resps).toHaveLength(2);
  expect(typeof resps[0]).toBe("string");
}, 20000);

test("anthropic models", async () => {
  // Call Anthropic's Claude with a basic question
  const [query, response] = await call_anthropic(
    "Who invented modern playing cards?",
    NativeLLM.Claude_v1,
    1,
    1.0,
  );
  console.log(response);
  expect(response).toHaveLength(1);
  expect(query).toHaveProperty("max_tokens_to_sample");

  // Extract responses, check their type
  const resps = extract_responses(
    response,
    NativeLLM.Claude_v1,
    LLMProvider.Anthropic,
  );
  expect(resps).toHaveLength(1);
  expect(typeof resps[0]).toBe("string");
}, 20000);

test("google palm2 models", async () => {
  // Call Google's PaLM Chat API with a basic question
  let [query, response] = await call_google_palm(
    "Who invented modern playing cards?",
    NativeLLM.PaLM2_Chat_Bison,
    3,
    0.7,
  );
  expect(response.candidates).toHaveLength(3);
  expect(query).toHaveProperty("candidateCount");

  // Extract responses, check their type
  let resps = extract_responses(
    response,
    NativeLLM.PaLM2_Chat_Bison,
    LLMProvider.Google,
  );
  expect(resps).toHaveLength(3);
  expect(typeof resps[0]).toBe("string");
  console.log(JSON.stringify(resps));

  // Call Google's PaLM Text Completions API with a basic question
  [query, response] = await call_google_palm(
    "Who invented modern playing cards? The answer ",
    NativeLLM.PaLM2_Text_Bison,
    3,
    0.7,
  );
  expect(response.candidates).toHaveLength(3);
  expect(query).toHaveProperty("maxOutputTokens");

  // Extract responses, check their type
  resps = extract_responses(
    response,
    NativeLLM.PaLM2_Chat_Bison,
    LLMProvider.Google,
  );
  expect(resps).toHaveLength(3);
  expect(typeof resps[0]).toBe("string");
  console.log(JSON.stringify(resps));
}, 40000);

test("aleph alpha model", async () => {
  let [query, response] = await call_alephalpha(
    "Who invented modern playing cards?",
    NativeLLM.Aleph_Alpha_Luminous_Base,
    3,
    0.7,
  );
  expect(response).toHaveLength(3);

  // Extract responses, check their type
  let resps = extract_responses(
    response,
    NativeLLM.Aleph_Alpha_Luminous_Base,
    LLMProvider.Aleph_Alpha,
  );
  expect(resps).toHaveLength(3);
  expect(typeof resps[0]).toBe("string");
  console.log(JSON.stringify(resps));

  // Call Google's PaLM Text Completions API with a basic question
  // eslint-disable-next-line
  [query, response] = await call_alephalpha(
    "Who invented modern playing cards? The answer ",
    NativeLLM.Aleph_Alpha_Luminous_Base,
    3,
    0.7,
  );
  expect(response).toHaveLength(3);

  // Extract responses, check their type
  resps = extract_responses(
    response,
    NativeLLM.Aleph_Alpha_Luminous_Base,
    LLMProvider.Aleph_Alpha,
  );
  expect(resps).toHaveLength(3);
  expect(typeof resps[0]).toBe("string");
  console.log(JSON.stringify(resps));
}, 40000);
