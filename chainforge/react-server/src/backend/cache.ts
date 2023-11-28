import { Dict } from "./typing";
import LZString from 'lz-string';

/**
 * Singleton JSON cache that functions like a local filesystem in a Python backend, 
 * but where 'storageKeys' are used in place of filepaths. 
 */
export default class StorageCache {
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

  private getCacheData(key: string): Dict | undefined {
    return this.data[key] || undefined;
  }
  public static get(key: string): Dict | undefined {
    return StorageCache.getInstance().getCacheData(key);
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

  private clearCache(): void {
    this.data = {};
  }
  public static clear(): void {
    StorageCache.getInstance().clearCache();
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
  public static saveToLocalStorage(localStorageKey: string='chainforge', data?: Dict): boolean {
    data = data ?? StorageCache.getInstance().data;
    const compressed = LZString.compressToUTF16(JSON.stringify(data));
    try {
      localStorage.setItem(localStorageKey, compressed);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        // Handle the error when storage quota is exceeded
        console.warn("Storage quota exceeded");
      } else {
        // Handle other types of storage-related errors
        console.error("Error storing data in localStorage:", error.message);
      }
      return false;
    }
  }

  /**
   * Attempts to load a previously stored cache JSON from localStorage.
   * Performs lz-string decompression from UTF16 encoding. 
   * 
   * @param localStorageKey The key that will be used in localStorage (default='chainforge')
   * @returns Loaded data if succeeded, undefined if failure (e.g., key not found). 
   */
  public static loadFromLocalStorage(localStorageKey: string='chainforge', setStorageCacheData: boolean=true): boolean {
    const compressed = localStorage.getItem(localStorageKey);
    if (!compressed) {
      console.error(`Could not find cache data in localStorage with key ${localStorageKey}.`);
      return undefined;
    }
    try {
      let data = JSON.parse(LZString.decompressFromUTF16(compressed));
      if (setStorageCacheData)
        StorageCache.getInstance().data = data;
      console.log('loaded', data);
      return data;
    } catch (error) {
      console.error(error.message);
      return undefined;
    }
  }
}