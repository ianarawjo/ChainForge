import { beforeEach, describe, expect, test, jest } from "@jest/globals";

// Real IndexedDB, so the persistence behaviour is actually exercised.
import "fake-indexeddb/auto";

// Force the browser-only path (see mediaPersistence.test.ts).
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
import { clearMedia, listMedia } from "../mediaStore";

// jsdom implements no URL.createObjectURL, which MediaLookup.getUrl needs.
// Stub it so the image display path can be followed, recording what it is
// handed -- that is the thing worth checking.
const objectUrlsFor: Blob[] = [];
beforeEach(() => {
  objectUrlsFor.length = 0;
  (URL as any).createObjectURL = (blob: Blob) => {
    objectUrlsFor.push(blob);
    return `blob:mock/${objectUrlsFor.length}`;
  };
  (URL as any).revokeObjectURL = () => undefined;
});

/** A tiny PNG-ish blob. Contents don't matter; size and type do. */
const image = (bytes = 2048, name = "photo.png") =>
  new File([new Uint8Array(bytes)], name, { type: "image/png" });

function simulateReload() {
  (MediaLookup as any).instance = undefined;
}

beforeEach(async () => {
  MediaLookup.clear();
  await clearMedia();
  simulateReload();
});

// The Media node and the image dropzone both go through MediaLookup.upload /
// getUrl / remove, so the storage work done for documents should cover images
// too. These tests confirm that rather than assuming it.
describe("images go through the same storage path as documents", () => {
  test("an uploaded image is retrievable and counted in usage", async () => {
    const uid = await MediaLookup.upload(image(4096));

    expect(MediaLookup.storageUsage()).toMatchObject({
      files: 1,
      bytes: 4096,
    });
    expect((await MediaLookup.get(uid))?.size).toBe(4096);
  });

  test("getUrl hands the image bytes to createObjectURL", async () => {
    const uid = await MediaLookup.upload(image(512));

    const url = await MediaLookup.getUrl(uid);
    expect(url).toMatch(/^blob:mock\//);
    expect(objectUrlsFor).toHaveLength(1);
    expect(objectUrlsFor[0].size).toBe(512);
  });

  test("an image survives a reload, which it previously did not", async () => {
    const uid = await MediaLookup.upload(image(1024, "diagram.png"));
    simulateReload();

    // Previously the bytes lived only in memory, so this returned undefined
    // and the Media node rendered a broken image after a refresh.
    const url = await MediaLookup.getUrl(uid);
    expect(url).toMatch(/^blob:mock\//);
    expect(objectUrlsFor[0].size).toBe(1024);
  });

  test("usage after a reload includes persisted images", async () => {
    await MediaLookup.upload(image(3000));
    simulateReload();

    expect(await MediaLookup.hydrateFromIndexedDB()).toBe(1);
    expect(MediaLookup.storageUsage()).toMatchObject({ files: 1, bytes: 3000 });
  });

  test("images added by data URL are bounded and persisted too", async () => {
    // MediaNode also uploads via uploadDataURL (e.g. pasted/generated images).
    const dataURL =
      "data:image/png;base64," + btoa("\x89PNG\r\n\x1a\n" + "x".repeat(200));
    const uid = await MediaLookup.uploadDataURL(dataURL);

    expect(MediaLookup.storageUsage().files).toBe(1);
    expect(await listMedia()).toHaveLength(1);
    expect(await MediaLookup.get(uid)).toBeDefined();
  });

  test("removing an image frees the budget and the durable copy", async () => {
    const uid = await MediaLookup.upload(image(2048));
    MediaLookup.remove(uid);
    await new Promise((r) => setTimeout(r, 0));

    expect(MediaLookup.storageUsage()).toMatchObject({ files: 0, bytes: 0 });
    expect(await listMedia()).toHaveLength(0);
  });
});

describe("images are subject to the same budget", () => {
  test("an oversized image is refused with a clear message", async () => {
    const { fileLimitBytes } = MediaLookup.storageUsage();
    await expect(
      MediaLookup.upload(image(fileLimitBytes + 1, "huge.png")),
    ).rejects.toThrow(/huge\.png[\s\S]*per-file limit/);
  });

  test("many images cannot silently exhaust memory", async () => {
    // The pre-existing behaviour: images accumulated in an unbounded object,
    // and a big enough set made export exceed V8's string length ceiling.
    const { limitBytes, fileLimitBytes } = MediaLookup.storageUsage();
    let uploaded = 0;
    while (uploaded + fileLimitBytes <= limitBytes) {
      await MediaLookup.upload(image(fileLimitBytes, `i${uploaded}.png`));
      uploaded += fileLimitBytes;
    }
    const remaining = limitBytes - uploaded;
    await expect(
      MediaLookup.upload(image(remaining + 1, "one-too-many.png")),
    ).rejects.toThrow(/total limit/);
  });

  test("the budget keeps a full store under the export string ceiling", () => {
    // Export base64-encodes every file into one JSON string; V8 caps a string
    // at ~512M chars, and base64 inflates by 4/3. This is the invariant that
    // prevents "RangeError: Invalid string length" on export.
    const { limitBytes } = MediaLookup.storageUsage();
    const base64Chars = Math.ceil(limitBytes / 3) * 4;
    expect(base64Chars).toBeLessThan(536870888 * 0.8);
  });
});
