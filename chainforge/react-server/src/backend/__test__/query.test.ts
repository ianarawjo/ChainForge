/*
 * @jest-environment node
 */
import { PromptPipeline } from "../query";
import { LLM, LLMProvider, NativeLLM } from "../models";
import { expect, test } from "@jest/globals";
import { LLMResponseError, RawLLMResponseObject } from "../typing";

async function prompt_model(model: LLM, provider: LLMProvider): Promise<void> {
  const pipeline = new PromptPipeline(
    "What is the oldest {thing} in the world? Keep your answer brief.",
    model.toString(),
  );
  let responses: Array<RawLLMResponseObject | LLMResponseError> = [];
  for await (const response of pipeline.gen_responses(
    { thing: ["bar", "tree", "book"] },
    model,
    provider,
    1,
    1.0,
  )) {
    responses.push(response);
  }
  expect(responses).toHaveLength(3);

  // Double-check the cache'd results
  let cache = pipeline._load_cached_responses();
  Object.entries(cache).forEach(([prompt, response]) => {
    const r = Array.isArray(response) ? response[0] : response;
    console.log(`Prompt: ${prompt}\nResponse: ${r.responses[0]}`);
  });
  expect(Object.keys(cache)).toHaveLength(3); // expect 3 prompts

  // Now query ChatGPT again, but set n=2 to force it to send off 1 query per prompt.
  responses = [];
  for await (const response of pipeline.gen_responses(
    { thing: ["bar", "tree", "book"] },
    model,
    provider,
    2,
    1.0,
  )) {
    responses.push(response);
  }
  expect(responses).toHaveLength(3); // still 3
  responses.forEach((resp_obj) => {
    if (resp_obj instanceof LLMResponseError) return;
    expect(resp_obj.responses).toHaveLength(2); // each response object should have 2 candidates, as n=2
  });

  // Double-check the cache'd results
  cache = pipeline._load_cached_responses();
  Object.entries(cache).forEach(([prompt, response]) => {
    const resp_obj = Array.isArray(response) ? response[0] : response;
    console.log(
      `Prompt: ${prompt}\nResponses: ${JSON.stringify(resp_obj.responses)}`,
    );
    expect(resp_obj.responses).toHaveLength(2);
  });
  expect(Object.keys(cache)).toHaveLength(3); // still expect 3 prompts

  // Now send off the exact same query. It should use only the cache'd results:
  responses = [];
  for await (const response of pipeline.gen_responses(
    { thing: ["bar", "tree", "book"] },
    model,
    provider,
    2,
    1.0,
  )) {
    responses.push(response);
  }
  expect(responses).toHaveLength(3); // still 3
  responses.forEach((resp_obj) => {
    if (resp_obj instanceof LLMResponseError) return;
    expect(resp_obj.responses).toHaveLength(2); // each response object should have 2 candidates, as n=2
  });

  cache = pipeline._load_cached_responses();
  // eslint-disable-next-line
  Object.entries(cache).forEach(([prompt, response]) => {
    const resp_obj = Array.isArray(response) ? response[0] : response;
    expect(resp_obj.responses).toHaveLength(2);
  });
  expect(Object.keys(cache)).toHaveLength(3); // still expect 3 prompts
}

test("basic prompt pipeline with chatgpt", async () => {
  // Setup a simple pipeline with a prompt template, 1 variable and 3 input values
  await prompt_model(NativeLLM.OpenAI_ChatGPT, LLMProvider.OpenAI);
}, 20000);

test("basic prompt pipeline with anthropic", async () => {
  await prompt_model(NativeLLM.Claude_v1, LLMProvider.Anthropic);
}, 40000);

test("basic prompt pipeline with google palm2", async () => {
  await prompt_model(NativeLLM.PaLM2_Chat_Bison, LLMProvider.Google);
}, 40000);
