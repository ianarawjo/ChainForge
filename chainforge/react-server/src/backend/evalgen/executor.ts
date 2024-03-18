import {
  execPyFunc,
  executeLLMEval,
  generateFunctionsForCriteria,
} from "./utils";
import {
  EvalCriteria,
  EvalFunction,
  EvalFunctionResult,
  EvalFunctionReport,
  EvalFunctionSetReport,
} from "./typing";
import { StandardizedLLMResponse, ResponseUID, QueryProgress } from "../typing";
import { EventEmitter } from "events";

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
 *      promptTemplate, examples, evalCriteria);
 *
 *    // Optionally, you can call setEvalCriteria to set the evaluation criteria
 *    // after the executor has been initialized.
 *    executor.setEvalCriteria(evalCriteria);
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
export default class EvaluationFunctionExecutor {
  private scores: Map<ResponseUID, number>;
  // Cache function results for each example
  private resultsCache: Map<EvalFunction, Map<ResponseUID, EvalFunctionResult>>;
  private grades: Map<ResponseUID, boolean>; // Grades for all examples
  private lastPickedHighScore: boolean; // To alternate between highest and lowest scores when sampling examples to grade
  private examples: StandardizedLLMResponse[]; // The set of examples being evaluated and graded
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
    promptTemplate: string,
    examples: StandardizedLLMResponse[],
    evalCriteria: EvalCriteria[] = [],
  ) {
    this.resultsCache = new Map<
      EvalFunction,
      Map<ResponseUID, EvalFunctionResult>
    >();
    this.lastPickedHighScore = false; // Start off picking the highest score
    this.examples = examples;
    this.evalCriteria = evalCriteria;
    this.promptTemplate = promptTemplate;

    // Set scores and grades to default values of 0
    this.scores = new Map<ResponseUID, number>();

    // Set scores to 0 for each example id
    for (const example of examples) {
      this.scores.set(example.uid, 0);
    }

    this.grades = new Map<ResponseUID, boolean>();
    this.evalFunctions = [];
  }

  /**
   * Starts the background computation for generating and executing evaluation functions.
   * This method initiates the tasks but does not wait for them to complete.
   * This method should be called after the constructor.
   */
  public start(onProgress?: (progress: QueryProgress) => void): void {
    // Throw error if there is no eval criteria
    if (this.evalCriteria.length === 0) {
      throw new Error(
        "No evaluation criteria provided. Please provide at least one evaluation criterion.",
      );
    }

    // Throw error if bg task is already running
    if (this.backgroundTaskPromise) {
      throw new Error(
        "Background task for generating and executing evaluation functions is already running.",
      );
    }

    // Initiate the background task without awaiting its completion
    this.backgroundTaskPromise =
      this.generateAndExecuteEvaluationFunctions(onProgress);
  }

  /**
   * Allows the client to explicitly wait for the background tasks to complete if needed.
   */
  public async waitForCompletion(): Promise<void> {
    if (this.backgroundTaskPromise) {
      await this.backgroundTaskPromise;
      this.backgroundTaskPromise = null;
    }
  }

  /**
   * Whether the executor is currently running (.start() has been called and is not yet completed).
   */
  public isRunning(): boolean {
    return this.backgroundTaskPromise !== null;
  }

  /**
   * Generates and executes evaluation functions for a set of examples based on provided criteria.
   * This method is responsible for initializing the evaluation process and managing the asynchronous execution of functions.
   */
  public async generateAndExecuteEvaluationFunctions(
    onProgress?: (progress: QueryProgress) => void,
  ): Promise<void> {
    const emitter = new EventEmitter();
    const numCriteriaToProcess = this.evalCriteria.length;

    // Since we don't know how many implementations the LLM will suggest,
    // we must estimate it here so we can use this information to stream
    // "progress" updates back to the client:
    let funcsExecuted = 0;
    const estimatedFuncsToExecute =
      numCriteriaToProcess +
      this.evalCriteria.length * 5 * this.examples.length;

    let criteriaProcessed = 0; // Track the number of criteria processed
    let resolveAllFunctionsGenerated; // To be called when all functions are generated and executed
    const functionExecutionPromises: Promise<any>[] = []; // Track execution promises for function executions

    // This promise resolves when the 'allFunctionsGenerated' event is emitted
    const allFunctionsGeneratedPromise = new Promise<void>((resolve) => {
      resolveAllFunctionsGenerated = resolve;
    });

    // Listen for generated functions and execute them as they come in
    emitter.on("functionGenerated", (evalFunction) => {
      // Capture the execution promise of each function
      const executionPromise = (async () => {
        // Add the eval function to the list of functions
        this.evalFunctions.push(evalFunction);

        const executionPromises = this.examples.map(async (example) => {
          const funcToExecute =
            evalFunction.evalCriteria.eval_method === "code"
              ? execPyFunc
              : executeLLMEval;

          // Run the function on the example and if there's an error, increment skipped
          const result = await funcToExecute(evalFunction, example);

          funcsExecuted++;
          if (onProgress) {
            onProgress({
              success: (100 * funcsExecuted) / estimatedFuncsToExecute,
              error: 0,
            });
          }

          // Put result in cache
          if (!this.resultsCache.has(evalFunction)) {
            this.resultsCache.set(evalFunction, new Map());
          }
          this.resultsCache.get(evalFunction)?.set(example.uid, result);

          // Update the score if the result is false
          if (result === EvalFunctionResult.FAIL) {
            this.updateScore(example.uid, evalFunction);
          }

          // Put result in cache
          if (!this.resultsCache.has(evalFunction)) {
            this.resultsCache.set(evalFunction, new Map());
          }
          this.resultsCache.get(evalFunction)?.set(example.uid, result);
        });

        await Promise.all(executionPromises);
        // console.log(`Function ${evalFunction.name} executed on all examples.`);
      })();

      functionExecutionPromises.push(executionPromise);
    });

    // Generate functions for each criterion
    this.evalCriteria.forEach((criteria) => {
      console.log(criteria);
      generateFunctionsForCriteria(
        criteria,
        this.promptTemplate,
        this.examples[Math.floor(Math.random() * this.examples.length)],
        emitter, // Pass the EventEmitter instance
      ).then(() => {
        emitter.emit("criteriaProcessed");
      });
    });

    // Listen for a custom 'criteriaProcessed' event to track when each criterion's functions have been generated
    emitter.on("criteriaProcessed", () => {
      criteriaProcessed++;
      if (criteriaProcessed === this.evalCriteria.length) {
        // Ensure all function executions have completed before emitting 'allFunctionsGenerated'
        Promise.all(functionExecutionPromises).then(() => {
          console.log(
            "All evaluation functions have been generated and executed.",
          );
          if (resolveAllFunctionsGenerated) {
            resolveAllFunctionsGenerated(); // Resolve the promise when all functions have been generated and executed
          }
        });

        if (onProgress)
          onProgress({
            success: 100,
            error: 0,
          });
      }
    });

    // Wait for the 'allFunctionsGenerated' event, which now waits for all executions
    await allFunctionsGeneratedPromise;
  }

  /**
   * Updates the grading prioritiy score for a given example based on the outcome of a synthesized evaluation function.
   * This method calculates the failure rate of a function and adjusts the example's score accordingly. Functions with higher failure rates will result in lower scores for the example.
   *
   * @param exampleId The unique ID of the example being scored.
   * @param evalFunction The eval function used for evaluation.
   */
  private updateScore(
    exampleId: ResponseUID,
    evalFunction: EvalFunction,
  ): void {
    // const outcome = this.outcomes.get(evalFunction);

    // Get all the results for this function
    const results = this.resultsCache.get(evalFunction);

    if (results === undefined) {
      return;
    }

    // Compute pass rate
    const passed = Array.from(results.values()).filter(
      (result) => result === EvalFunctionResult.PASS,
    ).length;

    // Compute failure rate
    const failed = Array.from(results.values()).filter(
      (result) => result === EvalFunctionResult.FAIL,
    ).length;

    const passRate = passed / (passed + failed);

    const currentScore = this.scores.get(exampleId) || 0;
    this.scores.set(exampleId, currentScore + passRate);
  }

  /**
   * Retrieves the current response priority score for a given example.
   * This method allows clients to query the score of an example at any point during the evaluation process, for transparency and debugging purposes.
   *
   * @param exampleId The unique ID of the example whose score is being requested.
   * @returns The current response priority score of the example, if available.
   */
  public getScore(exampleId: ResponseUID): number | undefined {
    return this.scores.get(exampleId);
  }

  /**
   * Retrieves scores for all examples.
   * This method provides a snapshot of the current scores for all examples being evaluated.
   *
   * @returns A map of example IDs to their current scores.
   */
  public getAllScores(): Map<ResponseUID, number> {
    return new Map(this.scores);
  }

  /**
   * Retrieves the grades set by the developer for all examples.
   *
   * @returns A map of example IDs to their grades.
   */
  public getGrades(): Map<ResponseUID, boolean> {
    return new Map(this.grades);
  }

  /**
   * Sets a grade for an example based on external input from the developer.
   * This will be used for filtering out incorrect evaluation functions.
   *
   * @param exampleId The unique ID of the example being graded.
   * @param grade The developer-provided grade assigned to the example.
   */
  public setGradeForExample(exampleId: ResponseUID, grade: boolean): void {
    this.grades.set(exampleId, grade);
    console.log(this.grades);
  }

  /**
   * Set evaluation criteria for the executor.
   * This method allows the client to set the evaluation criteria after the executor has been initialized.
   */
  public setEvalCriteria(evalCriteria: EvalCriteria[]): void {
    this.evalCriteria = evalCriteria;
  }

  /**
   * Set examples for the executor.
   * This method allows the client to change the examples after the executor has been initialized.
   */
  public setExamples(examples: StandardizedLLMResponse[]): void {
    this.examples = examples;

    // Set scores to 0 for each example id
    for (const example of examples) {
      this.scores.set(example.uid, 0);
    }
  }

  /**
   * Gets a map of ungraded example ids and their scores, sorted by score.
   * @return A map of ungraded example ids and their scores, sorted by score.
   */
  public getUngradedScores(): Map<ResponseUID, number> {
    // Step 1: Convert the scores Map to an array and filter out graded examples
    const ungradedEntries = Array.from(this.scores.entries())
      .filter(([id]) => !this.grades.has(id))
      .map(([id, score]) => ({ id, score, rand: Math.random() })) // Add a random value for tie-breaking

      // Step 2: Sort the ungraded entries first by score, then randomly for tie-breaking
      .sort((a, b) => {
        if (a.score === b.score) {
          return a.rand - b.rand; // Tie-breaking by random value
        }
        return b.score - a.score; // Sort by score descending
      })

      // Step 3: Convert the sorted objects back into the format expected by the Map constructor
      .map(({ id, score }) => [id, score] as [ResponseUID, number]);

    // Step 4: Convert the array of key-value pairs back into a Map and return
    return new Map(ungradedEntries);
  }

  private getExampleForId(id: string) {
    const item = this.examples.filter((e) => e.uid === id);
    if (item.length === 1) return item[0];
    else if (item.length > 1) {
      console.error(
        "More than one example found with the same id. Ids must be unique. Returning the first, to not halt...",
      );
      return item[0];
    } else return null;
  }

  /**
   * Determines the next example to be graded, alternating between examples with the highest and lowest ungraded scores.
   * This method aims to balance attention across examples of varying difficulty or quality. Ideally, in grading, we get a sample of good and bad
   * responses.
   *
   * @param policy The policy to use for selecting the next example to grade. Currently, the only supported policies are "random" and "priority".
   *
   * @returns The unique ID of the next example to be graded, or null if all examples have been graded.
   */
  public getNextExampleToGrade(
    policy: "random" | "priority" = "priority",
  ): StandardizedLLMResponse | null {
    const ungraded = Array.from(this.getUngradedScores().keys());

    if (ungraded.length === 0) {
      return null; // No ungraded examples left
    }

    // If the policy is random, return a random ungraded example
    if (policy === "random") {
      return this.getExampleForId(
        ungraded[Math.floor(Math.random() * ungraded.length)],
      );
    }

    // Otherwise whether to pick the highest or lowest ungraded score
    const pickIndex = this.lastPickedHighScore ? ungraded.length - 1 : 0;
    this.lastPickedHighScore = !this.lastPickedHighScore; // Alternate for next time

    return this.getExampleForId(ungraded[pickIndex]);
  }

  /**
   * Filters out evaluation functions that are incorrect based on the grades provided by the developer.
   * TODO: Actually use an ILP solver to do this
   *
   * @param falseFailureRateThreshold The threshold for the failure rate of each selected evaluation functions. The returned function set will only contain functions with a false failure rate below this threshold.
   *
   * @returns A filtered set of evaluation functions that each have a false failure rate below the specified threshold and cover as much evaluation criteria as possible.
   */
  public async filterEvaluationFunctions(
    falseFailureRateThreshold: number,
  ): Promise<EvalFunctionSetReport> {
    const gradedExamples = this.examples.filter((example) =>
      this.grades.has(example.uid),
    );
    const gradedResultMap: Map<
      ResponseUID,
      Map<EvalFunction, EvalFunctionResult>
    > = new Map();

    // Iterate over graded examples and evaluation functions to fill the matrix
    for (const example of gradedExamples) {
      const row = new Map<EvalFunction, EvalFunctionResult>();
      for (const evalFunction of this.evalFunctions) {
        // Check if the result is in the cache
        if (this.resultsCache.has(evalFunction)) {
          const result = this.resultsCache.get(evalFunction)?.get(example.uid);
          if (result !== undefined) {
            row.set(evalFunction, result);
            continue;
          }
        }

        // If not, execute the function and store the result in the cache
        const funcToExecute =
          evalFunction.evalCriteria.eval_method === "code"
            ? execPyFunc
            : executeLLMEval;
        const result = await funcToExecute(evalFunction, example);

        // Put result in cache
        if (!this.resultsCache.has(evalFunction)) {
          this.resultsCache.set(evalFunction, new Map());
        }
        this.resultsCache.get(evalFunction)?.set(example.uid, result);

        row.set(evalFunction, result);
      }
      gradedResultMap.set(example.uid, row);
    }

    const numFailGrades = gradedExamples.filter(
      (example) => !this.grades.get(example.uid),
    ).length;
    const bestEvalFunctions: EvalFunction[] = [];
    const evalFunctionReport: Map<EvalCriteria, EvalFunctionReport[]> =
      new Map();
    const coveredFailures = new Set<ResponseUID>();

    // Iterate through each criteria
    // For each criteria, select the function with the highest accuracy rate
    for (const criteria of this.evalCriteria) {
      let bestFunction: EvalFunction | null = null;
      let bestCoverage = 0;

      for (const evalFunction of this.evalFunctions) {
        // Skip functions that don't match the criteria
        if (evalFunction.evalCriteria.criteria !== criteria.criteria) {
          continue;
        }

        // Create a report for this function
        const report: EvalFunctionReport = {
          evalFunction,
          true_pass: 0,
          true_fail: 0,
          false_pass: 0,
          false_fail: 0,
          skipped: 0,
        };

        // Calculate accuracy for this function based on the graded examples
        for (const example of gradedExamples) {
          const result = gradedResultMap.get(example.uid)?.get(evalFunction);
          const grade = this.grades.get(example.uid)
            ? EvalFunctionResult.PASS
            : EvalFunctionResult.FAIL;

          if (result !== undefined) {
            // Handle true positives and true negatives
            if (result === grade) {
              if (result === EvalFunctionResult.PASS) {
                report.true_pass++;
              } else if (result === EvalFunctionResult.FAIL) {
                report.true_fail++;
              }
            } else {
              if (result === EvalFunctionResult.PASS) {
                report.false_pass++;
              } else if (result === EvalFunctionResult.FAIL) {
                report.false_fail++;
              } else {
                report.skipped++;
              }
            }
          }

          // If the example failed and is covered, add it to the set of covered failures
          if (result === EvalFunctionResult.FAIL && result === grade) {
            coveredFailures.add(example.uid);
          }
        }

        // Save the report for this function
        if (!evalFunctionReport.has(criteria)) {
          evalFunctionReport.set(criteria, []);
        }
        evalFunctionReport.get(criteria)?.push(report);

        // TODO: Revisit this choice
        // IF false failure rate is above the threshold, skip this function
        // const falseFailureRate =
        //   report.false_fail / (report.false_fail + report.true_pass);
        // if (falseFailureRate > falseFailureRateThreshold) {
        //   continue;
        // }

        // Calculate coverage
        // NOTE: If there are no resps graded as failing, then technically coverage is 100%; this will pick the first function generated.
        const failureCoverage =
          numFailGrades > 0 ? report.true_fail / numFailGrades : 1.0;

        if (failureCoverage >= bestCoverage) {
          bestFunction = evalFunction;
          bestCoverage = failureCoverage;
        }
      }

      // Save the best function for this criteria
      if (bestFunction) {
        bestEvalFunctions.push(bestFunction);
      }
    }

    // Print out failure coverage
    const numFailures = gradedExamples.filter(
      (example) => !this.grades.get(example.uid),
    ).length;
    const coverage = coveredFailures.size / numFailures;
    console.log(`Failure coverage: ${coverage}`);

    // Print out missed failures
    const missedFailures = gradedExamples.filter(
      (example) =>
        !this.grades.get(example.uid) && !coveredFailures.has(example.uid),
    );
    if (missedFailures.length > 0) {
      console.log(`Missed failures: ${missedFailures}`);
    }

    // Create report of coverage, missed failures, selected functions, and all eval function reports
    const report = {
      failureCoverage: coverage,
      missedFailures,
      selectedEvalFunctions: bestEvalFunctions,
      allEvalFunctionReports: evalFunctionReport,
    };

    return report;
  }

  /**
   * Retrieves the current outcomes of the evaluation functions.
   * This method provides a snapshot of the current outcomes of the evaluation functions.
   *
   * @returns A map of evaluation functions to their current outcomes.
   */
  public getOutcomes(): Map<
    EvalFunction,
    { passed: number; failed: number; skipped: number }
  > {
    // Compute based on the results cache
    const outcomes = new Map<
      EvalFunction,
      { passed: number; failed: number; skipped: number }
    >();

    for (const [evalFunction, results] of this.resultsCache) {
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      for (const result of results.values()) {
        if (result === EvalFunctionResult.PASS) {
          passed++;
        } else if (result === EvalFunctionResult.FAIL) {
          failed++;
        } else {
          skipped++;
        }
      }

      outcomes.set(evalFunction, { passed, failed, skipped });
    }

    return outcomes;
  }
}
