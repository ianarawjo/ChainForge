import { Dict } from "./typing";

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

  private getCacheData(key: string): Dict {
    return this.data[key] || {};
  }
  public static get(key: string): Dict {
    return StorageCache.getInstance().getCacheData(key);
  }
  
  private storeCacheData(key: string, _data: any): void {
    this.data[key] = _data;
  }
  public static store(key: string, data: any): void {
    StorageCache.getInstance().storeCacheData(key, data);
  }
}