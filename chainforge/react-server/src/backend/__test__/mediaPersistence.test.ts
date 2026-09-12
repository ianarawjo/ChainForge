import { beforeEach, describe, expect, test, jest } from "@jest/globals";

// A real IndexedDB implementation for Node. jsdom provides none, so without
// this the store degrades to memory-only and none of this would be exercised.
import "fake-indexeddb/auto";

// Force the browser code path; APP_IS_RUNNING_LOCALLY() is true under jsdom's
// localhost origin, which would send uploads to the Flask backend instead.
jest.mock("../utils", () => {
  const fromDataURL = (dataURL: string) => {
    const [meta, encoded] = dataURL.split(",");
    const mime = /:(.*?);/.exec(meta)?.[1] ?? "";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };
  return {
    APP_IS_RUNNING_LOCALLY: () => false,
    FLASK_BASE_URL: "/",
    blobOrFileToDataURL: (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new (globalThis as any).FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }),
    dataURLToBlob: fromDataURL,
    base64ToBlob: fromDataURL,
  };
});

// eslint-disable-next-line import/first
import { MediaLookup } from "../cache";
// eslint-disable-next-line import/first
import {
  clearMedia,
  getMedia,
  indexedDBAvailable,
  listMedia,
  putMedia,
} from "../mediaStore";

const file = (contents: string, name: string) =>
  new File([contents], name, { type: "text/plain" });

/** Drops the in-memory state without touching IndexedDB, i.e. a page reload. */
function simulateReload() {
  // The singleton holds mediaUIDs, the byte cache and the size index; replacing
  // it is what a fresh page load does. IndexedDB deliberately survives.
  (MediaLookup as any).instance = undefined;
}

beforeEach(async () => {
  MediaLookup.clear();
  await clearMedia();
  simulateReload();
});

describe("the store itself", () => {
  test("IndexedDB is available under fake-indexeddb", () => {
    expect(indexedDBAvailable()).toBe(true);
  });

  test("a file round-trips", async () => {
    expect(await putMedia("u1", file("contents", "a.txt"))).toBe(true);
    const back = await getMedia("u1");
    expect(back).toBeDefined();
    expect(back!.size).toBe("contents".length);
  });

  test("reading an unknown uid yields undefined", async () => {
    expect(await getMedia("nope")).toBeUndefined();
  });

  test("listMedia reports uids and sizes without loading contents", async () => {
    await putMedia("u1", file("aaaa", "a.txt"));
    await putMedia("u2", file("bb", "b.txt"));

    const listed = await listMedia();
    expect(listed).toHaveLength(2);
    expect(listed.find((r) => r.uid === "u1")?.size).toBe(4);
    expect(listed.find((r) => r.uid === "u2")?.size).toBe(2);
  });

  test("putting the same uid twice replaces rather than duplicates", async () => {
    await putMedia("u1", file("first", "a.txt"));
    await putMedia("u1", file("second!", "a.txt"));

    const listed = await listMedia();
    expect(listed).toHaveLength(1);
    expect(listed[0].size).toBe("second!".length);
  });
});

describe("uploads survive a reload", () => {
  test("contents are readable again after the in-memory state is lost", async () => {
    const uid = await MediaLookup.upload(file("persist me", "notes.txt"));
    simulateReload();

    // Nothing in memory, but get() falls back to IndexedDB.
    const blob = await MediaLookup.get(uid);
    expect(blob).toBeDefined();
    expect(blob!.size).toBe("persist me".length);
  });

  test("text extraction works after a reload", async () => {
    const uid = await MediaLookup.upload(file("# Title\nbody", "doc.md"));
    simulateReload();

    expect(await MediaLookup.getAsText(uid)).toBe("# Title\nbody");
  });

  test("hydrating restores the uid set and usage", async () => {
    await MediaLookup.upload(file("x".repeat(1000), "a.txt"));
    await MediaLookup.upload(file("y".repeat(500), "b.txt"));
    simulateReload();

    // Before hydrating, this session knows of nothing.
    expect(MediaLookup.storageUsage().files).toBe(0);

    const recovered = await MediaLookup.hydrateFromIndexedDB();
    expect(recovered).toBe(2);

    const usage = MediaLookup.storageUsage();
    expect(usage.files).toBe(2);
    expect(usage.bytes).toBe(1500);
    expect(MediaLookup.hasAnyMedia()).toBe(true);
  });

  test("hydrating twice does not double-count", async () => {
    await MediaLookup.upload(file("x".repeat(100), "a.txt"));
    simulateReload();

    await MediaLookup.hydrateFromIndexedDB();
    await MediaLookup.hydrateFromIndexedDB();

    expect(MediaLookup.storageUsage()).toMatchObject({ files: 1, bytes: 100 });
  });

  test("hydrating does not overwrite a size known from this session", async () => {
    const uid = await MediaLookup.upload(file("x".repeat(42), "a.txt"));
    // Same session: the size is already known and must not be disturbed.
    await MediaLookup.hydrateFromIndexedDB();

    expect(MediaLookup.storageUsage().bytes).toBe(42);
    expect(await MediaLookup.get(uid)).toBeDefined();
  });

  test("hydrating an empty store recovers nothing", async () => {
    expect(await MediaLookup.hydrateFromIndexedDB()).toBe(0);
    expect(MediaLookup.storageUsage().files).toBe(0);
  });
});

describe("removal is durable too", () => {
  test("a removed file does not come back after a reload", async () => {
    const uid = await MediaLookup.upload(file("bye", "a.txt"));
    MediaLookup.remove(uid);
    // The delete is fire-and-forget; let it land.
    await new Promise((r) => setTimeout(r, 0));

    simulateReload();
    expect(await MediaLookup.hydrateFromIndexedDB()).toBe(0);
    expect(await MediaLookup.get(uid)).toBeUndefined();
  });

  test("clear() empties the durable store", async () => {
    await MediaLookup.upload(file("a", "a.txt"));
    await MediaLookup.upload(file("b", "b.txt"));

    MediaLookup.clear();
    await new Promise((r) => setTimeout(r, 0));

    simulateReload();
    expect(await MediaLookup.hydrateFromIndexedDB()).toBe(0);
  });
});

describe("budget accounting spans memory and storage", () => {
  test("usage counts persisted files not currently in memory", async () => {
    await MediaLookup.upload(file("x".repeat(2048), "a.txt"));
    simulateReload();
    await MediaLookup.hydrateFromIndexedDB();

    // Nothing is in the byte cache, yet the budget knows about it.
    expect(MediaLookup.storageUsage().bytes).toBe(2048);
  });

  test("the per-file limit still applies", async () => {
    const { fileLimitBytes } = MediaLookup.storageUsage();
    const tooBig = new File(
      [new Uint8Array(fileLimitBytes + 1)],
      "huge.bin",
      {},
    );
    await expect(MediaLookup.upload(tooBig)).rejects.toThrow(/per-file limit/);
  });

  test("a rejected upload is not persisted", async () => {
    const { fileLimitBytes } = MediaLookup.storageUsage();
    await expect(
      MediaLookup.upload(
        new File([new Uint8Array(fileLimitBytes + 1)], "huge.bin", {}),
      ),
    ).rejects.toThrow();

    expect(await listMedia()).toHaveLength(0);
  });
});

describe("export still works against persisted files", () => {
  test("toJSON encodes files that were loaded back from storage", async () => {
    const uid = await MediaLookup.upload(file("exported", "a.txt"));
    simulateReload();
    await MediaLookup.hydrateFromIndexedDB();

    // Pull the bytes back into memory, as export does via get().
    await MediaLookup.get(uid);

    const json = await MediaLookup.toJSON();
    expect(json.uids).toContain(uid);
    expect(Object.values(json.cache ?? {})[0]).toMatch(/^data:/);
  });
});
