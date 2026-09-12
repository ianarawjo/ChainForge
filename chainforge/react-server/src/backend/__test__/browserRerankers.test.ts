import { beforeEach, describe, expect, jest, test } from "@jest/globals";

/**
 * The real cross-encoder downloads tens of megabytes, so it is mocked. What
 * these pin is our side: that the model registry is coherent, that the model
 * is fetched once and only on demand, that the query is actually paired with
 * every document (a cross-encoder that scores documents alone is not doing
 * its job), and that the output matches the shape the node consumes.
 *
 * The fake scores by token overlap, so the expected ordering is derivable
 * rather than asserted from a recording.
 */

const mockLoads: { model: string; opts: any }[] = [];
/** Every (query, documents) batch the fake model was asked to score. */
const mockBatches: { query: string[]; pair: string[] }[] = [];
let mockFailNextLoad = false;

jest.mock("@huggingface/transformers", () => ({
  env: {},
  AutoTokenizer: {
    from_pretrained: async () => (query: string[], opts: any) => {
      mockBatches.push({ query, pair: opts.text_pair });
      return { query, pair: opts.text_pair };
    },
  },
  AutoModelForSequenceClassification: {
    from_pretrained: async (model: string, opts: any) => {
      mockLoads.push({ model, opts });
      if (mockFailNextLoad) {
        mockFailNextLoad = false;
        throw new Error("network died");
      }
      return async (inputs: any) => {
        const words = (s: string) => new Set(s.toLowerCase().split(/\W+/));
        const q = words(inputs.query[0]);
        return {
          logits: {
            tolist: () =>
              inputs.pair.map((doc: string) => {
                // Sentinels, so tests can drive the extremes a real
                // cross-encoder reaches instead of only small overlaps.
                if (doc.includes("VERYLOW")) return [-40];
                if (doc.includes("VERYHIGH")) return [40];
                let overlap = 0;
                for (const w of words(doc)) if (q.has(w)) overlap++;
                return [overlap];
              }),
          },
        };
      };
    },
  },
}));

function freshModule() {
  let mod: any;
  jest.isolateModules(() => {
    mod = require("../browserRerankers");
  });
  return mod;
}

const DOCS = [
  "the mitochondrion produces chemical energy",
  "reset your password from the sign in screen",
  "invoices are payable within thirty days",
];

beforeEach(() => {
  mockLoads.length = 0;
  mockBatches.length = 0;
  mockFailNextLoad = false;
});

describe("the reranker registry", () => {
  const mod = require("../browserRerankers");

  test("every entry is keyed by its own id", () => {
    for (const [key, model] of Object.entries<any>(mod.BROWSER_RERANK_MODELS))
      expect(model.id).toBe(key);
  });

  test("the default is one of the offered models", () => {
    expect(
      mod.BROWSER_RERANK_MODELS[mod.DEFAULT_BROWSER_RERANK_MODEL],
    ).toBeDefined();
  });

  test("every model is small enough to fetch on demand", () => {
    for (const model of Object.values<any>(mod.BROWSER_RERANK_MODELS)) {
      expect(model.sizeMB).toBeGreaterThan(0);
      expect(model.sizeMB).toBeLessThanOrEqual(50);
      expect(typeof model.note).toBe("string");
    }
  });

  test("an unknown id falls back to the default", () => {
    expect(mod.browserRerankModel("no/such-model").id).toBe(
      mod.DEFAULT_BROWSER_RERANK_MODEL,
    );
  });

  test("only the browser method is claimed", () => {
    expect(mod.canRerankInBrowser("browser_cross_encoder")).toBe(true);
    expect(mod.canRerankInBrowser("cross_encoder")).toBe(false);
    expect(mod.canRerankInBrowser("cohere_rerank")).toBe(false);
  });
});

describe("loading", () => {
  test("nothing loads until something reranks", () => {
    const mod = freshModule();
    expect(mod.isRerankerLoaded(mod.DEFAULT_BROWSER_RERANK_MODEL)).toBe(false);
    expect(mockLoads).toHaveLength(0);
  });

  test("an empty document list does not load the model", async () => {
    const mod = freshModule();
    expect(await mod.rerankInBrowser([], "anything")).toEqual([]);
    expect(mockLoads).toHaveLength(0);
  });

  test("concurrent callers share one download", async () => {
    const mod = freshModule();
    await Promise.all([
      mod.rerankInBrowser(DOCS, "password"),
      mod.rerankInBrowser(DOCS, "invoice"),
    ]);
    expect(mockLoads).toHaveLength(1);
  });

  test("weights are requested quantized, on wasm", async () => {
    const mod = freshModule();
    await mod.rerankInBrowser(DOCS, "password");
    expect(mockLoads[0].opts).toMatchObject({ dtype: "q8", device: "wasm" });
  });

  test("a failed load is not cached, so the node can retry", async () => {
    const mod = freshModule();
    mockFailNextLoad = true;
    await expect(mod.rerankInBrowser(DOCS, "password")).rejects.toThrow(
      /network died/,
    );
    expect(mod.isRerankerLoaded(mod.DEFAULT_BROWSER_RERANK_MODEL)).toBe(false);
    await mod.rerankInBrowser(DOCS, "password");
    expect(mockLoads).toHaveLength(2);
  });
});

describe("scoring", () => {
  test("the query is paired with every document", async () => {
    // The whole point of a cross-encoder: it reads the pair, not the document.
    const mod = freshModule();
    await mod.rerankInBrowser(DOCS, "reset password");
    expect(mockBatches).toHaveLength(1);
    expect(mockBatches[0].query).toEqual([
      "reset password",
      "reset password",
      "reset password",
    ]);
    expect(mockBatches[0].pair).toEqual(DOCS);
  });

  test("documents come back ordered by score, best first", async () => {
    const mod = freshModule();
    const out = await mod.rerankInBrowser(DOCS, "reset my password please");
    expect(out[0].document).toBe(DOCS[1]);
    expect(out[0].score).toBeGreaterThan(out[1].score);
  });

  test("scores are relevances in (0, 1), not raw logits", async () => {
    const mod = freshModule();
    const out = await mod.rerankInBrowser(DOCS, "reset my password please");
    for (const r of out) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.score).toBeLessThan(1);
    }
  });

  test("squashing preserves the order the model produced", async () => {
    // Sigmoid is monotonic, so it may change how scores read but never which
    // document wins. The fake scores by overlap, so the order is derivable.
    const mod = freshModule();
    const out = await mod.rerankInBrowser(DOCS, "reset your password screen");
    const overlap = (doc: string) => {
      const q = new Set("reset your password screen".split(" "));
      return doc.split(/\W+/).filter((w) => q.has(w.toLowerCase())).length;
    };
    const byOverlap = [...DOCS].sort((a, b) => overlap(b) - overlap(a));
    expect(out.map((r: any) => r.document)).toEqual(byOverlap);
  });

  test("extreme logits stay finite and inside the bounds", async () => {
    // Real cross-encoder logits run to roughly +-15; these go further, so
    // the mapping is pinned well outside the range it will actually meet.
    const mod = freshModule();
    const out = await mod.rerankInBrowser(
      ["a VERYHIGH match", "a VERYLOW match"],
      "query",
    );
    expect(out.map((r: any) => r.document)).toEqual([
      "a VERYHIGH match",
      "a VERYLOW match",
    ]);
    for (const r of out) {
      expect(Number.isFinite(r.score)).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
    // Still separated, not both flattened onto the same endpoint.
    expect(out[0].score).toBeGreaterThan(0.99);
    expect(out[1].score).toBeLessThan(0.01);
  });

  test("each result carries the index it had on the way in", async () => {
    const mod = freshModule();
    const out = await mod.rerankInBrowser(DOCS, "reset my password please");
    expect(out[0].index).toBe(1);
    // Every index is a real position in the input.
    for (const r of out) expect(DOCS[r.index]).toBe(r.document);
  });

  test("top_k limits the results", async () => {
    const mod = freshModule();
    const out = await mod.rerankInBrowser(DOCS, "password", { top_k: 2 });
    expect(out).toHaveLength(2);
  });

  test("a different query produces a different winner", async () => {
    const mod = freshModule();
    const out = await mod.rerankInBrowser(DOCS, "chemical energy cell");
    expect(out[0].document).toBe(DOCS[0]);
  });

  test("an empty query keeps the input order rather than inventing one", async () => {
    const mod = freshModule();
    const out = await mod.rerankInBrowser(DOCS, "");
    expect(out.map((r: any) => r.index)).toEqual([0, 1, 2]);
    // Scores still descend, so downstream ranking stays well-defined.
    expect(out[0].score).toBeGreaterThan(out[1].score);
    expect(mockLoads).toHaveLength(0);
  });

  test("the model choice in settings is honoured", async () => {
    const mod = freshModule();
    await mod.rerankInBrowser(DOCS, "password", {
      browserRerankModel: "Xenova/ms-marco-MiniLM-L-12-v2",
    });
    expect(mockLoads[0].model).toBe("Xenova/ms-marco-MiniLM-L-12-v2");
  });

  test("progress is reported while scoring", async () => {
    const mod = freshModule();
    const seen: any[] = [];
    await mod.rerankInBrowser(DOCS, "password", {}, (p: any) => seen.push(p));
    expect(seen.some((p) => p.phase === "embed" && p.percent === 100)).toBe(
      true,
    );
  });
});
