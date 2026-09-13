import { describe, expect, test } from "@jest/globals";
import {
  ChatAnswer,
  ChatTurn,
  PromptOutputLike,
  answerLabel,
  answeringNodeIds,
  answersConflict,
  answersMatchExactly,
  answersFromPromptOutput,
  buildChatTurn,
  collectStageValues,
  explainMixedStage,
  explainTurn,
  groupAnswers,
  groupAnswersByMeaning,
  groupAnswersExactly,
  mixedStages,
  progressMessage,
  splitAnswerLabels,
  ungroupedAnswers,
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

describe("answersMatchExactly", () => {
  test("ignores case, punctuation and spacing", () => {
    expect(answersMatchExactly("Seven years.", "  seven   YEARS")).toBe(true);
  });

  test("different wording does not match, however close", () => {
    expect(answersMatchExactly("Seven years.", "7 years.")).toBe(false);
    expect(
      answersMatchExactly("Backups are kept.", "Backups are retained."),
    ).toBe(false);
  });
});

describe("answersConflict", () => {
  test("different numbers conflict", () => {
    expect(answersConflict("Kept for 7 years.", "Kept for 30 years.")).toBe(
      true,
    );
  });

  test("a number written out is the same number", () => {
    expect(answersConflict("Kept for seven years.", "Kept for 7 years.")).toBe(
      false,
    );
  });

  test("a negation conflicts with its opposite", () => {
    expect(
      answersConflict(
        "Employees may work remotely.",
        "Employees may not work remotely.",
      ),
    ).toBe(true);
    expect(
      answersConflict("The handbook says.", "The handbook doesn't say."),
    ).toBe(true);
  });

  test("a leading yes does not conflict with a plain affirmative", () => {
    expect(
      answersConflict(
        "Yes, dogs are allowed on the train.",
        "Dogs are permitted on board the train.",
      ),
    ).toBe(false);
  });

  test("yes and no conflict", () => {
    expect(answersConflict("Yes, you can.", "No, you can.")).toBe(true);
  });

  test("paraphrases do not conflict", () => {
    expect(
      answersConflict(
        "Customer data is kept for 7 years after an account is closed.",
        "Customer data is retained for seven years after the account is closed.",
      ),
    ).toBe(false);
  });
});

describe("groupAnswers", () => {
  const texts = (ts: string[]) => ts.map((t) => answer(t, {}));

  test("an answer must agree with every member, not just one", () => {
    // 1 agrees with 0 and 2, but 0 and 2 disagree: 2 may not join 0's group.
    const pairs = new Set(["0,1", "1,2"]);
    const agree = (i: number, j: number) => pairs.has([i, j].sort().join(","));
    expect(groupAnswers(texts(["a", "b", "c"]), agree)).toEqual([[0, 1], [2]]);
  });

  test("largest group first; equal-sized groups keep arrival order", () => {
    const same = (i: number, j: number) =>
      i % 2 === j % 2 || i === 4 || j === 4 ? i % 2 === j % 2 : false;
    expect(groupAnswers(texts(["a", "b", "c", "d", "e"]), same)).toEqual([
      [0, 2, 4],
      [1, 3],
    ]);
  });
});

describe("groupAnswersExactly", () => {
  test("groups matching text, leaving paraphrases apart", () => {
    const answers = [
      "Backups are kept for 90 days.",
      "Backups are retained for 90 days.",
      "backups are kept for 90 days",
    ].map((t) => answer(t, {}));
    expect(groupAnswersExactly(answers)).toEqual([[0, 2], [1]]);
  });
});

describe("ungroupedAnswers", () => {
  test("puts every answer on its own", () => {
    expect(ungroupedAnswers([answer("a", {}), answer("a", {})])).toEqual([
      [0],
      [1],
    ]);
  });
});

describe("groupAnswersByMeaning", () => {
  /** A fake NLI model: entails only the ordered pairs listed. */
  function judge(pairs: [string, string][]) {
    const calls: string[] = [];
    const entails = async (premise: string, hypothesis: string) => {
      calls.push(`${premise} => ${hypothesis}`);
      return pairs.some(([p, h]) => p === premise && h === hypothesis);
    };
    return { entails, calls };
  }
  const answers = (ts: string[]) => ts.map((t) => answer(t, {}));
  const both = (a: string, b: string): [string, string][] => [
    [a, b],
    [b, a],
  ];

  test("groups answers that entail each other", async () => {
    const kept = "Backups are kept for 90 days.";
    const retained = "Backups are retained for 90 days.";
    const { entails } = judge(both(kept, retained));
    expect(
      await groupAnswersByMeaning(
        answers([kept, "Chat history is kept for 18 months.", retained]),
        entails,
      ),
    ).toEqual([[0, 2], [1]]);
  });

  test("entailment one way only is not the same meaning", async () => {
    // The conditional answer entails the plain one, but not the reverse.
    const plain = "Employees may work remotely.";
    const conditional = "Employees may work remotely with manager approval.";
    const { entails } = judge([[conditional, plain]]);
    expect(
      await groupAnswersByMeaning(answers([plain, conditional]), entails),
    ).toEqual([[0], [1]]);
  });

  test("answers that conflict are never judged, let alone grouped", async () => {
    const { entails, calls } = judge(
      both("Kept for 7 years.", "Kept for 30 years."),
    );
    expect(
      await groupAnswersByMeaning(
        answers(["Kept for 7 years.", "Kept for 30 years."]),
        entails,
      ),
    ).toEqual([[0], [1]]);
    expect(calls).toEqual([]);
  });

  test("exact matches group without asking the model", async () => {
    const { entails, calls } = judge([]);
    expect(
      await groupAnswersByMeaning(answers(["Yes.", "yes"]), entails),
    ).toEqual([[0, 1]]);
    expect(calls).toEqual([]);
  });

  test("an answer must agree with every member of a group", async () => {
    // b agrees with a and with c, but a and c do not agree.
    const { entails } = judge([...both("a", "b"), ...both("b", "c")]);
    expect(
      await groupAnswersByMeaning(answers(["a", "b", "c"]), entails),
    ).toEqual([[0, 1], [2]]);
  });

  test("judges each ordered pair of distinct texts once", async () => {
    const { entails, calls } = judge(both("a", "b"));
    await groupAnswersByMeaning(answers(["a", "c", "b", "b"]), entails);
    expect(calls.length).toBe(new Set(calls).size);
  });

  test("a single answer needs no judgement", async () => {
    const { entails, calls } = judge([]);
    expect(await groupAnswersByMeaning(answers(["a"]), entails)).toEqual([[0]]);
    expect(calls).toEqual([]);
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
