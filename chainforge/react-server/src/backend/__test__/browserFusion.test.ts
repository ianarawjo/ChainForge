import { describe, expect, test } from "@jest/globals";
import {
  RetrieveRequest,
  RetrieveResponseRow,
  fusedRows,
} from "../browserRetrieve";

/** A /retrieve row for one hit. */
function row(
  methodId: string,
  docTitle: string,
  chunkId: string,
  text: string,
  rank: number,
  similarity: number,
): RetrieveResponseRow {
  return {
    text,
    prompt: "q",
    eval_res: { items: [{ similarity, rank }], dtype: "KeyValue_Mixed" },
    vars: { query: "q", retrievalMethod: methodId, chunkMethod: "cm" },
    metavars: { methodId, docTitle, chunkId },
    llm: "(none)",
  };
}

function request(fusionMethod: string): RetrieveRequest {
  return {
    methods: [
      { id: "m1", baseMethod: "bm25", methodName: "M1" },
      { id: "m2", baseMethod: "overlap", methodName: "M2" },
    ],
    chunks: [],
    queries: [],
    fusion_enabled: true,
    linked_groups: [{ id: "g", methodKeys: ["m1", "m2"], fusionMethod }],
  };
}

describe.each(["reciprocal_rank_fusion", "weighted_average"])(
  "%s",
  (fusionMethod) => {
    test("chunks sharing a chunkId in different documents stay separate", () => {
      // chunkId is a per-document index, so both documents have a chunk "0".
      const rows = [
        row("m1", "a.md", "0", "cats", 1, 0.9),
        row("m1", "b.md", "0", "dogs", 2, 0.5),
        row("m2", "b.md", "0", "dogs", 1, 0.8),
        row("m2", "a.md", "0", "cats", 2, 0.1),
      ];
      const fused = fusedRows(rows, request(fusionMethod));
      expect(fused.map((r) => r.metavars.docTitle).sort()).toEqual([
        "a.md",
        "b.md",
      ]);
    });
  },
);

describe("weighted average fusion", () => {
  test("a method scoring on a larger scale does not dominate", () => {
    const rows = [
      row("m1", "d", "a", "a", 1, 0.9),
      row("m1", "d", "b", "b", 2, 0.8),
      row("m2", "d", "b", "b", 1, 30),
      row("m2", "d", "a", "a", 2, 10),
    ];
    const scores = fusedRows(rows, request("weighted_average")).map(
      (r) => r.eval_res.items[0].similarity,
    );
    expect(scores).toEqual([1, 1]);
  });

  test("the row comes from the method ranking the chunk highest", () => {
    const rows = [
      { ...row("m1", "d", "a", "a", 5, 0.9), llm: "from m1" },
      { ...row("m2", "d", "a", "a", 1, 0.1), llm: "from m2" },
    ];
    const [fused] = fusedRows(rows, request("weighted_average"));
    expect(fused.vars.retrievalMethod).toBe("Fused (M1 + M2)");
    expect(fused.llm).toBe("from m2");
  });
});

describe("fusion with a loaded index", () => {
  test("its hits fuse with each chunking method's rankings", () => {
    // A server method loading an existing index labels its rows so.
    const loaded = {
      ...row("m2", "d", "b", "b", 1, 0.8),
      vars: {
        query: "q",
        retrievalMethod: "m2",
        chunkMethod: "(existing index)",
      },
    };
    const fused = fusedRows([row("m1", "d", "a", "a", 1, 0.9), loaded], {
      ...request("reciprocal_rank_fusion"),
      chunks: [
        { text: "a", fill_history: { chunkMethod: "cm" }, metavars: {} },
      ],
    });
    expect(fused.map((r) => r.text).sort()).toEqual(["a", "b"]);
    expect(new Set(fused.map((r) => r.vars.chunkMethod))).toEqual(
      new Set(["cm"]),
    );
    expect(fused[0].vars.retrievalMethod).toBe("Fused (M1 + M2)");
  });
});
