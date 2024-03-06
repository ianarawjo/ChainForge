// import fs from "fs";
// import csvParser from "csv-parser";
// import readline from "readline";

// import { Example, EvalCriteria, generateLLMEvaluationCriteria } from "./utils";
// import EvaluationFunctionExecutor from "./executor";

// const readCSV = async (filePath: string): Promise<Example[]> => {
//   const examples: Example[] = [];
//   let counter = 0; // Counter to generate unique IDs

//   return new Promise((resolve, reject) => {
//     fs.createReadStream(filePath)
//       .pipe(csvParser(["prompt", "example", "response", "model"]))
//       .on("data", (data) => {
//         try {
//           examples.push({
//             id: `example_${++counter}`, // Generating a unique ID
//             variables: data.example,
//             prompt: data.prompt,
//             response: data.response,
//           });
//         } catch (error) {
//           // console.error("Error parsing variables from CSV:", error);
//           // Don't throw here, just skip the example
//         }
//       })
//       .on("end", () => resolve(examples))
//       .on("error", reject);
//   });
// };

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// const askQuestion = (query: string): Promise<string> =>
//   new Promise((resolve) => rl.question(query, resolve));

// const main = async () => {
//   // Placeholder values - replace with actual data
//   const promptTemplate = `You are an AI Assistant that’s an expert at reviewing pull requests. Review the below pull request that you receive.

//   Input format
//   - The input format follows Github diff format with addition and subtraction of code.
//   - The + sign means that code has been added.
//   - The - sign means that code has been removed.

//   Instructions
//   - Take into account that you don’t have access to the full code but only the code diff.
//   - Only answer on what can be improved and provide the improvement in code.
//   - Answer in short form.
//   - Include code snippets if necessary.
//   - Adhere to the languages code conventions.
//   - Make it personal and always show gratitude to the author using "@" when tagging.`;

//   let examples: Example[] = await readCSV("./codereviews.csv");

//   // Get a sample of 10 examples
//   examples = examples.slice(0, 10);

//   // Print number of examples
//   console.log(`Loaded ${examples.length} examples.`);

//   // Start a timer
//   let start = Date.now();
//   let timeElapsed = 0;

//   // Step 1: Suggest eval criteria and solicit approval
//   const evalCriteria = await generateLLMEvaluationCriteria(promptTemplate);
//   // Pause the timer
//   timeElapsed += Date.now() - start;

//   const approval = await askQuestion(
//     "Do you approve the suggested criteria? (y/n) ",
//   );

//   if (approval.toLowerCase() !== "y") {
//     console.log(
//       "Please adjust the criteria directly in the source code for now.",
//     );
//     return;
//   }

//   const executor = new EvaluationFunctionExecutor(
//     promptTemplate,
//     examples,
//   );

//   // Set the evaluation criteria
//   executor.setEvaluationCriteria(evalCriteria);

//   // Resume the timer
//   start = Date.now();

//   // Step 2: Start background task
//   executor.start();

//   //   await executor.waitForCompletion();

//   //   Step 3: Present examples to grade
//   while (true) {
//     // Get ungraded scores
//     const ungradedScores = executor.getUngradedScores();
//     console.log("Ungraded Scores: ", ungradedScores);

//     const nextExampleId = executor.getNextExampleToGrade();
//     if (!nextExampleId) {
//       console.log("All examples graded or no examples available.");
//       break;
//     }

//     const example = examples.find((e) => e.id === nextExampleId);
//     if (!example) continue;

//     console.log(
//       `Example ID: ${example.id}, Prompt: ${example.prompt}, Response: ${example.response}`,
//     );
//     const grade = await askQuestion(
//       "Is this response acceptable? (y/n/finish) ",
//     );

//     if (grade === "finish") {
//       break;
//     }

//     executor.setGradeForExample(example.id, grade.toLowerCase() === "y");
//   }

//   // Print grades
//   console.log("Grades: ", executor.getGrades());

//   // Step 4: Filtering and results
//   //   await executor.waitForCompletion();
//   const filteredFunctions = await executor.filterEvaluationFunctions(0.2);
//   console.log("Filtered Functions: ", filteredFunctions);

//   rl.close();
// };

// main().catch(console.error);
