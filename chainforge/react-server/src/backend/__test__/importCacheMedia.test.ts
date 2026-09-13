/*
 * @jest-environment jsdom
 */
// Real IndexedDB, so "cleared" means cleared from durable storage too.
import "fake-indexeddb/auto";

// Same stubs as backend.test.ts: the Pyodide loader uses import.meta, and the
// app store imports ModelSettingSchemas cyclically.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));

// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { importCache } from "../backend";
// eslint-disable-next-line import/first
import StorageCache, { MediaLookup } from "../cache";
// eslint-disable-next-line import/first
import { clearMedia, listMedia } from "../mediaStore";

// "cache__" uids are browser-held files, so lookups never try a Flask server.
const PREVIOUS = "cache__previous-flow__cache__old.png";
const IMPORTED = "cache__imported-flow__cache__new.png";

/** An exported flow's cache data carrying one media file. */
const exportedCache = () => ({
  "prompt-1.json": { some: "responses" },
  __s: [],
  __media: {
    uids: [IMPORTED],
    cache: { [IMPORTED]: "data:image/png;base64," + btoa("new image bytes") },
  },
});

/** Lets fire-and-forget IndexedDB writes and deletes land. */
const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  MediaLookup.clear();
  StorageCache.clear();
  await clearMedia();
  // The file the flow on the canvas uses before the import.
  MediaLookup.setCacheData(PREVIOUS, new Blob(["old image bytes"]));
  await settle();
});

describe("importing a flow that replaces the current one", () => {
  test("the previous flow's media are cleared, from IndexedDB too", async () => {
    await importCache(exportedCache(), { replaceMedia: true });
    await settle();

    expect(await MediaLookup.get(PREVIOUS)).toBeUndefined();
    const stored = (await listMedia()).map((r) => r.uid);
    expect(stored).not.toContain(PREVIOUS);
  });

  test("the imported flow's media are available", async () => {
    await importCache(exportedCache(), { replaceMedia: true });
    await settle();

    expect(await MediaLookup.get(IMPORTED)).toBeDefined();
    expect((await listMedia()).map((r) => r.uid)).toEqual([IMPORTED]);
  });

  test("storage usage counts only the imported flow's media", async () => {
    await importCache(exportedCache(), { replaceMedia: true });
    expect(MediaLookup.storageUsage().files).toBe(1);
  });

  test("the rest of the cache data is still imported", async () => {
    await importCache(exportedCache(), { replaceMedia: true });
    expect(StorageCache.get("prompt-1.json")).toEqual({ some: "responses" });
  });
});

describe("importing without replacing media (bundles, autosave)", () => {
  test("existing media are kept alongside the imported ones", async () => {
    await importCache(exportedCache());
    await settle();

    expect(await MediaLookup.get(PREVIOUS)).toBeDefined();
    expect(await MediaLookup.get(IMPORTED)).toBeDefined();
    expect((await listMedia()).map((r) => r.uid).sort()).toEqual(
      [IMPORTED, PREVIOUS].sort(),
    );
  });
});
