import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  NOTICE_DISMISSED_KEY,
  ProtectionEnv,
  StorageProtection,
  checkStorageProtection,
  dismissStorageNotice,
  getStorageProtection,
  requestStorageProtection,
  resetStorageProtection,
  storageNoticeDismissed,
  subscribeStorageProtection,
} from "../storagePersistence";

/** A stand-in for navigator.storage that grants or declines persistence. */
const fakeManager = (opts: { persisted?: boolean; grants?: boolean }) => {
  const persist = jest.fn(async () => opts.grants ?? false);
  const persisted = jest.fn(async () => opts.persisted ?? false);
  return { persist, persisted };
};

const chrome = (manager?: ProtectionEnv["manager"]): ProtectionEnv => ({
  manager,
  safari: false,
  standalone: false,
});

beforeEach(() => resetStorageProtection());

describe("requesting that the browser keep ChainForge's storage", () => {
  test("a browser that grants it protects storage", async () => {
    const manager = fakeManager({ grants: true });
    const result = await requestStorageProtection(chrome(manager));
    expect(result).toEqual({ status: "protected", requested: true });
    expect(manager.persist).toHaveBeenCalledTimes(1);
  });

  test("a browser that declines leaves storage at risk", async () => {
    const result = await requestStorageProtection(
      chrome(fakeManager({ grants: false })),
    );
    expect(result).toEqual({
      status: "at-risk",
      reason: "declined",
      requested: true,
    });
  });

  test("storage that's already protected isn't requested again", async () => {
    const manager = fakeManager({ persisted: true });
    const result = await requestStorageProtection(chrome(manager));
    expect(result.status).toBe("protected");
    expect(manager.persist).not.toHaveBeenCalled();
  });

  test("a browser without the Storage API is at risk", async () => {
    const result = await requestStorageProtection(chrome(undefined));
    expect(result).toEqual({
      status: "at-risk",
      reason: "unsupported",
      requested: true,
    });
  });

  test("an error from the browser counts as declined, without throwing", async () => {
    const manager = {
      persisted: jest.fn(async () => false),
      persist: jest.fn(async (): Promise<boolean> => {
        throw new Error("NotAllowedError");
      }),
    };
    const result = await requestStorageProtection(chrome(manager));
    expect(result.reason).toBe("declined");
  });

  test("it's requested at most once per session, even when saves overlap", async () => {
    const manager = fakeManager({ grants: false });
    await Promise.all([
      requestStorageProtection(chrome(manager)),
      requestStorageProtection(chrome(manager)),
    ]);
    await requestStorageProtection(chrome(manager));
    expect(manager.persist).toHaveBeenCalledTimes(1);
  });
});

describe("Safari's 7-day deletion", () => {
  test("Safari in a tab is at risk even when persistence is granted", async () => {
    const result = await requestStorageProtection({
      manager: fakeManager({ grants: true }),
      safari: true,
      standalone: false,
    });
    expect(result).toEqual({
      status: "at-risk",
      reason: "safari",
      requested: true,
    });
  });

  test("a Home Screen or Dock web app in Safari is protected when granted", async () => {
    const result = await requestStorageProtection({
      manager: fakeManager({ grants: true }),
      safari: true,
      standalone: true,
    });
    expect(result.status).toBe("protected");
  });
});

describe("checking protection without requesting it", () => {
  test("reads the current state and never asks (Firefox would prompt)", async () => {
    const manager = fakeManager({ persisted: false, grants: true });
    const result = await checkStorageProtection(chrome(manager));
    expect(result).toEqual({
      status: "at-risk",
      reason: "declined",
      requested: false,
    });
    expect(manager.persist).not.toHaveBeenCalled();
  });

  test("doesn't overwrite the result of a request", async () => {
    await requestStorageProtection(chrome(fakeManager({ grants: true })));
    const result = await checkStorageProtection(
      chrome(fakeManager({ persisted: false })),
    );
    expect(result).toEqual({ status: "protected", requested: true });
  });
});

describe("listening for changes", () => {
  test("listeners hear each change until they unsubscribe", async () => {
    const heard: StorageProtection[] = [];
    const unsubscribe = subscribeStorageProtection((p) => heard.push(p));
    await checkStorageProtection(chrome(fakeManager({ persisted: false })));
    unsubscribe();
    await requestStorageProtection(chrome(fakeManager({ grants: true })));
    expect(heard).toEqual([
      { status: "at-risk", reason: "declined", requested: false },
    ]);
    expect(getStorageProtection()).toEqual({
      status: "protected",
      requested: true,
    });
  });
});

describe("dismissing the notice", () => {
  const memoryStorage = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  };

  test("is remembered", () => {
    const storage = memoryStorage();
    expect(storageNoticeDismissed(storage)).toBe(false);
    dismissStorageNotice(storage);
    expect(storageNoticeDismissed(storage)).toBe(true);
    expect(storage.getItem(NOTICE_DISMISSED_KEY)).toBe("true");
  });

  test("unavailable storage never throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => dismissStorageNotice(broken)).not.toThrow();
    expect(storageNoticeDismissed(broken)).toBe(false);
    expect(storageNoticeDismissed(undefined)).toBe(false);
  });
});
