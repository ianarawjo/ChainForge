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

interface EvaluationCriteria {
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

async function generateLLMEvaluations(
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

/**
 * The EvaluationFunctionExecutor class is designed to asynchronously
 * evaluate a set of examples against specified evaluation criteria using
 * generated evaluation functions and to prioritize grading based on the
 * results.
 *
 * Usage:
 *
 * 1. Initialization:
 *    Create an instance of the EvaluationFunctionExecutor by providing the
 *    evaluation criteria, a prompt template for the developer's LLM chain,
 *    and a set of examples to be evaluated.
 *
 *    const executor = new EvaluationFunctionExecutor(
 *      evaluationCriteria, promptTemplate, examples);
 *
 * 2. Start Background Computation:
 *    Call the `start` method to begin generating and executing evaluation
 *    functions in the background. This method returns immediately,
 *    allowing your application to perform other tasks concurrently.
 *
 *    executor.start();
 *
 * 3. Continue with Other Computations and Interactive Grading:
 *    You can proceed with other tasks (i.e., grading) immediately after
 *    starting the background computation. Use `getNextExampleToScore`
 *    to determine which example to grade next and `setGradeForExample`
 *    to assign grades to specific examples. This interactive grading will
 *    help in filtering out incorrect evaluation functions.
 *
 *    // Example of interactive grading loop
 *    let nextExampleId = executor.getNextExampleToScore();
 *    while (nextExampleId !== null) {
 *      const grade = ...; // Determine the grade for the example, e.g.,
 *                          // through user input
 *      executor.setGradeForExample(nextExampleId, grade);
 *      nextExampleId = executor.getNextExampleToScore();
 *    }
 *
 * 5. (Optional) Querying Results:
 *    At any time, you can query the current grading priorities of examples
 *    or check the grading status by using methods like `getScore`,
 *    `getAllScores`, or `getNextExampleToScore`.
 */
class EvaluationFunctionExecutor {
  private scores: Map<ExampleId, number>;
  private outcomes: Map<string, { successes: number; failures: number }>; // Track successes and failures for each function to compute failure rates
  private grades: Map<ExampleId, boolean>; // Grades for all examples
  private lastPickedHighScore; // To alternate between highest and lowest scores when sampling examples to grade
  private examples: Example[]; // The set of examples being evaluated and graded
  private evaluationCriteria: EvaluationCriteria[]; // The criteria used to generate evaluation functions
  private promptTemplate: string; // The prompt template for the developer's LLM chain
  private backgroundTaskPromise: Promise<void> | null = null; // To keep track of the background task for generating and executing evaluation functions

  /**
   * Initializes a new instance of the EvaluationFunctionExecutor class.
   *
   * @param evaluationCriteria The criteria used to generate evaluation functions. Provided/confirmed by the developer.
   * @param promptTemplate The prompt demplate for the developer's LLM chain. This is useful for GPT-4 to generate correct evaluation functions.
   * @param examples A set of variable-prompt-response triples that we want the developer to grade (and use for filtering incorrect evaluation functions).
   */
  constructor(
    evaluationCriteria: EvaluationCriteria[],
    promptTemplate: string,
    examples: Example[],
  ) {
    this.outcomes = new Map<string, { successes: number; failures: number }>();
    this.lastPickedHighScore = false; // Start off picking the highest score
    this.examples = examples;
    this.evaluationCriteria = evaluationCriteria;
    this.promptTemplate = promptTemplate;

    // Set scores and grades to default values of 0
    this.scores = new Map<ExampleId, number>();
    this.grades = new Map<ExampleId, boolean>();
  }

  /**
   * Starts the background computation for generating and executing evaluation functions.
   * This method initiates the tasks but does not wait for them to complete.
   * This method should be called after the constructor.
   */
  public start(): void {
    // Initiate the background task without awaiting its completion
    this.backgroundTaskPromise = this.generateAndExecuteEvaluationFunctions();
  }

  /**
   * Allows the client to explicitly wait for the background tasks to complete if needed.
   */
  public async waitForCompletion(): Promise<void> {
    if (this.backgroundTaskPromise) {
      await this.backgroundTaskPromise;
    }
  }

  /**
   * Generates and executes evaluation functions for a set of examples based on provided criteria.
   * This method is responsible for initializing the evaluation process and managing the asynchronous execution of functions.
   */
  async generateAndExecuteEvaluationFunctions(): Promise<void> {
    const allExecutionPromises = this.evaluationCriteria.map(
      async (criteria) => {
        const functionString = await generateFunctionForCriteria(
          criteria,
          this.promptTemplate,
          this.examples[Math.floor(Math.random() * this.examples.length)],
        );

        // Initialize outcome tracking for this function
        this.outcomes.set(functionString, { successes: 0, failures: 0 });

        const executionPromises = this.examples.map(async (example) => {
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
      },
    );

    await Promise.all(allExecutionPromises);
  }

  /**
   * Updates the grading prioritiy score for a given example based on the outcome of a synthesized evaluation function.
   * This method calculates the failure rate of a function and adjusts the example's score accordingly. Functions with higher failure rates will result in lower scores for the example.
   *
   * @param exampleId The unique ID of the example being scored.
   * @param functionString The string representation of the function used for evaluation. TODO: have better function IDs instead of passing in the code here.
   */
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

  /**
   * Retrieves the current response priority score for a given example.
   * This method allows clients to query the score of an example at any point during the evaluation process, for transparency and debugging purposes.
   *
   * @param exampleId The unique ID of the example whose score is being requested.
   * @returns The current response priority score of the example, if available.
   */
  public getScore(exampleId: ExampleId): number | undefined {
    return this.scores.get(exampleId);
  }

  /**
   * Retrieves scores for all examples.
   * This method provides a snapshot of the current scores for all examples being evaluated.
   *
   * @returns A map of example IDs to their current scores.
   */
  public getAllScores(): Map<ExampleId, number> {
    return new Map(this.scores);
  }

  /**
   * Sets a grade for an example based on external input from the developer.
   * This will be used for filtering out incorrect evaluation functions.
   *
   * @param exampleId The unique ID of the example being graded.
   * @param grade The developer-provided grade assigned to the example.
   */
  public setGradeForExample(exampleId: ExampleId, grade: boolean): void {
    this.grades.set(exampleId, grade);
  }

  /**
   * Determines the next example to be graded, alternating between examples with the highest and lowest ungraded scores.
   * This method aims to balance attention across examples of varying difficulty or quality. Ideally, in grading, we get a sample of good and bad
   * responses.
   *
   * @returns The unique ID of the next example to be graded, or null if all examples have been graded.
   */
  public getNextExampleToGrade(): ExampleId | null {
    const ungraded = Array.from(this.scores.entries())
      .filter(([id]) => !this.grades.has(id)) // Filter out graded examples
      .map(([id, score]) => ({ id, score, rand: Math.random() })) // Add random key for tie-breaking
      .sort((a, b) => {
        // Sort by score, then randomly for tie-breaking
        if (a.score === b.score) {
          return a.rand - b.rand;
        }
        return a.score - b.score;
      })
      .map(({ id }) => id); // Extract sorted ids

    if (ungraded.length === 0) {
      return null; // No ungraded examples left
    }

    // Decide whether to pick the highest or lowest ungraded score
    const pickIndex = this.lastPickedHighScore ? ungraded.length - 1 : 0;
    this.lastPickedHighScore = !this.lastPickedHighScore; // Alternate for next time

    return ungraded[pickIndex];
  }
}

async function generateFunctionForCriteria(
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
