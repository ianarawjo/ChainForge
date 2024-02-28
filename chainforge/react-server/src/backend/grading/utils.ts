// Interfaces and utility functions
// TODO: Replace GPTResponse and askGPT4 with actual GPT-4 API calls

export interface GPTResponse<T> {
  data: T;
}

export interface EvaluationCriteria {
  criteria: string;
  category: string;
  eval_method: "code" | "manual";
  source?: string;
}

export type ExampleId = string;

export interface Example {
  id: ExampleId;
  variables: Record<string, string>;
  prompt: string;
  response: string;
}

export interface FunctionResult {
  function: string;
  result: boolean;
  prompt: string;
  response: string;
}

export async function generateLLMEvaluations(
  prompt: string,
): Promise<EvaluationCriteria[]> {
  // Construct the detailed prompt for the LLM
  const detailedPrompt = `Here is my LLM prompt: ${prompt}
    
    Based on the content in the prompt, I want to write evaluations for my LLM pipeline to run on all pipeline responses. Here are some categories of evaluation criteria I want to check for:
    
    - Presentation Format: Is there a specific format for the response, like a comma-separated list or a JSON object?
    - Example Demonstration: Does the prompt template include any examples of good responses that demonstrate any specific headers, keys, or structures?
    - Workflow Description: Does the prompt template include any descriptions of the workflow that the LLM should follow, indicating possible evaluation criteria?
    - Count: Are there any instructions regarding the number of items of a certain type in the response, such as “at least”, “at most”, or an exact number?
    - Inclusion: Are there keywords that every LLM response should include?
    - Exclusion: Are there keywords that every LLM response should never mention?
    - Qualitative Assessment: Are there qualitative criteria for assessing good responses, including specific requirements for length, tone, or style?
    - Other: Based on the prompt template, are there any other criteria to check in evaluations that are not covered by the above categories, such as correctness, completeness, or consistency?
    
    Give me a list of criteria to check for in LLM responses. Each item in the list should contain a string description of a criteria to check for, its corresponding category, whether it should be evaluated with code or manually by an expert, and the source, or phrase in the prompt template that triggered the criteria. Your answer should be a JSON list of objects within \`\`\`json \`\`\` markers, where each object has the following fields: "criteria", "category", "eval_method" (code or LLM), and "source". This list should contain as many evaluation criteria as you can think of, as long are specific and reasonable.`;

  // TODO: Call the LLM appropriately
  const response = await askGPT4<string>(detailedPrompt);

  // Assuming the response is a JSON string that we need to parse into an object
  try {
    const evaluationCriteria: EvaluationCriteria[] = JSON.parse(response.data);
    return evaluationCriteria;
  } catch (error) {
    console.error("Error parsing GPT-4 response:", error);
    throw new Error("Failed to parse GPT-4 response into evaluation criteria.");
  }
}

export async function executeFunction(
  functionString: string,
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
      functionString,
      example,
    }),
  });
  if (!response.ok) {
    throw new Error(`API call failed with status ${response.status}`);
  }
  return response.json();
}

export async function generateFunctionForCriteria(
  criteria: EvaluationCriteria,
  promptTemplate: string,
  example: Example,
): Promise<string> {
  const functionGenPrompt = `Here is my prompt template:
      
    "${promptTemplate}"
    
    Here is an example and its corresponding LLM response:
    
    Example formatted LLM prompt: ${example.prompt}
    LLM Response: ${example.response}
    
    I want to check for a concept in LLM responses based on this criteria:
    
    - Criteria: ${criteria.criteria}
    - Category: ${criteria.category}
    - Evaluation Method: ${criteria.eval_method}
    
    Give me a Python function that can be used to check for this concept in LLM responses. If the evaluation method is "LLM", the function should leverage the external function \`ask_llm\`; otherwise it should only rely on code and Python libraries. Each function should take in 3 args: an example (dict with string keys), prompt formatted on that example (string), and LLM response (string), and return a boolean indicating whether the response satisfies the concept covered by the function.`;

  // TODO: Replace with actual call to GPT-4
  try {
    const response = await askGPT4<string>(functionGenPrompt);
    return response.data; // TODO: convert this into an executable function
  } catch (error) {
    console.error("Error generating function for criteria:", error);
    throw new Error(
      `Failed to generate function for criteria: ${criteria.criteria}`,
    );
  }
}
