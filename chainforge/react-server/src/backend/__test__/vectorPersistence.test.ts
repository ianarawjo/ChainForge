import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// A real IndexedDB for Node; jsdom has none, so without this the vector store
// would degrade to a no-op and none of this would be exercised.
import "fake-indexeddb/auto";

/** Every text the fake model was asked to embed, in order. */
const mockEmbedded: string[] = [];

jest.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async () => async (text: string) => {
    mockEmbedded.push(text);
    // Distinct-but-deterministic vectors, so a wrong one is detectable.
    const seed = text.length % 7;
    return { data: [seed, 1, 0], dims: [1, 3] };
  },
}));

// eslint-disable-next-line import/first, @typescript-eslint/no-var-requires
const { semanticRetriever, clearVectorCache } =
  require("../browserSemanticRetriever") as any;
// eslint-disable-next-line import/first
import {
  clearVectors,
  loadVectorsForModel,
  saveVectors,
  trimVectorStore,
  vectorStoreAvailable,
  vectorStoreUsage,
} from "../vectorStore";

const CHUNKS = [
  { text: "alpha document", chunkId: "c1" },
  { text: "beta document here", chunkId: "c2" },
  { text: "gamma", chunkId: "c3" },
];

const BGE = "Xenova/bge-small-en-v1.5";

beforeEach(async () => {
  clearVectorCache();
  await clearVectors();
  mockEmbedded.length = 0;
});

describe("the store itself", () => {
  test("IndexedDB is available in this environment", () => {
    expect(vectorStoreAvailable()).toBe(true);
  });

  test("vectors round-trip", async () => {
    await saveVectors([
      { key: "m\u0000d\u0000hello", vector: new Float32Array([1, 2, 3]) },
    ]);
    const loaded = await loadVectorsForModel("m");
    expect(Array.from(loaded.get("m\u0000d\u0000hello")!)).toEqual([1, 2, 3]);
  });

  test("they come back as real Float32Arrays, not plain objects", async () => {
    await saveVectors([
      { key: "m\u0000d\u0000x", vector: new Float32Array([0.5]) },
    ]);
    const loaded = await loadVectorsForModel("m");
    expect(loaded.get("m\u0000d\u0000x")).toBeInstanceOf(Float32Array);
  });

  test("loading is scoped to one model", async () => {
    await saveVectors([
      { key: "modelA\u0000d\u0000same text", vector: new Float32Array([1]) },
      { key: "modelB\u0000d\u0000same text", vector: new Float32Array([2]) },
    ]);
    const a = await loadVectorsForModel("modelA");
    expect(a.size).toBe(1);
    expect(Array.from(a.values())[0][0]).toBe(1);
  });

  test("a model id that prefixes another does not capture its vectors", async () => {
    await saveVectors([
      { key: "bge\u0000d\u0000x", vector: new Float32Array([1]) },
      { key: "bge-small\u0000d\u0000x", vector: new Float32Array([2]) },
    ]);
    expect((await loadVectorsForModel("bge")).size).toBe(1);
  });

  test("saving nothing is a no-op that still succeeds", async () => {
    expect(await saveVectors([])).toBe(true);
    expect((await vectorStoreUsage()).count).toBe(0);
  });

  test("usage counts what was stored", async () => {
    await saveVectors([
      { key: "m\u0000d\u0000a", vector: new Float32Array([1, 2]) },
      { key: "m\u0000d\u0000b", vector: new Float32Array([3, 4]) },
    ]);
    const usage = await vectorStoreUsage();
    expect(usage.count).toBe(2);
    expect(usage.bytes).toBeGreaterThan(0);
  });

  test("clearing empties the store", async () => {
    await saveVectors([
      { key: "m\u0000d\u0000a", vector: new Float32Array([1]) },
    ]);
    await clearVectors();
    expect((await vectorStoreUsage()).count).toBe(0);
  });
});

describe("trimming to a budget", () => {
  test("a store under budget is left alone", async () => {
    await saveVectors([
      { key: "m\u0000d\u0000a", vector: new Float32Array([1]) },
    ]);
    expect(await trimVectorStore()).toBe(0);
    expect((await vectorStoreUsage()).count).toBe(1);
  });

  test("the oldest entries go first when over budget", async () => {
    await saveVectors([
      { key: "m\u0000d\u0000old", vector: new Float32Array(64) },
    ]);
    // A later timestamp, so ordering is unambiguous.
    await new Promise((r) => setTimeout(r, 5));
    await saveVectors([
      { key: "m\u0000d\u0000new", vector: new Float32Array(64) },
    ]);

    // A budget that fits roughly one record.
    const removed = await trimVectorStore(300);
    expect(removed).toBeGreaterThan(0);

    const remaining = await loadVectorsForModel("m");
    expect(remaining.has("m\u0000d\u0000old")).toBe(false);
    expect(remaining.has("m\u0000d\u0000new")).toBe(true);
  });

  test("a zero budget clears everything", async () => {
    await saveVectors([
      { key: "m\u0000d\u0000a", vector: new Float32Array(16) },
      { key: "m\u0000d\u0000b", vector: new Float32Array(16) },
    ]);
    await trimVectorStore(0);
    expect((await vectorStoreUsage()).count).toBe(0);
  });
});

describe("surviving a reload", () => {
  test("a second session does not re-embed the corpus", async () => {
    await semanticRetriever(CHUNKS, [{ text: "alpha" }], {});
    expect(mockEmbedded.length).toBe(4); // 3 chunks + 1 query

    // Losing the in-memory cache is what a page reload does.
    mockEmbedded.length = 0;
    clearVectorCache();

    await semanticRetriever(CHUNKS, [{ text: "alpha" }], {});
    expect(mockEmbedded).toEqual([]);
  });

  test("results are identical to the session that computed them", async () => {
    const before = await semanticRetriever(CHUNKS, [{ text: "alpha" }], {
      top_k: 3,
    });
    clearVectorCache();
    const after = await semanticRetriever(CHUNKS, [{ text: "alpha" }], {
      top_k: 3,
    });
    expect(after).toEqual(before);
  });

  test("only the genuinely new chunk is embedded after a reload", async () => {
    await semanticRetriever(CHUNKS, [{ text: "alpha" }], {});
    clearVectorCache();
    mockEmbedded.length = 0;

    await semanticRetriever(
      [...CHUNKS, { text: "delta added later", chunkId: "c4" }],
      [{ text: "alpha" }],
      {},
    );
    expect(mockEmbedded).toEqual(["delta added later"]);
  });

  test("vectors are persisted under the model that produced them", async () => {
    await semanticRetriever(CHUNKS, [{ text: "alpha" }], {});
    const stored = await loadVectorsForModel(BGE);
    expect(stored.size).toBe(4);
    // Nothing was filed under a model we never ran.
    expect((await loadVectorsForModel("Xenova/all-MiniLM-L6-v2")).size).toBe(0);
  });

  test("switching model after a reload re-embeds rather than reusing", async () => {
    await semanticRetriever(CHUNKS, [{ text: "alpha" }], {});
    clearVectorCache();
    mockEmbedded.length = 0;

    await semanticRetriever(CHUNKS, [{ text: "alpha" }], {
      browserEmbeddingModel: "Xenova/all-MiniLM-L6-v2",
    });
    expect(mockEmbedded.length).toBe(4);
  });

  test("a query and a chunk with identical text stay distinct on disk", async () => {
    // The bug this guards: caching by text alone served queries the passage
    // vector, which is wrong for models that prefix queries.
    await semanticRetriever([{ text: "alpha", chunkId: "c1" }], ["alpha"], {});
    const stored = await loadVectorsForModel(BGE);
    expect(stored.size).toBe(2);
  });

  test("vectors are filed under the embedding revision, not just the model", async () => {
    // Guards the stale-cache bug: changing how vectors are computed (weight
    // format, pooling, prefix) must make old entries misses, not wrong
    // answers. Keys carry the revision, so a bump cannot collide.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { EMBEDDING_REVISION } = require("../browserEmbeddings");
    await semanticRetriever(CHUNKS, [{ text: "alpha" }], {});
    const stored = await loadVectorsForModel(BGE);
    for (const key of stored.keys()) expect(key).toContain(EMBEDDING_REVISION);
  });
});
