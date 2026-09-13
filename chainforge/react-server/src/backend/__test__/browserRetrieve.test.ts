import { describe, expect, jest, test } from "@jest/globals";
import {
  BROWSER_SEMANTIC_METHOD,
  canRetrieveRequestInBrowser,
  methodsNeedingBackend,
  retrievalLocation,
  retrieveAcrossBrowserAndServer,
  retrieveRequestInBrowser,
} from "../browserRetrieve";

// For the in-browser semantic method: a vector per text from which words it
// contains, so similarity follows shared words.
jest.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async () => async (text: string) => ({
    data: [text.includes("cat") ? 1 : 0, text.includes("mat") ? 1 : 0, 0.1],
    dims: [1, 3],
  }),
}));

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
  test.each(fixture.cases)("$name", async ({ request, response }) => {
    const actual = await retrieveRequestInBrowser(request);
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

  const semantic = {
    id: "s1",
    baseMethod: BROWSER_SEMANTIC_METHOD,
    methodName: "Semantic Search (in-browser)",
    settings: {},
  };

  test("the in-browser semantic method can", () => {
    expect(canRetrieveRequestInBrowser([semantic])).toBe(true);
  });

  test("semantic mixed with keyword can, which is what fusion needs", () => {
    expect(canRetrieveRequestInBrowser([keyword, semantic])).toBe(true);
  });

  test("semantic mixed with a backend-only method cannot", () => {
    expect(
      methodsNeedingBackend([
        semantic,
        { id: "m", baseMethod: "tfidf", methodName: "TF-IDF" },
      ]),
    ).toEqual(["TF-IDF"]);
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

  test("no methods", async () => {
    await expect(
      retrieveRequestInBrowser({
        methods: [],
        chunks,
        queries: [{ text: "q" }],
      }),
    ).rejects.toThrow(/No retrieval methods provided/);
  });

  test("no chunks", async () => {
    await expect(
      retrieveRequestInBrowser({
        methods,
        chunks: [],
        queries: [{ text: "q" }],
      }),
    ).rejects.toThrow(/No chunks provided/);
  });

  test("no queries", async () => {
    await expect(
      retrieveRequestInBrowser({ methods, chunks, queries: [] }),
    ).rejects.toThrow(/No queries provided/);
  });

  test("a method needing the backend is refused by name", async () => {
    await expect(
      retrieveRequestInBrowser({
        methods: [{ id: "m", baseMethod: "tfidf", methodName: "TF-IDF" }],
        chunks,
        queries: [{ text: "q" }],
      }),
    ).rejects.toThrow(/TF-IDF/);
  });
});

describe("mixing browser and server methods", () => {
  const bm25 = { id: "bm25", baseMethod: "bm25", methodName: "BM25" };
  const tfidf = { id: "tfidf", baseMethod: "tfidf", methodName: "TF-IDF" };
  const semantic = {
    id: "sem",
    baseMethod: BROWSER_SEMANTIC_METHOD,
    methodName: "Semantic Search (in-browser)",
  };

  const chunks = [
    ["A", "a1", "the cat sat"],
    ["A", "a2", "a mat by the door"],
    ["B", "b1", "a cat on a mat"],
  ].map(([chunkMethod, chunkId, text]) => ({
    text,
    fill_history: { chunkMethod },
    metavars: { chunkId, docTitle: "doc" },
  }));

  /** A row as the endpoint returns it. */
  const serverRow = (
    method: typeof tfidf,
    chunkMethod: string,
    chunkId: string,
    rank: number,
    similarity: number,
  ) => ({
    text: chunks.find((c) => c.metavars.chunkId === chunkId)?.text ?? "",
    prompt: "cat mat",
    eval_res: { items: [{ similarity, rank }], dtype: "KeyValue_Mixed" },
    vars: {
      query: "cat mat",
      retrievalMethod: method.methodName,
      chunkMethod,
    },
    metavars: {
      methodId: method.id,
      retrievalMethodSignature: method.baseMethod,
      signature: `${chunkMethod}-${method.methodName}`,
      docTitle: "doc",
      chunkId,
      chunkLibrary: "",
      latency_ms: "1.00ms",
    },
    llm: "(none)",
  });

  test("where the methods run", () => {
    expect(retrievalLocation([bm25, semantic])).toBe("browser");
    expect(retrievalLocation([tfidf])).toBe("server");
    expect(retrievalLocation([semantic, tfidf])).toBe("both");
    expect(retrievalLocation([])).toBe("server");
  });

  test("in-browser semantic search stays here while TF-IDF goes to the server", async () => {
    const sent: any[] = [];
    const rows = await retrieveAcrossBrowserAndServer(
      {
        methods: [tfidf, semantic],
        chunks,
        queries: [{ text: "cat mat" }],
        fusion_enabled: true,
        linked_groups: [
          {
            id: "g",
            methodKeys: ["tfidf", "sem"],
            fusionMethod: "reciprocal_rank_fusion",
          },
        ],
      },
      async (request) => {
        sent.push(request);
        return [
          serverRow(tfidf, "A", "a1", 1, 0.5),
          serverRow(tfidf, "A", "a2", 2, 0.2),
          serverRow(tfidf, "B", "b1", 1, 0.9),
        ] as any;
      },
    );

    // The server is sent only what it can run, and does no fusing, since the
    // group spans both sides.
    expect(sent).toHaveLength(1);
    expect(sent[0].methods).toEqual([tfidf]);
    expect(sent[0].fusion_enabled).toBe(false);
    expect(sent[0].linked_groups).toEqual([]);

    // Rows in endpoint order: by chunking method, then by retrieval method.
    expect(
      rows
        .filter((r) => !r.metavars.methodId.startsWith("group:"))
        .map((r) => `${r.vars.chunkMethod}:${r.metavars.methodId}`),
    ).toEqual(["A:tfidf", "A:tfidf", "A:sem", "A:sem", "B:tfidf", "B:sem"]);

    // Fused across the two sides, per chunking method.
    const fused = rows.filter((r) => r.metavars.methodId === "group:g");
    expect(fused.map((r) => r.vars.chunkMethod)).toEqual(["A", "A", "B"]);
    expect(fused[0].vars.retrievalMethod).toBe(
      "Fused (TF-IDF + Semantic Search (in-browser))",
    );
    expect(fused.map((r) => r.eval_res.items[0].rank)).toEqual([1, 2, 1]);
  });

  test("a failing server fails the run rather than returning half the results", async () => {
    await expect(
      retrieveAcrossBrowserAndServer(
        { methods: [bm25, tfidf], chunks, queries: [{ text: "cat" }] },
        async () => {
          throw new Error("the server did not respond");
        },
      ),
    ).rejects.toThrow("the server did not respond");
  });

  test("with nothing for the server, nothing is sent to it", async () => {
    const runOnServer = jest.fn(async () => []);
    const rows = await retrieveAcrossBrowserAndServer(
      { methods: [bm25], chunks, queries: [{ text: "cat" }] },
      runOnServer,
    );
    expect(runOnServer).not.toHaveBeenCalled();
    expect(rows.length).toBeGreaterThan(0);
  });

  // The strongest check: any fixture request, split so that one method runs
  // "on the server", must still match what the endpoint returned. The browser
  // implementation stands in for the server, which the fixture shows it
  // matches.
  const splittable = fixture.cases.filter((c) => c.request.methods.length > 1);

  test("the fixture has requests with several methods to split", () => {
    expect(splittable.length).toBeGreaterThan(0);
  });

  test.each(splittable)(
    "split across both sides, $name still matches the endpoint",
    async ({ request, response }) => {
      const first = request.methods[0].id;
      const actual = await retrieveAcrossBrowserAndServer(
        request,
        (part) => retrieveRequestInBrowser(part),
        undefined,
        (m) => m.id === first,
      );
      expect(normalize(actual)).toEqual(normalize(response));
    },
  );
});
