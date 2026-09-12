import { beforeEach, describe, expect, test, jest } from "@jest/globals";

// Force the browser-only code path. APP_IS_RUNNING_LOCALLY() reports true for a
// "localhost" hostname and jsdom serves http://localhost/, so by default these
// tests would take the Flask branch and fail on a network request.
//
// Only the handful of helpers cache.ts actually imports are provided, so the
// real utils module -- and its ESM-only provider SDKs and load-time RAG
// availability probe -- stay out of the test.
jest.mock("../utils", () => {
  const toDataURL = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      // Referenced via globalThis: jest.mock factories may not close over
      // arbitrary globals, but globalThis itself is permitted.
      const reader = new (globalThis as any).FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

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
    blobOrFileToDataURL: toDataURL,
    dataURLToBlob: fromDataURL,
    base64ToBlob: fromDataURL,
  };
});

// eslint-disable-next-line import/first
import StorageCache, { MediaLookup } from "../cache";

// These cover the browser-only path, where MediaLookup is the authoritative
// store for uploaded files rather than a cache in front of the Flask backend.

const MB = 1024 * 1024;

/** A Blob of a given size, without allocating a huge string. */
const blobOfSize = (bytes: number, name?: string): File | Blob => {
  const blob = new Blob([new Uint8Array(bytes)]);
  return name ? new File([blob], name) : blob;
};

beforeEach(() => {
  MediaLookup.clear();
  StorageCache.clear();
});

describe("browser-mode uploads", () => {
  test("a small file is accepted and retrievable", async () => {
    const uid = await MediaLookup.upload(blobOfSize(1024, "small.txt"));
    expect(typeof uid).toBe("string");
    expect(MediaLookup.hasAnyMedia()).toBe(true);

    const blob = await MediaLookup.get(uid);
    expect(blob?.size).toBe(1024);
  });

  test("the original filename is preserved in the uid", async () => {
    const uid = await MediaLookup.upload(blobOfSize(16, "report.pdf"));
    expect(uid).toContain("report.pdf");
  });

  test("usage reflects what has been uploaded", async () => {
    expect(MediaLookup.storageUsage().bytes).toBe(0);

    await MediaLookup.upload(blobOfSize(2 * MB, "a.pdf"));
    await MediaLookup.upload(blobOfSize(3 * MB, "b.pdf"));

    const usage = MediaLookup.storageUsage();
    expect(usage.files).toBe(2);
    expect(usage.bytes).toBe(5 * MB);
    expect(usage.limitBytes).toBeGreaterThan(usage.bytes);
  });

  test("removing a file frees its budget", async () => {
    const uid = await MediaLookup.upload(blobOfSize(4 * MB, "big.pdf"));
    expect(MediaLookup.storageUsage().bytes).toBe(4 * MB);

    MediaLookup.remove(uid);
    expect(MediaLookup.storageUsage().bytes).toBe(0);
  });

  test("clear() frees everything", async () => {
    await MediaLookup.upload(blobOfSize(MB, "a.pdf"));
    await MediaLookup.upload(blobOfSize(MB, "b.pdf"));

    MediaLookup.clear();
    expect(MediaLookup.storageUsage()).toMatchObject({ files: 0, bytes: 0 });
  });
});

describe("browser-mode limits", () => {
  test("a file over the per-file limit is rejected", async () => {
    const { fileLimitBytes } = MediaLookup.storageUsage();
    await expect(
      MediaLookup.upload(blobOfSize(fileLimitBytes + 1, "huge.pdf")),
    ).rejects.toThrow(/per-file limit/);
  });

  test("the rejection names the file and suggests running locally", async () => {
    const { fileLimitBytes } = MediaLookup.storageUsage();
    await expect(
      MediaLookup.upload(blobOfSize(fileLimitBytes + 1, "huge.pdf")),
    ).rejects.toThrow(/huge\.pdf[\s\S]*locally/);
  });

  test("a rejected file is not left in the store", async () => {
    const { fileLimitBytes } = MediaLookup.storageUsage();
    await expect(
      MediaLookup.upload(blobOfSize(fileLimitBytes + 1, "huge.pdf")),
    ).rejects.toThrow();

    expect(MediaLookup.storageUsage()).toMatchObject({ files: 0, bytes: 0 });
  });

  test("a file at exactly the per-file limit is allowed", async () => {
    const { fileLimitBytes } = MediaLookup.storageUsage();
    const uid = await MediaLookup.upload(
      blobOfSize(fileLimitBytes, "edge.pdf"),
    );
    expect(uid).toBeTruthy();
  });

  test("uploads are refused once the total budget is exhausted", async () => {
    const { limitBytes, fileLimitBytes } = MediaLookup.storageUsage();

    // Fill up to just under the total budget, in per-file-sized pieces.
    let uploaded = 0;
    while (uploaded + fileLimitBytes <= limitBytes) {
      await MediaLookup.upload(blobOfSize(fileLimitBytes, `f${uploaded}.pdf`));
      uploaded += fileLimitBytes;
    }

    // The next file that would cross the total must be refused, even though
    // it is individually under the per-file limit.
    const remaining = limitBytes - uploaded;
    await expect(
      MediaLookup.upload(blobOfSize(remaining + 1, "one-too-many.pdf")),
    ).rejects.toThrow(/total limit/);
  });

  test("the total-budget error reports current usage", async () => {
    const { limitBytes, fileLimitBytes } = MediaLookup.storageUsage();
    let uploaded = 0;
    while (uploaded + fileLimitBytes <= limitBytes) {
      await MediaLookup.upload(blobOfSize(fileLimitBytes, `f${uploaded}.pdf`));
      uploaded += fileLimitBytes;
    }
    // Must stay under the per-file limit, or that check fires first.
    const remaining = limitBytes - uploaded;
    await expect(
      MediaLookup.upload(blobOfSize(remaining + 1, "nope.pdf")),
    ).rejects.toThrow(/already in use/);
  });
});

describe("persisted media state", () => {
  // Blobs are not JSON-serializable: JSON.stringify(blob) === "{}". Writing
  // them into the StorageCache stored a useless placeholder per file and, on
  // restore, installed those placeholders as if they were real Blobs.
  test("only uids are written to the StorageCache", async () => {
    await MediaLookup.upload(blobOfSize(1024, "a.txt"));

    const stored = StorageCache.get("__media");
    expect(Array.isArray(stored.mediaUIDs)).toBe(true);
    expect(stored.mediaUIDs).toHaveLength(1);
    // Assert on the key set, not the object: a deep diff of a regressed value
    // would try to copy every cached Blob and exhaust the heap.
    expect(Object.keys(stored).sort()).toEqual(["mediaUIDs"]);
  });

  test("the persisted state survives JSON serialization intact", async () => {
    await MediaLookup.upload(blobOfSize(1024, "a.txt"));

    const stored = StorageCache.get("__media");
    const roundTripped = JSON.parse(JSON.stringify(stored));
    expect(Object.keys(roundTripped).sort()).toEqual(
      Object.keys(stored).sort(),
    );
    expect(roundTripped.mediaUIDs).toEqual(stored.mediaUIDs);
  });

  test("restoring recovers uids without inventing blobs", async () => {
    const uid = await MediaLookup.upload(blobOfSize(1024, "a.txt"));
    const saved = JSON.parse(JSON.stringify(StorageCache.get("__media")));

    MediaLookup.clear();
    StorageCache.store("__media", saved);

    expect(MediaLookup.getInstance().restoreStateFromStorageCache()).toBe(true);
    // The uid is known again...
    expect(MediaLookup.hasAnyMedia()).toBe(true);
    // ...but no bogus blob was materialised for it.
    expect(MediaLookup.storageUsage().bytes).toBe(0);
    expect(uid).toBeTruthy();
  });

  test("restoring from absent state is a no-op", () => {
    StorageCache.clear();
    expect(MediaLookup.getInstance().restoreStateFromStorageCache()).toBe(
      false,
    );
  });
});

describe("export serialization", () => {
  test("toJSON emits uids plus data-URL-encoded blobs", async () => {
    await MediaLookup.upload(blobOfSize(8, "tiny.bin"));

    const json = await MediaLookup.toJSON();
    expect(json.uids).toHaveLength(1);
    const encoded = Object.values(json.cache ?? {});
    expect(encoded).toHaveLength(1);
    // Data URLs are what restoreFrom() expects to decode.
    expect(encoded[0]).toMatch(/^data:/);
  });

  test("a toJSON/restoreFrom round trip preserves file bytes", async () => {
    await MediaLookup.upload(blobOfSize(32, "tiny.bin"));
    const json = await MediaLookup.toJSON();

    MediaLookup.clear();
    MediaLookup.restoreFrom(json);

    expect(MediaLookup.storageUsage().bytes).toBe(32);
  });
});
