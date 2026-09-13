import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import "fake-indexeddb/auto";

/**
 * Serving the built app from localhost without a Flask server is an ordinary
 * way to run the browser-only feature set, and it used to fail: the upload
 * path is chosen by hostname, so it POSTed to a server that was not there and
 * surfaced "Failed to fetch" instead of keeping the file in the browser.
 *
 * These pin the distinction that makes the fallback safe -- an unreachable
 * server falls back, a server that answers and refuses does not.
 */

jest.mock("../utils", () => ({
  APP_IS_RUNNING_LOCALLY: () => true,
  FLASK_BASE_URL: "http://localhost:8000/",
  blobOrFileToDataURL: async () => "data:text/plain;base64,eA==",
  dataURLToBlob: () => new Blob(["x"]),
  base64ToBlob: () => new Blob(["x"]),
}));

// eslint-disable-next-line import/first
import { MediaLookup } from "../cache";

const file = () =>
  new File(["hello there"], "notes.txt", { type: "text/plain" });

beforeEach(() => {
  MediaLookup.clear?.();
  jest.restoreAllMocks();
});

describe("uploading while on localhost", () => {
  test("uses the backend when one answers", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ uid: "server-uid-1" }),
    })) as any;

    expect(await MediaLookup.upload(file())).toBe("server-uid-1");
  });

  test("falls back to the browser when the server is unreachable", async () => {
    // fetch rejects with a TypeError when nothing is listening.
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as any;

    const uid = await MediaLookup.upload(file());
    expect(uid).toMatch(/^cache__/);
    expect(uid).toContain("notes.txt");
  });

  test("the fallback file is actually retrievable", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as any;

    const uid = await MediaLookup.upload(file());
    expect(await MediaLookup.get(uid)).toBeDefined();
  });

  test("a server that answers and refuses is reported, not swallowed", async () => {
    // Masking this would silently store a file the server rejected.
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      statusText: "Payload Too Large",
    })) as any;

    await expect(MediaLookup.upload(file())).rejects.toThrow(
      /Payload Too Large/,
    );
  });

  test("a malformed success response is reported too", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as any;

    await expect(MediaLookup.upload(file())).rejects.toThrow(/No UID/);
  });
});
