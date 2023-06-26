/*
* @jest-environment node
*/
import { LLM } from '../models';
import { expect, test } from '@jest/globals';
import { queryLLM } from '../backend';
import { StandardizedLLMResponse } from '../typing';

test('call three LLMs with a single prompt', async () => {
  // Setup params to call
  const prompt = 'What is one major difference between French and English languages? Be brief.'
  const llms = [LLM.OpenAI_ChatGPT, LLM.Claude_v1, LLM.PaLM2_Chat_Bison];
  const n = 1;
  const progress_listener = (progress: {[key: symbol]: any}) => {
    console.log(JSON.stringify(progress));
  };

  // Call all three LLMs with the same prompt, n=1, and listen to progress
  const {responses, errors} = await queryLLM('testid', llms, n, prompt, {}, undefined, progress_listener);

  // Check responses
  expect(responses).toHaveLength(3);
  responses.forEach((resp_obj: StandardizedLLMResponse) => {
    expect(resp_obj.prompt).toBe(prompt);
    expect(resp_obj.responses).toHaveLength(1); // since n = 1
    expect(Object.keys(resp_obj.vars)).toHaveLength(0);
  });
}, 40000);