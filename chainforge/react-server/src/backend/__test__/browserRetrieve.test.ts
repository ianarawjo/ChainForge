import { describe, expect, test } from "@jest/globals";
import {
  canRetrieveRequestInBrowser,
  methodsNeedingBackend,
  retrieveRequestInBrowser,
} from "../browserRetrieve";

// Reference responses captured from the real Flask /retrieve endpoint. This
// pins far more than ranking: chunk grouping, the response row shape, vars and
// metavars propagation, and fusion.
const fixture: {
  cases: { name: string; request: any; response: any[] }[];
} = (() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../../tests/fixtures/retrieve_endpoint_cases.json",
      ),
      "utf8",
    ),
  );
})();

/** Rounds floats so float formatting alone can't fail a comparison. */
function normalize(rows: any[]): any[] {
  return rows.map((row) => ({
    ...row,
    eval_res: {
      ...row.eval_res,
      items: row.eval_res.items.map((it: any) => ({
        ...it,
        similarity: Number(Number(it.similarity).toFixed(10)),
      })),
    },
    // The endpoint's latency_ms is a wall-clock timing, stripped from the
    // fixture; drop ours too.
    metavars: Object.fromEntries(
      Object.entries(row.metavars).filter(([k]) => k !== "latency_ms"),
    ),
  }));
}

describe("the endpoint fixture", () => {
  test("exists and includes fusion cases", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
    expect(fixture.cases.some((c) => c.request.fusion_enabled === true)).toBe(
      true,
    );
  });

  test("every case returns rows, so agreement is meaningful", () => {
    for (const c of fixture.cases) expect(c.response.length).toBeGreaterThan(0);
  });
});

describe("matches the Flask endpoint row for row", () => {
  test.each(fixture.cases)("$name", ({ request, response }) => {
    const actual = retrieveRequestInBrowser(request);
    expect(normalize(actual)).toEqual(normalize(response));
  });
});

describe("which requests can run client-side", () => {
  const keyword = {
    id: "m1",
    baseMethod: "bm25",
    methodName: "BM25",
    settings: {},
  };

  test("all-keyword requests can", () => {
    expect(canRetrieveRequestInBrowser([keyword])).toBe(true);
  });

  test("an empty method list cannot", () => {
    expect(canRetrieveRequestInBrowser([])).toBe(false);
  });

  test("tfidf cannot, since sklearn's vectorizer is not ported", () => {
    expect(
      canRetrieveRequestInBrowser([
        { id: "m", baseMethod: "tfidf", methodName: "TF-IDF" },
      ]),
    ).toBe(false);
  });

  test("a method wanting embeddings cannot, even if the base method is ported", () => {
    // embeddingProvider means the endpoint would compute vectors server-side.
    expect(
      canRetrieveRequestInBrowser([
        { ...keyword, embeddingProvider: "openai" },
      ]),
    ).toBe(false);
  });

  test("one unsupported method disqualifies the whole request", () => {
    expect(
      canRetrieveRequestInBrowser([
        keyword,
        { id: "m2", baseMethod: "lancedb_vector_store", methodName: "LanceDB" },
      ]),
    ).toBe(false);
  });

  test("the unsupported methods are named, for the error message", () => {
    expect(
      methodsNeedingBackend([
        keyword,
        { id: "m2", baseMethod: "tfidf", methodName: "TF-IDF" },
        { id: "m3", baseMethod: "embedding", methodName: "Embeddings" },
      ]),
    ).toEqual(["TF-IDF", "Embeddings"]);
  });
});

describe("input validation mirrors the endpoint", () => {
  const chunks = [
    {
      text: "some text",
      fill_history: { chunkMethod: "cm" },
      metavars: { chunkId: "c1" },
    },
  ];
  const methods = [
    { id: "m1", baseMethod: "bm25", methodName: "BM25", settings: {} },
  ];

  test("no methods", () => {
    expect(() =>
      retrieveRequestInBrowser({
        methods: [],
        chunks,
        queries: [{ text: "q" }],
      }),
    ).toThrow(/No retrieval methods provided/);
  });

  test("no chunks", () => {
    expect(() =>
      retrieveRequestInBrowser({
        methods,
        chunks: [],
        queries: [{ text: "q" }],
      }),
    ).toThrow(/No chunks provided/);
  });

  test("no queries", () => {
    expect(() =>
      retrieveRequestInBrowser({ methods, chunks, queries: [] }),
    ).toThrow(/No queries provided/);
  });

  test("a method needing the backend is refused by name", () => {
    expect(() =>
      retrieveRequestInBrowser({
        methods: [{ id: "m", baseMethod: "tfidf", methodName: "TF-IDF" }],
        chunks,
        queries: [{ text: "q" }],
      }),
    ).toThrow(/TF-IDF/);
  });
});
