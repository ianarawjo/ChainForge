import { expect, test } from "@jest/globals";
import StorageCache from "../cache";

test("saving and loading cache data from localStorage", () => {
  // Store Unicode and numeric data into StorageCache
  StorageCache.store("hello", { a: "土", b: "ہوا", c: "火" });
  StorageCache.store("world", 42);

  // Verify stored data:
  let d = StorageCache.get("hello");
  expect(d).toHaveProperty("a");
  expect(d?.a).toBe("土");

  // Save to localStorage
  StorageCache.saveToLocalStorage("test");

  // Remove all data in the cache
  StorageCache.clear();

  // Double-check there's no data:
  d = StorageCache.get("hello");
  expect(d).toBeUndefined();

  // Load cache from localStorage
  StorageCache.loadFromLocalStorage("test", false);

  // Verify stored data:
  d = StorageCache.get("hello");
  expect(d).toHaveProperty("c");
  expect(d?.c).toBe("火");
  expect(StorageCache.get("world")).toBe(42);
});
