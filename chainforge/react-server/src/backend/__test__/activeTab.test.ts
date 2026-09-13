import { describe, expect, test } from "@jest/globals";
import { ACTIVE_TAB_KEY, claimActiveTab, isActiveTab } from "../activeTab";

/** In-memory stand-in for localStorage, shared between "tabs". */
const memoryStorage = () => {
  const data = new Map<string, string>();
  let writes = 0;
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      writes++;
      data.set(k, v);
    },
    writes: () => writes,
  };
};

const brokenStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("which tab may save on hide or close", () => {
  test("before any tab claims, every tab may save", () => {
    const storage = memoryStorage();
    expect(isActiveTab("A", storage)).toBe(true);
    expect(isActiveTab("B", storage)).toBe(true);
  });

  test("the tab used last may save; an older background tab may not", () => {
    const storage = memoryStorage();
    claimActiveTab("A", storage); // opened first
    claimActiveTab("B", storage); // user moved on to B
    expect(isActiveTab("B", storage)).toBe(true);
    expect(isActiveTab("A", storage)).toBe(false);
  });

  test("using an older tab again lets it save again", () => {
    const storage = memoryStorage();
    claimActiveTab("A", storage);
    claimActiveTab("B", storage);
    claimActiveTab("A", storage);
    expect(isActiveTab("A", storage)).toBe(true);
    expect(isActiveTab("B", storage)).toBe(false);
  });

  test("repeated claims by the same tab don't rewrite storage", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 50; i++) claimActiveTab("A", storage);
    expect(storage.writes()).toBe(1);
    expect(storage.getItem(ACTIVE_TAB_KEY)).toBe("A");
  });

  test("unavailable storage never blocks saving", () => {
    expect(() => claimActiveTab("A", brokenStorage)).not.toThrow();
    expect(isActiveTab("A", brokenStorage)).toBe(true);
    expect(isActiveTab("A", undefined)).toBe(true);
  });
});
