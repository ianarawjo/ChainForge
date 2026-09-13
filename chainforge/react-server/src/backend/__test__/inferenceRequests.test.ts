import { afterEach, describe, expect, jest, test } from "@jest/globals";

/**
 * What the inference worker does with each request, run here on Jest's thread
 * with the models replaced. The worker file itself only passes messages to
 * handleInferenceRequest and back.
 */

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const hold = { nliTokenizer: false };
  let releaseTokenizer = () => undefined as void;

  // Fresh modules for every test: the NLI load and its cancellation are
  // module state, in the worker as on the page.
  jest.resetModules();
  jest.doMock("@huggingface/transformers", () => ({
    env: {},
    pipeline: async (_task: string, _model: string, opts: any) => {
      opts?.progress_callback?.({
        status: "progress",
        progress: 50,
        file: "model_quantized.onnx",
      });
      return async (text: string) => ({
        data: [text.length, 0, 0],
        dims: [1, 3],
      });
    },
    AutoTokenizer: {
      from_pretrained: async (model: string) => {
        if (model.includes("nli") && hold.nliTokenizer)
          await new Promise<void>((resolve) => {
            releaseTokenizer = resolve;
          });
        return async (_first: unknown, opts: any) => ({ pair: opts.text_pair });
      },
    },
    AutoModelForSequenceClassification: {
      from_pretrained: async () =>
        Object.assign(
          async (inputs: { pair: string | string[] }) => ({
            logits: {
              // Reranking: a high logit for documents saying "match".
              tolist: () =>
                (inputs.pair as string[]).map((d) => [
                  d.includes("match") ? 3 : -3,
                ]),
              // NLI: entailment only for the hypothesis "entailed".
              data: inputs.pair === "entailed" ? [0, 9, 0] : [9, 0, 0],
            },
          }),
          {
            config: {
              id2label: { 0: "contradiction", 1: "entailment", 2: "neutral" },
            },
          },
        ),
    },
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const requests: typeof import("../inferenceRequests") = require("../inferenceRequests");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nli: typeof import("../browserNli") = require("../browserNli");
  return { requests, nli, hold, release: () => releaseTokenizer() };
}

afterEach(() => {
  jest.dontMock("@huggingface/transformers");
});

describe("handling a request in the worker", () => {
  test("embed returns vectors and reports progress", async () => {
    const { requests } = setup();
    const progress: any[] = [];
    const vectors = (await requests.handleInferenceRequest(
      {
        kind: "embed",
        modelId: "Xenova/bge-small-en-v1.5",
        texts: ["ab", "abcd"],
        isQuery: false,
      },
      (p) => progress.push(p),
    )) as Float32Array[];

    expect(vectors.map((v) => Array.from(v))).toEqual([
      [2, 0, 0],
      [4, 0, 0],
    ]);
    expect(progress[0]).toMatchObject({ phase: "download", percent: 50 });
    expect(progress.slice(1).map((p) => p.percent)).toEqual([50, 100]);
  });

  test("rerank returns a relevance per document, in input order", async () => {
    const { requests } = setup();
    const progress: any[] = [];
    const scores = (await requests.handleInferenceRequest(
      {
        kind: "rerank",
        modelId: "Xenova/ms-marco-MiniLM-L-6-v2",
        query: "q",
        documents: ["no", "a match"],
      },
      (p) => progress.push(p),
    )) as number[];

    expect(scores[0]).toBeCloseTo(1 / (1 + Math.exp(3)));
    expect(scores[1]).toBeCloseTo(1 / (1 + Math.exp(-3)));
    expect(progress.map((p) => p.percent)).toEqual([0, 100]);
  });

  test("loadNli then entails judges with the loaded model", async () => {
    const { requests } = setup();
    const none = () => undefined;
    expect(
      await requests.handleInferenceRequest({ kind: "loadNli" }, none),
    ).toBeNull();
    expect(
      await requests.handleInferenceRequest(
        { kind: "entails", premise: "p", hypothesis: "entailed" },
        none,
      ),
    ).toBe(true);
    expect(
      await requests.handleInferenceRequest(
        { kind: "entails", premise: "p", hypothesis: "something else" },
        none,
      ),
    ).toBe(false);
  });

  test("cancelNliDownload stops a load in flight, which can then be retried", async () => {
    const { requests, nli, hold, release } = setup();
    const none = () => undefined;
    hold.nliTokenizer = true;
    const loading = requests.handleInferenceRequest({ kind: "loadNli" }, none);
    await flush();

    await requests.handleInferenceRequest({ kind: "cancelNliDownload" }, none);
    await expect(loading).rejects.toBeInstanceOf(nli.DownloadCancelled);
    release();

    hold.nliTokenizer = false;
    expect(
      await requests.handleInferenceRequest({ kind: "loadNli" }, none),
    ).toBeNull();
  });

  test("cancelling with no download in flight does nothing", async () => {
    const { requests } = setup();
    await expect(
      requests.handleInferenceRequest(
        { kind: "cancelNliDownload" },
        () => undefined,
      ),
    ).resolves.toBeNull();
  });
});
