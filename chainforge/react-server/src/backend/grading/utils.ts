// Interfaces and utility functions
// TODO: Use ChainForge's openai utils (I tried but got errors)
import { AzureOpenAIStreamer } from "./oai_utils";
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const { loadPyodide } = require("pyodide");
import path from "path";
import { EventEmitter } from "events";

// Define a global variable to store the Pyodide instance without an explicit type
let pyodideInstance: any = null;

export interface EvalCriteria {
  criteria: string;
  eval_method: "code" | "expert";
  source?: string;
}

export type ExampleId = string;

export interface Example {
  id: ExampleId;
  variables: string; // Useful for converting to Python format
  prompt: string;
  response: string;
}

export interface EvalFunction {
  evalCriteria: EvalCriteria;
  code: string;
  name: string;
}

export async function generateLLMEvaluationCriteria(
  prompt: string,
): Promise<EvalCriteria[]> {
  // Construct the detailed prompt for the LLM
  const detailedPrompt = `Here is my LLM prompt template:
  
  \`${prompt}\`
    
    Based on the content in the prompt, I want to write assertions for my LLM pipeline to run on all pipeline responses. Give me a list of criteria to check for in LLM responses. Each item in the list should contain a string description of a criteria to check for, and whether it should be evaluated with code or by an expert if the criteria is difficult to evaluate. Your answer should be a JSON list of objects within \`\`\`json \`\`\` markers, where each object has the following fields: "criteria" and "eval_method" (code or expert). The criteria should be short, and this list should contain as many evaluation criteria as you can think of. Each evaluation criteria should test a unit concept.`;

  // Usage example

  let data: EvalCriteria[] = [];
  const streamer = new AzureOpenAIStreamer();
  streamer.on("evalCriteria", (evalCriteria) => {
    console.log(evalCriteria);
    data.push(evalCriteria);
  });

  await streamer.genCriteria(detailedPrompt, "gpt-35-turbo");

  // Assuming the response is a JSON string that we need to parse into an object
  try {
    return data;
  } catch (error) {
    console.error("Error parsing GPT response:", error);
    throw new Error("Failed to parse GPT response into evaluation criteria.");
  }
}

export async function executeLLMEval(
  evalFunction: EvalFunction,
  example: Example,
): Promise<boolean> {
  // Construct call to an LLM to evaluate the example

  const client = new OpenAIClient(
    process.env.AZURE_OPENAI_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_OPENAI_KEY),
  );

  const evalPrompt = `You are an expert evaluator. Given the following example variables, prompt, and response:
- Variables: ${example.variables}
- Prompt: ${example.prompt}
- Response: ${example.response}

${evalFunction.code}? Return "yes" or "no".`;

  const messages = [
    {
      content: "You are an expert evaluator.",
      role: "system",
    },
    { role: "user", content: evalPrompt },
  ];

  const response = await client.getChatCompletions("gpt-35-turbo", messages);

  // Parse the response to determine the boolean value to return
  if (response.choices[0].message.content.toLowerCase().includes("yes")) {
    return true;
  } else if (response.choices[0].message.content.toLowerCase().includes("no")) {
    return false;
  } else {
    console.error(
      `Unexpected response from LLM: ${response.choices[0].message.content}`,
    );
    return false;
  }
}

export async function executeFunction(
  evalFunction: EvalFunction,
  example: Example,
): Promise<boolean> {
  // Load Pyodide only if it hasn't been loaded before
  if (!pyodideInstance) {
    const pyodidePath = path.join(__dirname, "pyodide");
    pyodideInstance = await loadPyodide({
      indexURL: pyodidePath,
    });
  }

  /// Use the pyodideInstance to run Python code
  try {
    const pythonCode = `
import json

${evalFunction.code}

# Execute the evaluation function with the example's prompt and response
result = ${evalFunction.name}(${example.variables}, '${example.prompt}', '${example.response}')

result`;

    // This example simply runs "1+1" to demonstrate usage
    const result = await pyodideInstance.runPythonAsync(pythonCode);
    // Determine the boolean value to return based on your actual use case
    return result;
  } catch (error) {
    console.error(
      `Error executing Python function ${evalFunction.name} with Pyodide`,
    );
    return false;
  }
}

export async function generateFunctionsForCriteria(
  criteria: EvalCriteria,
  promptTemplate: string,
  example: Example,
  emitter: EventEmitter,
): Promise<void> {
  // Separate prompt for expert eval_method
  let functionGenPrompt = "";

  if (criteria.eval_method === "expert") {
    functionGenPrompt = `Given a prompt template for an LLM pipeline, your task is to devise a prompt for an expert to to evaluate the pipeline's responses based on the following criteria. Write as many prompts as possible.

    Prompt Template:
    "${promptTemplate}"
    
    Example inputs and outputs of the LLM pipeline:
    - Prompt: ${example.prompt}
    - LLM Response: ${example.response}
    
    Evaluation Criteria:
    - ${criteria.criteria}

    Each answer should be a question that an expert can answer with a "yes" or "no" to evaluate the LLM response based on the criteria. Be creative in your prompts. Try different variations/wordings in the question. Return your answers in a JSON list of strings within \`\`\`json \`\`\` markers. Each string should be a question for the expert to answer, and each question should be contained on its own line.
    `;
  } else {
    functionGenPrompt = `Given a prompt template for an LLM pipeline, your task is to devise multiple Python functions to evaluate LLM responses based on specific criteria. Create as many implementations as possible.

    Prompt Template:
    "${promptTemplate}"
    
    Example inputs and outputs of the LLM pipeline:
    - Prompt: ${example.prompt}
    - LLM Response: ${example.response}
    
    Evaluation Criteria:
    - ${criteria.criteria}
    
    Function Requirements:
    - Develop multiple (at least 3) to assess the concept outlined in the criteria.
    - Each function must accept three arguments:
      1. \`variables\`: A string representation of the variables for this LLM call.
      2. \`prompt\`: A string representing the input prompt based on the variables.
      3. \`response\`: The LLM response as a string.
    - The function should return a boolean value indicating whether the LLM response meets the set criteria.
    - Base the implementations on standard coding practices and common Python libraries.
    
    Be creative in your implementations. Our goal is to explore diverse approaches to evaluate LLM responses effectively. Feel free to use external libraries for code-based evaluation methods, but all imports (e.g., import re, import nltk) should be done within the function definitions. Include the full implementation of each function.
    `;
  }

  try {
    // let data: EvalFunction[] = [];
    const streamer = new AzureOpenAIStreamer();

    streamer.on("function", (functionDefinition) => {
      console.log(functionDefinition);
      // Log a delimiter to separate functions
      console.log("--------------------------------------------------");

      // If the criteria is expert-based, we don't need to extract the function name
      if (criteria.eval_method === "expert") {
        const evalFunction = {
          evalCriteria: criteria,
          code: functionDefinition,
          name: functionDefinition,
        };
        emitter.emit("functionGenerated", evalFunction);
      } else {
        // Extract the function name from the function definition
        const functionNameMatch = functionDefinition.match(
          /def\s+([a-zA-Z_]\w*)\s*\(/,
        );
        if (functionNameMatch) {
          const functionName = functionNameMatch[1];

          const evalFunction = {
            evalCriteria: criteria,
            code: functionDefinition,
            name: functionName,
          };

          // Emit the function
          emitter.emit("functionGenerated", evalFunction);
        } else {
          console.error(
            "Could not extract the function name from the provided code.",
          );
        }
      }
    });

    if (criteria.eval_method === "expert") {
      await streamer.genLLMEvalPrompts(functionGenPrompt, "gpt-35-turbo");
    } else {
      await streamer.genFunctions(functionGenPrompt, "gpt-35-turbo");
    }

    // return data;
  } catch (error) {
    console.error("Error generating function for criteria:", error);
    throw new Error(
      `Failed to generate function for criteria: ${criteria.criteria}`,
    );
  }
}
