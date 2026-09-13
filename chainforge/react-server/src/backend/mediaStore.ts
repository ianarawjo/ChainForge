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
const DB_VERSION = 1;
const STORE = "media";

/** One stored file. The Blob is kept as-is; IndexedDB clones it structurally. */
interface MediaRecord {
  uid: string;
  blob: Blob;
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

/** Opens (and if needed creates) the database. Resolves undefined on failure. */
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

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "uid" });
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

/** Runs `work` inside a transaction, resolving undefined on any failure. */
async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T | undefined> {
  const db = await openDB();
  if (!db) return undefined;

  return new Promise<T | undefined>((resolve) => {
    let request: IDBRequest;
    try {
      const tx = db.transaction(STORE, mode);
      request = work(tx.objectStore(STORE));
    } catch (err) {
      console.warn(`IndexedDB transaction failed: ${String(err)}`);
      db.close();
      resolve(undefined);
      return;
    }

    request.onsuccess = () => {
      resolve(request.result as T);
      db.close();
    };
    request.onerror = () => {
      // QuotaExceededError lands here; the caller keeps its memory copy.
      console.warn(
        `IndexedDB write/read failed: ${request.error?.message ?? "unknown error"}`,
      );
      resolve(undefined);
      db.close();
    };
  });
}

/** Stores a file. Returns whether it was durably written. */
export async function putMedia(uid: string, blob: Blob): Promise<boolean> {
  const record: MediaRecord = { uid, blob, size: blob.size };
  const result = await withStore<IDBValidKey>("readwrite", (store) =>
    store.put(record),
  );
  return result !== undefined;
}

/** Reads a file back, or undefined if absent or unreadable. */
export async function getMedia(uid: string): Promise<Blob | undefined> {
  const record = await withStore<MediaRecord | undefined>("readonly", (store) =>
    store.get(uid),
  );
  return record?.blob;
}

/** Forgets a file. */
export async function deleteMedia(uid: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(uid));
}

/** Forgets every stored file. */
export async function clearMedia(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}

/**
 * Lists what is stored, without loading any file contents.
 *
 * This is what makes it possible to know the total bytes held, and which uids
 * exist, without pulling every Blob into memory.
 */
export async function listMedia(): Promise<{ uid: string; size: number }[]> {
  const records = await withStore<MediaRecord[]>("readonly", (store) =>
    store.getAll(),
  );
  if (!records) return [];
  return records.map((r) => ({ uid: r.uid, size: r.size ?? 0 }));
}
