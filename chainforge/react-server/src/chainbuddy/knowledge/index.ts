/**
 * The model's instructions, bundled as text. Node guides are imported by
 * their NodeKinds (see nodes/).
 */

import instructions from "./instructions.md";
import review from "./review.md";

/** What the model is told at the start of every conversation. */
export const INSTRUCTIONS = instructions;

/** What the model checking a proposal before the user sees it is told. */
export const REVIEW_INSTRUCTIONS = review;
