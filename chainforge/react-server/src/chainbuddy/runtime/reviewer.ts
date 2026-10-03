/**
 * A Reviewer (see flowApi/review.ts) made from a model: one request, with
 * fresh context, asking it to check a proposal against the user's request
 * and the guides for the node types involved.
 */

import { ReviewInput, Reviewer } from "../flowApi/review";
import { ModelClient, ToolSpec } from "../model/types";
import { isPlainObject } from "./tools";

/** The most problems a review reports; the worst come first. */
const MAX_PROBLEMS = 5;

const REPORT: ToolSpec = {
  name: "report_problems",
  description:
    "Reports the problems found in the proposal. An empty list means it's fine.",
  parameters: {
    type: "object",
    required: ["problems"],
    properties: {
      problems: {
        type: "array",
        description:
          "Each problem in one or two sentences: where it is, what's wrong, and how to fix it. Most serious first.",
        items: { type: "string" },
      },
    },
  },
};

/** The review request, as the reviewing model reads it. */
export function reviewRequest(input: ReviewInput): string {
  const guides = Object.entries(input.guides)
    .map(([type, doc]) => `### Guide: ${type}\n\n${doc.trim()}`)
    .join("\n\n");
  return [
    `## What the user asked\n\n${input.request.trim() || "(not given)"}`,
    ...(input.approach
      ? [`## The approach it told the user it would take\n\n${input.approach}`]
      : []),
    `## The flow now\n\n${JSON.stringify(input.flow, null, 1)}`,
    `## The proposed changes\n\n${JSON.stringify(input.changeSet, null, 1)}`,
    `## Guides for the node types involved\n\n${guides}`,
  ].join("\n\n");
}

/** A list of problem sentences, from report_problems arguments or a JSON reply. */
function problemsIn(value: unknown): string[] | undefined {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return undefined;
    }
  }
  if (isPlainObject(v)) v = v.problems;
  if (typeof v === "string") return problemsIn(v);
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .slice(0, MAX_PROBLEMS);
}

export function createReviewer(
  client: ModelClient,
  instructions: string,
): Reviewer {
  return async (input, signal) => {
    const turn = await client.respond(
      {
        system: instructions,
        messages: [{ role: "user", content: reviewRequest(input) }],
        tools: [REPORT],
      },
      { signal },
    );
    const call = turn.message.toolCalls?.find((c) => c.name === REPORT.name);
    // A model that answers in text instead may still have written the JSON.
    const found = call
      ? problemsIn(call.arguments)
      : problemsIn(turn.message.content.match(/\{[\s\S]*\}/)?.[0]);
    if (!found) throw new Error("The review couldn't be read.");
    return found;
  };
}
