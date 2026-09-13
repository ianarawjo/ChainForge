import { describe, expect, test } from "@jest/globals";
import {
  InferenceMessage,
  InferenceReply,
  InferenceWorkerClient,
  InferenceWorkerFailed,
  WorkerLike,
} from "../inferenceWorkerClient";

/** Records what the page sends and lets a test answer as the worker would. */
class FakeWorker implements WorkerLike {
  posted: InferenceMessage[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<InferenceReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: InferenceMessage): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(reply: InferenceReply): void {
    this.onmessage?.({ data: reply } as MessageEvent<InferenceReply>);
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function setup() {
  const worker = new FakeWorker();
  return { worker, client: new InferenceWorkerClient(worker) };
}

describe("the inference worker client", () => {
  test("sends each request with its own id", () => {
    const { worker, client } = setup();
    client.request({
      kind: "embed",
      modelId: "Xenova/bge-small-en-v1.5",
      texts: ["a"],
      isQuery: true,
    });
    client.request({ kind: "entails", premise: "p", hypothesis: "h" });
    expect(worker.posted.map((m) => m.request)).toEqual([
      {
        kind: "embed",
        modelId: "Xenova/bge-small-en-v1.5",
        texts: ["a"],
        isQuery: true,
      },
      { kind: "entails", premise: "p", hypothesis: "h" },
    ]);
    expect(worker.posted[0].id).not.toBe(worker.posted[1].id);
  });

  test("each request gets its own result, whatever order the answers come in", async () => {
    const { worker, client } = setup();
    const first = client.request({ kind: "loadNli" });
    const second = client.request({
      kind: "entails",
      premise: "p",
      hypothesis: "h",
    });
    const [a, b] = worker.posted;

    worker.reply({ id: b.id, type: "result", value: true });
    worker.reply({ id: a.id, type: "result", value: null });

    expect(await first).toBeNull();
    expect(await second).toBe(true);
  });

  test("progress reaches only the request it is about", async () => {
    const { worker, client } = setup();
    const seenA: unknown[] = [];
    const seenB: unknown[] = [];
    const a = client.request({ kind: "loadNli" }, (p) => seenA.push(p));
    client.request(
      { kind: "rerank", modelId: "m", query: "q", documents: ["d"] },
      (p) => seenB.push(p),
    );
    const [requestA, requestB] = worker.posted;

    worker.reply({ id: requestA.id, type: "progress", progress: { n: 1 } });
    worker.reply({ id: requestB.id, type: "progress", progress: { n: 2 } });
    worker.reply({ id: requestA.id, type: "result", value: null });
    await a;

    expect(seenA).toEqual([{ n: 1 }]);
    expect(seenB).toEqual([{ n: 2 }]);
  });

  test("a model error fails that request only, keeping its name", async () => {
    const { worker, client } = setup();
    const failing = client.request({ kind: "loadNli" });
    worker.reply({
      id: worker.posted[0].id,
      type: "error",
      name: "DownloadCancelled",
      message: "Download cancelled",
    });
    const err = (await failing.catch((e) => e)) as Error;
    expect(err).not.toBeInstanceOf(InferenceWorkerFailed);
    expect(err.name).toBe("DownloadCancelled");
    expect(err.message).toBe("Download cancelled");

    // The worker is still fine.
    const next = client.request({ kind: "loadNli" });
    worker.reply({ id: worker.posted[1].id, type: "result", value: null });
    expect(await next).toBeNull();
    expect(worker.terminated).toBe(false);
  });

  test("a worker that crashes fails every waiting request, and every later one", async () => {
    const { worker, client } = setup();
    const a = client.request({ kind: "loadNli" });
    const b = client.request({ kind: "cancelNliDownload" });

    worker.crash("script failed to load");

    await expect(a).rejects.toBeInstanceOf(InferenceWorkerFailed);
    await expect(b).rejects.toThrow("script failed to load");
    expect(worker.terminated).toBe(true);

    await expect(client.request({ kind: "loadNli" })).rejects.toBeInstanceOf(
      InferenceWorkerFailed,
    );
    expect(worker.posted).toHaveLength(2);
  });

  test("answers about requests it never made are ignored", () => {
    const { worker } = setup();
    expect(() =>
      worker.reply({ id: 999, type: "result", value: null }),
    ).not.toThrow();
  });
});
