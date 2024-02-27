/*
This file provides utility functions to solicit grading from the developer.
We define the following modules:
* Evaluation criteria suggestion
* Evaluation function generation and execution
* Grading prioritization
* Evaluation function selection
*/

// TODO: Define this interface appropriately; this is just a placeholder
interface GPTResponse<T> {
  data: T;
}

interface AssertionCriteria {
  criteria: string;
  category: string;
  eval_method: "code" | "manual";
  source?: string; // Marking the 'source' field as optional; we used it in SPADE but it may not be necessary, espcially for user-generated criteria
}

type ExampleId = string;
interface Example {
  id: ExampleId;
  variables: Record<string, string>;
  prompt: string;
  response: string;
}

interface FunctionResult {
  function: string;
  result: boolean;
  prompt: string;
  response: string;
}

async function generateLLMAssertions(
  prompt: string,
): Promise<AssertionCriteria[]> {
  // Construct the detailed prompt for the LLM
  const detailedPrompt = `Here is my LLM prompt: ${prompt}
  
  Based on the content in the prompt, I want to write assertions for my LLM pipeline to run on all pipeline responses. Here are some categories of assertion criteria I want to check for:
  
  - Presentation Format: Is there a specific format for the response, like a comma-separated list or a JSON object?
  - Example Demonstration: Does the prompt template include any examples of good responses that demonstrate any specific headers, keys, or structures?
  - Workflow Description: Does the prompt template include any descriptions of the workflow that the LLM should follow, indicating possible assertion criteria?
  - Count: Are there any instructions regarding the number of items of a certain type in the response, such as “at least”, “at most”, or an exact number?
  - Inclusion: Are there keywords that every LLM response should include?
  - Exclusion: Are there keywords that every LLM response should never mention?
  - Qualitative Assessment: Are there qualitative criteria for assessing good responses, including specific requirements for length, tone, or style?
  - Other: Based on the prompt template, are there any other criteria to check in assertions that are not covered by the above categories, such as correctness, completeness, or consistency?
  
  Give me a list of criteria to check for in LLM responses. Each item in the list should contain a string description of a criteria to check for, its corresponding category, whether it should be evaluated with code or manually by an expert, and the source, or phrase in the prompt template that triggered the criteria. Your answer should be a JSON list of objects within \`\`\`json \`\`\` markers, where each object has the following fields: "criteria", "category", "eval_method" (code or LLM), and "source". This list should contain as many assertion criteria as you can think of, as long are specific and reasonable.`;

  // TODO: Call the LLM appropriately
  const response = await askGPT4<string>(detailedPrompt);

  // Assuming the response is a JSON string that we need to parse into an object
  try {
    const assertionCriteria: AssertionCriteria[] = JSON.parse(response.data);
    return assertionCriteria;
  } catch (error) {
    console.error("Error parsing GPT-4 response:", error);
    throw new Error("Failed to parse GPT-4 response into assertion criteria.");
  }
}

async function executeFunction(
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

class AssertionFunctionExecutor {
  private scores: Map<ExampleId, number>;
  private outcomes: Map<string, { successes: number; failures: number }>; // Track successes and failures for each function to compute failure rates

  constructor() {
    this.scores = new Map<ExampleId, number>();
    this.outcomes = new Map<string, { successes: number; failures: number }>();
  }

  // Method to execute assertion functions and update scores
  async generateAndExecuteAssertionFunctions(
    assertionCriteria: AssertionCriteria[],
    promptTemplate: string,
    examples: Example[],
  ): Promise<void> {
    const allExecutionPromises = assertionCriteria.map(async (criteria) => {
      const functionString = await generateFunctionForCriteria(
        criteria,
        promptTemplate,
        examples[Math.floor(Math.random() * examples.length)],
      );

      // Initialize outcome tracking for this function
      this.outcomes.set(functionString, { successes: 0, failures: 0 });

      const executionPromises = examples.map(async (example) => {
        try {
          const result = await executeFunction(functionString, example);

          // Update outcome tracking
          const outcome = this.outcomes.get(functionString);
          if (outcome) {
            if (result) {
              outcome.successes++;
            } else {
              outcome.failures++;
            }
            this.outcomes.set(functionString, outcome);
          }

          // Update the score if the function failed the example
          if (!result) {
            this.updateScore(example.id, functionString);
          }

          return {
            function: functionString,
            result,
            prompt: example.prompt,
            response: example.response,
          };
        } catch (error) {
          console.error("Error executing function on example:", error);
          return null; // Adjust based on your error handling preferences
        }
      });

      return Promise.all(executionPromises);
    });

    await Promise.all(allExecutionPromises);
  }

  // Method to update scores
  private updateScore(exampleId: ExampleId, functionString: string): void {
    const outcome = this.outcomes.get(functionString);
    if (outcome) {
      const failureRate =
        outcome.failures / (outcome.successes + outcome.failures);
      /* TODO: experiment if it's ok to do streaming failure rate calculation like this, or if we need to store the total count and calculate the rate at the end */
      const scoreIncrement = 1 - failureRate;
      const currentScore = this.scores.get(exampleId) || 0;
      this.scores.set(exampleId, currentScore + scoreIncrement);
    }
  }

  // Method for clients to query scores
  public getScore(exampleId: ExampleId): number | undefined {
    return this.scores.get(exampleId);
  }

  // Method for clients to query all scores
  public getAllScores(): Map<ExampleId, number> {
    return new Map(this.scores);
  }

  // Method to prioritize examples based on scores
  public prioritizeExamples(): ExampleId[] {
    // Implement a prioritization algorithm that alternates between
    // prioritizing examples with the lowest scores and the highest scores
    // to ensure a balanced grading process
    // TODO: Test if this actually works, and integrate with examples that
    // the developer has already graded

    const sortedScores = Array.from(this.scores).sort(
      ([, scoreA], [, scoreB]) => scoreA - scoreB,
    );

    const prioritizedExamples: ExampleId[] = [];
    for (let i = 0; i < sortedScores.length / 2; i++) {
      prioritizedExamples.push(sortedScores[i][0]);
      prioritizedExamples.push(sortedScores[sortedScores.length - 1 - i][0]);
    }

    return prioritizedExamples;
  }
}

async function generateFunctionForCriteria(
  criteria: AssertionCriteria,
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
