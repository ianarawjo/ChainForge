import { describe, expect, test, jest } from "@jest/globals";

// Deliberately does NOT import fake-indexeddb: this is the private-browsing /
// storage-disabled case, where IndexedDB is absent. Uploads must still work for
// the session; only durability is lost.
jest.mock("../utils", () => ({
  APP_IS_RUNNING_LOCALLY: () => false,
  FLASK_BASE_URL: "/",
  blobOrFileToDataURL: () => Promise.resolve("data:,"),
  dataURLToBlob: () => new Blob([]),
  base64ToBlob: () => new Blob([]),
}));

// eslint-disable-next-line import/first
import { MediaLookup } from "../cache";
// eslint-disable-next-line import/first
import {
  getMedia,
  indexedDBAvailable,
  listMedia,
  putMedia,
} from "../mediaStore";

describe("without IndexedDB", () => {
  test("availability is reported as false", () => {
    expect(indexedDBAvailable()).toBe(false);
  });

  test("store operations resolve instead of throwing", async () => {
    await expect(putMedia("u", new Blob(["x"]))).resolves.toBe(false);
    await expect(getMedia("u")).resolves.toBeUndefined();
    await expect(listMedia()).resolves.toEqual([]);
  });

  test("uploading still works for the session", async () => {
    const uid = await MediaLookup.upload(new File(["hello"], "a.txt"));
    const blob = await MediaLookup.get(uid);
    expect(blob?.size).toBe(5);
    expect(await MediaLookup.getAsText(uid)).toBe("hello");
  });

  test("usage accounting still works", async () => {
    MediaLookup.clear();
    await MediaLookup.upload(new File(["x".repeat(64)], "a.txt"));
    expect(MediaLookup.storageUsage()).toMatchObject({ files: 1, bytes: 64 });
  });

  test("hydrating is a harmless no-op", async () => {
    await expect(MediaLookup.hydrateFromIndexedDB()).resolves.toBe(0);
  });
});
