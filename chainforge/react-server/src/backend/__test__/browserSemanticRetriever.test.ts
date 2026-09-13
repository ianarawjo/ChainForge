import { beforeEach, describe, expect, jest, test } from "@jest/globals";

/**
 * A deterministic stand-in for the real model: each text maps to a unit vector
 * over three marker words, so expected rankings can be reasoned about exactly
 * rather than approximated. The caching and dispatch code under test is real.
 */
const MARKERS = ["apple", "banana", "cherry"];

/** Every text the fake model was asked to embed, in order. */
const mockEmbedded: string[] = [];

jest.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async () => async (text: string) => {
    mockEmbedded.push(text);
    const counts = MARKERS.map(
      (m) => (text.toLowerCase().match(new RegExp(m, "g")) ?? []).length,
    );
    const norm = Math.hypot(...counts) || 1;
    return { data: counts.map((c) => c / norm), dims: [1, MARKERS.length] };
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { semanticRetriever, clearVectorCache, cachedVectorCount } =
  require("../browserSemanticRetriever") as any;

const CHUNKS = [
  { text: "apple apple apple", docTitle: "fruit.md", chunkId: "c1" },
  { text: "banana banana", docTitle: "fruit.md", chunkId: "c2" },
  { text: "cherry", docTitle: "fruit.md", chunkId: "c3" },
];

beforeEach(() => {
  clearVectorCache();
  mockEmbedded.length = 0;
});

describe("ranking", () => {
  test("the semantically closest chunk comes first", async () => {
    const [result] = await semanticRetriever(CHUNKS, [{ text: "banana" }], {
      top_k: 3,
    });
    expect(result.retrieved_chunks.map((h: any) => h.chunkId)).toEqual([
      "c2",
      "c1",
      "c3",
    ]);
  });

  test("scores are raw cosine, not rescaled so the best hit is 1", async () => {
    // A query matching c1 exactly scores 1; the others are orthogonal, so 0.
    const [result] = await semanticRetriever(CHUNKS, [{ text: "apple" }], {
      top_k: 3,
    });
    expect(result.retrieved_chunks[0].similarity).toBeCloseTo(1);
    expect(result.retrieved_chunks[1].similarity).toBeCloseTo(0);
  });

  test("a mixed query ranks by proportion, not raw count", async () => {
    const [result] = await semanticRetriever(
      CHUNKS,
      [{ text: "apple banana banana" }],
      { top_k: 3 },
    );
    // Chunk vectors are normalized, so c2 (pure banana) beats c1 (pure apple)
    // for a query weighted two-thirds toward banana.
    expect(result.retrieved_chunks[0].chunkId).toBe("c2");
  });

  test("top_k limits the hits", async () => {
    const [result] = await semanticRetriever(CHUNKS, [{ text: "apple" }], {
      top_k: 1,
    });
    expect(result.retrieved_chunks).toHaveLength(1);
  });

  test("hits carry doc title and chunk id through", async () => {
    const [result] = await semanticRetriever(CHUNKS, [{ text: "cherry" }], {});
    expect(result.retrieved_chunks[0]).toMatchObject({
      docTitle: "fruit.md",
      chunkId: "c3",
      text: "cherry",
    });
  });

  test("one result per query, in order", async () => {
    const results = await semanticRetriever(
      CHUNKS,
      [{ text: "apple" }, { text: "cherry" }],
      { top_k: 1 },
    );
    expect(results).toHaveLength(2);
    expect(results[0].retrieved_chunks[0].chunkId).toBe("c1");
    expect(results[1].retrieved_chunks[0].chunkId).toBe("c3");
  });
});

describe("edge cases", () => {
  test("an empty corpus returns a result per query with no hits", async () => {
    const results = await semanticRetriever([], [{ text: "apple" }], {});
    expect(results).toHaveLength(1);
    expect(results[0].retrieved_chunks).toEqual([]);
    // Nothing was embedded, so no model was loaded.
    expect(mockEmbedded).toHaveLength(0);
  });

  test("an empty query yields no hits rather than an arbitrary order", async () => {
    const [result] = await semanticRetriever(CHUNKS, [{ text: "" }], {});
    expect(result.retrieved_chunks).toEqual([]);
  });

  test("a bare string query is accepted", async () => {
    const [result] = await semanticRetriever(CHUNKS, ["banana"], { top_k: 1 });
    expect(result.retrieved_chunks[0].chunkId).toBe("c2");
  });

  test("chunks with no text do not break scoring", async () => {
    const [result] = await semanticRetriever(
      [...CHUNKS, { text: undefined, chunkId: "c4" }],
      [{ text: "apple" }],
      { top_k: 4 },
    );
    expect(result.retrieved_chunks).toHaveLength(4);
    expect(result.retrieved_chunks[0].chunkId).toBe("c1");
  });
});

describe("the vector cache", () => {
  test("each distinct text is embedded once across runs", async () => {
    await semanticRetriever(CHUNKS, [{ text: "apple" }], {});
    const afterFirst = mockEmbedded.length;
    expect(cachedVectorCount()).toBe(4); // 3 chunks + 1 query

    await semanticRetriever(CHUNKS, [{ text: "apple" }], {});
    expect(mockEmbedded.length).toBe(afterFirst);
  });

  test("a repeated chunk in one corpus costs a single embedding", async () => {
    const dupes = [
      { text: "apple", chunkId: "a" },
      { text: "apple", chunkId: "b" },
      { text: "apple", chunkId: "c" },
    ];
    await semanticRetriever(dupes, [{ text: "apple" }], {});
    // "apple" as a passage, and once more with the query prefix.
    expect(mockEmbedded).toHaveLength(2);
  });

  test("adding a query re-embeds only the query", async () => {
    await semanticRetriever(CHUNKS, [{ text: "apple" }], {});
    mockEmbedded.length = 0;
    await semanticRetriever(CHUNKS, [{ text: "cherry" }], {});
    expect(mockEmbedded).toHaveLength(1);
  });

  test("clearing the cache forces re-embedding", async () => {
    await semanticRetriever(CHUNKS, [{ text: "apple" }], {});
    clearVectorCache();
    expect(cachedVectorCount()).toBe(0);
    mockEmbedded.length = 0;
    await semanticRetriever(CHUNKS, [{ text: "apple" }], {});
    expect(mockEmbedded.length).toBeGreaterThan(0);
  });

  test("switching model re-embeds, since vectors are not comparable", async () => {
    await semanticRetriever(CHUNKS, [{ text: "apple" }], {});
    mockEmbedded.length = 0;
    await semanticRetriever(CHUNKS, [{ text: "apple" }], {
      browserEmbeddingModel: "Xenova/all-MiniLM-L6-v2",
    });
    expect(mockEmbedded.length).toBeGreaterThan(0);
  });
});

describe("model selection", () => {
  test("queries get the model's prefix and chunks do not", async () => {
    await semanticRetriever(
      [{ text: "apple", chunkId: "c1" }],
      [{ text: "banana" }],
      { browserEmbeddingModel: "Xenova/bge-small-en-v1.5" },
    );
    expect(mockEmbedded).toEqual([
      "apple",
      "Represent this sentence for searching relevant passages: banana",
    ]);
  });

  test("a model without a prefix uses the bare query", async () => {
    await semanticRetriever(
      [{ text: "apple", chunkId: "c1" }],
      [{ text: "banana" }],
      { browserEmbeddingModel: "Xenova/all-MiniLM-L6-v2" },
    );
    expect(mockEmbedded).toEqual(["apple", "banana"]);
  });

  test("an unknown model id falls back rather than failing the run", async () => {
    const [result] = await semanticRetriever(CHUNKS, [{ text: "apple" }], {
      browserEmbeddingModel: "not/a-real-model",
    });
    expect(result.retrieved_chunks[0].chunkId).toBe("c1");
  });
});
