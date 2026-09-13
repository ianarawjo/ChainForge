import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

/**
 * Where embedding runs. On the page's main thread, embedding a corpus freezes
 * the tab until it finishes, so embedTexts hands the work to a worker when the
 * page has one. These tests pin that routing and its fallback; the real worker
 * and model are replaced, and embeddingWorkerClient.test.ts covers the
 * messages themselves.
 */

/** Model loads that happened on the page rather than in the worker. */
const mockPipelineCalls: string[] = [];

jest.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: async (_task: string, model: string) => {
    mockPipelineCalls.push(model);
    return async () => ({ data: [1, 0, 0], dims: [1, 3] });
  },
}));

/** Stands in for the worker's client; each test decides what embed() does. */
const mockClient = { embed: jest.fn<Promise<Float32Array[]>, any[]>() };
const mockStartWorker = jest.fn<typeof mockClient, []>();

jest.mock("../embeddingWorker", () => ({
  startEmbeddingWorker: () => mockStartWorker(),
}));

/** The embeddings module and the client module it uses, from one registry. */
function freshModules() {
  let embeddings: any;
  let client: any;
  jest.isolateModules(() => {
    embeddings = require("../browserEmbeddings");
    client = require("../embeddingWorkerClient");
  });
  return { embeddings, client };
}

beforeEach(() => {
  mockPipelineCalls.length = 0;
  // Set here rather than where the mocks are made: the project's Jest config
  // resets mock implementations before every test.
  mockClient.embed.mockReset();
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

describe("embedding off the main thread", () => {
  test("goes to the worker when the page has one", async () => {
    const { embeddings } = freshModules();
    mockClient.embed.mockResolvedValue([new Float32Array([0, 1, 0])]);
    const onProgress = () => undefined;

    const vectors = await embeddings.embedTexts("no/such-model", ["a cat"], {
      isQuery: true,
      onProgress,
    });

    expect(Array.from(vectors[0])).toEqual([0, 1, 0]);
    // The model id is resolved on the page, so the worker gets a real one.
    expect(mockClient.embed).toHaveBeenCalledWith(
      "Xenova/bge-small-en-v1.5",
      ["a cat"],
      { isQuery: true, onProgress },
    );
    expect(mockPipelineCalls).toHaveLength(0);
  });

  test("starts the worker once", async () => {
    const { embeddings } = freshModules();
    mockClient.embed.mockResolvedValue([new Float32Array([1])]);
    await embeddings.embedTexts("Xenova/bge-small-en-v1.5", ["a"]);
    await embeddings.embedTexts("Xenova/bge-small-en-v1.5", ["b"]);
    expect(mockStartWorker).toHaveBeenCalledTimes(1);
  });

  test("no texts means no worker at all", async () => {
    const { embeddings } = freshModules();
    expect(await embeddings.embedTexts("Xenova/bge-small-en-v1.5", [])).toEqual(
      [],
    );
    expect(mockStartWorker).not.toHaveBeenCalled();
  });

  test("a worker that fails is replaced by the page, for good", async () => {
    const { embeddings, client } = freshModules();
    mockClient.embed.mockRejectedValue(
      new client.EmbeddingWorkerFailed("script failed to load"),
    );

    const vectors = await embeddings.embedTexts("Xenova/bge-small-en-v1.5", [
      "x",
    ]);
    expect(Array.from(vectors[0])).toEqual([1, 0, 0]);
    expect(mockPipelineCalls).toEqual(["Xenova/bge-small-en-v1.5"]);

    await embeddings.embedTexts("Xenova/bge-small-en-v1.5", ["y"]);
    expect(mockClient.embed).toHaveBeenCalledTimes(1);
  });

  test("a worker that cannot start is replaced by the page", async () => {
    const { embeddings } = freshModules();
    mockStartWorker.mockImplementationOnce(() => {
      throw new Error("Workers are blocked");
    });

    const vectors = await embeddings.embedTexts("Xenova/bge-small-en-v1.5", [
      "x",
    ]);
    expect(Array.from(vectors[0])).toEqual([1, 0, 0]);
    expect(mockClient.embed).not.toHaveBeenCalled();
  });

  test("a model error from the worker is reported, not retried on the page", async () => {
    const { embeddings } = freshModules();
    mockClient.embed.mockRejectedValue(new Error("network died"));

    await expect(
      embeddings.embedTexts("Xenova/bge-small-en-v1.5", ["x"]),
    ).rejects.toThrow("network died");
    expect(mockPipelineCalls).toHaveLength(0);
  });

  test("without Workers, embedding happens on the page", async () => {
    delete (globalThis as any).Worker;
    const { embeddings } = freshModules();
    const vectors = await embeddings.embedTexts("Xenova/bge-small-en-v1.5", [
      "x",
    ]);
    expect(Array.from(vectors[0])).toEqual([1, 0, 0]);
    expect(mockStartWorker).not.toHaveBeenCalled();
  });
});
