/*
 * @jest-environment jsdom
 */
import { NativeLLM } from "../models";
import { expect, test } from "@jest/globals";
import {
  queryLLM,
  executejs,
  countQueries,
  ResponseInfo,
  grabResponses,
} from "../backend";
import { LLMResponse, Dict, StringOrHash, LLMSpec } from "../typing";
import StorageCache from "../cache";

test("count queries required", async () => {
  // Setup params to call
  const prompt = "What is the {timeframe} when {person} was born?";
  const vars: { [key: string]: any } = {
    timeframe: ["year", "decade", "century"],
    person: ["Howard Hughes", "Toni Morrison", "Otis Redding"],
  };

  // Double-check the queries required (not loading from cache)
  const test_count_queries = async (
    llms: Array<StringOrHash | LLMSpec>,
    n: number,
  ) => {
    const { counts, total_num_responses } = await countQueries(
      prompt,
      vars,
      llms,
      n,
    );

    Object.values(total_num_responses).forEach((v) => {
      expect(v).toBe(n * 3 * 3);
    });
    Object.keys(counts).forEach((llm) => {
      expect(Object.keys(counts[llm])).toHaveLength(3 * 3);
      Object.values(counts[llm]).forEach((num) => {
        expect(num).toBe(n);
      });
    });
  };

  // Try a number of different inputs
  await test_count_queries([NativeLLM.OpenAI_ChatGPT, NativeLLM.Claude_v1], 3);
  await test_count_queries(
    [
      {
        name: "Claude",
        key: "claude-test",
        emoji: "📚",
        model: "claude-v1",
        base_model: "claude-v1",
        temp: 0.5,
      },
    ],
    5,
  );
});

test("call three LLMs with a single prompt", async () => {
  // Setup params to call
  const prompt =
    "What is one major difference between French and English languages? Be brief.";
  const llms = [
    NativeLLM.OpenAI_ChatGPT,
    NativeLLM.Claude_v1,
    NativeLLM.PaLM2_Chat_Bison,
  ];
  const n = 1;
  const progress_listener = (progress: { [key: symbol]: any }) => {
    console.log(JSON.stringify(progress));
  };

  // Call all three LLMs with the same prompt, n=1, and listen to progress
  const { responses } = await queryLLM(
    "testid",
    llms,
    n,
    prompt,
    {},
    undefined,
    undefined,
    undefined,
    progress_listener,
  );

  // Check responses
  expect(responses).toHaveLength(3);
  responses.forEach((resp_obj: LLMResponse) => {
    expect(resp_obj.prompt).toBe(prompt);
    expect(resp_obj.responses).toHaveLength(1); // since n = 1
    expect(Object.keys(resp_obj.vars)).toHaveLength(0);
  });
}, 40000);

test("run evaluate func over responses", async () => {
  // Store dummy responses to cache, to mock the aftermath of LLM calls
  StorageCache.store("dummy_response_id.json", DUMMY_RESPONSE_CACHE);

  // Create basic Javascript code to execute
  // NOTE: Jest, for whatever reason, cannot run eval() inside tests.
  //       So, we need to give it an actual function. Unf we can't test the eval() version :(
  const code = (response: ResponseInfo) => {
    console.log("hello there!");
    return response.text.length;
  };

  const input_resps = (await grabResponses([
    "dummy_response_id",
  ])) as LLMResponse[];

  //   const code = `
  // function evaluate(response) {
  //   console.log('hello there!');
  //   return response.text.length;
  // }
  // `;

  // Execute the code, and map the evaluate function over all responses
  const { responses, logs, error } = await executejs(
    "evalid",
    code,
    input_resps,
    "response",
    "evaluator",
  );

  // There should be no errors
  if (error) console.log(error);
  expect(error).toBeUndefined();

  // Check length of responses
  expect(responses).toHaveLength(DUMMY_RESPONSE_CACHE.length);

  // Expect all scores (evaluation results) to be present
  responses?.forEach((r) => {
    expect(r.eval_res?.items?.length).toBe(1);
  });

  // Expect there to be 5 logs from the hijacked console.warn, with the same value:
  expect(logs).toEqual(new Array(5).fill("hello there!"));
});

// Example output from a prompt node, stored in StorageCache
const DUMMY_RESPONSE_CACHE = [
  {
    vars: {
      tool: "chainsaw",
      text: "The first chainsaw was patented in 1926 by Andreas Stihl, a German mechanical engineer and the founder of the company Stihl. However, the chainsaw as we know it today has gone through multiple modifications and improvements over the years by various inventors and companies.",
    },
    metavars: {
      LLM_0: "GPT3.5",
    },
    llm: "GPT3.5",
    prompt:
      'Return only a comma-separated list of named entities that appear in the following text: "The first chainsaw was patented in 1926 by Andreas Stihl, a German mechanical engineer and the founder of the company Stihl. However, the chainsaw as we know it today has gone through multiple modifications and improvements over the years by various inventors and companies."',
    responses: ["Andreas Stihl, Stihl"],
    tokens: {
      completion_tokens: 9,
      prompt_tokens: 93,
      total_tokens: 102,
    },
  },
  {
    vars: {
      tool: "chainsaw",
      text: "The chainsaw was invented by two different people: \n1. The first electric chainsaw was invented by Andreas Stihl in 1926.\n2. The first chainsaw with a gasoline engine was invented by a Canadian logger named James Shand in the 1920s.",
    },
    metavars: {
      LLM_0: "GPT3.5",
    },
    llm: "GPT3.5",
    prompt:
      'Return only a comma-separated list of named entities that appear in the following text: "The chainsaw was invented by two different people: \n1. The first electric chainsaw was invented by Andreas Stihl in 1926.\n2. The first chainsaw with a gasoline engine was invented by a Canadian logger named James Shand in the 1920s."',
    responses: ["Andreas Stihl, James Shand."],
    tokens: {
      completion_tokens: 10,
      prompt_tokens: 93,
      total_tokens: 103,
    },
  },
  {
    vars: {
      tool: "chainsaw",
      text: "The first chainsaw was invented in the late 18th century by two Scottish doctors, John Aitken and James Jeffray. However, it was not until the early 1900s that the chainsaw became a widely used tool. The first gasoline-powered chainsaw was invented in 1929 by Andreas Stihl.",
    },
    metavars: {
      LLM_0: "GPT3.5",
    },
    llm: "GPT3.5",
    prompt:
      'Return only a comma-separated list of named entities that appear in the following text: "The first chainsaw was invented in the late 18th century by two Scottish doctors, John Aitken and James Jeffray. However, it was not until the early 1900s that the chainsaw became a widely used tool. The first gasoline-powered chainsaw was invented in 1929 by Andreas Stihl."',
    responses: [
      "Scottish, John Aitken, James Jeffray, early 1900s, gasoline-powered, Andreas Stihl.",
    ],
    tokens: {
      completion_tokens: 26,
      prompt_tokens: 103,
      total_tokens: 129,
    },
  },
  {
    vars: {
      tool: "lightbulb",
      text: "Thomas Edison is credited with inventing the first commercially successful incandescent light bulb in 1879.",
    },
    metavars: {
      LLM_0: "GPT3.5",
    },
    llm: "GPT3.5",
    prompt:
      'Return only a comma-separated list of named entities that appear in the following text: "Thomas Edison is credited with inventing the first commercially successful incandescent light bulb in 1879."',
    responses: ["Thomas Edison"],
    tokens: {
      completion_tokens: 2,
      prompt_tokens: 57,
      total_tokens: 59,
    },
  },
  {
    vars: {
      tool: "lightbulb",
      text: "Thomas Edison is credited with inventing the first commercially practical incandescent light bulb in 1879.",
    },
    metavars: {
      LLM_0: "GPT3.5",
    },
    llm: "GPT3.5",
    prompt:
      'Return only a comma-separated list of named entities that appear in the following text: "Thomas Edison is credited with inventing the first commercially practical incandescent light bulb in 1879."',
    responses: ["Thomas Edison"],
    tokens: {
      completion_tokens: 2,
      prompt_tokens: 57,
      total_tokens: 59,
    },
  },
];
