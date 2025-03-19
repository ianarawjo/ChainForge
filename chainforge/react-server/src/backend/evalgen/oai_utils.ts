// import { env as process_env } from "process";
import { EventEmitter } from "events";
// import { AzureKeyCredential, OpenAIClient } from "@azure/openai";
import { llmResponseDataToString } from "../utils";
import { simpleQueryLLM } from "../backend";
import { Dict, LLMSpec } from "../typing";
import { extractMdBlocks } from "./utils";
type ContentType = "python_fn" | "llm_eval";

export class EvalGenAssertionEmitter extends EventEmitter {
  private apiKeys: Dict | undefined;

  constructor(apiKeys?: Dict) {
    super();
    this.apiKeys = apiKeys;
  }

  async generate(
    prompt: string,
    llm: string | LLMSpec,
    contentType: ContentType,
  ): Promise<void> {
    const emit_prompt = ((p: string) => this.emit("function", p)).bind(this);

    const result = await simpleQueryLLM(
      prompt, // prompt
      typeof llm === "string" ? llm : [llm], // llm
      // spec, // llm
      "You are an expert Python programmer and helping me write assertions for my LLM pipeline. An LLM pipeline accepts an example and prompt template, fills the template's placeholders with the example, and generates a response.", // system_msg
      this.apiKeys, // API keys (if any)
    );

    if (result.errors && Object.keys(result.errors).length > 0)
      throw new Error(Object.values(result.errors as Dict)[0].toString());

    // Get output (text from LLM response)
    const output = llmResponseDataToString(result.responses[0].responses[0]);
    console.log("Streamer: LLM said: ", output); // for debuggging

    // Attempt to extract output depending on content type
    if (contentType === "llm_eval") {
      // Expected output is a ``json block that is just a list of three strings representing the prompts i.e. ["str1", "str2", "str3"]
      // Attempt to extract JSON blocks (strings) from output
      const json_blocks = extractMdBlocks(output, "json");
      if (json_blocks === undefined || json_blocks.length === 0)
        throw new Error(
          "EvalGen: Could not parse LLM response into evaluation prompt: No JSON detected in output.",
        );

      // If we passed, this should be a list of strings:
      const prompts = json_blocks.flatMap((b) => JSON.parse(b));
      // Verify format:
      if (prompts.every((p) => typeof p === "string")) {
        // If these are all strings, we are good to go--
        // Emit all the LLM eval prompt candidates in one burst
        prompts.forEach(emit_prompt);
      } else {
        console.error(
          "Unexpected output type after JSON parsing: At least generated LLM eval prompt is not a string.",
          prompts,
        );
        throw new Error("Unexpected output type after JSON parsing");
      }
    } else if (contentType === "python_fn") {
      // Expected output has ~3 Python codeblocks within ```python markers
      // Attempt to extract code blocks from output
      const code_blocks = extractMdBlocks(output, "python");
      if (code_blocks === undefined || code_blocks.length === 0)
        throw new Error(
          "EvalGen: Could not parse LLM response into Python function: No code detected in output.",
        );

      // If we passed, this should be a list of Python code functions. We assume it is OK, and treat them separately:
      code_blocks.forEach(emit_prompt);
    } else {
      throw new Error("Unknown content type: " + contentType);
    }

    this.emit("end"); // Signal that streaming is complete
  }
}
