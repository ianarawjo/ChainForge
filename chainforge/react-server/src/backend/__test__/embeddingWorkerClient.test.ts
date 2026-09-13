import { describe, expect, test } from "@jest/globals";
import {
  EmbedRequest,
  EmbedWorkerMessage,
  EmbeddingWorkerClient,
  EmbeddingWorkerFailed,
  WorkerLike,
} from "../embeddingWorkerClient";

/** Records what the page sends and lets a test answer as the worker would. */
class FakeWorker implements WorkerLike {
  posted: EmbedRequest[] = [];
  terminated = false;
  onmessage: ((event: MessageEvent<EmbedWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: EmbedRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(message: EmbedWorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<EmbedWorkerMessage>);
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function setup() {
  const worker = new FakeWorker();
  return { worker, client: new EmbeddingWorkerClient(worker) };
}

const vector = (...values: number[]) => new Float32Array(values);

describe("the embedding worker client", () => {
  test("sends the model, texts and role", () => {
    const { worker, client } = setup();
    client.embed("Xenova/bge-small-en-v1.5", ["a", "b"], { isQuery: true });
    client.embed("Xenova/all-MiniLM-L6-v2", ["c"]);
    expect(worker.posted).toEqual([
      {
        id: expect.any(Number),
        modelId: "Xenova/bge-small-en-v1.5",
        texts: ["a", "b"],
        isQuery: true,
      },
      {
        id: expect.any(Number),
        modelId: "Xenova/all-MiniLM-L6-v2",
        texts: ["c"],
        isQuery: false,
      },
    ]);
    expect(worker.posted[0].id).not.toBe(worker.posted[1].id);
  });

  test("each request gets its own vectors, whatever order the answers come in", async () => {
    const { worker, client } = setup();
    const first = client.embed("m", ["first"]);
    const second = client.embed("m", ["second"]);
    const [a, b] = worker.posted;

    worker.reply({ id: b.id, type: "result", vectors: [vector(0, 1)] });
    worker.reply({ id: a.id, type: "result", vectors: [vector(1, 0)] });

    expect(await first).toEqual([vector(1, 0)]);
    expect(await second).toEqual([vector(0, 1)]);
  });

  test("progress reaches only the request it is about", async () => {
    const { worker, client } = setup();
    const seenA: number[] = [];
    const seenB: number[] = [];
    const a = client.embed("m", ["a"], {
      onProgress: (p) => seenA.push(p.percent ?? -1),
    });
    client.embed("m", ["b"], {
      onProgress: (p) => seenB.push(p.percent ?? -1),
    });
    const [requestA, requestB] = worker.posted;

    worker.reply({
      id: requestA.id,
      type: "progress",
      progress: { phase: "embed", percent: 50 },
    });
    worker.reply({
      id: requestB.id,
      type: "progress",
      progress: { phase: "download", percent: 10 },
    });
    worker.reply({ id: requestA.id, type: "result", vectors: [] });
    await a;

    expect(seenA).toEqual([50]);
    expect(seenB).toEqual([10]);
  });

  test("a model error fails that request only, and not as a worker failure", async () => {
    const { worker, client } = setup();
    const failing = client.embed("m", ["a"]);
    worker.reply({
      id: worker.posted[0].id,
      type: "error",
      message: "network died",
    });
    const err = await failing.catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(EmbeddingWorkerFailed);
    expect(err.message).toBe("network died");

    // The worker is still fine.
    const next = client.embed("m", ["b"]);
    worker.reply({
      id: worker.posted[1].id,
      type: "result",
      vectors: [vector(1)],
    });
    expect(await next).toEqual([vector(1)]);
    expect(worker.terminated).toBe(false);
  });

  test("a worker that crashes fails every waiting request, and every later one", async () => {
    const { worker, client } = setup();
    const a = client.embed("m", ["a"]);
    const b = client.embed("m", ["b"]);

    worker.crash("script failed to load");

    await expect(a).rejects.toBeInstanceOf(EmbeddingWorkerFailed);
    await expect(b).rejects.toThrow("script failed to load");
    expect(worker.terminated).toBe(true);

    await expect(client.embed("m", ["c"])).rejects.toBeInstanceOf(
      EmbeddingWorkerFailed,
    );
    expect(worker.posted).toHaveLength(2);
  });

  test("answers about requests it never made are ignored", () => {
    const { worker } = setup();
    expect(() =>
      worker.reply({ id: 999, type: "result", vectors: [] }),
    ).not.toThrow();
  });
});
