import { describe, expect, test } from "@jest/globals";

// A fresh fake IndexedDB per test file, so a version 1 database can be laid
// down before mediaStore opens it.
import "fake-indexeddb/auto";

// eslint-disable-next-line import/first
import { getMedia, listMedia } from "../mediaStore";

/** Creates the database as version 1 of mediaStore left it: files, no size index. */
function createVersion1Database(
  records: { uid: string; blob: Blob; size: number }[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("chainforge", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("media", {
        keyPath: "uid",
      });
      for (const record of records) store.put(record);
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

describe("upgrading a version 1 database", () => {
  test("files stored before the upgrade are listed with their sizes", async () => {
    await createVersion1Database([
      { uid: "old1", blob: new Blob([new Uint8Array(700)]), size: 700 },
      { uid: "old2", blob: new Blob([new Uint8Array(30)]), size: 30 },
    ]);

    const listed = await listMedia();
    expect(listed.sort((a, b) => a.uid.localeCompare(b.uid))).toEqual([
      { uid: "old1", size: 700 },
      { uid: "old2", size: 30 },
    ]);
    expect((await getMedia("old1"))?.size).toBe(700);
  });
});
