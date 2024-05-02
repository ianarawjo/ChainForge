// Interfaces and utility functions
// TODO: Use ChainForge's openai utils (I tried but got errors)
// import { AzureOpenAIStreamer } from "./oai_utils";
import { EventEmitter } from "events";
import {
  AssertionWriterSystemMsg,
  EvalCriteria,
  EvalFunction,
  EvalFunctionResult,
  validEvalCriteriaFormat,
} from "./typing";
import { Dict, StandardizedLLMResponse } from "../typing";
import { executejs, executepy, simpleQueryLLM } from "../backend";
import { getVarsAndMetavars, retryAsyncFunc } from "../utils";
import { v4 as uuid } from "uuid";
import { AzureOpenAIStreamer } from "./oai_utils";
import {
  buildContextPromptForVarsMetavars,
  buildGenEvalCodePrompt,
} from "../../AiPopover";

/**
 * Extracts substrings within "```json" and "```" ticks. Excludes the ticks from return.
 * @param mdText
 * @returns
 */
function extractJSONBlocks(mdText: string): string[] | undefined {
  const regex = /```json(.*?)```/gs;
  const matches = mdText.match(regex);
  if (matches)
    return matches.map((s) => s.replace("```json", "").replace("```", ""));

  console.error("No JSON found in output.");
  return undefined;
}

/**
 * Given the user's prompt, generates a list of criteria in JSON format.
 *
 * FUTURE: One might consider giving more contextual information, e.g. input vars to the prompt or prompt history.
 *
 * @param prompt The user's prompt (must be 'concrete'/escaped braces)
 * @returns A list of parsed `EvalCriteria`
 */
export async function generateLLMEvaluationCriteria(
  prompt: string,
  apiKeys?: Dict,
  promptTemplate?: string, // overrides prompt template used
  systemMsg?: string | null, // overrides default system message, if present. Use null to specify empty.
): Promise<EvalCriteria[]> {
  // Construct the detailed prompt for the LLM
  const detailedPrompt =
    promptTemplate ??
    `Here is my LLM prompt template:
  
  \`${prompt}\`
    
    Based on the content in the prompt, I want to write assertions for my LLM pipeline to run on all pipeline responses. Give me a list of criteria to check for in LLM responses. Each item in the list should contain a string description of a criteria to check for, and whether it should be evaluated with code or by an expert if the criteria is difficult to evaluate. Your answer should be a JSON list of objects within \`\`\`json \`\`\` markers, where each object has the following three fields: "criteria", "shortname", and "eval_method" (code or expert). At most 3 criteria should have eval_method as expert. The "criteria" should be short, and the "shortname" should be a very brief title for the criteria. Each evaluation criteria should test a concept that should evaluate to "true" in the ideal case.`;

  // Query the LLM (below, we will try this up to 3 times)
  async function _query() {
    const spec = [
      {
        key: "c9fb3b4a-ed01-40ce-a3ae-da30668a8a80",
        name: "Azure OpenAI",
        emoji: "🔷",
        model: "azure-openai",
        base_model: "azure-openai",
        temp: 1,
        deployment_name: "gpt-4",
        model_type: "chat-completion",
        // api_version: "2023-05-15",
        system_msg: AssertionWriterSystemMsg,
        settings: {
          deployment_name: "gpt-4",
          model_type: "chat-completion",
          // // api_version: "2023-05-15",
          system_msg: AssertionWriterSystemMsg,
          temperature: 1,
          response_format: {
            type: "text",
          },
          functions: [],
          function_call: "",
          top_p: 1,
          stop: [],
          presence_penalty: 0,
          frequency_penalty: 0,
        },
        formData: {
          shortname: "Azure OpenAI",
          deployment_name: "gpt-4",
          model_type: "chat-completion",
          // api_version: "2023-05-15",
          system_msg: AssertionWriterSystemMsg,
          temperature: 1,
          response_format: "text",
          functions: "",
          function_call: "",
          top_p: 1,
          stop: "",
          presence_penalty: 0,
          frequency_penalty: 0,
        },
        progress: {
          success: 0,
          error: 0,
        },
      },
    ];

    const result = await simpleQueryLLM(
      detailedPrompt, // prompt
      // "gpt-35-turbo-16k", // llm
      spec, // llm
      systemMsg !== undefined
        ? systemMsg === null
          ? undefined
          : systemMsg
        : AssertionWriterSystemMsg, // system_msg
      apiKeys, // API keys (if any)
    );

    if (result.errors && Object.keys(result.errors).length > 0)
      throw new Error(Object.values(result.errors as Dict)[0].toString());

    // Get output (text from LLM response)
    const output = result.responses[0].responses[0];
    console.log("LLM said: ", output); // for debuggging

    // Attempt to extract JSON blocks (strings) from input
    const json_blocks = extractJSONBlocks(output);
    if (json_blocks === undefined || json_blocks.length === 0)
      throw new Error(
        "EvalGen: Could not parse LLM response into evaluation critera: No JSON detected in output.",
      );

    // Attempt to parse all JSON blocks into objects
    const data: EvalCriteria[] = json_blocks.map((s) => JSON.parse(s)).flat(1);

    console.log("Parsed", data);

    // Double-check the formatting
    if (data.every(validEvalCriteriaFormat)) return data;
    // Incorrect formatting
    else
      throw new Error(
        "EvalGen: At least one JSON block was not in expected EvalCriteria format.",
      );
  }

  // Retry up to 3 times; otherwise, we will throw the last encountered error.
  return retryAsyncFunc(_query, 3);
}

export async function executeLLMEval(
  evalFunction: EvalFunction,
  example: StandardizedLLMResponse,
): Promise<EvalFunctionResult> {
  // Construct call to an LLM to evaluate the example
  const evalPrompt =
    "Evaluate the text below according to this criteria: " +
    evalFunction.code +
    ' Only return "yes" or "no", nothing else.\n\n```\n' +
    example.responses[0] +
    "\n```";

  // Sleep a random number of seconds between 1 and 30
  // const sleep = (ms: number) =>
  //   new Promise((resolve) => setTimeout(resolve, ms));
  // await sleep(Math.floor(Math.random() * 30) * 1000);

  const spec = [
    {
      key: "c9fb3b4a-ed01-40ce-a3ae-da30668a8a80",
      name: "Azure OpenAI",
      emoji: "🔷",
      model: "azure-openai",
      base_model: "azure-openai",
      temp: 1,
      deployment_name: "gpt-35-turbo-16k",
      model_type: "chat-completion",
      // api_version: "2023-05-15",
      system_msg: "You are an expert evaluator.",
      settings: {
        deployment_name: "gpt-35-turbo-16k",
        model_type: "chat-completion",
        // api_version: "2023-05-15",
        system_msg: "You are an expert evaluator.",
        temperature: 1,
        response_format: {
          type: "text",
        },
        functions: [],
        function_call: "",
        top_p: 1,
        stop: [],
        presence_penalty: 0,
        frequency_penalty: 0,
      },
      formData: {
        shortname: "Azure OpenAI",
        deployment_name: "gpt-35-turbo-16k",
        model_type: "chat-completion",
        // api_version: "2023-05-15",
        system_msg: "You are an expert evaluator.",
        temperature: 1,
        response_format: "text",
        functions: "",
        function_call: "",
        top_p: 1,
        stop: "",
        presence_penalty: 0,
        frequency_penalty: 0,
      },
      progress: {
        success: 0,
        error: 0,
      },
    },
  ];

  // Query an LLM as an evaluator
  const result = await simpleQueryLLM(
    evalPrompt, // prompt
    // "gpt-3.5-turbo", // llm
    spec,
    "You are an expert evaluator.", // system_msg
  );

  // Get the output
  const output = result.responses[0].responses[0];

  // Parse the response to determine the boolean value to return
  if (output.toLowerCase().includes("yes")) {
    return EvalFunctionResult.PASS;
  } else if (output.toLowerCase().includes("no")) {
    return EvalFunctionResult.FAIL;
  } else {
    // throw new EvalExecutionError(
    //   `Error executing function ${evalFunction.name}: could not parse ${response.choices[0].message.content}`,
    // );
    console.warn(
      "executeLLMEval: Warning: Could not find 'yes' or 'no' in response.",
      evalPrompt,
      output,
    );
    return EvalFunctionResult.SKIP;
  }
}

/**
 * Executes a JavaScript function, described by evalFunction, against the "example" LLM response object.
 * @returns `EvalFunctionResult`
 */
export async function execJSFunc(
  evalFunction: EvalFunction,
  example: StandardizedLLMResponse,
  iframe_id: string,
) {
  try {
    const result = await executejs(
      iframe_id,
      evalFunction.code,
      [example],
      "response",
      "evaluator",
    );

    // Check for errors
    if (result.error !== undefined) throw new Error(result.error);

    // Extract the evaluation result
    const eval_res = result.responses
      ? (result.responses[0] as StandardizedLLMResponse).eval_res?.items[0]
      : undefined;

    // Check that the evaluation result is a boolean value
    // NOTE: EvalGen only supports assertion functions at this time.
    if (typeof eval_res !== "boolean")
      throw new Error(
        "Non-boolean return value encountered when executing JS eval code. Value: " +
          eval_res,
      );

    return eval_res ? EvalFunctionResult.PASS : EvalFunctionResult.FAIL;
  } catch (err) {
    console.error(err);
    return EvalFunctionResult.SKIP;
  }
}

/**
 * Executes a Python function, described by evalFunction, against the "example" LLM response object.
 * NOTE: This runs in a sandbox using pyodide.
 * @returns `EvalFunctionResult`
 */
export async function execPyFunc(
  evalFunction: EvalFunction,
  example: StandardizedLLMResponse,
): Promise<EvalFunctionResult> {
  try {
    // We need to replace the function name with "evaluate", which is what is expected by backend:
    let code = evalFunction.code.replace(
      `def ${evalFunction.name}`,
      "def evaluate",
    );

    // Add `import re` to the code if it's not already there
    if (!code.includes("import re")) code = "import re\n" + code;

    console.log(`Executing function: ${code}`);

    // Execute the function via pyodide
    const result = await executepy(
      uuid(),
      code,
      [example],
      "response",
      "evaluator",
      undefined,
      "pyodide", // execute in sandbox with a pyodide WebWorker
    );

    // Check for errors
    if (result.error !== undefined) throw new Error(result.error);

    console.log("Result:", result);

    // Extract the evaluation result
    const eval_res = result.responses
      ? (result.responses[0] as StandardizedLLMResponse).eval_res?.items[0]
      : undefined;

    // Check that the evaluation result is a boolean value
    // NOTE: EvalGen only supports assertion functions at this time.
    if (typeof eval_res !== "boolean")
      throw new Error(
        "Non-boolean return value encountered when executing Python eval code. Value: " +
          eval_res,
      );

    return eval_res ? EvalFunctionResult.PASS : EvalFunctionResult.FAIL;
  } catch (err) {
    console.error(err);
    return EvalFunctionResult.SKIP;
  }
}

export async function generateFunctionsForCriteria(
  criteria: EvalCriteria,
  promptTemplate: string,
  example: StandardizedLLMResponse,
  emitter: EventEmitter,
): Promise<void> {
  const functionGenPrompt = buildFunctionGenPrompt(
    criteria,
    promptTemplate,
    example,
  );
  console.log("Function generation prompt:", functionGenPrompt);

  try {
    const streamer = new AzureOpenAIStreamer();

    streamer.on("function", (functionDefinition: string) => {
      processAndEmitFunction(criteria, functionDefinition, emitter);
    });

    const modelType =
      criteria.eval_method === "expert" ? "llm_eval" : "python_fn";
    await streamer.generate(functionGenPrompt, "gpt-4", modelType);
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
  example: StandardizedLLMResponse,
): string {
  if (criteria.eval_method === "expert")
    return `Given the following prompt template for an LLM pipeline:\n\n ${promptTemplate}\n\n, your task is to devise a prompt for an expert to evaluate the pipeline's responses based on the following criteria: ${criteria.criteria}
  
  You will devise multiple prompts to see which has the best accuracy. Each prompt you generate should be a short question that an expert can answer with a "yes" or "no" to evaluate entire criteria (don't miss anything in the criteria). Try different variations/wordings in the prompts. Return your prompts in a JSON list of strings within \`\`\`json \`\`\` markers. Each string should be a question for the expert to answer, and each question should be contained on its own line.
  `;
  else {
    const prompt = `Given the following prompt template for an LLM pipeline:\n\n ${promptTemplate}\n\n, your task is to devise multiple Python assertions to evaluate LLM responses based on the criteria "${criteria.shortname}". Create as many implementations as possible.
${buildGenEvalCodePrompt("python", buildContextPromptForVarsMetavars(getVarsAndMetavars([example])), criteria.criteria, true)}

Be creative in your implementations. Our goal is to explore diverse approaches to evaluate LLM responses effectively. Try to avoid using third-party libraries for code-based evaluation methods. Include the full implementation of each function. Each function should return only True or False.`;

    console.log("Function generation prompt:", prompt);

    return prompt;
  }
}

function processAndEmitFunction(
  criteria: EvalCriteria,
  functionDefinition: string,
  emitter: EventEmitter,
): void {
  const evalFunction: EvalFunction = {
    evalCriteria: criteria,
    code: functionDefinition,
    name: functionDefinition,
    uid: uuid(),
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
