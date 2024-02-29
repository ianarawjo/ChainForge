// Interfaces and utility functions
// TODO: Use ChainForge's openai utils (I tried but got errors)

// Import top-level utils
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
import { env as process_env } from "process";

export interface GPTResponse<T> {
  data: T;
}

export interface EvalCriteria {
  criteria: string;
  category: string;
  eval_method: "code" | "expert";
  source?: string;
}

export type ExampleId = string;

export interface Example {
  id: ExampleId;
  variables: Record<string, string>;
  prompt: string;
  response: string;
}

export interface EvalFunction {
  evalCriteria: EvalCriteria;
  code: string;
}

async function call_azure_openai(
  prompt: string,
  model: string,
): Promise<GPTResponse<string>> {
  // Create a new client and endpoint
  const client = new OpenAIClient(
    process_env.AZURE_OPENAI_ENDPOINT,
    new AzureKeyCredential(process_env.AZURE_OPENAI_KEY),
  );

  // Call the model
  const messages = [
    {
      content:
        "You are an expert Python programmer and helping me write assertions for my LLM pipeline. An LLM pipeline accepts an example and prompt template, fills the template's placeholders with the example, and generates a response.",
      role: "system",
    },
    { role: "user", content: prompt },
  ];

  const events = await client.listChatCompletions(model, messages, {});

  let response = "";

  for await (const event of events) {
    for (const choice of event.choices) {
      const delta = choice.delta?.content;
      if (delta !== undefined) {
        // console.log(delta);
        response += delta;
      }
    }
  }

  console.log("Azure OpenAI response:", response);

  return { data: response };
}

export async function generateLLMEvaluationCriteria(
  prompt: string,
): Promise<EvalCriteria[]> {
  // Construct the detailed prompt for the LLM
  const detailedPrompt = `Here is my LLM prompt template:
  
  \`${prompt}\`
    
    Based on the content in the prompt, I want to write assertions for my LLM pipeline to run on all pipeline responses. Give me a list of criteria to check for in LLM responses. Each item in the list should contain a string description of a criteria to check for, and whether it should be evaluated with code or manually by an expert if the criteria is difficult to evaluate. Your answer should be a JSON list of objects within \`\`\`json \`\`\` markers, where each object has the following fields: "criteria" and "eval_method" (code or expert). The criteria should be short, and this list should contain as many evaluation criteria as you can think of. Each evaluation criteria should test a unit concept.`;

  const response = await call_azure_openai(detailedPrompt, "gpt-4");

  // Assuming the response is a JSON string that we need to parse into an object
  try {
    let data = response.data;
    // Strip everything not in `````` markers
    const jsonStart = data.indexOf("```json");
    const jsonEnd = data.indexOf("```", jsonStart + 6);
    data = data.slice(jsonStart + 8, jsonEnd);

    // Trim whitespace
    data = data.trim();

    return JSON.parse(data);
  } catch (error) {
    console.error("Error parsing GPT response:", error);
    throw new Error("Failed to parse GPT response into evaluation criteria.");
  }
}

export async function executeFunction(
  evalFunction: EvalFunction,
  example: Example,
): Promise<boolean> {
  // Replace with call to Python backend to execute the function
  // This is a placeholder for demonstration purposes
  const response = await fetch("YOUR_API_ENDPOINT", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: evalFunction.code,
      example: example,
    }),
  });
  if (!response.ok) {
    throw new Error(`API call failed with status ${response.status}`);
  }
  return response.json();
}

export async function generateFunctionsForCriteria(
  criteria: EvalCriteria,
  promptTemplate: string,
  example: Example,
): Promise<EvalFunction[]> {
  const functionGenPrompt = `Given a prompt template and an example with its LLM response, your task is to devise multiple Python functions to evaluate LLM responses based on specific criteria. Aim to create as many implementations as possible to ensure a comprehensive evaluation that aligns with developer expectations.

  Prompt Template:
  "${promptTemplate}"
  
  Example Details:
  - Prompt: ${example.prompt}
  - LLM Response: ${example.response}
  
  Evaluation Criteria:
  - Criteria: ${criteria.criteria}
  - Evaluation Method: ${criteria.eval_method}
  
  Function Requirements:
  - Develop as many Python functions as possible (at least 5) to assess the concept outlined in the criteria.
  - Each function must accept three arguments:
    1. An example, represented as a dictionary with string keys.
    2. A string representing the prompt based on the example.
    3. The LLM response as a string.
  - The function should return a boolean value indicating whether the LLM response meets the set criteria.
  - For evaluation methods labeled 'expert', functions should incorporate the external function \`ask_llm\`, which should ask a True or False question to an expert. Try different variations/wordings in the ask_llm question. For all other methods, base the implementations on standard coding practices and Python libraries.
  
  We encourage creativity in your implementations. Our goal is to explore diverse approaches to evaluate LLM responses effectively, and we'll select the functions that best align with developer expectations.
  `;

  // TODO: figure out how to make this faster
  try {
    const response = await call_azure_openai(functionGenPrompt, "gpt-4");

    console.log("GPT-4 response:", response);

    return [];

    // const src_array = response.data;
    // return src_array.map((src: string) => {
    //   return {
    //     evalCriteria: criteria,
    //     code: src,
    //   };
    // });
  } catch (error) {
    console.error("Error generating function for criteria:", error);
    throw new Error(
      `Failed to generate function for criteria: ${criteria.criteria}`,
    );
  }
}
