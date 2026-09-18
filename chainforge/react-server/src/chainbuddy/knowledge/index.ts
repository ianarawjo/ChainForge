/**
 * The knowledge files, bundled as text. Add a node's file here when its
 * support is added to flowApi/nodeSpecs.ts.
 */

import instructions from "./instructions.md";
import evaluator from "./nodes/evaluator.md";
import prompt from "./nodes/prompt.md";
import textfields from "./nodes/textfields.md";

/** What the model is told at the start of every conversation. */
export const INSTRUCTIONS = instructions;

/** Node type → its guide, as describe_node returns it. */
export const NODE_DOCS: Record<string, string> = {
  prompt,
  textfields,
  evaluator,
};
