/**
 * A second look at each proposal before the user sees it. The Flow API
 * decides when a proposal is reviewed and what happens with the problems
 * found (see propose_changes in tools.ts); a Reviewer, which knows nothing
 * of the canvas, does the looking (see runtime/reviewer.ts).
 */

import { ChangeSet, FlowView } from "./types";

export interface ReviewInput {
  /** What the user asked for, in their messages so far. */
  request: string;
  /** The flow as it is now. */
  flow: FlowView;
  /** The proposal, already checked by code. */
  changeSet: ChangeSet;
  /** The guide for each node type the proposal touches, by type. */
  guides: Record<string, string>;
}

/**
 * Problems with a proposal, as sentences the proposing model can act on; none
 * if it's fine. Rejects if the review couldn't be done.
 */
export type Reviewer = (
  input: ReviewInput,
  signal?: AbortSignal,
) => Promise<string[]>;

/** What the review found, as the proposal card shows it. */
export interface ProposalReview {
  /** Problems a first review found, which the proposal was revised for. */
  fixed: string[];
  /** Problems the last review still found. */
  unresolved: string[];
  /** Whether the review failed, so the proposal wasn't checked. */
  failed?: boolean;
}
