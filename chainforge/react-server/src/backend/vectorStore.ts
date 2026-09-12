/**
 * Durable storage for browser-computed embeddings, on IndexedDB.
 *
 * Embedding is the expensive half of client-side semantic retrieval: the model
 * itself is cached by the browser after the first download, but the vectors it
 * produces lived only in memory, so a page reload re-embedded the whole corpus.
 * For a few hundred chunks that is seconds of staring at a progress bar to get
 * back exactly the numbers we had before.
 *
 * This is a separate database from the one mediaStore.ts uses rather than a new
 * object store inside it. Adding a store means bumping that database's version,
 * and an open tab running the old code blocks the upgrade. Vectors are
 * regenerable cache, so they should not be able to interfere with uploaded
 * files, which are not.
 *
 * As in mediaStore, every operation degrades to a no-op rather than throwing:
 * private browsing disables IndexedDB, users block site data, and quotas are
 * exceeded in practice. Callers keep their in-memory map, so a failure here
 * costs a re-embed, not the session.
 */

const DB_NAME = "chainforge-vectors";
const DB_VERSION = 1;
const STORE = "vectors";

/**
 * How much of the user's disk quota to spend on cached vectors.
 *
 * At 384 dimensions a vector is about 1.5KB, so this holds on the order of ten
 * thousand chunks -- far more than a workshop corpus, and small next to the
 * 250MB file cache. Past it, the oldest entries are dropped.
 */
export const MAX_VECTOR_STORE_BYTES = 32 * 1024 * 1024;

/** One cached embedding. The key is `model NUL role NUL text`, model first so a
 * prefix range can fetch every vector for one model. */
interface VectorRecord {
  key: string;
  vector: Float32Array;
  bytes: number;
  savedAt: number;
}

let warnedUnavailable = false;

function warnUnavailableOnce(reason: string): void {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(
    `Embeddings will not persist across reloads: ${reason}. ` +
      `They will be recomputed as needed.`,
  );
}

/** Whether IndexedDB looks usable. Accessing it can itself throw. */
export function vectorStoreAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Opens (and if needed creates) the database. Resolves undefined on failure. */
function openDB(): Promise<IDBDatabase | undefined> {
  if (!vectorStoreAvailable()) {
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
        db.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      warnUnavailableOnce(
        `IndexedDB refused to open (${String(request.error)})`,
      );
      resolve(undefined);
    };
    request.onblocked = () => resolve(undefined);
  });
}

/**
 * Runs one request against the store, resolving undefined on any failure.
 * Mirrors mediaStore's helper so both degrade the same way.
 */
function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) {
          resolve(undefined);
          return;
        }
        let request: IDBRequest;
        try {
          const tx = db.transaction(STORE, mode);
          request = work(tx.objectStore(STORE));
        } catch (err) {
          warnUnavailableOnce(`IndexedDB rejected a request (${String(err)})`);
          resolve(undefined);
          return;
        }
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => resolve(undefined);
      }),
  );
}

/**
 * Loads every cached vector for one model.
 *
 * Scoped by model because vectors from different models are not comparable,
 * so loading the rest would be waste rather than a smaller cache.
 */
export async function loadVectorsForModel(
  modelId: string,
  keySep = "\u0000",
): Promise<Map<string, Float32Array>> {
  const out = new Map<string, Float32Array>();
  if (!vectorStoreAvailable()) return out;

  let range: IDBKeyRange;
  try {
    // Every key for this model sorts inside [model+NUL, model+NUL+FFFF].
    range = IDBKeyRange.bound(
      `${modelId}${keySep}`,
      `${modelId}${keySep}\uffff`,
    );
  } catch {
    return out;
  }

  const records = await withStore<VectorRecord[]>("readonly", (store) =>
    store.getAll(range),
  );
  for (const record of records ?? []) {
    // A record written by a different build could be shaped differently;
    // skip rather than hand back something that is not a vector.
    if (record?.key && record.vector instanceof Float32Array)
      out.set(record.key, record.vector);
  }
  return out;
}

/**
 * Persists vectors. Returns whether the write landed.
 *
 * One transaction for the whole batch: a corpus is embedded together, and
 * per-vector transactions would be far slower for no benefit.
 */
export async function saveVectors(
  entries: { key: string; vector: Float32Array }[],
): Promise<boolean> {
  if (entries.length === 0) return true;
  const db = await openDB();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch (err) {
      warnUnavailableOnce(`IndexedDB rejected a write (${String(err)})`);
      resolve(false);
      return;
    }
    const store = tx.objectStore(STORE);
    const savedAt = Date.now();
    for (const { key, vector } of entries) {
      const record: VectorRecord = {
        key,
        vector,
        bytes: vector.byteLength + key.length * 2,
        savedAt,
      };
      try {
        store.put(record);
      } catch {
        // Keep going; a single bad record should not lose the batch.
      }
    }
    tx.oncomplete = () => resolve(true);
    // Quota errors surface here rather than on the individual put.
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

/** Current size of the vector cache. */
export async function vectorStoreUsage(): Promise<{
  count: number;
  bytes: number;
}> {
  const records = await withStore<VectorRecord[]>("readonly", (store) =>
    store.getAll(),
  );
  let bytes = 0;
  for (const record of records ?? []) bytes += record?.bytes ?? 0;
  return { count: records?.length ?? 0, bytes };
}

/**
 * Drops the oldest vectors until the store fits in `maxBytes`.
 * Returns how many were removed.
 */
export async function trimVectorStore(
  maxBytes = MAX_VECTOR_STORE_BYTES,
): Promise<number> {
  const records = await withStore<VectorRecord[]>("readonly", (store) =>
    store.getAll(),
  );
  if (!records || records.length === 0) return 0;

  let total = 0;
  for (const record of records) total += record?.bytes ?? 0;
  if (total <= maxBytes) return 0;

  // Oldest first, so the corpus someone is working with right now survives.
  const byAge = [...records].sort(
    (a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0),
  );
  const doomed: string[] = [];
  for (const record of byAge) {
    if (total <= maxBytes) break;
    doomed.push(record.key);
    total -= record?.bytes ?? 0;
  }

  for (const key of doomed)
    await withStore("readwrite", (store) => store.delete(key));
  return doomed.length;
}

/** Removes every cached vector. */
export async function clearVectors(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}
