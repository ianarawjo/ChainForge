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
import { Dict, LLMResponse, LLMSpec } from "../typing";
import {
  evalWithLLM,
  executejs,
  executepy,
  queryLLM,
  simpleQueryLLM,
} from "../backend";
import {
  getVarsAndMetavars,
  hashtagTemplateVars,
  llmResponseDataToString,
  retryAsyncFunc,
} from "../utils";
import { v4 as uuid } from "uuid";
import { EvalGenAssertionEmitter } from "./oai_utils";
import {
  buildContextPromptForVarsMetavars,
  buildGenEvalCodePrompt,
} from "../../AiPopover";
import { escapeBraces } from "../template";

/**
 * Extracts substrings within "```" and "```" ticks. Excludes the ticks from return.
 * @param mdText
 * @returns
 */
export function extractMdBlocks(
  mdText: string,
  blockName: string,
): string[] | undefined {
  const regex = new RegExp(`\`\`\`${blockName}(.*?)\`\`\``, "gs");
  const matches = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(mdText)) !== null) matches.push(match[1]);

  if (matches.length > 0) return matches;

  console.error("No md blocks found for name:", blockName);
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
  llm: string | LLMSpec,
  apiKeys?: Dict,
  promptTemplate?: string, // overrides prompt template used
  systemMsg?: string | null, // overrides default system message, if present. Use null to specify empty.
  userFeedback?: { grade: boolean; note?: string; response: string }[], // user feedback to include in the prompt
): Promise<EvalCriteria[]> {
  // Compose user feedback
  let userFeedbackPrompt = "";
  if (userFeedback) {
    userFeedbackPrompt = `\n\n-----------------\nHere is some feedback on the LLM's responses to this prompt:`;
    for (const feedback of userFeedback) {
      userFeedbackPrompt += `\n\nFor the response: "${feedback.response}", the user gave the following feedback:`;
      if (feedback.grade !== undefined) {
        userFeedbackPrompt += `\nGrade: ${feedback.grade === true ? "Good" : "Bad"}`;
      }
      if (feedback.note !== undefined) {
        userFeedbackPrompt += `\nExplanation for grade: "${feedback.note}"`;
      }
    }
    userFeedbackPrompt += "\n-----------------\n";
  }

  // Construct the detailed prompt for the LLM
  const detailedPrompt =
    promptTemplate ??
    `Here is my LLM prompt template:
  
  \`${prompt}\`

    ${userFeedbackPrompt}
    
    Based on the instructions in the prompt that need to be followed, I want to write a list of assertions for my LLM pipeline to run on all pipeline responses. Give me a list of 3 distinct criteria to check for in LLM responses. Each item in the list should contain a string description of a criteria to check for, and whether it should be evaluated with code or by an expert if the criteria is difficult to evaluate. Your answer should be a JSON list of objects within \`\`\`json \`\`\` markers, where each object has the following three fields: "criteria", "shortname", and "eval_method" (code or expert). At most 3 criteria should have eval_method as expert. The "criteria" should be short, and the "shortname" should be a very brief title for the criteria. Each evaluation criteria should test a concept that should evaluate to "true" in the ideal case.`;

  // Query the LLM (below, we will try this up to 3 times)
  async function _query() {
    const result = await simpleQueryLLM(
      detailedPrompt, // prompt
      typeof llm === "string" ? llm : [llm], // llm
      // spec, // llm
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
    const output = llmResponseDataToString(result.responses[0].responses[0]);
    // console.log("LLM said: ", output); // for debuggging

    // Attempt to extract JSON blocks (strings) from input
    const json_blocks = extractMdBlocks(output, "json");
    if (json_blocks === undefined || json_blocks.length === 0)
      throw new Error(
        "EvalGen: Could not parse LLM response into evaluation critera: No JSON detected in output.",
      );

    // Attempt to parse all JSON blocks into objects
    const data: EvalCriteria[] = json_blocks.map((s) => JSON.parse(s)).flat(1);

    // console.log("Parsed", data);

    // Double-check the formatting
    if (data.every(validEvalCriteriaFormat)) {
      // Initialize any required properties
      data.forEach((d) => {
        d.uid = uuid();
        d.priority = 0;
      });
      return data;
    }
    // Incorrect formatting
    else
      throw new Error(
        "EvalGen: At least one JSON block was not in expected EvalCriteria format.",
      );
  }

  // Retry up to 3 times; otherwise, we will throw the last encountered error.
  return retryAsyncFunc(_query, 3);
}

export function getPromptForGenEvalCriteriaFromDesc(desc: string) {
  return `I've described a criteria I want to use to evaluate text. I want you to take the criteria and output a JSON object in the format below. 

CRITERIA: 
\`\`\`
${desc}
\`\`\`

Your response should contain a short title for the criteria ("shortname"), a description of the criteria in 2 sentences ("criteria"), and whether it should be evaluated with "code", or by an "expert" if the criteria is difficult to evaluate ("eval_method"). Your answer should be JSON within a \`\`\`json \`\`\` marker, with the following three fields: "criteria", "shortname", and "eval_method" (code or expert). The "criteria" should expand upon the user's input, the "shortname" should be a very brief title for the criteria, and this list should contain as many evaluation criteria as you can think of. Each evaluation criteria should test a unit concept that should evaluate to "true" in the ideal case. Only output JSON, nothing else.`;
}

export async function executeLLMEval(
  evalFunction: EvalFunction,
  llm: string | LLMSpec,
  example: LLMResponse,
  positiveExample?: LLMResponse,
  negativeExample?: LLMResponse,
): Promise<EvalFunctionResult> {
  // The LLM eval prompt might include template vars. We need to add
  // a hashtag to indicate to ChainForge that it should use the
  // fill_history in the provided `example` LLMResponse.
  const candidateCriteriaPrompt = hashtagTemplateVars(evalFunction.code);

  // Construct call to an LLM to evaluate the example
  const evalPrompt =
    "Evaluate the text below according to this criteria: " +
    candidateCriteriaPrompt +
    ' Only return "yes" or "no", nothing else.\n\n```\n' +
    "{__input}" +
    "\n```";

  // Query an LLM as an evaluator
  let systemMessage;
  if (
    positiveExample &&
    positiveExample.responses.length > 0 &&
    negativeExample &&
    negativeExample.responses.length > 0
  ) {
    systemMessage =
      "You are an expert evaluator. Please consider the following GOOD example:\n" +
      llmResponseDataToString(positiveExample.responses[0]) +
      "\n\nand BAD example:\n" +
      llmResponseDataToString(negativeExample.responses[0]) +
      "\n\nwhen making your evaluation.";
  }

  // We use ChainForge's infrastructure for running LLM evaluators
  // to score responses based on the criteria.
  const { responses, errors } = await evalWithLLM(
    Date.now().toString(), // id to refer to this query
    llm, // llm
    evalPrompt,
    [example], // we pass in a single example
    undefined,
    undefined,
    undefined,
    systemMessage,
  );

  if (
    !responses ||
    responses.length === 0 ||
    !responses[0].eval_res ||
    responses[0].eval_res.items.length === 0
  ) {
    console.error(
      "Error executing LLM eval candidate:",
      errors,
      evalFunction.code,
    );
    return EvalFunctionResult.SKIP;
  }

  // Get the output
  const output = responses[0].eval_res?.items[0];
  // This should be a boolean... but we need to parse it
  const is_pass =
    output === true || (typeof output === "string" && output.includes("yes"));
  const is_fail =
    output === false || (typeof output === "string" && output.includes("no"));

  // Parse the response to determine the boolean value to return
  if (is_pass) {
    return EvalFunctionResult.PASS;
  } else if (is_fail) {
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
  example: LLMResponse,
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
      ? (result.responses[0] as LLMResponse).eval_res?.items[0]
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
  llm: string | LLMSpec, // not used, but provided for consistency with the other exec func signature
  example: LLMResponse,
  positiveExample?: LLMResponse,
  negativeExample?: LLMResponse,
): Promise<EvalFunctionResult> {
  try {
    // We need to replace the function name with "evaluate", which is what is expected by backend:
    let code = evalFunction.code.replace(
      `def ${evalFunction.name}`,
      "def evaluate",
    );

    // Add `import re` to the code if it's not already there
    if (!code.includes("import re")) code = "import re\n" + code;

    // console.log(`Executing function: ${code}`);

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

    // console.log("Result:", result);

    // Extract the evaluation result
    const eval_res = result.responses
      ? (result.responses[0] as LLMResponse).eval_res?.items[0]
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
  llm: string | LLMSpec,
  promptTemplate: string,
  example: LLMResponse,
  emitter: EventEmitter,
  badExample?: LLMResponse,
  apiKeys?: Dict,
): Promise<void> {
  const functionGenPrompt = buildFunctionGenPrompt(
    criteria,
    promptTemplate,
    example,
    badExample,
  );
  console.log("Function generation prompt:", functionGenPrompt);

  try {
    const streamer = new EvalGenAssertionEmitter(apiKeys);

    streamer.on("function", (functionDefinition: string) => {
      processAndEmitFunction(criteria, functionDefinition, emitter);
    });

    const modelType =
      criteria.eval_method === "expert" ? "llm_eval" : "python_fn";
    await streamer.generate(functionGenPrompt, llm, modelType);
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
  example: LLMResponse,
  badExample?: LLMResponse,
): string {
  let badExampleSection = "";
  if (badExample) {
    badExampleSection = `
    Here is an example response that DOES NOT meet the criteria:
    \`\`\`
    ${llmResponseDataToString(badExample.responses[0])}
    \`\`\`
    `;
  }

  if (criteria.eval_method === "expert") {
    const varsAndMetavars = getVarsAndMetavars([example]);
    // Turn the vars and metavars into a string
    const _composeVarsContext = (vars: string[]) => {
      if (vars.length === 0) return "";
      vars.map((v) => ` - "${v}": ${example.vars[v]}`).join("\n");
    };
    const varsAndMetavarsContext =
      _composeVarsContext(varsAndMetavars.vars) +
      "\n" +
      _composeVarsContext(varsAndMetavars.metavars);
    const varsAndMetavarsContextPrompt =
      varsAndMetavarsContext.length > 2
        ? `\n\nIn your prompts, it may be useful to refer to metadata associated with the LLM output, such as when you are comparing to a ground truth. For instance, consider a situation where the user has a prompt template with a variable {writing_style} —'poem', 'text message', or 'formal letter' —and they want to validate that the LLM's output was really in that style. You would produce a prompt template like:

"Respond with 'yes' if the text below is in the style of a {writing_style}, 'no' if not. Only reply with the classification, nothing else."

The template indicates that the same {writing_style} variable used upstream in the LLM pipeline, should be used in your evaluation prompt.

If you want to refer to the value of an input variable, you **must** use template braces like {variable}.

Here are the variables you have access to (keys), and example values for one output: 
${varsAndMetavarsContext}`
        : "";

    return escapeBraces(`Given the following prompt template for an LLM pipeline:\n\n ${promptTemplate}\n\nYour task is to devise a prompt for an expert to evaluate the pipeline's responses based on the following criteria: "${criteria.criteria}"
    ${badExampleSection}
    You will devise 3 prompts for the evaluation criterion to see which has the best accuracy. Each prompt you generate should be a short question that an expert can answer with a "yes" or "no" to evaluate entire criteria (don't miss anything in the criteria). Try different variations/wordings in the prompts. ${varsAndMetavarsContextPrompt}
    
    Return your prompts in a JSON list of strings within \`\`\`json \`\`\` markers. Each string should be a question for the expert to answer, and each question should be contained on its own line.
    ---
    `);
  } else {
    const prompt = `Given the following prompt template for an LLM pipeline:\n\n ${promptTemplate}\n\n, your task is to devise multiple Python assertions to evaluate LLM responses based on the criteria "${criteria.shortname}". 
    ${badExampleSection}
    Create 3 implementations of the criterion.
    ${buildGenEvalCodePrompt("python", buildContextPromptForVarsMetavars(getVarsAndMetavars([example])), criteria.criteria, true)}
    Be creative in your implementations. Our goal is to explore diverse approaches to evaluate LLM responses effectively. Try to avoid using third-party libraries for code-based evaluation methods. Include the full implementation of each function in separate "\`\`\`python" blocks. Each function should return only True or False.`;

    return escapeBraces(prompt); // Escape braces in the prompt
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

/**
 * Calculates the F1 score based on true positives, false positives, and false negatives.
 * The F1 score is the harmonic mean of precision and recall.
 * Precision = TP / (TP + FP)
 * Recall = TP / (TP + FN)
 * F1 = 2 * (Precision * Recall) / (Precision + Recall)
 * @param true_positive The number of true positive predictions
 * @param false_positive The number of false positive predictions
 * @param false_negative The number of false negative predictions
 * @returns The F1 score, or undefined if precision and recall are both zero
 */
export function calculateF1Score(
  true_positive: number,
  false_positive: number,
  false_negative: number,
): number | undefined {
  const precision = true_positive / (true_positive + false_positive);
  const recall = true_positive / (true_positive + false_negative);
  if (precision + recall === 0) return undefined; // Avoid division by zero
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Calculates Matthews correlation coefficient (MCC) based on the confusion matrix values.
 * ```
 *  MCC = (TP * TN - FP * FN) / sqrt((TP + FP) * (TP + FN) * (TN + FP) * (TN + FN))
 * ```
 * @param true_positive The number of true positive predictions
 * @param true_negative The number of true negative predictions
 * @param false_positive The number of false positive predictions
 * @param false_negative The number of false negative predictions
 * @returns The Matthews correlation coefficient, or undefined if the denominator is zero
 */
export function calculateMCC(
  true_positive: number,
  true_negative: number,
  false_positive: number,
  false_negative: number,
): number | undefined {
  const numerator =
    true_positive * true_negative - false_positive * false_negative;
  const denominator = Math.sqrt(
    (true_positive + false_positive) *
      (true_positive + false_negative) *
      (true_negative + false_positive) *
      (true_negative + false_negative),
  );
  if (denominator === 0) return undefined; // Avoid division by zero
  return numerator / denominator;
}

/**
 * Calculates Cohen's Kappa coefficient based on the confusion matrix values.
 * ```
 *  Kappa = (Po - Pe) / (1 - Pe)
 * ```
 * where Po is the observed agreement and Pe is the expected agreement.
 * @param TP The number of true positive predictions
 * @param TN The number of true negative predictions
 * @param FP The number of false positive predictions
 * @param FN The number of false negative predictions
 * @returns The Cohen's Kappa coefficient, or undefined if the denominator is zero
 */
export function calculateCohensKappa(
  TP: number,
  TN: number,
  FP: number,
  FN: number,
): number | undefined {
  const numerator = 2 * (TP * TN - FP * FN);
  const denominator = (TP + FP) * (FP + TN) + (TP + FN) * (FN + TN);
  if (denominator === 0) {
    return undefined; // Avoid division by zero
  }
  return numerator / denominator;
}
