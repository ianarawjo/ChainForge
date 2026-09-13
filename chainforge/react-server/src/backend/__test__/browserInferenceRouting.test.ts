import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

/**
 * Where the in-browser models run. On the page's main thread, embedding a
 * corpus, reranking a long list or judging a turn's answers freezes the tab
 * until it finishes, so each goes to the inference worker when the page has
 * one. These tests pin that routing and its fallbacks. The worker and the
 * models are replaced; inferenceWorkerClient.test.ts covers the messages and
 * inferenceRequests.test.ts what the worker does with them.
 */

/** Models that loaded on the page rather than in the worker. */
const mockPageLoads: string[] = [];

jest.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async (_task: string, model: string) => {
    mockPageLoads.push(model);
    return async () => ({ data: [1, 0, 0], dims: [1, 3] });
  },
  AutoTokenizer: {
    from_pretrained: async () => async (first: unknown) => ({
      pairs: Array.isArray(first) ? first.length : 1,
    }),
  },
  AutoModelForSequenceClassification: {
    from_pretrained: async (model: string) => {
      mockPageLoads.push(model);
      return Object.assign(
        async (inputs: { pairs: number }) => ({
          logits: {
            tolist: () => Array.from({ length: inputs.pairs }, () => [0]),
            data: [0, 9, 0],
          },
        }),
        {
          config: {
            id2label: { 0: "contradiction", 1: "entailment", 2: "neutral" },
          },
        },
      );
    },
  },
}));

/** Stands in for the worker's client; each test decides what it answers. */
const mockClient = { request: jest.fn<Promise<unknown>, any[]>() };
const mockStartWorker = jest.fn<typeof mockClient, []>();

jest.mock("../inferenceWorker", () => ({
  startInferenceWorker: () => mockStartWorker(),
}));

/** The model modules and the client module, from one module registry. */
function freshModules() {
  let embeddings: any;
  let rerankers: any;
  let nli: any;
  let client: any;
  jest.isolateModules(() => {
    embeddings = require("../browserEmbeddings");
    rerankers = require("../browserRerankers");
    nli = require("../browserNli");
    client = require("../inferenceWorkerClient");
  });
  return { embeddings, rerankers, nli, client };
}

/** What the fake worker was asked to do, in order. */
const kinds = () => mockClient.request.mock.calls.map((c: any[]) => c[0].kind);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockPageLoads.length = 0;
  // Set here rather than where the mocks are made: the project's Jest config
  // resets mock implementations before every test.
  mockClient.request.mockReset();
  mockStartWorker.mockReset();
  mockStartWorker.mockImplementation(() => mockClient);
  // jsdom has no Worker; the page under test does.
  (globalThis as any).Worker = class {};
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  delete (globalThis as any).Worker;
  jest.restoreAllMocks();
});

describe("in the worker", () => {
  test("embedding goes to the worker", async () => {
    const { embeddings } = freshModules();
    mockClient.request.mockResolvedValue([new Float32Array([0, 1, 0])]);
    const onProgress = () => undefined;

    const vectors = await embeddings.embedTexts("no/such-model", ["a cat"], {
      isQuery: true,
      onProgress,
    });

    expect(Array.from(vectors[0])).toEqual([0, 1, 0]);
    // The model id is resolved on the page, so the worker gets a real one.
    expect(mockClient.request).toHaveBeenCalledWith(
      {
        kind: "embed",
        modelId: "Xenova/bge-small-en-v1.5",
        texts: ["a cat"],
        isQuery: true,
      },
      onProgress,
    );
    expect(mockPageLoads).toHaveLength(0);
  });

  test("reranking goes to the worker", async () => {
    const { rerankers } = freshModules();
    mockClient.request.mockResolvedValue([0.2, 0.9]);

    const reranked = await rerankers.rerankInBrowser(["one", "two"], "q");

    expect(reranked.map((r: any) => [r.document, r.score])).toEqual([
      ["two", 0.9],
      ["one", 0.2],
    ]);
    expect(mockClient.request.mock.calls[0][0]).toEqual({
      kind: "rerank",
      modelId: "Xenova/ms-marco-MiniLM-L-6-v2",
      query: "q",
      documents: ["one", "two"],
    });
    expect(mockPageLoads).toHaveLength(0);
  });

  test("the NLI model loads and judges in the worker", async () => {
    const { nli } = freshModules();
    mockClient.request.mockImplementation(async (request: any) =>
      request.kind === "entails" ? true : null,
    );

    const entails = await nli.loadNli();
    expect(await entails("the cat sat", "a cat sat")).toBe(true);
    expect(nli.isNliLoaded()).toBe(true);
    expect(kinds()).toEqual(["loadNli", "entails"]);
    expect(mockClient.request.mock.calls[1][0]).toEqual({
      kind: "entails",
      premise: "the cat sat",
      hypothesis: "a cat sat",
    });
    expect(mockPageLoads).toHaveLength(0);
  });

  test("a second load reuses the first", async () => {
    const { nli } = freshModules();
    mockClient.request.mockResolvedValue(null);
    await nli.loadNli();
    await nli.loadNli();
    expect(kinds()).toEqual(["loadNli"]);
  });

  test("cancelling the NLI download tells the worker and rejects at once", async () => {
    const { nli } = freshModules();
    mockClient.request.mockImplementation((request: any) =>
      request.kind === "loadNli"
        ? new Promise(() => undefined) // a download that never finishes
        : Promise.resolve(null),
    );
    const controller = new AbortController();
    const loading = nli.loadNli({ signal: controller.signal });
    await flush();

    controller.abort();

    await expect(loading).rejects.toBeInstanceOf(nli.DownloadCancelled);
    expect(kinds()).toEqual(["loadNli", "cancelNliDownload"]);
    expect(nli.isNliLoaded()).toBe(false);

    // And it can be retried.
    mockClient.request.mockResolvedValue(null);
    await expect(nli.loadNli()).resolves.toBeInstanceOf(Function);
  });

  test("a signal already aborted rejects without asking the worker", async () => {
    const { nli } = freshModules();
    const controller = new AbortController();
    controller.abort();
    await expect(
      nli.loadNli({ signal: controller.signal }),
    ).rejects.toBeInstanceOf(nli.DownloadCancelled);
    expect(mockClient.request).not.toHaveBeenCalled();
  });

  test("a cancellation reported by the worker is a DownloadCancelled here", async () => {
    const { nli } = freshModules();
    mockClient.request.mockRejectedValue(
      Object.assign(new Error("Download cancelled"), {
        name: "DownloadCancelled",
      }),
    );
    await expect(nli.loadNli()).rejects.toBeInstanceOf(nli.DownloadCancelled);
  });

  test("the worker starts once for every model", async () => {
    const { embeddings, rerankers, nli } = freshModules();
    mockClient.request.mockImplementation(async (request: any) =>
      request.kind === "embed"
        ? [new Float32Array([1])]
        : request.kind === "rerank"
          ? [1]
          : null,
    );
    await embeddings.embedTexts("Xenova/bge-small-en-v1.5", ["a"]);
    await rerankers.rerankInBrowser(["d"], "q");
    await nli.loadNli();
    expect(mockStartWorker).toHaveBeenCalledTimes(1);
  });
});

describe("falling back to the page", () => {
  test("a worker that fails is replaced by the page, for every model", async () => {
    const { embeddings, rerankers, client } = freshModules();
    mockClient.request.mockRejectedValue(
      new client.InferenceWorkerFailed("script failed to load"),
    );

    const vectors = await embeddings.embedTexts("Xenova/bge-small-en-v1.5", [
      "x",
    ]);
    expect(Array.from(vectors[0])).toEqual([1, 0, 0]);

    await rerankers.rerankInBrowser(["d"], "q");
    // Once failed, the worker is not asked again.
    expect(mockClient.request).toHaveBeenCalledTimes(1);
    expect(mockPageLoads).toEqual([
      "Xenova/bge-small-en-v1.5",
      "Xenova/ms-marco-MiniLM-L-6-v2",
    ]);
  });

  test("an NLI load in a failed worker falls back to the page", async () => {
    const { nli, client } = freshModules();
    mockClient.request.mockRejectedValue(
      new client.InferenceWorkerFailed("crashed"),
    );
    const entails = await nli.loadNli();
    expect(await entails("a", "b")).toBe(true);
    expect(mockPageLoads).toEqual(["Xenova/nli-deberta-v3-xsmall"]);
  });

  test("a worker that cannot start is replaced by the page", async () => {
    const { rerankers } = freshModules();
    mockStartWorker.mockImplementationOnce(() => {
      throw new Error("Workers are blocked");
    });
    const reranked = await rerankers.rerankInBrowser(["d"], "q");
    expect(reranked).toHaveLength(1);
    expect(mockClient.request).not.toHaveBeenCalled();
  });

  test("a model error from the worker is reported, not retried on the page", async () => {
    const { rerankers } = freshModules();
    mockClient.request.mockRejectedValue(new Error("network died"));
    await expect(rerankers.rerankInBrowser(["d"], "q")).rejects.toThrow(
      "network died",
    );
    expect(mockPageLoads).toHaveLength(0);
  });

  test("without Workers, models run on the page", async () => {
    delete (globalThis as any).Worker;
    const { embeddings } = freshModules();
    const vectors = await embeddings.embedTexts("Xenova/bge-small-en-v1.5", [
      "x",
    ]);
    expect(Array.from(vectors[0])).toEqual([1, 0, 0]);
    expect(mockStartWorker).not.toHaveBeenCalled();
  });
});
