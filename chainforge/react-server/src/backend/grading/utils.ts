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

export enum EvalFunctionResult {
  PASS = "pass",
  FAIL = "fail",
  SKIP = "skip",
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

export interface EvalFunctionReport {
  evalFunction: EvalFunction;
  true_pass: number;
  true_fail: number;
  false_pass: number;
  false_fail: number;
  skipped: number;
}

export interface EvalFunctionSetReport {
  failureCoverage: number;
  missedFailures: Example[];
  selectedEvalFunctions: EvalFunction[];
  allEvalFunctionReports: Map<EvalCriteria, EvalFunctionReport[]>; // Map from criteria to function reports
}

class EvalExecutionError extends Error {
  constructor(message: string) {
    super(message); // Call the parent constructor with the message
    this.name = "EvalExecutionError"; // Set the error name to the class name
    Object.setPrototypeOf(this, EvalExecutionError.prototype);
  }
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

  await streamer.generate(detailedPrompt, "gpt-35-turbo", "criteria");

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
): Promise<EvalFunctionResult> {
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
    return EvalFunctionResult.PASS;
  } else if (response.choices[0].message.content.toLowerCase().includes("no")) {
    return EvalFunctionResult.FAIL;
  } else {
    // throw new EvalExecutionError(
    //   `Error executing function ${evalFunction.name}: could not parse ${response.choices[0].message.content}`,
    // );
    return EvalFunctionResult.SKIP;
  }
}

export async function executeFunction(
  evalFunction: EvalFunction,
  example: Example,
): Promise<EvalFunctionResult> {
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

    const result = await pyodideInstance.runPythonAsync(pythonCode);
    return result ? EvalFunctionResult.PASS : EvalFunctionResult.FAIL;
  } catch (error) {
    // Raise error
    // throw new EvalExecutionError(
    //   `Error executing function ${evalFunction.name}: ${error}`,
    // );
    return EvalFunctionResult.SKIP;
  }
}

export async function generateFunctionsForCriteria(
  criteria: EvalCriteria,
  promptTemplate: string,
  example: Example,
  emitter: EventEmitter,
): Promise<void> {
  const functionGenPrompt = buildFunctionGenPrompt(
    criteria,
    promptTemplate,
    example,
  );

  try {
    const streamer = new AzureOpenAIStreamer();

    streamer.on("function", (functionDefinition: string) => {
      processAndEmitFunction(criteria, functionDefinition, emitter);
    });

    const modelType =
      criteria.eval_method === "expert" ? "llm_eval" : "python_fn";
    await streamer.generate(functionGenPrompt, "gpt-35-turbo", modelType);
  } catch (error) {
    console.error("Error generating function for criteria:", error);
    throw new Error(
      `Failed to generate function for criteria: ${criteria.criteria}`,
    );
  }
}

function buildFunctionGenPrompt(
  criteria: EvalCriteria,
  promptTemplate: string,
  example: Example,
): string {
  if (criteria.eval_method === "expert") {
    return `Given a prompt template for an LLM pipeline, your task is to devise a prompt for an expert to evaluate the pipeline's responses based on the following criteria: ${criteria.criteria}
  
  Each prompt you generate should be a short question that an expert can answer with a "yes" or "no" to evaluate the LLM response based on the criteria. Be creative in your prompts. Try different variations/wordings in the question. Return your answers in a JSON list of strings within \`\`\`json \`\`\` markers. Each string should be a question for the expert to answer, and each question should be contained on its own line.
  `;
  } else {
    return `Given a prompt template for an LLM pipeline, your task is to devise multiple Python functions to evaluate LLM responses based on specific criteria. Create as many implementations as possible.
  
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
}

function processAndEmitFunction(
  criteria: EvalCriteria,
  functionDefinition: string,
  emitter: EventEmitter,
): void {
  let evalFunction: EvalFunction = {
    evalCriteria: criteria,
    code: functionDefinition,
    name: functionDefinition,
  };

  if (criteria.eval_method === "code") {
    const functionNameMatch = functionDefinition.match(
      /def\s+([a-zA-Z_]\w*)\s*\(/,
    );
    if (functionNameMatch) {
      evalFunction.name = functionNameMatch[1];
    } else {
      console.error(
        "Could not extract the function name from the provided code.",
      );
      return; // Skip emitting if no function name could be extracted
    }
  }

  emitter.emit("functionGenerated", evalFunction);
}
