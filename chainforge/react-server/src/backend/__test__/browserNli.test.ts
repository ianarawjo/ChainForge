import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { downloadProgress, isEntailment } from "../browserNli";

describe("isEntailment", () => {
  const labels = { 0: "contradiction", 1: "entailment", 2: "neutral" };

  test("true when entailment scores highest", () => {
    expect(isEntailment([-2, 3, 0.5], labels)).toBe(true);
  });

  test("false when neutral or contradiction scores highest", () => {
    expect(isEntailment([-2, 0.4, 0.5], labels)).toBe(false);
    expect(isEntailment([4, 3, 0.5], labels)).toBe(false);
  });

  test("reads labels in whatever order and case the model uses", () => {
    // mobilebert-mnli orders its labels differently from DeBERTa.
    expect(
      isEntailment([2, 0, 1], { 0: "ENTAILMENT", 1: "neutral", 2: "contra" }),
    ).toBe(true);
  });

  test("accepts label maps keyed by string", () => {
    expect(isEntailment([0, 1], { "0": "neutral", "1": "entailment" })).toBe(
      true,
    );
  });
});

describe("downloadProgress", () => {
  test("adds up bytes across files", () => {
    const p = downloadProgress(
      {
        "tokenizer.json": { loaded: 9e6, total: 9e6 },
        "onnx/model_quantized.onnx": { loaded: 39e6, total: 87e6 },
      },
      96,
    );
    expect(p.loadedMB).toBeCloseTo(48);
    expect(p.totalMB).toBeCloseTo(96);
    expect(p.percent).toBeCloseTo(50);
  });

  test("never shows a total below the known size of the whole", () => {
    // Only the tokenizer has started; the bar must not read as nearly done.
    const p = downloadProgress(
      { "tokenizer.json": { loaded: 9e6, total: 9e6 } },
      96,
    );
    expect(p.totalMB).toBe(96);
    expect(p.percent).toBeCloseTo(9.375);
  });

  test("a larger download than expected raises the total", () => {
    const p = downloadProgress({ a: { loaded: 50e6, total: 120e6 } }, 96);
    expect(p.totalMB).toBeCloseTo(120);
  });

  test("nothing yet is 0%", () => {
    expect(downloadProgress({}, 96)).toEqual({
      loadedMB: 0,
      totalMB: 96,
      percent: 0,
    });
  });
});

describe("loadNli", () => {
  const ID = "Xenova/nli-deberta-v3-xsmall";
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  /**
   * A stand-in for transformers.js: each load fetches its file through
   * env.fetch, and the tokenizer can be held mid-download.
   */
  function setup() {
    const fetches: { url: string; signal?: AbortSignal }[] = [];
    const hold = { tokenizer: false };
    let releaseTokenizer = () => undefined as void;
    const env: any = {
      allowLocalModels: true,
      fetch: async (url: string, init?: { signal?: AbortSignal }) => {
        fetches.push({ url, signal: init?.signal });
        return {};
      },
    };
    const model = Object.assign(async () => ({ logits: { data: [0, 5, 0] } }), {
      config: {
        id2label: { 0: "contradiction", 1: "entailment", 2: "neutral" },
      },
    });
    const tokenizerLoad = jest.fn(async () => {
      await env.fetch(
        `https://huggingface.co/${ID}/resolve/main/tokenizer.json`,
      );
      if (hold.tokenizer)
        await new Promise<void>((resolve) => {
          releaseTokenizer = resolve;
        });
      return async () => ({});
    });
    const modelLoad = jest.fn(async () => {
      await env.fetch(
        `https://huggingface.co/${ID}/resolve/main/onnx/model_quantized.onnx`,
      );
      return model;
    });
    // Fresh modules for every test. The loader imports transformers.js
    // asynchronously, after any isolateModules callback has returned, so it
    // would otherwise get an earlier test's mock.
    jest.resetModules();
    jest.doMock("@huggingface/transformers", () => ({
      env,
      AutoTokenizer: { from_pretrained: tokenizerLoad },
      AutoModelForSequenceClassification: { from_pretrained: modelLoad },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nli: typeof import("../browserNli") = require("../browserNli");
    return {
      nli,
      env,
      fetches,
      hold,
      modelLoad,
      release: () => releaseTokenizer(),
    };
  }

  afterEach(() => {
    jest.dontMock("@huggingface/transformers");
  });

  test("resolves to a judge of entailment", async () => {
    const { nli } = setup();
    const entails = await nli.loadNli();
    expect(await entails("a", "b")).toBe(true);
    expect(nli.isNliLoaded()).toBe(true);
  });

  test("this model's requests carry the signal; other models' do not", async () => {
    const { nli, env, fetches } = setup();
    const controller = new AbortController();
    await nli.loadNli({ signal: controller.signal });
    expect(fetches.map((f) => f.signal)).toEqual([
      controller.signal,
      controller.signal,
    ]);

    // A concurrent download of another model must not be cancellable here.
    const other = new AbortController();
    await nli.loadNli({ signal: other.signal });
    await env.fetch("https://huggingface.co/Xenova/bge-small-en-v1.5/x.onnx");
    expect(fetches[fetches.length - 1].signal).toBeUndefined();
  });

  test("cancelling mid-download rejects, and the model never starts", async () => {
    const { nli, hold, modelLoad, release } = setup();
    hold.tokenizer = true;
    const controller = new AbortController();
    const loading = nli.loadNli({ signal: controller.signal });
    await flush();

    controller.abort();
    await expect(loading).rejects.toBeInstanceOf(nli.DownloadCancelled);

    // The tokenizer's download finishing afterwards must not go on to fetch
    // the 87MB model.
    release();
    await flush();
    await flush();
    expect(modelLoad).not.toHaveBeenCalled();
    expect(nli.isNliLoaded()).toBe(false);
  });

  test("a cancelled load can be retried", async () => {
    const { nli, hold, release } = setup();
    hold.tokenizer = true;
    const controller = new AbortController();
    const first = nli.loadNli({ signal: controller.signal });
    await flush();
    controller.abort();
    await expect(first).rejects.toBeInstanceOf(nli.DownloadCancelled);
    release();

    hold.tokenizer = false;
    const entails = await nli.loadNli({ signal: new AbortController().signal });
    expect(await entails("a", "b")).toBe(true);
  });

  test("a signal already aborted rejects without downloading", async () => {
    const { nli, fetches } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      nli.loadNli({ signal: controller.signal }),
    ).rejects.toBeInstanceOf(nli.DownloadCancelled);
    await flush();
    expect(fetches).toEqual([]);
  });
});
