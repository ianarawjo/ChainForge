import {
  EvalCriteria,
  EvalFunction,
  Example,
  ExampleId,
  executeFunction,
  generateFunctionsForCriteria,
} from "./utils";

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
 *      evalCriteria, promptTemplate, examples);
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
  private outcomes: Map<EvalFunction, { successes: number; failures: number }>; // Track successes and failures for each function to compute failure rates
  // Cache function results for each example
  private resultsCache: Map<EvalFunction, Map<ExampleId, boolean>>;
  private grades: Map<ExampleId, boolean>; // Grades for all examples
  private lastPickedHighScore; // To alternate between highest and lowest scores when sampling examples to grade
  private examples: Example[]; // The set of examples being evaluated and graded
  private evalCriteria: EvalCriteria[]; // The criteria used to generate evaluation functions
  private evalFunctions: EvalFunction[]; // The set of evaluation functions generated for the developer's LLM chain
  private promptTemplate: string; // The prompt template for the developer's LLM chain
  private backgroundTaskPromise: Promise<void> | null = null; // To keep track of the background task for generating and executing evaluation functions

  /**
   * Initializes a new instance of the EvaluationFunctionExecutor class.
   *
   * @param evalCriteria The criteria used to generate evaluation functions. Provided/confirmed by the developer.
   * @param promptTemplate The prompt demplate for the developer's LLM chain. This is useful for GPT-4 to generate correct evaluation functions.
   * @param examples A set of variable-prompt-response triples that we want the developer to grade (and use for filtering incorrect evaluation functions).
   */
  constructor(
    evalCriteria: EvalCriteria[],
    promptTemplate: string,
    examples: Example[],
  ) {
    this.outcomes = new Map<
      EvalFunction,
      { successes: number; failures: number }
    >();
    this.resultsCache = new Map<EvalFunction, Map<ExampleId, boolean>>();
    this.lastPickedHighScore = false; // Start off picking the highest score
    this.examples = examples;
    this.evalCriteria = evalCriteria;
    this.promptTemplate = promptTemplate;

    // Set scores and grades to default values of 0
    this.scores = new Map<ExampleId, number>();
    this.grades = new Map<ExampleId, boolean>();
    this.evalFunctions = [];
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
  public async generateAndExecuteEvaluationFunctions(): Promise<void> {
    // Step 1: Concurrently generate all evaluation functions for each criterion
    const evalFunctionsPromises = this.evalCriteria.map(async (criteria) => {
      return generateFunctionsForCriteria(
        criteria,
        this.promptTemplate,
        this.examples[Math.floor(Math.random() * this.examples.length)],
      );
    });

    // Wait for all function generation promises to resolve
    const allEvalFunctions = await Promise.all(evalFunctionsPromises);
    this.evalFunctions = allEvalFunctions.flat(); // Flatten the array of arrays

    // Step 2: Concurrently execute all generated evaluation functions on all examples
    const executionPromises = this.evalFunctions.map((evalFunction) => {
      // Initialize outcome tracking for this function
      this.outcomes.set(evalFunction, { successes: 0, failures: 0 });

      return this.examples.map(async (example) => {
        try {
          const result = await executeFunction(evalFunction, example);

          // Put the result in the cache
          if (!this.resultsCache.has(evalFunction)) {
            this.resultsCache.set(evalFunction, new Map());
          }
          this.resultsCache.get(evalFunction)?.set(example.id, result);

          // Update outcome tracking
          const outcome = this.outcomes.get(evalFunction);

          if (outcome) {
            if (result) {
              outcome.successes++;
            } else {
              outcome.failures++;
            }
            this.outcomes.set(evalFunction, outcome);
          }

          // Update the score if the function failed the example
          if (!result) {
            this.updateScore(example.id, evalFunction);
          }

          return {
            function: evalFunction,
            result,
            prompt: example.prompt,
            response: example.response,
          };
        } catch (error) {
          console.error("Error executing function on example:", error);
          // Handle error, possibly continue with the next execution
          // TODO: figure out good defaults for this
          return {
            function: evalFunction,
            result: false,
            prompt: example.prompt,
            response: example.response,
          };
        }
      });
    });

    // Flatten the array of arrays of promises and wait for all executions to complete
    await Promise.all(executionPromises.flat());
  }

  /**
   * Updates the grading prioritiy score for a given example based on the outcome of a synthesized evaluation function.
   * This method calculates the failure rate of a function and adjusts the example's score accordingly. Functions with higher failure rates will result in lower scores for the example.
   *
   * @param exampleId The unique ID of the example being scored.
   * @param functionString The string representation of the function used for evaluation. TODO: have better function IDs instead of passing in the code here.
   */
  private updateScore(exampleId: ExampleId, evalFunction: EvalFunction): void {
    const outcome = this.outcomes.get(evalFunction);
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

  /**
   * Filters out evaluation functions that are incorrect based on the grades provided by the developer.
   * TODO: Actually use an ILP solver to do this
   *
   * @param falseFailureRateThreshold The threshold for the failure rate of the selected evaluation functions. The returned function set will only contain functions with a combined false failure rate below this threshold.
   * @param failureCoverageThreshold The threshold for the coverage of the bad examples by the selected evaluation functions.
   *
   * @returns A filtered set of evaluation functions that have a combined false failure rate below the specified threshold and cover all evaluation criteria.
   */
  public async filterEvaluationFunctions(
    falseFailureRateThreshold: number,
    failureCoverageThreshold: number,
  ): Promise<EvalFunction[]> {
    const gradedExamples = this.examples.filter((example) =>
      this.grades.has(example.id),
    );
    let gradedResultMap: Map<ExampleId, Map<EvalFunction, boolean>> = new Map();

    // Iterate over graded examples and evaluation functions to fill the matrix
    for (const example of gradedExamples) {
      let row = new Map<EvalFunction, boolean>();
      for (const evalFunction of this.evalFunctions) {
        // Check if the result is in the cache
        if (this.resultsCache.has(evalFunction)) {
          const result = this.resultsCache.get(evalFunction)?.get(example.id);
          if (result !== undefined) {
            row.set(evalFunction, result);
            continue;
          }
        }

        // If not, execute the function and store the result in the cache
        const result = await executeFunction(evalFunction, example);
        row.set(evalFunction, result);
      }
      gradedResultMap.set(example.id, row);
    }

    let bestEvalFunctions: EvalFunction[] = [];

    // Iterate through each criteria
    // For each criteria, select the function with the highest accuracy rate
    for (const criteria of this.evalCriteria) {
      let bestFunction: EvalFunction | null = null;
      let bestAccuracy = 0;

      for (const evalFunction of this.evalFunctions) {
        // Calculate accuracy for this function based on the graded examples
        let successes = 0;
        let failures = 0;
        for (const example of gradedExamples) {
          const result = gradedResultMap.get(example.id)?.get(evalFunction);
          if (result !== undefined) {
            if (result) {
              successes++;
            } else {
              failures++;
            }
          } else {
            console.error("No result found for example and function:", example);
            failures++;
          }
        }

        // Calculate accuracy
        const accuracy = successes / (successes + failures);
        if (accuracy > bestAccuracy) {
          bestFunction = evalFunction;
          bestAccuracy = accuracy;
        }
      }

      // Save the best function for this criteria
      if (bestFunction) {
        bestEvalFunctions.push(bestFunction);
      }
    }

    return bestEvalFunctions;
  }
}
