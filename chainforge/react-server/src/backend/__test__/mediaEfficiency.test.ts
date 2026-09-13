import { beforeEach, describe, expect, test, jest } from "@jest/globals";

// Real IndexedDB, so the store's structure and access patterns are exercised.
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
import { clearMedia, listMedia, putMedia } from "../mediaStore";

const image = (bytes = 2048, name = "photo.png") =>
  new File([new Uint8Array(bytes)], name, { type: "image/png" });

function simulateReload() {
  (MediaLookup as any).instance = undefined;
}

// jsdom has no object URLs; record creations and revocations.
let created: string[] = [];
let revoked: string[] = [];

beforeEach(async () => {
  (URL as any).createObjectURL = () => {
    const url = `blob:mock/${created.length + 1}`;
    created.push(url);
    return url;
  };
  (URL as any).revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  MediaLookup.clear();
  await clearMedia();
  simulateReload();
  // Reset after clear(), which revokes URLs the previous test left held.
  created = [];
  revoked = [];
});

describe("startup does not load stored files", () => {
  test("listMedia never reads the file store", async () => {
    await putMedia("u1", image(4096));
    await putMedia("u2", image(1024));

    // Record which object stores are read from.
    const touched: string[] = [];
    const proto = IDBObjectStore.prototype as any;
    const methods = ["get", "getAll", "openCursor"];
    const originals = methods.map((m) => proto[m]);
    methods.forEach((m, i) => {
      proto[m] = function (this: IDBObjectStore, ...args: unknown[]) {
        touched.push(this.name);
        return originals[i].apply(this, args);
      };
    });
    try {
      const listed = await listMedia();
      expect(listed.map((r) => r.size).sort()).toEqual([1024, 4096]);

      // Reading from the "media" store would deserialize every Blob.
      expect(touched.length).toBeGreaterThan(0);
      expect(touched).not.toContain("media");
    } finally {
      methods.forEach((m, i) => {
        proto[m] = originals[i];
      });
    }
  });

  test("removing a file removes its size entry too", async () => {
    const uid = await MediaLookup.upload(image(10));
    MediaLookup.remove(uid);
    await new Promise((r) => setTimeout(r, 0));
    expect(await listMedia()).toEqual([]);
  });

  test("one connection serves many operations", async () => {
    const open = jest.spyOn(indexedDB, "open");
    try {
      for (let i = 0; i < 20; i++) await putMedia(`u${i}`, image(8));
      await listMedia();
      // Already open from beforeEach; no reopening per operation.
      expect(open).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });
});

describe("object URLs are shared and freed", () => {
  test("two holders of one image share a single URL", async () => {
    const uid = await MediaLookup.upload(image());
    const a = await MediaLookup.acquireUrl(uid);
    const b = await MediaLookup.acquireUrl(uid);
    expect(a).toBe(b);
    expect(created).toHaveLength(1);
  });

  test("the URL is revoked only after the last release", async () => {
    const uid = await MediaLookup.upload(image());
    const url = await MediaLookup.acquireUrl(uid);
    await MediaLookup.acquireUrl(uid);

    MediaLookup.releaseUrl(uid);
    expect(revoked).toHaveLength(0);

    MediaLookup.releaseUrl(uid);
    expect(revoked).toEqual([url]);

    // A later acquire makes a fresh one rather than reusing a revoked URL.
    const again = await MediaLookup.acquireUrl(uid);
    expect(again).not.toBe(url);
  });

  test("concurrent acquires while loading still create one URL", async () => {
    const uid = await MediaLookup.upload(image());
    simulateReload(); // force both to wait on IndexedDB
    const [a, b] = await Promise.all([
      MediaLookup.acquireUrl(uid),
      MediaLookup.acquireUrl(uid),
    ]);
    expect(a).toBe(b);
    expect(created).toHaveLength(1);
  });

  test("removing an image revokes its URL", async () => {
    const uid = await MediaLookup.upload(image());
    const url = await MediaLookup.acquireUrl(uid);
    MediaLookup.remove(uid);
    expect(revoked).toEqual([url]);
    // A holder releasing afterwards is harmless.
    expect(() => MediaLookup.releaseUrl(uid)).not.toThrow();
  });

  test("clearing revokes every URL", async () => {
    const u1 = await MediaLookup.upload(image(10, "a.png"));
    const u2 = await MediaLookup.upload(image(20, "b.png"));
    await MediaLookup.acquireUrl(u1);
    await MediaLookup.acquireUrl(u2);
    MediaLookup.clear();
    expect(revoked).toHaveLength(2);
  });

  test("an unavailable image yields no URL", async () => {
    expect(await MediaLookup.acquireUrl("cache__missing__cache")).toBe(
      undefined,
    );
    expect(created).toHaveLength(0);
  });
});

describe("a clear during startup hydration", () => {
  test("does not re-register the files it deleted", async () => {
    await MediaLookup.upload(image(4096, "old.png"));
    simulateReload();

    // Hydration's listing is in flight when a loaded flow clears media.
    const hydrating = MediaLookup.hydrateFromIndexedDB();
    MediaLookup.clear();

    expect(await hydrating).toBe(0);
    expect(MediaLookup.storageUsage()).toMatchObject({ files: 0, bytes: 0 });
    expect(MediaLookup.hasAnyMedia()).toBe(false);
  });
});

describe("session-only overflow when storage is full", () => {
  test("a file kept for the session is readable but not persisted", async () => {
    const uid = MediaLookup.keepForSession(image(500, "gen.png"));
    expect((await MediaLookup.get(uid))?.size).toBe(500);
    expect(MediaLookup.sessionOnlyCount()).toBe(1);
    expect(await listMedia()).toEqual([]);

    // Gone after a reload, as the warning tells the user.
    simulateReload();
    expect(await MediaLookup.get(uid)).toBeUndefined();
  });

  test("it is accepted even when the budget is exhausted", async () => {
    const { limitBytes, fileLimitBytes } = MediaLookup.storageUsage();
    let used = 0;
    while (used + fileLimitBytes <= limitBytes) {
      await MediaLookup.upload(image(fileLimitBytes, `fill${used}.png`));
      used += fileLimitBytes;
    }
    await expect(
      MediaLookup.upload(image(limitBytes - used + 1, "over.png")),
    ).rejects.toThrow(/total limit/);

    const uid = MediaLookup.keepForSession(image(limitBytes - used + 1));
    expect(await MediaLookup.get(uid)).toBeDefined();
  });

  test("it is included in an export", async () => {
    const uid = MediaLookup.keepForSession(image(64));
    const json = await MediaLookup.toJSON();
    expect(json.cache?.[uid]).toMatch(/^data:/);
  });

  test("removing or clearing forgets it", () => {
    const a = MediaLookup.keepForSession(image(10));
    MediaLookup.keepForSession(image(10));
    MediaLookup.remove(a);
    expect(MediaLookup.sessionOnlyCount()).toBe(1);
    MediaLookup.clear();
    expect(MediaLookup.sessionOnlyCount()).toBe(0);
  });
});

describe("export includes files not loaded this session", () => {
  test("toJSON reads persisted bytes that were never viewed", async () => {
    const uid = await MediaLookup.upload(image(300, "unseen.png"));
    simulateReload();
    await MediaLookup.hydrateFromIndexedDB();

    // Deliberately no get(uid): the user reloaded and exported straight away.
    const json = await MediaLookup.toJSON();
    expect(json.uids).toContain(uid);
    expect(json.cache?.[uid]).toMatch(/^data:image\/png;base64,/);

    // Exporting shouldn't pull the file into memory for the rest of the session.
    expect((MediaLookup.getInstance() as any).cache[uid]).toBeUndefined();
  });
});
