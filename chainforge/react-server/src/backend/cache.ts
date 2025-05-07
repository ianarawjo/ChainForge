import { Dict, JSONCompatible } from "./typing";
import LZString from "lz-string";
import {
  APP_IS_RUNNING_LOCALLY,
  blobOrFileToDataURL,
  dataURLToBlob,
  FLASK_BASE_URL,
} from "./utils";
import { v4 as uuid } from "uuid";

const IS_RUNNING_LOCALLY = APP_IS_RUNNING_LOCALLY();

/**
 * Singleton JSON cache that functions like a local filesystem in a Python backend,
 * but where 'storageKeys' are used in place of filepaths.
 */
export default class StorageCache {
  // eslint-disable-next-line no-use-before-define
  private static instance: StorageCache;
  private data: Dict;

  private constructor() {
    // Initialize the singleton instance
    this.data = {};
  }

  /** Gets the storage cache. Initializes it if the singleton instance does not yet exist. */
  public static getInstance(): StorageCache {
    if (!StorageCache.instance) {
      StorageCache.instance = new StorageCache();
    }
    return StorageCache.instance;
  }

  private getCacheData(key: string): any {
    return this.data[key] ?? undefined;
  }

  public static get(key: string): any {
    return StorageCache.getInstance().getCacheData(key);
  }

  private getAllCacheData(filterFunc: (key: string) => boolean): Dict {
    const res: Dict = {};
    Object.keys(this.data)
      .filter(filterFunc)
      .forEach((key) => {
        res[key] = this.data[key];
      });
    return res;
  }

  public static getAllMatching(filterFunc: (key: string) => boolean): Dict {
    return StorageCache.getInstance().getAllCacheData(filterFunc);
  }

  private hasKey(key: string): boolean {
    return key in this.data;
  }

  public static has(key: string): boolean {
    return StorageCache.getInstance().hasKey(key);
  }

  private storeCacheData(key: string, _data: any): void {
    this.data[key] = _data;
  }

  public static store(key: string, data: any): void {
    StorageCache.getInstance().storeCacheData(key, data);
  }

  private clearCache(key?: string): void {
    if (key === undefined) this.data = {};
    else if (key in this.data) delete this.data[key];
  }

  /**
   * Clears data in the cache.
   * @param key Optional. A specific key to clear in the storage dict. If undefined, clears all data.
   */
  public static clear(key?: string): void {
    StorageCache.getInstance().clearCache(key);
    if (key === undefined) StringLookup.restoreFrom([]);
  }

  /**
   * Attempts to store the entire cache in localStorage.
   * Performs lz-string compression (https://pieroxy.net/blog/pages/lz-string/index.html)
   * before storing a JSON object in UTF encoding.
   *
   * Use loadFromLocalStorage to unpack the localStorage data.
   *
   * @param localStorageKey The key that will be used in localStorage (default='chainforge')
   * @param data Optional. JSON-compatible data to store. If undefined, will store the StorageCache's data. If defined, will only store the passed data.
   * @returns True if succeeded, false if failure (e.g., too big for localStorage).
   */
  public static saveToLocalStorage(
    localStorageKey = "chainforge",
    data?: Dict,
  ): boolean {
    data = data ?? StorageCache.getInstance().data;
    const compressed = LZString.compressToUTF16(JSON.stringify(data));
    try {
      localStorage.setItem(localStorageKey, compressed);
      return true;
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        // Handle the error when storage quota is exceeded
        console.warn("Storage quota exceeded");
      } else {
        // Handle other types of storage-related errors
        console.error(
          "Error storing data in localStorage:",
          (error as Error).message,
        );
      }
      return false;
    }
  }

  /**
   * Attempts to load a previously stored cache JSON from localStorage.
   * Performs lz-string decompression from UTF16 encoding.
   *
   * @param localStorageKey The key that will be used in localStorage (default='chainforge')
   * @param replaceStorageCacheWithLoadedData Whether the data in the StorageCache should be saved with the loaded data. Erases all current memory. Only set this to true if you are replacing the ChainForge flow state entirely.
   * @returns Loaded data if succeeded, undefined if failure (e.g., key not found).
   */
  public static loadFromLocalStorage(
    localStorageKey = "chainforge",
    replaceStorageCacheWithLoadedData = false,
  ): JSONCompatible | undefined {
    const compressed = localStorage.getItem(localStorageKey);
    if (!compressed) {
      console.error(
        `Could not find cache data in localStorage with key ${localStorageKey}.`,
      );
      return undefined;
    }
    try {
      const data = JSON.parse(LZString.decompressFromUTF16(compressed));
      if (replaceStorageCacheWithLoadedData) {
        // Replaces the current cache data with the loaded data
        StorageCache.getInstance().data = data;
        // Restores the current StringLookup table with the contents of the loaded data, if the __s key is present.
        if (data.__s) StringLookup.restoreFrom(data.__s);
        // Restores the current MediaLookup table with the contents of the loaded data, if the __media key is present.
        if (data.__media) MediaLookup.restoreFrom(data.__media);
      }
      console.log("loaded", data);
      return data;
    } catch (error) {
      console.error((error as Error).message);
      return undefined;
    }
  }
}

/** Global string intern table for efficient storage of repeated strings */
export class StringLookup {
  // eslint-disable-next-line no-use-before-define
  private static instance: StringLookup;
  private stringToIndex: Map<string, number> = new Map();
  private indexToString: string[] = [];

  /** Gets the string intern lookup table. Initializes it if the singleton instance does not yet exist. */
  public static getInstance(): StringLookup {
    if (!StringLookup.instance) {
      StringLookup.instance = new StringLookup();
    }
    return StringLookup.instance;
  }

  /** Adds a string to the table and returns its index */
  public static intern(str: string): number {
    const s = StringLookup.getInstance();
    if (s.stringToIndex.has(str)) {
      return s.stringToIndex.get(str)!; // Return existing index
    }

    // Add new string to the table
    const index = s.indexToString.length;
    s.indexToString.push(str);
    s.stringToIndex.set(str, index);

    // Save to cache
    StorageCache.store("__s", s.indexToString);

    return index;
  }

  // Overloaded signatures
  // This tells TypeScript that a number or string will always produce a string or undefined,
  // whereas any other type T will return the same type.
  public static get(index: number | string | undefined): string | undefined;
  public static get<T>(index: T): T;

  /**
   * Retrieves the string in the lookup table, given its index.
   * - **Note**: This function soft fails: if index is not a number, returns index unchanged.
   */
  public static get<T>(index: T | number): T | string {
    if (typeof index !== "number") return index;
    const s = StringLookup.getInstance();
    return s.indexToString[index]; // O(1) lookup
  }

  /**
   * Transforms a Dict by interning all strings encountered, up to 1 level of depth,
   * and returning the modified Dict with the strings as hash indexes instead.
   *
   * NOTE: This ignores recursing into any key "llm" that has a dict component.
   */
  public static internDict(
    d: Dict,
    inplace?: boolean,
    depth = 1,
    ignoreKey = ["llm", "uid", "eval_res"],
  ): Dict {
    const newDict = inplace ? d : ({} as Dict);
    const entries = Object.entries(d);

    for (const [key, value] of entries) {
      if (ignoreKey.includes(key)) {
        // Keep the ignored key the same
        if (!inplace) newDict[key] = value;
        continue;
      }
      if (typeof value === "string") {
        newDict[key] = StringLookup.intern(value);
      } else if (
        Array.isArray(value) &&
        value.every((v) => typeof v === "string")
      ) {
        newDict[key] = value.map((v) => StringLookup.intern(v));
      } else if (depth > 0 && typeof value === "object" && value !== null) {
        newDict[key] = StringLookup.internDict(
          value as Dict,
          inplace,
          depth - 1,
        );
      } else {
        if (!inplace) newDict[key] = value;
      }
    }

    return newDict as Map<string, unknown>;
  }

  /**
   * Treats all numberic values in the dictionary as hashes, and maps them to strings.
   * Leaves the rest of the dict unchanged. (Only operates 1 level deep.)
   * @param d The dictionary to operate over
   */
  public static concretizeDict<T>(
    d: Dict<T | number>,
    inplace = false,
    depth = 1,
    ignoreKey = ["llm", "uid", "eval_res"],
  ): Dict<T | string> {
    const newDict = inplace ? d : ({} as Dict);
    const entries = Object.entries(d);
    for (const [key, value] of entries) {
      const ignore = ignoreKey.includes(key);
      if (!ignore && typeof value === "number")
        newDict[key] = StringLookup.get(value);
      else if (
        !ignore &&
        Array.isArray(value) &&
        value.every((v) => typeof v === "number")
      )
        newDict[key] = value.map((v) => StringLookup.get(v));
      else if (
        !ignore &&
        depth > 0 &&
        typeof value === "object" &&
        value !== null
      ) {
        newDict[key] = StringLookup.concretizeDict(
          value as Dict<unknown>,
          false,
          0,
        );
      } else if (!inplace) newDict[key] = value;
    }
    return newDict;
  }

  public static restoreFrom(savedIndexToString?: string[]): void {
    const s = StringLookup.getInstance();
    s.stringToIndex = new Map<string, number>();
    if (savedIndexToString === undefined || savedIndexToString.length === 0) {
      // Reset
      s.indexToString = [];
      return;
    } else if (!Array.isArray(savedIndexToString)) {
      // Reset, but warn user
      console.error(
        "String lookup table could not be loaded: data.__s is not an array.",
      );
      s.indexToString = [];
      return;
    }

    // Recreate from the index array
    s.indexToString = savedIndexToString;
    savedIndexToString.forEach((v, i) => {
      s.stringToIndex.set(v, i);
    });
  }

  /** Serializes interned strings and their mappings */
  public static toJSON() {
    const s = StringLookup.getInstance();
    return s.indexToString;
  }

  /** Restores from JSON */
  static fromJSON(data: { dictionary: string[] }) {
    const table = new StringLookup();
    table.indexToString = data.dictionary;
    table.stringToIndex = new Map(data.dictionary.map((str, i) => [str, i]));
    StringLookup.instance = table;
  }
}

/** Global media lookup table for efficient storage and retrieval of media (images, PDFs, etc) with the Flask backend. */
export class MediaLookup {
  // eslint-disable-next-line no-use-before-define
  private static instance: MediaLookup;
  /**
   * All media UIDs that are used in the currently loaded flow.
   * This is used to keep track of the currently loaded media,
   * and export all the relevant media for the flow when the user clicks "Export".
   */
  private mediaUIDs = new Set<string>();
  // Use a cache if running locally, otherwise use the backend
  private cache: Dict<Blob> = {};

  private constructor() {
    // Initialize the singleton instance
    this.mediaUIDs = new Set<string>();
    this.cache = {};
  }

  /**
   * Saves the current state of the media lookup table to localStorage.
   */
  public saveStateToStorageCache(): void {
    const savedState = {
      mediaUIDs: Array.from(this.mediaUIDs),
      cache: this.cache,
    };
    StorageCache.store("__media", savedState);
  }

  public restoreStateFromStorageCache(): boolean {
    const savedState = StorageCache.get("__media");
    if (savedState) {
      this.mediaUIDs = new Set(savedState.mediaUIDs);
      this.cache = savedState.cache;
      return true;
    }
    return false;
  }

  /**
   * Adds a UID to the media UIDs set and optionally adds a Blob to the cache.
   * Handles saving the state to localStorage.
   * @param uid The UID of the media
   * @param blob Optional. A Blob or File object to cache
   */
  private add(uid: string, blob?: Blob | File): void {
    this.mediaUIDs.add(uid);

    if (blob) this.cache[uid] = blob;

    this.saveStateToStorageCache();
  }

  public static setCacheData(uid: string, blob: Blob | File): void {
    const mediaLookup = MediaLookup.getInstance();
    mediaLookup.mediaUIDs.add(uid);
    mediaLookup.cache[uid] = blob;
  }

  static getInstance(): MediaLookup {
    if (!MediaLookup.instance) {
      MediaLookup.instance = new MediaLookup();
    }
    return MediaLookup.instance;
  }

  public static hasAnyMedia(): boolean {
    const mediaLookup = MediaLookup.getInstance();
    return (
      mediaLookup.mediaUIDs.size > 0 ||
      Object.keys(mediaLookup.cache).length > 0
    );
  }

  /**
   * Uploads a file to the backend and returns its UID.
   * @param file A Blob or File object to upload
   * @returns The UID assigned by the backend
   */
  public static async upload(file: File | Blob): Promise<string> {
    if (IS_RUNNING_LOCALLY) {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${FLASK_BASE_URL}upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);

      const json = await res.json();
      const uid = json.uid;

      if (!uid) throw new Error("Upload failed: No UID returned");

      // Store the UID in the media UIDs set
      MediaLookup.getInstance().add(uid);

      return uid;
    } else {
      // Make a uid for the file, and use it to cache the file:
      // NOTE: We keep the file name around, if there is one, just in case we need to recover it later.
      const uid =
        `cache__${uuid()}__cache` + ("name" in file ? `__${file.name}` : "");
      MediaLookup.getInstance().add(uid, file);
      return uid;
    }
  }

  /**
   * Fetches the raw Blob from the backend using a UID.
   * @param uid The UID of the file
   * @returns Blob (image, PDF, etc.)
   */
  public static async get(uid: string): Promise<Blob | undefined> {
    // Check if the file is in the mediaUIDs
    const mediaLookup = MediaLookup.getInstance();
    const isInLookup = mediaLookup.mediaUIDs.has(uid);
    if (!isInLookup) {
      console.error(
        `File with UID ${uid} not found in media UIDs. Still proceeding to try to fetch....`,
      );
    }

    if (IS_RUNNING_LOCALLY) {
      // Fetch the file from the backend
      const res = await fetch(`${FLASK_BASE_URL}media/${uid}`);
      if (!res.ok) {
        console.error(`Fetch failed for UID ${uid}: ${res.statusText}`);
        return undefined;
      }

      const blob = await res.blob();

      // If the file was for some reason not listed in the media UIDs, add it now:
      if (!isInLookup) mediaLookup.add(uid);

      return blob;
    } else {
      // Check if the file is in the cache
      const blob = mediaLookup.cache[uid];
      if (blob) {
        // If the file was for some reason not listed in the media UIDs, add it now:
        if (!isInLookup) mediaLookup.add(uid);

        return blob;
      } else {
        console.error(`File with UID ${uid} not found in cache.`);
        return undefined;
      }
    }
  }

  /**
   * Fetches the text content from the backend using a UID.
   * @param uid The UID of the file (must be a doc)
   * @returns Text content as a string
   */
  public static async getAsText(uid: string): Promise<string | undefined> {
    // Check if the file is in the mediaUIDs
    const mediaLookup = MediaLookup.getInstance();
    const isInLookup = mediaLookup.mediaUIDs.has(uid);
    if (!isInLookup) {
      console.error(
        `File with UID ${uid} not found in media UIDs. Still proceeding to try to fetch....`,
      );
    }

    if (IS_RUNNING_LOCALLY) {
      // Fetch the file from the backend
      const res = await fetch(`${FLASK_BASE_URL}mediaToText/${uid}`);
      if (!res.ok) {
        throw new Error(`Fetch failed for UID ${uid}: ${res.statusText}`);
      }
      const json = await res.json();
      const text = json.text;

      if (text === undefined)
        throw new Error(`Fetch failed for UID ${uid}: No text returned`);

      // If the file was for some reason not listed in the media UIDs, add it now:
      if (!isInLookup) mediaLookup.add(uid);

      return json.text;
    } else {
      // TODO: Implement this for the local cache
      throw new Error(
        `Text content not available for UID ${uid} in local cache.`,
      );
    }
  }

  /**
   * Returns a usable object URL (e.g., for <img src=...>) for a given UID.
   * Automatically revokes the previous URL for the same UID.
   * @param uid The UID of the file
   * @returns An object URL string
   */
  public static async getUrl(uid: string): Promise<string> {
    const blob = await MediaLookup.get(uid);
    if (!blob) {
      console.error(`Blob not found for UID ${uid}`);
      return "";
    }
    return URL.createObjectURL(blob);
  }

  /**
   * Clears the media lookup table and its cache entirely.
   */
  public static clear(): void {
    const mediaLookup = MediaLookup.getInstance();
    mediaLookup.mediaUIDs.clear();
    mediaLookup.cache = {};
    mediaLookup.saveStateToStorageCache();
  }

  /**
   * Removes a specific UID from the media lookup table and its cache.
   * @param uid The UID to remove
   */
  public static remove(uid: string): void {
    const mediaLookup = MediaLookup.getInstance();
    mediaLookup.mediaUIDs.delete(uid);
    delete mediaLookup.cache[uid];
    mediaLookup.saveStateToStorageCache();
  }

  /**
   * Restores the media lookup table from a saved state.
   * NOTE: This deliberately does not override the current mediaUIDs or cache.
   * If you want to clear the current mediaUIDs or cache, use the clear() method first.
   * @param savedState The saved state containing mediaUIDs and cache.
   */
  public static restoreFrom(savedState?: {
    uids: string[];
    cache?: Dict<string>;
  }): void {
    if (!savedState) return;

    const mediaLookup = MediaLookup.getInstance();

    if (Array.isArray(savedState.uids)) {
      savedState.uids.forEach((uid) => {
        mediaLookup.mediaUIDs.add(uid);
      });
    }

    if (savedState.cache !== undefined) {
      // Convert each data URL back to a Blob
      for (const [key, base64String] of Object.entries(savedState.cache)) {
        const blob = dataURLToBlob(base64String);
        mediaLookup.cache[key] = blob;
      }
    }

    mediaLookup.saveStateToStorageCache();
  }

  /**
   * Serializes the media lookup table to a JSON-compatible object.
   * @returns An object containing the mediaUIDs and cache.
   */
  public static async toJSON(): Promise<{
    uids: string[];
    cache?: Dict<string>;
  }> {
    const mediaLookup = MediaLookup.getInstance();

    // Convert each Blob to a base64 string
    const serializedCache: Dict<Promise<string>> = {};
    for (const [key, blob] of Object.entries(mediaLookup.cache)) {
      serializedCache[key] = blobOrFileToDataURL(blob);
    }

    // Wait for all the base64 strings to be generated
    const serializedCacheEntries = await Promise.all(
      Object.entries(serializedCache).map(async ([key, blobPromise]) => {
        const base64String = await blobPromise;
        return [key, base64String];
      }),
    );

    // Convert the array of entries back to an object
    const serializedBlobs: Dict<string> = Object.fromEntries(
      serializedCacheEntries,
    );

    return {
      uids: Array.from(mediaLookup.mediaUIDs),
      cache: serializedBlobs,
    };
  }
}
