import { describe, expect, test } from "@jest/globals";
import { groupDocumentsForRerank } from "../rerankGroups";

interface Doc {
  text: string;
  vars: Record<string, string>;
}

const Q1 = "How long is customer data kept?";
const Q2 = "How many days of paid leave?";

function doc(text: string, vars: Record<string, string> = {}): Doc {
  return { text, vars };
}

const options = (wiredQueries: string[] = []) => ({
  wiredQueries,
  queryOf: (d: Doc) => d.vars.query ?? "",
  varOf: (d: Doc, name: string) => d.vars[name],
});

const summary = (groups: ReturnType<typeof groupDocumentsForRerank<Doc>>) =>
  groups.map((g) => ({
    query: g.query,
    config: g.config,
    texts: g.documents.map((d) => d.text),
  }));

/** Three retrieved docs for every (chunker, retriever) pair, for one query. */
function retrieved(query: string): Doc[] {
  const docs: Doc[] = [];
  for (const chunkMethod of ["Markdown Headers", "Fixed size (characters)"])
    for (const retrievalMethod of ["BM25 Retrieval", "Semantic Search"])
      for (let i = 0; i < 3; i++)
        docs.push(
          doc(`${chunkMethod}/${retrievalMethod}/${i}`, {
            query,
            chunkMethod,
            retrievalMethod,
            docTitle: "handbook.txt",
            chunkId: String(i),
          }),
        );
  return docs;
}

describe("groupDocumentsForRerank, documents from a Retrieval node", () => {
  test("ranks each configuration separately, not the pooled set", () => {
    // The reported flow: 2 chunkers x 2 retrievers, top_k 3 each. Pooled, a
    // reranker's top 2 all came from one chunker and the other vanished.
    const groups = groupDocumentsForRerank(retrieved(Q1), options());
    expect(summary(groups)).toEqual([
      {
        query: Q1,
        config: {
          chunkMethod: "Markdown Headers",
          retrievalMethod: "BM25 Retrieval",
        },
        texts: [0, 1, 2].map((i) => `Markdown Headers/BM25 Retrieval/${i}`),
      },
      {
        query: Q1,
        config: {
          chunkMethod: "Markdown Headers",
          retrievalMethod: "Semantic Search",
        },
        texts: [0, 1, 2].map((i) => `Markdown Headers/Semantic Search/${i}`),
      },
      {
        query: Q1,
        config: {
          chunkMethod: "Fixed size (characters)",
          retrievalMethod: "BM25 Retrieval",
        },
        texts: [0, 1, 2].map(
          (i) => `Fixed size (characters)/BM25 Retrieval/${i}`,
        ),
      },
      {
        query: Q1,
        config: {
          chunkMethod: "Fixed size (characters)",
          retrievalMethod: "Semantic Search",
        },
        texts: [0, 1, 2].map(
          (i) => `Fixed size (characters)/Semantic Search/${i}`,
        ),
      },
    ]);
  });

  test("keeps queries apart as before", () => {
    const groups = groupDocumentsForRerank(
      [...retrieved(Q1), ...retrieved(Q2)],
      options(),
    );
    expect(groups).toHaveLength(8);
    expect(groups.slice(0, 4).every((g) => g.query === Q1)).toBe(true);
    expect(groups.slice(4).every((g) => g.query === Q2)).toBe(true);
  });

  test("a single configuration is one group per query, as before", () => {
    const docs = [
      doc("a", { query: Q1, retrievalMethod: "BM25 Retrieval" }),
      doc("b", { query: Q2, retrievalMethod: "BM25 Retrieval" }),
      doc("c", { query: Q1, retrievalMethod: "BM25 Retrieval" }),
    ];
    expect(summary(groupDocumentsForRerank(docs, options()))).toEqual([
      {
        query: Q1,
        config: { retrievalMethod: "BM25 Retrieval" },
        texts: ["a", "c"],
      },
      {
        query: Q2,
        config: { retrievalMethod: "BM25 Retrieval" },
        texts: ["b"],
      },
    ]);
  });

  test("documents recording no configuration group by query alone", () => {
    const docs = [doc("a", { query: Q1 }), doc("b", { query: Q1 })];
    expect(summary(groupDocumentsForRerank(docs, options()))).toEqual([
      { query: Q1, config: {}, texts: ["a", "b"] },
    ]);
  });

  test("per-document variables do not split a group", () => {
    // Splitting on these would rank every document on its own.
    const docs = [
      doc("a", {
        query: Q1,
        retrievalMethod: "BM25",
        docTitle: "x.txt",
        chunkId: "0",
        score: "0.9",
        originalRank: "0",
      }),
      doc("b", {
        query: Q1,
        retrievalMethod: "BM25",
        docTitle: "y.txt",
        chunkId: "7",
        score: "0.2",
        originalRank: "1",
      }),
    ];
    expect(groupDocumentsForRerank(docs, options())).toHaveLength(1);
  });

  test("documents from different earlier rerankers stay apart", () => {
    const docs = [
      doc("a", { query: Q1, retrievalMethod: "BM25", rerankMethod: "Cohere" }),
      doc("b", {
        query: Q1,
        retrievalMethod: "BM25",
        rerankMethod: "Cross-encoder",
      }),
    ];
    expect(groupDocumentsForRerank(docs, options())).toHaveLength(2);
  });

  test("a missing stage is not the same as an empty one", () => {
    const docs = [
      doc("a", { query: Q1, chunkMethod: "" }),
      doc("b", { query: Q1 }),
    ];
    expect(groupDocumentsForRerank(docs, options())).toHaveLength(2);
  });

  test("keeps input order within a group, so result indices map back", () => {
    const docs = [
      doc("first", { query: Q1, retrievalMethod: "BM25" }),
      doc("other", { query: Q1, retrievalMethod: "Semantic" }),
      doc("second", { query: Q1, retrievalMethod: "BM25" }),
    ];
    const [bm25] = groupDocumentsForRerank(docs, options());
    expect(bm25.documents.map((d) => d.text)).toEqual(["first", "second"]);
  });
});

describe("groupDocumentsForRerank, with a query wired in", () => {
  test("ranks every wired query against each configuration's documents", () => {
    // Raw chunks straight from a Chunk node with two chunkers.
    const docs = [
      doc("m0", { chunkMethod: "Markdown Headers", chunkId: "0" }),
      doc("f0", { chunkMethod: "Fixed size (characters)", chunkId: "0" }),
      doc("m1", { chunkMethod: "Markdown Headers", chunkId: "1" }),
    ];
    expect(summary(groupDocumentsForRerank(docs, options([Q1, Q2])))).toEqual([
      {
        query: Q1,
        config: { chunkMethod: "Markdown Headers" },
        texts: ["m0", "m1"],
      },
      {
        query: Q1,
        config: { chunkMethod: "Fixed size (characters)" },
        texts: ["f0"],
      },
      {
        query: Q2,
        config: { chunkMethod: "Markdown Headers" },
        texts: ["m0", "m1"],
      },
      {
        query: Q2,
        config: { chunkMethod: "Fixed size (characters)" },
        texts: ["f0"],
      },
    ]);
  });

  test("ignores the query documents recorded", () => {
    const docs = [doc("a", { query: Q2 }), doc("b", { query: Q1 })];
    expect(summary(groupDocumentsForRerank(docs, options([Q1])))).toEqual([
      { query: Q1, config: {}, texts: ["a", "b"] },
    ]);
  });

  test("chunks with no configuration are one group per query, as before", () => {
    const docs = [doc("a"), doc("b")];
    expect(summary(groupDocumentsForRerank(docs, options([Q1])))).toEqual([
      { query: Q1, config: {}, texts: ["a", "b"] },
    ]);
  });
});

test("no documents, no groups", () => {
  expect(groupDocumentsForRerank([], options())).toEqual([]);
  expect(groupDocumentsForRerank([], options([Q1]))).toEqual([]);
});
