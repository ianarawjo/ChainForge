import { describe, expect, test } from "@jest/globals";
import {
  ChatTurn,
  PromptOutputLike,
  answerLabel,
  answeringNodeIds,
  answersFromPromptOutput,
  buildChatTurn,
  explainTurn,
  progressMessage,
} from "../ragChat";
import { NodeRunResult } from "../runGraph";

/**
 * Prompt node output text is interned: stored as indices into a string table.
 * This fake table stands in for StringLookup so resolution is exercised.
 */
const TABLE: Record<number, string> = {
  1: "Customer data is retained for seven years.",
  2: "How long is customer data kept?",
  3: "BM25 Retrieval",
};
const resolveText = (v: unknown) =>
  typeof v === "number" ? TABLE[v] : typeof v === "string" ? v : undefined;

const QUERY = "How long is customer data kept?";

function output(overrides: Partial<PromptOutputLike> = {}): PromptOutputLike {
  return {
    text: "Seven years.",
    fill_history: {
      query: QUERY,
      chunkMethod: "Markdown Headers",
      retrievalMethod: "BM25 Retrieval",
      rerankMethod: "Cross-encoder (in-browser)",
      Context: "# Data Retention\n\nCustomer records are retained...",
    },
    metavars: {},
    llm: { name: "gpt-oss:20b" },
    ...overrides,
  };
}

describe("answersFromPromptOutput", () => {
  test("reads the answer, model, configuration and inputs", () => {
    const [a] = answersFromPromptOutput("p1", [output()], QUERY, resolveText);
    expect(a).toEqual({
      promptNodeId: "p1",
      llm: "gpt-oss:20b",
      text: "Seven years.",
      config: {
        chunkMethod: "Markdown Headers",
        retrievalMethod: "BM25 Retrieval",
        rerankMethod: "Cross-encoder (in-browser)",
      },
      inputs: {
        Context: "# Data Retention\n\nCustomer records are retained...",
      },
    });
  });

  test("resolves interned text, query and variables", () => {
    const [a] = answersFromPromptOutput(
      "p1",
      [
        output({
          text: 1,
          fill_history: { query: 2, retrievalMethod: 3 },
        }),
      ],
      QUERY,
      resolveText,
    );
    expect(a.text).toBe("Customer data is retained for seven years.");
    expect(a.config.retrievalMethod).toBe("BM25 Retrieval");
  });

  test("the query itself is neither configuration nor an input", () => {
    const [a] = answersFromPromptOutput("p1", [output()], QUERY, resolveText);
    expect(a.config).not.toHaveProperty("query");
    expect(a.inputs).not.toHaveProperty("query");
  });

  test("keeps every configuration's answer, not just the first", () => {
    // Comparing two retrievers is the point; both answers must survive.
    const answers = answersFromPromptOutput(
      "p1",
      [
        output({ text: "A" }),
        output({
          text: "B",
          fill_history: { query: QUERY, retrievalMethod: "Semantic Search" },
        }),
      ],
      QUERY,
      resolveText,
    );
    expect(answers.map((a) => a.text)).toEqual(["A", "B"]);
  });

  test("drops answers recorded for a different question", () => {
    // A Tabular node can feed the same Retrieval node alongside the chat.
    const answers = answersFromPromptOutput(
      "p1",
      [
        output({ text: "mine" }),
        output({
          text: "someone else's",
          fill_history: { query: "Where is the office?" },
        }),
      ],
      QUERY,
      resolveText,
    );
    expect(answers.map((a) => a.text)).toEqual(["mine"]);
  });

  test("matches the question despite surrounding whitespace", () => {
    const answers = answersFromPromptOutput(
      "p1",
      [output({ fill_history: { query: `  ${QUERY}\n` } })],
      QUERY,
      resolveText,
    );
    expect(answers).toHaveLength(1);
  });

  test("keeps entries with no recorded query, having nothing to exclude them by", () => {
    const answers = answersFromPromptOutput(
      "p1",
      [output({ fill_history: {} })],
      QUERY,
      resolveText,
    );
    expect(answers).toHaveLength(1);
  });

  test("skips entries with no text, such as image responses", () => {
    const answers = answersFromPromptOutput(
      "p1",
      [output({ text: undefined }), output({ text: "kept" })],
      QUERY,
      resolveText,
    );
    expect(answers.map((a) => a.text)).toEqual(["kept"]);
  });

  test("falls back to a generic model name when none was recorded", () => {
    const [a] = answersFromPromptOutput(
      "p1",
      [output({ llm: undefined })],
      QUERY,
      resolveText,
    );
    expect(a.llm).toBe("LLM");
  });

  test("reads a model name stored as a string", () => {
    const [a] = answersFromPromptOutput(
      "p1",
      [output({ llm: "Qwen2.5 0.5B" })],
      QUERY,
      resolveText,
    );
    expect(a.llm).toBe("Qwen2.5 0.5B");
  });

  test("tolerates missing output", () => {
    expect(
      answersFromPromptOutput("p1", undefined, QUERY, resolveText),
    ).toEqual([]);
  });
});

describe("answerLabel", () => {
  test("follows the pipeline order and ends with the model", () => {
    const [a] = answersFromPromptOutput("p1", [output()], QUERY, resolveText);
    expect(answerLabel(a)).toBe(
      "Markdown Headers · BM25 Retrieval · Cross-encoder (in-browser) · gpt-oss:20b",
    );
  });

  test("omits stages the flow does not have", () => {
    const [a] = answersFromPromptOutput(
      "p1",
      [output({ fill_history: { query: QUERY, retrievalMethod: "BM25" } })],
      QUERY,
      resolveText,
    );
    expect(answerLabel(a)).toBe("BM25 · gpt-oss:20b");
  });
});

describe("answeringNodeIds", () => {
  const types: Record<string, string> = {
    r: "retrieval",
    j: "join",
    p1: "prompt",
    p2: "prompt",
    c: "chat",
    i: "inspect",
  };
  const typeOf = (id: string) => types[id];

  test("picks the prompt-like nodes that finished", () => {
    const results: NodeRunResult[] = [
      { nodeId: "r", outcome: "ok" },
      { nodeId: "j", outcome: "ok" },
      { nodeId: "p1", outcome: "ok" },
      { nodeId: "c", outcome: "ok" },
      { nodeId: "i", outcome: "skipped" },
    ];
    expect(answeringNodeIds(results, typeOf)).toEqual(["p1", "c"]);
  });

  test("ignores prompt nodes that did not finish", () => {
    const results: NodeRunResult[] = [
      { nodeId: "p1", outcome: "failed" },
      { nodeId: "p2", outcome: "cancelled" },
    ];
    expect(answeringNodeIds(results, typeOf)).toEqual([]);
  });
});

describe("buildChatTurn", () => {
  const types: Record<string, string> = {
    r: "retrieval",
    p: "prompt",
  };
  const base = {
    id: "turn-1",
    query: QUERY,
    askedAt: 1000,
    typeOf: (id: string) => types[id],
    nodeLabel: (id: string) =>
      ({ r: "Retrieval Node", p: "Prompt Node" })[id] ?? id,
    resolveText,
  };

  test("a successful run is answered", () => {
    const turn = buildChatTurn({
      ...base,
      results: [
        { nodeId: "r", outcome: "ok" },
        { nodeId: "p", outcome: "ok" },
      ],
      promptOutputs: { p: [output()] },
    });
    expect(turn.status).toBe("answered");
    expect(turn.answers).toHaveLength(1);
    expect(turn.problems).toEqual([]);
  });

  test("a failure before any answer is failed, naming the node", () => {
    const turn = buildChatTurn({
      ...base,
      results: [{ nodeId: "r", outcome: "failed", error: "no chunks" }],
      promptOutputs: {},
    });
    expect(turn.status).toBe("failed");
    expect(turn.problems).toEqual([
      {
        nodeId: "r",
        nodeLabel: "Retrieval Node",
        outcome: "failed",
        error: "no chunks",
      },
    ]);
  });

  test("a stop is cancelled even if earlier answers exist", () => {
    const turn = buildChatTurn({
      ...base,
      results: [
        { nodeId: "r", outcome: "ok" },
        { nodeId: "p", outcome: "cancelled" },
      ],
      promptOutputs: { p: [output()] },
    });
    expect(turn.status).toBe("cancelled");
  });

  test("stale output from a prompt node that did not run is not shown", () => {
    // The prompt node still holds the previous question's answers; it must not
    // be read as a reply to this one.
    const turn = buildChatTurn({
      ...base,
      results: [{ nodeId: "r", outcome: "failed" }],
      promptOutputs: { p: [output({ text: "old answer" })] },
    });
    expect(turn.answers).toEqual([]);
  });

  test("a run with no prompt node downstream has no answer", () => {
    const turn = buildChatTurn({
      ...base,
      results: [{ nodeId: "r", outcome: "ok" }],
      promptOutputs: {},
    });
    expect(turn.status).toBe("no-answer");
  });

  test("keeps the question and timing", () => {
    const turn = buildChatTurn({
      ...base,
      results: [],
      promptOutputs: {},
    });
    expect(turn).toMatchObject({ id: "turn-1", query: QUERY, askedAt: 1000 });
  });
});

describe("explainTurn", () => {
  const turn = (overrides: Partial<ChatTurn>): ChatTurn => ({
    id: "t",
    query: QUERY,
    askedAt: 0,
    status: "answered",
    answers: [],
    problems: [],
    ...overrides,
  });

  test("an answered turn needs no explanation", () => {
    expect(explainTurn(turn({}))).toBeUndefined();
  });

  test("a failure names the node and its error", () => {
    expect(
      explainTurn(
        turn({
          status: "failed",
          problems: [
            {
              nodeId: "r",
              nodeLabel: "Retrieval Node",
              outcome: "failed",
              error: "Input 'chunks' is missing or empty.",
            },
          ],
        }),
      ),
    ).toBe("Retrieval Node could not run: Input 'chunks' is missing or empty.");
  });

  test("a failure without a message points at the node", () => {
    expect(
      explainTurn(
        turn({
          status: "failed",
          problems: [
            { nodeId: "r", nodeLabel: "Retrieval Node", outcome: "failed" },
          ],
        }),
      ),
    ).toBe("Retrieval Node could not run. Check that node for details.");
  });

  test("no answer explains what to connect", () => {
    expect(explainTurn(turn({ status: "no-answer" }))).toMatch(/Prompt node/);
  });

  test("a stop says so", () => {
    expect(explainTurn(turn({ status: "cancelled" }))).toBe("Stopped.");
  });
});

describe("progressMessage", () => {
  test("describes each pipeline stage", () => {
    expect(progressMessage("retrieval")).toMatch(/Retriev/);
    expect(progressMessage("rerank")).toMatch(/Rerank/);
    expect(progressMessage("prompt")).toMatch(/model/);
  });

  test("has a fallback for anything else", () => {
    expect(progressMessage(undefined)).toBe("Running…");
    expect(progressMessage("vis")).toBe("Running…");
  });
});
