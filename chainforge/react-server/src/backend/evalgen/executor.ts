import {
  calculateCohensKappa,
  calculateF1Score,
  calculateMCC,
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
  EvalCriteriaUID,
} from "./typing";
import {
  LLMResponse,
  ResponseUID,
  QueryProgress,
  Dict,
  LLMSpec,
} from "../typing";
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
  private llms: { small: string | LLMSpec; large: string | LLMSpec };
  private apiKeys: Dict;
  private grades: Map<ResponseUID, boolean>; // Grades for all examples
  private perCriteriaGrades: Dict<Dict<boolean | undefined>>; // Grades per criteria
  private annotations: Dict<string>; // Annotations for each response
  private lastPickedHighScore: boolean; // To alternate between highest and lowest scores when sampling examples to grade
  private examples: LLMResponse[]; // The set of examples being evaluated and graded
  private evalCriteria: EvalCriteria[]; // The criteria used to generate evaluation functions
  private evalFunctions: EvalFunction[]; // The set of evaluation functions generated for the developer's LLM chain
  private promptTemplate: string; // The prompt template for the developer's LLM chain
  private backgroundTaskPromise: Promise<void> | null = null; // To keep track of the background task for generating and executing evaluation functions
  private criteriaQueue: EvalCriteria[] = []; // Queue for new criteria to be processed
  private processing = false; // To keep track of whether we are currently processing a criteria
  private updateNumLLMCalls: (
    numStrongModelCalls: number,
    numWeakModelCalls: number,
  ) => void;

  private logFunction: (logMessage: string) => void;

  /**
   * Initializes a new instance of the EvaluationFunctionExecutor class.
   *
   * @param evalCriteria The criteria used to generate evaluation functions. Provided/confirmed by the developer.
   * @param promptTemplate The prompt template for the developer's LLM chain. This is useful for the LLM to generate correct evaluation functions.
   * @param examples A set of variable-prompt-response triples that we want the developer to grade (and use for filtering incorrect evaluation functions).
   * @param existingGrades Optional. A dict in format {uid: grade}, containing existing grades.
   */
  constructor(
    genAIModels: { small: string | LLMSpec; large: string | LLMSpec },
    apiKeys: Dict,
    promptTemplate: string,
    examples: LLMResponse[],
    evalCriteria: EvalCriteria[] = [],
    updateNumLLMCalls: (
      numStrongModelCalls: number,
      numWeakModelCalls: number,
    ) => void,
    addLog: (log: string) => void,
    existingGrades?: Record<ResponseUID, boolean>,
    existingPerCriteriaGrades?: Dict<Dict<boolean | undefined>>,
    annotations?: Dict<string>,
  ) {
    console.log(evalCriteria);

    this.resultsCache = new Map<
      EvalFunction,
      Map<ResponseUID, EvalFunctionResult>
    >();
    this.lastPickedHighScore = false; // Start off picking the highest score
    this.examples = examples;
    this.evalCriteria = evalCriteria;
    this.promptTemplate = promptTemplate;
    this.llms = genAIModels;
    this.apiKeys = apiKeys;

    // Set scores and grades to default values of 0
    this.scores = new Map<ResponseUID, number>();

    // Set scores to 0 for each example id
    for (const example of examples) {
      this.scores.set(example.uid, 0);
    }

    this.grades = new Map<ResponseUID, boolean>();
    this.perCriteriaGrades = {};
    this.evalFunctions = [];
    this.annotations = {};

    // Pass in any existing grades
    if (existingGrades) {
      Object.entries(existingGrades).forEach(([uid, grade]) => {
        this.grades.set(uid, grade);
      });
    }

    // Pass in any existing per-criteria grades
    if (existingPerCriteriaGrades) {
      this.perCriteriaGrades = existingPerCriteriaGrades;
    }

    if (annotations) {
      this.annotations = annotations;
    }

    this.criteriaQueue = [];
    this.processing = false;

    this.updateNumLLMCalls = updateNumLLMCalls;
    this.logFunction = addLog;
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
      const promise = this.backgroundTaskPromise;
      this.backgroundTaskPromise = null;
      await promise;
    }
  }

  /**
   * Whether the executor is currently running (.start() has been called and is not yet completed).
   */
  public isRunning(): boolean {
    return this.backgroundTaskPromise !== null;
  }

  private async generateAndExecuteFunctionsForCriteria(
    criteria: EvalCriteria,
    onProgress?: (progress: QueryProgress) => void,
  ): Promise<void> {
    const emitter = new EventEmitter();
    const functionExecutionPromises: Promise<any>[] = [];

    emitter.on("functionGenerated", (evalFunction) => {
      this.logFunction(
        `Generated a new ${evalFunction.evalCriteria.eval_method === "code" ? "code-based" : "LLM-based"} validator for criteria: ${evalFunction.evalCriteria.shortname}${evalFunction.evalCriteria.eval_method === "expert" ? `, with prompt: ${evalFunction.name}` : ""}. Executing it on ${this.examples.length} examples.`,
      );

      const executionPromise = (async () => {
        this.evalFunctions.push(evalFunction);
        const executionPromises = this.examples.map(async (example) => {
          // Get random positive and negative examples for this criteria using the perCriteriaGrades
          const criteriaId = criteria.uid;
          const randomPositiveExample = this.examples.find(
            (example) =>
              this.perCriteriaGrades[criteriaId]?.[example.uid] === true,
          );
          const randomNegativeExample = this.examples.find(
            (example) =>
              this.perCriteriaGrades[criteriaId]?.[example.uid] === false,
          );

          const funcToExecute =
            evalFunction.evalCriteria.eval_method === "code"
              ? execPyFunc
              : executeLLMEval;

          // Run the function on the example and if there's an error, increment skipped
          const result = await funcToExecute(
            evalFunction,
            this.llms.small,
            example,
            randomPositiveExample,
            randomNegativeExample,
          );

          // Update weak model call count by 1 if the eval method is expert
          if (evalFunction.evalCriteria.eval_method === "expert") {
            this.updateNumLLMCalls(0, 1);
          }

          if (onProgress) {
            onProgress({
              success:
                (100 * functionExecutionPromises.length) /
                this.criteriaQueue.length,
              error: 0,
            });
          }

          if (!this.resultsCache.has(evalFunction)) {
            this.resultsCache.set(evalFunction, new Map());
          }
          this.resultsCache.get(evalFunction)?.set(example.uid, result);

          if (result === EvalFunctionResult.FAIL) {
            this.updateScore(example.uid, evalFunction);
          }
        });

        await Promise.all(executionPromises);
      })();

      functionExecutionPromises.push(executionPromise);
    });

    const badExample = this.examples.find(
      (example) =>
        this.perCriteriaGrades[criteria.uid]?.[example.uid] === false,
    );

    await generateFunctionsForCriteria(
      criteria,
      this.llms.large,
      this.promptTemplate,
      this.examples[Math.floor(Math.random() * this.examples.length)],
      emitter,
      badExample,
      this.apiKeys,
    );

    // Update LLM call count by 1
    this.updateNumLLMCalls(1, 0);

    console.log(`Generated functions for criteria: ${criteria.shortname}`);
    console.log(
      `Number of functions generated: ${functionExecutionPromises.length}`,
    );
    this.logFunction(
      `Generated ${functionExecutionPromises.length} functions for criteria: ${criteria.shortname}`,
    );

    await Promise.all(functionExecutionPromises);
  }

  /**
   * Generates and executes evaluation functions for a set of examples based on provided criteria.
   * This method is responsible for initializing the evaluation process and managing the asynchronous execution of functions.
   */
  public async generateAndExecuteEvaluationFunctions(
    onProgress?: (progress: QueryProgress) => void,
  ): Promise<void> {
    // Enter a continuous monitoring loop for new criteria
    while (this.backgroundTaskPromise !== null) {
      // Check if there are any criteria in the queue to process
      if (this.criteriaQueue.length > 0 && !this.processing) {
        // Pop a criteria off the queue and process it
        // TODO: use worker pool to parallelize this
        await this.processNextCriteria();
      }

      // Sleep for a short time before checking again (prevents CPU hogging)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /**
   * Updates the set of evaluation criteria and triggers the generation and execution of evaluation functions for any new criteria.
   * This method allows the client to add new evaluation criteria after the executor has been initialized.
   * The new criteria will be processed in parallel with the existing criteria.
   * The method returns immediately, allowing the client to continue with other tasks.
   *
   * @param criteria The new state of the evaluation criteria list.
   */
  public updateCriteria(criteriaList: EvalCriteria[]): void {
    // See if there are criteria to remove
    this.evalCriteria = this.evalCriteria.filter(
      (c) => !criteriaList.includes(c),
    );

    // See if there are new criteria to add
    for (const criteria of criteriaList) {
      if (this.evalCriteria.includes(criteria)) {
        // criteria already included
        continue;
      }

      console.log(`Adding new criteria: ${criteria.shortname}`);
      this.criteriaQueue.push(criteria);
      this.evalCriteria.push(criteria);

      // Start the generation and execution of functions for the new criteria
      if (!this.processing) {
        this.processNextCriteria();
      }
    }
  }

  private async processNextCriteria() {
    this.processing = true;
    while (this.criteriaQueue.length > 0) {
      const criteria = this.criteriaQueue.shift();
      if (criteria) {
        // Log the processing of new criteria
        this.logFunction(`Processing new criteria: ${criteria.shortname}`);
        await this.generateAndExecuteFunctionsForCriteria(criteria);
      }
    }
    this.processing = false;
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

  public estimateNumGPTCalls(perCriteriaGrades: Dict<boolean>): {
    numGPT4Calls: number;
    numGPT35Calls: number;
  } {
    let numGPT4Calls = 0;
    let numLLMCriteria = 0;
    for (const criteriaId in perCriteriaGrades) {
      const currGrade = perCriteriaGrades[criteriaId];
      const numGradedAsCurrGrade = this.examples.filter(
        (example) =>
          this.perCriteriaGrades[example.uid] &&
          this.perCriteriaGrades[example.uid][criteriaId] === currGrade,
      ).length;
      if (Math.random() <= 1 / (numGradedAsCurrGrade + 1)) {
        numGPT4Calls += 1;
        const criteria = this.evalCriteria.find(
          (criteria) => criteria.uid === criteriaId,
        );
        if (criteria && criteria.eval_method === "expert") {
          numLLMCriteria += 1;
        }
      }
    }

    return {
      numGPT4Calls,
      numGPT35Calls: numLLMCriteria * 3 * this.examples.length,
    };
  }

  /**
   * Sets a grade for an example based on external input from the developer.
   * This will be used for filtering out incorrect evaluation functions.
   * If the developer does not provide a holistic grade, the executor will infer it from the perCriteriaGrades.
   * With some probability, generate new implementations for the criteria in perCriteriaGrades.
   *
   * @param exampleId The unique ID of the example being graded.
   * @param holisticGrade The developer-provided grade assigned to the example, "good" or "bad" or unknown.
   */
  public setGradeForExample(
    exampleId: ResponseUID,
    perCriteriaGrades?: Dict<boolean | undefined>,
    holisticGrade?: string,
    annotation?: string,
  ): void {
    if (holisticGrade !== null) {
      const boolHolistic = holisticGrade === "good";
      this.grades.set(exampleId, boolHolistic);
    }

    if (perCriteriaGrades) {
      this.perCriteriaGrades[exampleId] = perCriteriaGrades;

      // If holisticGrade was null, set it based on the perCriteriaGrades---if all criteria in the perCriteriaGrades are true, set the holisticGrade to true, else false
      if (holisticGrade === null) {
        const allTrue = Object.values(perCriteriaGrades).every(
          (value) => value === true,
        );
        this.grades.set(exampleId, allTrue);
      }
    }

    if (annotation) {
      this.annotations[exampleId] = annotation;
    }

    let numCriteriaWithNewImplementations = 0;

    // Trigger generateNewImplementationsForCriteria for each criteria in perCriteriaGrades
    for (const criteriaId in perCriteriaGrades) {
      const currGrade = perCriteriaGrades[criteriaId];
      // With probability 1 / # graded examples for this criteria with currGrade, generate new implementations
      const numGradedAsCurrGrade = this.examples.filter(
        (example) =>
          this.perCriteriaGrades[example.uid] &&
          this.perCriteriaGrades[example.uid][criteriaId] === currGrade,
      ).length;

      if (Math.random() <= 1 / (numGradedAsCurrGrade + 1)) {
        console.log(
          `Generating new implementations for criteria: ${criteriaId}`,
        );
        const evalCriteria = this.evalCriteria.find(
          (criteria) => criteria.uid === criteriaId,
        );
        if (evalCriteria) {
          this.criteriaQueue.push(evalCriteria);
          if (!this.processing) {
            this.processNextCriteria();
          }
          numCriteriaWithNewImplementations++;
        } else {
          console.error(`Evaluation criteria with ID ${criteriaId} not found.`);
        }
      }
    }

    console.log(
      `Generated new implementations for ${numCriteriaWithNewImplementations} criteria.`,
    );
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
  public setExamples(examples: LLMResponse[]): void {
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
  ): LLMResponse | null {
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
   * Given an eval function and the results of that function against the examples (LLM responses),
   * computes the alignment statistics between the eval function and the user grades.
   * @param evalFunc
   * @returns A Report, assuming the the function has been executed over some examples and the user has provided grades for those examples. If there's not enough data, returns undefined.
   */
  public computeAlignmentStats(
    evalFunc: EvalFunction,
  ): EvalFunctionReport | undefined {
    // Get the eval function results from the cache
    const results = this.resultsCache.get(evalFunc);
    if (results === undefined) {
      console.warn(
        "No cache results found for this eval function. First ensure that the function has been executed over some examples.",
      );
      return undefined;
    }

    // Get a reference to the perCriteria grades for this eval function
    const criteriaId = evalFunc.evalCriteria.uid;
    if (!(criteriaId in this.perCriteriaGrades)) {
      console.warn(
        "No user grades found for this eval criteria. You must first grade some examples against this criteria (thumbs up/down) before we can compute alignment.",
      );
      return undefined;
    }
    // The perCriteriaGrades is a map of ResponseUID to boolean (user grade true/false)
    // or undefined (no user grade for that example).
    const userGradedExamples = this.perCriteriaGrades[criteriaId];

    // Now `evalFuncResults` is a Map<ResponseUID, EvalFunctionResult>.
    // We can compute the alignment stats across all examples.
    // First, create a report for this function
    const report: EvalFunctionReport = {
      evalFunction: evalFunc,
      true_pass: 0,
      true_fail: 0,
      false_pass: 0,
      false_fail: 0,
      skipped: 0,
    };

    // Calculate alignment for this function based on the graded examples
    Object.entries(userGradedExamples).forEach(([exampleId, grade]) => {
      if (grade === undefined) return; // Skip if user provides no grade for this example
      const result = results.get(exampleId);
      const userGrade = grade
        ? EvalFunctionResult.PASS
        : EvalFunctionResult.FAIL;

      if (result !== undefined) {
        // Handle true positives and true negatives
        if (result === userGrade) {
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
    });

    // Calculate alignment in different ways
    // NOTE: If a denominator during the calculate is 0, this will set the score to undefined.
    report.f1 = calculateF1Score(
      report.true_pass,
      report.false_pass,
      report.false_fail,
    );
    report.mcc = calculateMCC(
      report.true_pass,
      report.true_fail,
      report.false_pass,
      report.false_fail,
    );
    report.cohens_kappa = calculateCohensKappa(
      report.true_pass,
      report.true_fail,
      report.false_pass,
      report.false_fail,
    );

    // Calculate failure coverage
    const failureCoverage =
      report.true_fail + report.false_pass > 0
        ? report.true_fail / (report.true_fail + report.false_pass)
        : 0.0; // 0.0 if there are no failures to detect

    // Calculate false failure rate
    const falseFailureRate =
      report.true_pass + report.false_fail > 0
        ? report.false_fail / (report.true_pass + report.false_fail)
        : 0.0; // Default to 0.0 if there are no examples that could trigger false failures

    report.failureCoverage = failureCoverage;
    report.falseFailureRate = falseFailureRate;

    return report;
  }

  /**
   * Filters out evaluation functions that are incorrect based on the grades provided by the developer.
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
        const result = await funcToExecute(
          evalFunction,
          this.llms.small,
          example,
        );

        // Put result in cache
        if (!this.resultsCache.has(evalFunction)) {
          this.resultsCache.set(evalFunction, new Map());
        }
        this.resultsCache.get(evalFunction)?.set(example.uid, result);

        row.set(evalFunction, result);
      }
      gradedResultMap.set(example.uid, row);
    }

    const bestEvalFunctions: EvalFunction[] = [];
    const evalFunctionReport: Map<EvalCriteria, EvalFunctionReport[]> =
      new Map();

    // Iterate through each criteria
    // For each criteria, select the function with the highest alignment rate
    for (const criteria of this.evalCriteria) {
      const scoredFunctions = [];

      for (const evalFunction of this.evalFunctions) {
        // Skip functions that don't match the criteria
        if (evalFunction.evalCriteria !== criteria) {
          continue;
        }

        // Create a report for this function
        const report: EvalFunctionReport | undefined =
          this.computeAlignmentStats(evalFunction);

        // Save the report for this function
        if (!evalFunctionReport.has(criteria)) {
          evalFunctionReport.set(criteria, []);
        }
        evalFunctionReport.get(criteria)?.push(report);
        console.log(report);

        scoredFunctions.push({
          evalFunction,
          report,
        });
      }

      // Sort the functions by "alignment"
      // Here, we are using MCC as the alignment metric, where higher is better.
      scoredFunctions.sort((a, b) => {
        const a_mcc = a.report?.mcc ?? -1; // If undefined, set to -1, which is lowest possible.
        const b_mcc = b.report?.mcc ?? -1;
        if (a_mcc === b_mcc) {
          // If MCC is the same or not present, sort by false failure rate
          return (
            (a.report?.falseFailureRate ?? 0) -
            (b.report?.falseFailureRate ?? 0)
          );
        }
        return b_mcc - a_mcc; // Sort by MCC descending
      });

      // // See if we can filter out functions with ffr > threshold
      // const funcsBelowThreshold = scoredFunctions.filter(
      //   (func) => func.report?.falseFailureRate !== undefined && func.report?.falseFailureRate <= falseFailureRateThreshold,
      // );

      // // Save the best function for this criteria
      // // Maximize failure coverage and minimize false failure rate
      // funcsBelowThreshold.sort((a, b) => {
      //   if (a.report?.failureCoverage === b.report?.failureCoverage) {
      //     return a.report?.falseFailureRate - b.report?.falseFailureRate;
      //   }
      //   return b.failureCoverage - a.failureCoverage;
      // });

      if (scoredFunctions.length > 0) {
        // The top result is the 'best' / most aligned function
        bestEvalFunctions.push(scoredFunctions[0].evalFunction);
      }
    }

    const [coverage, falseFailureRate] = this.getSelectedFunctionAlignment(
      bestEvalFunctions,
      gradedResultMap,
      gradedExamples,
    );

    // Create report of coverage, missed failures, selected functions, and all eval function reports
    const report = {
      failureCoverage: coverage,
      falseFailureRate,
      selectedEvalFunctions: bestEvalFunctions,
      allEvalFunctionReports: evalFunctionReport,
    };

    return report;
  }

  private getSelectedFunctionAlignment(
    selectedEvalFunctions: EvalFunction[],
    gradedResultMap: Map<ResponseUID, Map<EvalFunction, EvalFunctionResult>>,
    gradedExamples: LLMResponse[],
  ) {
    // Of the selected functions, calculate the coverage of failures and false failure rate
    let truePass = 0;
    const coveredFailures = new Set<ResponseUID>();
    const falseFailures = new Set<ResponseUID>();

    for (const example of gradedExamples) {
      let systemPass = true;

      for (const evalFunction of selectedEvalFunctions) {
        const result = gradedResultMap.get(example.uid)?.get(evalFunction);
        if (
          result === EvalFunctionResult.FAIL &&
          !this.grades.get(example.uid)
        ) {
          coveredFailures.add(example.uid);
          systemPass = false;
        }

        if (
          result === EvalFunctionResult.FAIL &&
          this.grades.get(example.uid)
        ) {
          systemPass = false;
          falseFailures.add(example.uid);
        }
      }

      if (systemPass) {
        if (this.grades.get(example.uid)) {
          truePass++;
        }
      }
    }

    // Print out failure coverage
    const numFailures = gradedExamples.filter(
      (example) => !this.grades.get(example.uid),
    ).length;
    const coverage = (coveredFailures.size / numFailures) * 100;
    const falseFailureRate =
      (falseFailures.size / (truePass + falseFailures.size)) * 100;
    console.log(`Failure coverage: ${coverage}`);
    console.log(`False failure rate: ${falseFailureRate}`);

    // Print out missed failures
    // const missedFailures = gradedExamples.filter(
    //   (example) =>
    //     !this.grades.get(example.uid) && !coveredFailures.has(example.uid),
    // );
    // if (missedFailures.length > 0) {
    //   console.log(`Missed failures: ${missedFailures}`);
    // }

    return [coverage, falseFailureRate];
  }

  public async recomputeAlignment(
    selectedEvalCriteria: EvalCriteria[],
    oldReport: EvalFunctionSetReport,
  ): Promise<EvalFunctionSetReport> {
    // Recompute alignment based on the selected functions
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
        const result = await funcToExecute(
          evalFunction,
          this.llms.small,
          example,
        );

        // Put result in cache
        if (!this.resultsCache.has(evalFunction)) {
          this.resultsCache.set(evalFunction, new Map());
        }
        this.resultsCache.get(evalFunction)?.set(example.uid, result);

        row.set(evalFunction, result);
      }
      gradedResultMap.set(example.uid, row);
    }

    // Filter out functions that don't match the selected criteria
    const selectedEvalFunctions = oldReport.selectedEvalFunctions.filter(
      (evalFunction) =>
        selectedEvalCriteria.includes(evalFunction.evalCriteria),
    );

    const [coverage, falseFailureRate] = this.getSelectedFunctionAlignment(
      selectedEvalFunctions,
      gradedResultMap,
      gradedExamples,
    );

    // Create report of coverage, missed failures, selected functions, and all eval function reports
    const report = {
      failureCoverage: coverage,
      falseFailureRate,
      selectedEvalFunctions: oldReport.selectedEvalFunctions,
      allEvalFunctionReports: oldReport.allEvalFunctionReports,
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
