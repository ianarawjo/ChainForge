// The reviewer made from a model: what it sends, and how it reads the answer.

import { describe, expect, test } from "@jest/globals";
import { ModelClient, ModelRequest, ToolCall } from "../model/types";
import { createReviewer, reviewRequest } from "../runtime/reviewer";
import { ReviewInput } from "../flowApi/review";

const input: ReviewInput = {
  request: "Audit a model for bias.",
  flow: { nodes: [], connections: [] },
  changeSet: { summary: "An audit", changes: [] },
  guides: { evaluator: "# JavaScript Evaluator\n\nScores responses." },
};

/** A model that answers once, with this text and these tool calls. */
function answering(content: string, toolCalls?: ToolCall[]) {
  const requests: ModelRequest[] = [];
  const client: ModelClient = {
    respond: async (request) => {
      requests.push(request);
      return {
        message: { role: "assistant", content, toolCalls },
        finishReason: toolCalls ? "tool_calls" : "stop",
      };
    },
  };
  return { client, requests };
}

const report = (args: string): ToolCall[] => [
  { id: "1", name: "report_problems", arguments: args },
];

describe("reviewer", () => {
  test("asks with the request, the flow, the changes and the guides", async () => {
    const { client, requests } = answering("", report('{"problems": []}'));
    await createReviewer(client, "Check it.")(input);
    expect(requests[0].system).toBe("Check it.");
    const asked = requests[0].messages[0].content as string;
    expect(asked).toMatch(/## What the user asked\n\nAudit a model for bias\./);
    expect(asked).toMatch(/## The proposed changes/);
    expect(asked).toMatch(/### Guide: evaluator\n\n# JavaScript Evaluator/);
    expect(requests[0].tools?.map((t) => t.name)).toEqual(["report_problems"]);
  });

  test("reads the problems it reports", async () => {
    const { client } = answering(
      "",
      report('{"problems": ["Counts \\"he\\" inside \\"the\\"."]}'),
    );
    expect(await createReviewer(client, "")(input)).toEqual([
      'Counts "he" inside "the".',
    ]);
  });

  test("reads a list sent as a string, as small models do", async () => {
    const { client } = answering("", report('{"problems": "[\\"A.\\"]"}'));
    expect(await createReviewer(client, "")(input)).toEqual(["A."]);
  });

  test("reads JSON written in the reply instead of reported", async () => {
    const { client } = answering('Here: {"problems": ["B."]}');
    expect(await createReviewer(client, "")(input)).toEqual(["B."]);
  });

  test("reports at most five, and fails when there's nothing to read", async () => {
    const many = JSON.stringify({ problems: ["1", "2", "3", "4", "5", "6"] });
    expect(
      await createReviewer(answering("", report(many)).client, "")(input),
    ).toHaveLength(5);
    await expect(
      createReviewer(answering("Looks good to me.").client, "")(input),
    ).rejects.toThrow("The review couldn't be read.");
  });

  test("the request reads as sections", () => {
    expect(reviewRequest({ ...input, request: "" })).toMatch(
      /## What the user asked\n\n\(not given\)/,
    );
  });
});
