/**
 * Durable browser-side storage for uploaded files, on IndexedDB.
 *
 * Without a Flask backend, uploaded files used to live only in a JS object, so
 * a page reload lost them: the flow still referenced their uids, but the bytes
 * were gone. localStorage is not an option -- it holds strings, caps out around
 * 5MB, and blocks the UI thread. IndexedDB stores Blobs natively, allows orders
 * of magnitude more, and is asynchronous.
 *
 * Everything here degrades to a no-op rather than throwing when IndexedDB is
 * unavailable or refuses a write: private browsing modes disable it, users can
 * block site data, and quotas are exceeded in practice. Callers keep their own
 * in-memory copy, so a failure here costs durability, not the session.
 */

const DB_NAME = "chainforge";
const DB_VERSION = 2;
const STORE = "media";

/**
 * uid -> size only, kept alongside STORE.
 *
 * Reading a record out of STORE deserializes its Blob, so listing sizes from
 * there loads every stored file. This store lets startup learn what exists
 * without touching any file contents. Added in version 2.
 */
const META_STORE = "mediaMeta";

/** One stored file. The Blob is kept as-is; IndexedDB clones it structurally. */
interface MediaRecord {
  uid: string;
  blob: Blob;
  size: number;
}

interface MediaMetaRecord {
  uid: string;
  size: number;
}

/** Logged at most once, so a disabled-storage browser isn't spammed. */
let warnedUnavailable = false;

function warnUnavailableOnce(reason: string): void {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(
    `Uploaded files will not persist across reloads: ${reason}. ` +
      `They remain available for this session.`,
  );
}

/** Whether IndexedDB looks usable. Accessing it can itself throw. */
export function indexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Opens (and if needed creates or upgrades) the database. Resolves undefined on failure. */
function openDB(): Promise<IDBDatabase | undefined> {
  if (!indexedDBAvailable()) {
    warnUnavailableOnce("IndexedDB is not available in this browser context");
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      warnUnavailableOnce(`IndexedDB could not be opened (${String(err)})`);
      resolve(undefined);
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "uid" });

      if (!db.objectStoreNames.contains(META_STORE)) {
        const meta = db.createObjectStore(META_STORE, { keyPath: "uid" });
        // A version 1 database holds files but no size index. Build it once,
        // here; that reads each file record a single time, which is the cost
        // the index exists to avoid on every later page load.
        if (event.oldVersion >= 1 && tx) {
          const cursorReq = tx.objectStore(STORE).openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const record = cursor.value as MediaRecord;
            meta.put({
              uid: record.uid,
              size: record.size ?? record.blob?.size ?? 0,
            } as MediaMetaRecord);
            cursor.continue();
          };
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      warnUnavailableOnce(
        `IndexedDB open failed (${request.error?.message ?? "unknown error"})`,
      );
      resolve(undefined);
    };
    // Another tab holding an old version open; don't hang forever.
    request.onblocked = () => {
      warnUnavailableOnce("IndexedDB is blocked by another open tab");
      resolve(undefined);
    };
  });
}

/**
 * One shared connection. Opening IndexedDB is comparatively slow, and adding
 * a hundred images would otherwise open (and close) it hundreds of times.
 */
let dbPromise: Promise<IDBDatabase | undefined> | undefined;

function getDB(): Promise<IDBDatabase | undefined> {
  if (!dbPromise) {
    dbPromise = openDB().then((db) => {
      if (!db) {
        // Don't cache a failure: a blocking tab may since have closed.
        dbPromise = undefined;
      } else {
        // Step aside if another tab needs to upgrade; reopen on next use.
        db.onversionchange = () => {
          db.close();
          dbPromise = undefined;
        };
        db.onclose = () => {
          dbPromise = undefined;
        };
      }
      return db;
    });
  }
  return dbPromise;
}

/**
 * Runs `work` inside a transaction over `stores`, resolving with the result of
 * the request it returns once the transaction commits, or undefined on any
 * failure. Resolving on commit rather than on the request matters for writes:
 * the data is only durable then, and QuotaExceededError surfaces as an abort.
 */
async function withTransaction<T>(
  mode: IDBTransactionMode,
  stores: string[],
  work: (tx: IDBTransaction) => IDBRequest,
): Promise<T | undefined> {
  const db = await getDB();
  if (!db) return undefined;

  return new Promise<T | undefined>((resolve) => {
    let tx: IDBTransaction;
    let request: IDBRequest;
    try {
      tx = db.transaction(stores, mode);
      request = work(tx);
    } catch (err) {
      // e.g. the connection closed underneath us; reopen next time.
      console.warn(`IndexedDB transaction failed: ${String(err)}`);
      dbPromise = undefined;
      resolve(undefined);
      return;
    }

    tx.oncomplete = () => resolve(request.result as T);
    tx.onabort = () => {
      // The caller keeps its memory copy.
      console.warn(
        `IndexedDB write/read failed: ${tx.error?.message ?? request.error?.message ?? "unknown error"}`,
      );
      resolve(undefined);
    };
  });
}

/** Stores a file. Returns whether it was durably written. */
export async function putMedia(uid: string, blob: Blob): Promise<boolean> {
  const record: MediaRecord = { uid, blob, size: blob.size };
  const result = await withTransaction<IDBValidKey>(
    "readwrite",
    [STORE, META_STORE],
    (tx) => {
      tx.objectStore(STORE).put(record);
      return tx
        .objectStore(META_STORE)
        .put({ uid, size: blob.size } as MediaMetaRecord);
    },
  );
  return result !== undefined;
}

/** Reads a file back, or undefined if absent or unreadable. */
export async function getMedia(uid: string): Promise<Blob | undefined> {
  const record = await withTransaction<MediaRecord | undefined>(
    "readonly",
    [STORE],
    (tx) => tx.objectStore(STORE).get(uid),
  );
  return record?.blob;
}

/** Forgets a file. */
export async function deleteMedia(uid: string): Promise<void> {
  await withTransaction("readwrite", [STORE, META_STORE], (tx) => {
    tx.objectStore(STORE).delete(uid);
    return tx.objectStore(META_STORE).delete(uid);
  });
}

/** Forgets every stored file. */
export async function clearMedia(): Promise<void> {
  await withTransaction("readwrite", [STORE, META_STORE], (tx) => {
    tx.objectStore(STORE).clear();
    return tx.objectStore(META_STORE).clear();
  });
}

/**
 * Lists what is stored, without loading any file contents.
 *
 * This is what makes it possible to know the total bytes held, and which uids
 * exist, without pulling every Blob into memory.
 */
export async function listMedia(): Promise<{ uid: string; size: number }[]> {
  const records = await withTransaction<MediaMetaRecord[]>(
    "readonly",
    [META_STORE],
    (tx) => tx.objectStore(META_STORE).getAll(),
  );
  if (!records) return [];
  return records.map((r) => ({ uid: r.uid, size: r.size ?? 0 }));
}
