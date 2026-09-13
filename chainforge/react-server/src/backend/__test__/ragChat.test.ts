import { describe, expect, test } from "@jest/globals";
import {
  ChatAnswer,
  ChatTurn,
  PromptOutputLike,
  answerLabel,
  answeringNodeIds,
  answersAgree,
  answersFromPromptOutput,
  buildChatTurn,
  collectStageValues,
  explainMixedStage,
  explainTurn,
  groupAgreeingAnswers,
  mixedStages,
  progressMessage,
  splitAnswerLabels,
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

function answer(
  text: string,
  config: Record<string, string>,
  llm = "Qwen2.5 0.5B",
): ChatAnswer {
  return { promptNodeId: "p", llm, text, config, inputs: {} };
}

describe("splitAnswerLabels", () => {
  test("says the shared stages once and keeps what differs per answer", () => {
    const rerank = "Cross-encoder (in-browser)";
    const labels = splitAnswerLabels([
      answer("a", {
        chunkMethod: "Markdown",
        retrievalMethod: "BM25",
        rerankMethod: rerank,
      }),
      answer("b", {
        chunkMethod: "Markdown",
        retrievalMethod: "Semantic",
        rerankMethod: rerank,
      }),
      answer("c", {
        chunkMethod: "Sentences",
        retrievalMethod: "BM25",
        rerankMethod: rerank,
      }),
    ]);
    expect(labels.shared).toBe("Cross-encoder (in-browser) · Qwen2.5 0.5B");
    expect(labels.distinct).toEqual([
      "Markdown · BM25",
      "Markdown · Semantic",
      "Sentences · BM25",
    ]);
  });

  test("treats the model as a stage like any other", () => {
    const labels = splitAnswerLabels([
      answer("a", { retrievalMethod: "BM25" }, "Qwen2.5 0.5B"),
      answer("b", { retrievalMethod: "BM25" }, "gpt-oss:20b"),
    ]);
    expect(labels.shared).toBe("BM25");
    expect(labels.distinct).toEqual(["Qwen2.5 0.5B", "gpt-oss:20b"]);
  });

  test("a stage only some answers have is not shared", () => {
    const labels = splitAnswerLabels([
      answer("a", { retrievalMethod: "BM25", rerankMethod: "Cohere" }),
      answer("b", { retrievalMethod: "BM25" }),
    ]);
    expect(labels.shared).toBe("BM25 · Qwen2.5 0.5B");
    expect(labels.distinct).toEqual(["Cohere", "Response 1"]);
  });

  test("numbers answers from the same configuration", () => {
    const labels = splitAnswerLabels([
      answer("a", { retrievalMethod: "BM25" }, "Qwen2.5 0.5B"),
      answer("b", { retrievalMethod: "BM25" }, "Qwen2.5 0.5B"),
      answer("c", { retrievalMethod: "BM25" }, "gpt-oss:20b"),
      answer("d", { retrievalMethod: "BM25" }, "gpt-oss:20b"),
    ]);
    expect(labels.distinct).toEqual([
      "Qwen2.5 0.5B #1",
      "Qwen2.5 0.5B #2",
      "gpt-oss:20b #1",
      "gpt-oss:20b #2",
    ]);
  });

  test("a lone answer shares everything", () => {
    const labels = splitAnswerLabels([
      answer("a", { retrievalMethod: "BM25" }),
    ]);
    expect(labels.shared).toBe("BM25 · Qwen2.5 0.5B");
    expect(labels.distinct).toEqual(["Response 1"]);
  });

  test("no answers, no labels", () => {
    expect(splitAnswerLabels([])).toEqual({ shared: "", distinct: [] });
  });
});

describe("answersAgree", () => {
  test("the same words agree, whatever the case and punctuation", () => {
    expect(answersAgree("Seven years.", "seven years")).toBe(true);
  });

  test("a close paraphrase agrees", () => {
    // Real answers from two retrievers in the comparison flow.
    expect(
      answersAgree(
        "Customer data is kept for 7 years after an account is closed.",
        "Customer data is retained for seven years after the account is closed.",
      ),
    ).toBe(true);
  });

  test("different numbers never agree, however similar the wording", () => {
    expect(
      answersAgree(
        "Customer data is kept for 7 years after an account is closed.",
        "Customer data is kept for 30 years after an account is closed.",
      ),
    ).toBe(false);
  });

  test("a negation never agrees with its opposite", () => {
    expect(
      answersAgree(
        "Employees may work remotely on Fridays.",
        "Employees may not work remotely on Fridays.",
      ),
    ).toBe(false);
    expect(
      answersAgree(
        "The handbook says how long data is kept.",
        "The handbook doesn't say how long data is kept.",
      ),
    ).toBe(false);
  });

  test("yes and no disagree", () => {
    expect(answersAgree("Yes, you can.", "No, you can.")).toBe(false);
  });

  test("unrelated answers disagree", () => {
    expect(
      answersAgree(
        "Customer data is kept for 7 years.",
        "The handbook does not mention data retention for closed accounts.",
      ),
    ).toBe(false);
  });

  test("a loose paraphrase is left apart rather than risk hiding a difference", () => {
    expect(
      answersAgree(
        "Full-time employees accrue 18 days of paid leave per calendar year.",
        "You get 18 days off every year if you work full time.",
      ),
    ).toBe(false);
  });
});

describe("groupAgreeingAnswers", () => {
  const texts = (ts: string[]) => ts.map((t) => answer(t, {}));

  test("groups agreeing answers, largest group first", () => {
    const groups = groupAgreeingAnswers(
      texts([
        "The handbook doesn't say.",
        "Customer data is kept for 7 years.",
        "Customer data is kept for seven years.",
        "customer data is kept for 7 years",
      ]),
    );
    expect(groups).toEqual([[1, 2, 3], [0]]);
  });

  test("an answer must agree with every member, not just one", () => {
    // b agrees with both a and c, but a and c disagree: c may not join a's group.
    const agree = (x: string, y: string) =>
      x === y ||
      [x, y].sort().join() === "a,b" ||
      [x, y].sort().join() === "b,c";
    expect(groupAgreeingAnswers(texts(["a", "b", "c"]), agree)).toEqual([
      [0, 1],
      [2],
    ]);
  });

  test("when nothing agrees, every answer stands alone in arrival order", () => {
    expect(
      groupAgreeingAnswers(texts(["7 years.", "30 days.", "Not stated."])),
    ).toEqual([[0], [1], [2]]);
  });

  test("equal-sized groups keep arrival order", () => {
    expect(
      groupAgreeingAnswers(
        texts(["30 days.", "7 years.", "30 days", "7 years"]),
      ),
    ).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });
});

describe("collectStageValues", () => {
  test("gathers each stage's methods across nodes, once each, in order seen", () => {
    const retrieval = [
      {
        fill_history: {
          query: QUERY,
          chunkMethod: "Markdown Headers",
          retrievalMethod: "BM25",
        },
      },
      {
        fill_history: {
          query: QUERY,
          chunkMethod: "Fixed size",
          retrievalMethod: "BM25",
        },
      },
      {
        fill_history: {
          query: QUERY,
          chunkMethod: "Markdown Headers",
          retrievalMethod: "Semantic",
        },
      },
    ];
    const rerank = [
      {
        fill_history: {
          chunkMethod: "Markdown Headers",
          rerankMethod: "Cross-encoder",
        },
      },
    ];
    expect(collectStageValues([retrieval, rerank], resolveText)).toEqual({
      chunkMethod: ["Markdown Headers", "Fixed size"],
      retrievalMethod: ["BM25", "Semantic"],
      rerankMethod: ["Cross-encoder"],
    });
  });

  test("resolves interned values", () => {
    expect(
      collectStageValues(
        [[{ fill_history: { retrievalMethod: 3 } }]],
        resolveText,
      ),
    ).toEqual({ retrievalMethod: ["BM25 Retrieval"] });
  });

  test("skips outputs that are not lists, and entries without variables", () => {
    expect(
      collectStageValues(
        [undefined, {}, "text", [null, { text: "x" }]],
        resolveText,
      ),
    ).toEqual({});
  });
});

describe("mixedStages", () => {
  const stageValues = {
    chunkMethod: ["Markdown Headers", "Fixed size"],
    retrievalMethod: ["BM25", "Semantic"],
  };

  test("a Join grouped by retriever only merges the chunkers", () => {
    // The Join drops chunkMethod, since it differs within each group.
    const answers = [
      answer("a", { retrievalMethod: "BM25" }),
      answer("b", { retrievalMethod: "Semantic" }),
    ];
    expect(mixedStages(stageValues, answers)).toEqual([
      { key: "chunkMethod", values: ["Markdown Headers", "Fixed size"] },
    ]);
  });

  test("merging everything into one answer flags every stage", () => {
    expect(mixedStages(stageValues, [answer("a", {})])).toEqual([
      { key: "chunkMethod", values: ["Markdown Headers", "Fixed size"] },
      { key: "retrievalMethod", values: ["BM25", "Semantic"] },
    ]);
  });

  test("a Join grouped by every stage is fine", () => {
    const answers = [
      answer("a", { chunkMethod: "Markdown Headers", retrievalMethod: "BM25" }),
      answer("b", { chunkMethod: "Fixed size", retrievalMethod: "Semantic" }),
    ];
    expect(mixedStages(stageValues, answers)).toEqual([]);
  });

  test("a stage with a single method cannot be mixed", () => {
    expect(
      mixedStages({ chunkMethod: ["Markdown Headers"] }, [answer("a", {})]),
    ).toEqual([]);
  });

  test("no answers, nothing to warn about", () => {
    expect(mixedStages(stageValues, [])).toEqual([]);
  });
});

describe("buildChatTurn with stage values", () => {
  test("records merged stages on the turn", () => {
    const turn = buildChatTurn({
      id: "t",
      query: QUERY,
      askedAt: 0,
      results: [{ nodeId: "p", outcome: "ok" }],
      promptOutputs: {
        p: [
          output({ fill_history: { query: QUERY, retrievalMethod: "BM25" } }),
        ],
      },
      typeOf: () => "prompt",
      nodeLabel: () => "Prompt Node",
      resolveText,
      stageValues: { chunkMethod: ["Markdown Headers", "Fixed size"] },
    });
    expect(turn.mixed).toEqual([
      { key: "chunkMethod", values: ["Markdown Headers", "Fixed size"] },
    ]);
  });
});

describe("explainMixedStage", () => {
  test("names the methods and the variable to group by", () => {
    expect(
      explainMixedStage({
        key: "chunkMethod",
        values: ["Markdown Headers", "Fixed size (characters)"],
      }),
    ).toBe(
      "Answers mix results from 2 chunkers (Markdown Headers, Fixed size (characters)). " +
        "To compare them, group the Join node by chunkMethod too.",
    );
  });
});
