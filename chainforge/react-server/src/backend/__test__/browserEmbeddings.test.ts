import { beforeEach, describe, expect, jest, test } from "@jest/globals";

/**
 * The real library downloads tens of megabytes of weights from HuggingFace,
 * so it is mocked throughout. What these tests pin is our side of the
 * contract: that the model registry is internally consistent, that the
 * download happens once and only on demand, that a failed load can be
 * retried, and that each model's pooling and query prefix actually reach
 * transformers.js -- the details that silently degrade ranking when wrong.
 */

/** Records every pipeline() call so we can assert on load behaviour. */
const mockPipelineCalls: { model: string; opts: any }[] = [];
/** Records every extractor invocation: the text and the pooling options. */
const mockExtractCalls: { text: string; opts: any }[] = [];
/** Lets a test make the next load fail. */
let mockFailNextLoad = false;

jest.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async (_task: string, model: string, opts: any) => {
    mockPipelineCalls.push({ model, opts });
    if (mockFailNextLoad) {
      mockFailNextLoad = false;
      throw new Error("network died");
    }
    // transformers.js reports during the load, so the mock does too.
    opts?.progress_callback?.({
      status: "progress",
      progress: 42,
      file: "model_quantized.onnx",
    });
    // Non-progress events must be ignored by our adapter.
    opts?.progress_callback?.({ status: "done", file: "config.json" });
    return async (text: string, extractOpts: any) => {
      mockExtractCalls.push({ text, opts: extractOpts });
      return { data: [1, 0, 0], dims: [1, 3] };
    };
  },
}));

// Required fresh in each test that cares about the module-level load cache.
function freshModule() {
  let mod: any;
  jest.isolateModules(() => {
    mod = require("../browserEmbeddings");
  });
  return mod;
}

beforeEach(() => {
  mockPipelineCalls.length = 0;
  mockExtractCalls.length = 0;
  mockFailNextLoad = false;
});

describe("the model registry", () => {
  const mod = require("../browserEmbeddings");
  const models = mod.BROWSER_EMBEDDING_MODELS;

  test("every entry is keyed by its own id", () => {
    for (const [key, model] of Object.entries<any>(models))
      expect(model.id).toBe(key);
  });

  test("the default is one of the offered models", () => {
    expect(models[mod.DEFAULT_BROWSER_EMBEDDING_MODEL]).toBeDefined();
  });

  test("the default is BGE small", () => {
    expect(mod.DEFAULT_BROWSER_EMBEDDING_MODEL).toBe(
      "Xenova/bge-small-en-v1.5",
    );
  });

  test("every model declares a plausible size and dimension", () => {
    for (const model of Object.values<any>(models)) {
      expect(model.dim).toBeGreaterThan(0);
      // If one of these ever exceeds ~100MB it stops being reasonable to
      // download on demand, which is the whole premise here.
      expect(model.sizeMB).toBeGreaterThan(0);
      expect(model.sizeMB).toBeLessThanOrEqual(100);
      expect(["cls", "mean"]).toContain(model.pooling);
      expect(typeof model.note).toBe("string");
    }
  });

  test("the download label reports the model's size", () => {
    expect(mod.modelDownloadLabel({ sizeMB: 34 })).toBe("~34MB");
  });

  test("an unknown or missing id falls back to the default", () => {
    expect(mod.browserEmbeddingModel("no/such-model").id).toBe(
      mod.DEFAULT_BROWSER_EMBEDDING_MODEL,
    );
    expect(mod.browserEmbeddingModel(undefined).id).toBe(
      mod.DEFAULT_BROWSER_EMBEDDING_MODEL,
    );
  });

  test("a known id is returned as-is", () => {
    expect(mod.browserEmbeddingModel("Xenova/all-MiniLM-L6-v2").id).toBe(
      "Xenova/all-MiniLM-L6-v2",
    );
  });
});

describe("loading a model", () => {
  test("nothing is loaded until something asks for it", () => {
    const mod = freshModule();
    expect(mod.isEmbedderLoaded("Xenova/bge-small-en-v1.5")).toBe(false);
    expect(mockPipelineCalls).toHaveLength(0);
  });

  test("concurrent callers share one download", async () => {
    const mod = freshModule();
    await Promise.all([
      mod.loadEmbedder("Xenova/bge-small-en-v1.5"),
      mod.loadEmbedder("Xenova/bge-small-en-v1.5"),
      mod.loadEmbedder("Xenova/bge-small-en-v1.5"),
    ]);
    expect(mockPipelineCalls).toHaveLength(1);
  });

  test("a second call after loading reuses the model", async () => {
    const mod = freshModule();
    await mod.loadEmbedder("Xenova/bge-small-en-v1.5");
    await mod.loadEmbedder("Xenova/bge-small-en-v1.5");
    expect(mockPipelineCalls).toHaveLength(1);
  });

  test("different models load independently", async () => {
    const mod = freshModule();
    await mod.loadEmbedder("Xenova/bge-small-en-v1.5");
    await mod.loadEmbedder("Xenova/all-MiniLM-L6-v2");
    expect(mockPipelineCalls.map((c) => c.model)).toEqual([
      "Xenova/bge-small-en-v1.5",
      "Xenova/all-MiniLM-L6-v2",
    ]);
  });

  test("a failed load is not cached, so the node can retry", async () => {
    const mod = freshModule();
    mockFailNextLoad = true;
    await expect(mod.loadEmbedder("Xenova/bge-small-en-v1.5")).rejects.toThrow(
      /network died/,
    );
    expect(mod.isEmbedderLoaded("Xenova/bge-small-en-v1.5")).toBe(false);

    // The retry succeeds and does load.
    await mod.loadEmbedder("Xenova/bge-small-en-v1.5");
    expect(mockPipelineCalls).toHaveLength(2);
  });

  test("weights load as q8 on wasm", async () => {
    const mod = freshModule();
    await mod.loadEmbedder("Xenova/bge-small-en-v1.5");
    expect(mockPipelineCalls[0].opts).toMatchObject({
      device: "wasm",
      dtype: "q8",
    });
  });

  test("download progress is reported, and non-progress events ignored", async () => {
    const mod = freshModule();
    const seen: any[] = [];
    await mod.loadEmbedder("Xenova/bge-small-en-v1.5", (p: any) =>
      seen.push(p),
    );
    expect(seen).toEqual([
      { phase: "download", percent: 42, detail: "model_quantized.onnx" },
    ]);
  });
});

describe("embedding text", () => {
  test("no texts means no model load at all", async () => {
    const mod = freshModule();
    expect(await mod.embedTexts("Xenova/bge-small-en-v1.5", [])).toEqual([]);
    expect(mockPipelineCalls).toHaveLength(0);
  });

  test("each model's own pooling is used", async () => {
    const mod = freshModule();
    await mod.embedTexts("Xenova/bge-small-en-v1.5", ["hello"]);
    expect(mockExtractCalls[0].opts).toEqual({
      pooling: "cls",
      normalize: true,
    });

    mockExtractCalls.length = 0;
    await mod.embedTexts("Xenova/all-MiniLM-L6-v2", ["hello"]);
    expect(mockExtractCalls[0].opts).toEqual({
      pooling: "mean",
      normalize: true,
    });
  });

  test("the query prefix is applied to queries only", async () => {
    const mod = freshModule();
    await mod.embedTexts("Xenova/bge-small-en-v1.5", ["a cat"], {
      isQuery: true,
    });
    expect(mockExtractCalls[0].text).toBe(
      "Represent this sentence for searching relevant passages: a cat",
    );

    mockExtractCalls.length = 0;
    await mod.embedTexts("Xenova/bge-small-en-v1.5", ["a cat"]);
    expect(mockExtractCalls[0].text).toBe("a cat");
  });

  test("a model with no prefix gets none even for queries", async () => {
    const mod = freshModule();
    await mod.embedTexts("Xenova/all-MiniLM-L6-v2", ["a cat"], {
      isQuery: true,
    });
    expect(mockExtractCalls[0].text).toBe("a cat");
  });

  test("vectors come back as Float32Array", async () => {
    const mod = freshModule();
    const [vector] = await mod.embedTexts("Xenova/bge-small-en-v1.5", ["x"]);
    expect(vector).toBeInstanceOf(Float32Array);
    expect(Array.from(vector)).toEqual([1, 0, 0]);
  });

  test("progress is reported per text while embedding", async () => {
    const mod = freshModule();
    const seen: any[] = [];
    await mod.embedTexts("Xenova/bge-small-en-v1.5", ["a", "b", "c", "d"], {
      onProgress: (p: any) => p.phase === "embed" && seen.push(p.percent),
    });
    expect(seen).toEqual([25, 50, 75, 100]);
  });
});

describe("cosine similarity", () => {
  const { cosineSimilarity } = require("../browserEmbeddings");

  test("identical unit vectors score 1", () => {
    const v = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  test("orthogonal vectors score 0", () => {
    expect(
      cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1])),
    ).toBeCloseTo(0);
  });

  test("opposed vectors score -1", () => {
    expect(
      cosineSimilarity(new Float32Array([1, 0]), new Float32Array([-1, 0])),
    ).toBeCloseTo(-1);
  });

  test("mismatched lengths do not read past the shorter vector", () => {
    expect(
      cosineSimilarity(
        new Float32Array([1, 0, 0]),
        new Float32Array([1, 0, 0, 99]),
      ),
    ).toBeCloseTo(1);
  });
});
