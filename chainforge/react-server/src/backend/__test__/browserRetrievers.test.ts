import { describe, expect, test } from "@jest/globals";
import {
  BROWSER_RETRIEVERS,
  canRetrieveInBrowser,
  normalizeQuery,
  retrieveInBrowser,
  simplePreprocess,
} from "../browserRetrievers";

// The reference implementations are in chainforge/rag/retrievers.py. The
// frontend runs these ports even when a backend exists, so the two must agree;
// the fixture below is shared with the Python suite so a divergence fails a
// build. Its expected values were generated from Python.
const fixture: {
  corpus: { text: string; docTitle: string; chunkId: string }[];
  tokenizer: { input: string; tokens: string[] }[];
  cases: {
    method: string;
    query: string;
    settings: Record<string, number>;
    hits: { chunkId: string; docTitle: string; similarity: number }[];
  }[];
} = (() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  return JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../../../tests/fixtures/keyword_retrieval_cases.json",
      ),
      "utf8",
    ),
  );
})();

const round10 = (n: number) => Number(n.toFixed(10));

describe("the shared fixture", () => {
  test("was found and has cases for every ported method", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
    for (const method of Object.keys(BROWSER_RETRIEVERS))
      expect(fixture.cases.some((c) => c.method === method)).toBe(true);
  });

  test("most cases actually return hits, so agreement is meaningful", () => {
    // A fixture of all-empty results would pass against almost any
    // implementation. Learned this the hard way with the markdown chunker.
    const withHits = fixture.cases.filter((c) => c.hits.length > 0);
    expect(withHits.length).toBeGreaterThan(fixture.cases.length / 2);
  });

  test("cases discriminate on ordering, not just on membership", () => {
    // At least some case must return more than one hit, or a wrong ranking
    // would go unnoticed.
    expect(fixture.cases.some((c) => c.hits.length > 1)).toBe(true);
  });
});

describe("simplePreprocess matches Python", () => {
  test.each(fixture.tokenizer)("tokenizes $input", ({ input, tokens }) => {
    expect(simplePreprocess(input)).toEqual(tokens);
  });

  test("length bounds are configurable, as in Python", () => {
    expect(simplePreprocess("a bb ccc", 1)).toEqual(["a", "bb", "ccc"]);
    expect(simplePreprocess("bb ccc", 2, 2)).toEqual(["bb"]);
  });
});

describe("keyword retrievers match Python", () => {
  test.each(fixture.cases)(
    "$method / $query / top_k=$settings.top_k",
    ({ method, query, settings, hits }) => {
      const results = retrieveInBrowser(
        method,
        fixture.corpus,
        [{ text: query }],
        settings,
      );
      expect(results).toHaveLength(1);

      const actual = results[0].retrieved_chunks.map((h) => ({
        chunkId: h.chunkId,
        docTitle: h.docTitle,
        similarity: round10(h.similarity),
      }));
      expect(actual).toEqual(hits);
    },
  );
});

describe("response shape", () => {
  const corpus = () => fixture.corpus;

  test.each(Object.keys(BROWSER_RETRIEVERS))(
    "%s returns one result per query",
    (method) => {
      const results = retrieveInBrowser(
        method,
        corpus(),
        [{ text: "python" }, { text: "memory" }],
        { top_k: 2 },
      );
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r).toHaveProperty("query_object");
        expect(Array.isArray(r.retrieved_chunks)).toBe(true);
      }
    },
  );

  test.each(Object.keys(BROWSER_RETRIEVERS))(
    "%s hits carry the fields /retrieve reads",
    (method) => {
      const hits = retrieveInBrowser(method, corpus(), [{ text: "python" }], {
        top_k: 1,
      })[0].retrieved_chunks;
      expect(hits.length).toBeGreaterThan(0);
      // docTitle and chunkId matter: /retrieve surfaces them, and rank fusion
      // keys documents by chunkId.
      expect(Object.keys(hits[0]).sort()).toEqual([
        "chunkId",
        "docTitle",
        "similarity",
        "text",
      ]);
      expect(hits[0].chunkId).toBeTruthy();
    },
  );

  test.each(Object.keys(BROWSER_RETRIEVERS))(
    "%s accepts a plain string query",
    (method) => {
      const results = retrieveInBrowser(method, corpus(), ["python"], {
        top_k: 1,
      });
      expect(results[0].query_object).toEqual({ text: "python" });
    },
  );

  test.each(Object.keys(BROWSER_RETRIEVERS))(
    "%s returns nothing for no queries",
    (method) => {
      expect(retrieveInBrowser(method, corpus(), [], { top_k: 3 })).toEqual([]);
    },
  );

  test.each(Object.keys(BROWSER_RETRIEVERS))(
    "%s tolerates an empty corpus",
    (method) => {
      const results = retrieveInBrowser(method, [], [{ text: "python" }], {
        top_k: 3,
      });
      expect(results).toHaveLength(1);
      expect(results[0].retrieved_chunks).toEqual([]);
    },
  );
});

describe("normalizeQuery", () => {
  test("a string becomes a text object", () => {
    expect(normalizeQuery("hi")).toEqual([{ text: "hi" }, "hi"]);
  });

  test("falls back through text, query, prompt", () => {
    expect(normalizeQuery({ query: "q" })[1]).toBe("q");
    expect(normalizeQuery({ prompt: "p" })[1]).toBe("p");
    expect(normalizeQuery({ text: "t", query: "q" })[1]).toBe("t");
  });

  test("extra fields are preserved on the object", () => {
    const [obj] = normalizeQuery({ text: "t", extra: 1 });
    expect(obj.extra).toBe(1);
  });

  test("a number is stringified", () => {
    expect(normalizeQuery(42)[1]).toBe("42");
  });
});

describe("registry", () => {
  test("reports the ported methods", () => {
    expect(canRetrieveInBrowser("bm25")).toBe(true);
    expect(canRetrieveInBrowser("boolean")).toBe(true);
    expect(canRetrieveInBrowser("overlap")).toBe(true);
  });

  test("does not claim methods that stay server-side", () => {
    // tfidf needs scikit-learn's vectorizer; the rest need embeddings or a
    // vector store.
    for (const m of [
      "tfidf",
      "embedding",
      "clustered",
      "lancedb_vector_store",
      "faiss_vector_store",
    ])
      expect(canRetrieveInBrowser(m)).toBe(false);
  });

  test("running a server-side method by name is refused clearly", () => {
    expect(() => retrieveInBrowser("tfidf", [], [], {})).toThrow(
      /needs the local ChainForge server/,
    );
  });
});
