/*
 * @jest-environment jsdom
 */
import { describe, expect, jest, test } from "@jest/globals";
import axios from "axios";
import {
  SESSION_TOKEN_HEADER,
  addSessionTokenToAxios,
  createTokenSource,
  injectedSessionToken,
  isBackendUrl,
  withSessionToken,
} from "../sessionToken";

const SERVED = "http://localhost:8000/";

describe("isBackendUrl", () => {
  test("a page served by ChainForge: its own origin is the server", () => {
    expect(isBackendUrl("/api/flows", "/", SERVED)).toBe(true);
    expect(isBackendUrl("app/executepy", "/", SERVED)).toBe(true);
    expect(isBackendUrl("http://localhost:8000/media/x.png", "/", SERVED)).toBe(
      true,
    );
  });

  test("never another site, so the token cannot leak to a provider", () => {
    expect(isBackendUrl("https://api.openai.com/v1/chat", "/", SERVED)).toBe(
      false,
    );
    expect(isBackendUrl("http://localhost:11434/api/chat", "/", SERVED)).toBe(
      false,
    );
    expect(isBackendUrl("http://127.0.0.1:8000/api/flows", "/", SERVED)).toBe(
      false,
    );
  });

  test("a front-end dev server: only the configured backend", () => {
    const dev = "http://localhost:3000/";
    expect(isBackendUrl("http://localhost:8000/api/flows", SERVED, dev)).toBe(
      true,
    );
    expect(isBackendUrl("/static/js/main.js", SERVED, dev)).toBe(false);
  });

  test("not blob, data or unparseable URLs", () => {
    expect(isBackendUrl("blob:http://localhost:8000/abc", "/", SERVED)).toBe(
      false,
    );
    expect(isBackendUrl("data:text/plain,hi", "/", SERVED)).toBe(false);
    expect(isBackendUrl("http://", "/", SERVED)).toBe(false);
  });
});

test("injectedSessionToken", () => {
  expect(injectedSessionToken({ __CF_SESSION_TOKEN: "t" })).toBe("t");
  expect(injectedSessionToken({ __CF_SESSION_TOKEN: "" })).toBeUndefined();
  expect(injectedSessionToken({})).toBeUndefined();
});

/** A fetch that records what it was called with. */
function recordingFetch() {
  const calls: { input: unknown; init?: RequestInit }[] = [];
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  };
  return { fetchFn, calls };
}

describe("withSessionToken", () => {
  const isBackend = (url: string) => isBackendUrl(url, "/", SERVED);
  const token = async () => "t0k3n";

  test("adds the token to requests for the server, keeping their headers", async () => {
    const { fetchFn, calls } = recordingFetch();
    await withSessionToken(
      fetchFn,
      token,
      isBackend,
    )("/app/executepy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(calls[0].init).toEqual({
      method: "POST",
      body: "{}",
      headers: {
        "Content-Type": "application/json",
        [SESSION_TOKEN_HEADER]: "t0k3n",
      },
    });
  });

  test("leaves requests to other sites exactly as they were", async () => {
    const { fetchFn, calls } = recordingFetch();
    const init = { method: "POST", headers: { Authorization: "Bearer sk" } };
    await withSessionToken(
      fetchFn,
      token,
      isBackend,
    )("https://api.openai.com/v1/chat", init);
    expect(calls[0].init).toBe(init);
  });

  test("accepts headers given as an array", async () => {
    const { fetchFn, calls } = recordingFetch();
    await withSessionToken(
      fetchFn,
      token,
      isBackend,
    )("/api/flows", {
      headers: [["Accept", "application/json"]],
    });
    expect(calls[0].init?.headers).toEqual({
      Accept: "application/json",
      [SESSION_TOKEN_HEADER]: "t0k3n",
    });
  });

  test("sends the request unchanged when there is no token", async () => {
    const { fetchFn, calls } = recordingFetch();
    await withSessionToken(
      fetchFn,
      async () => undefined,
      isBackend,
    )("/api/flows");
    expect(calls[0].init).toBeUndefined();
  });
});

describe("createTokenSource", () => {
  test("uses the token in the page without asking the server", async () => {
    const { fetchFn, calls } = recordingFetch();
    const get = createTokenSource({
      win: { __CF_SESSION_TOKEN: "page" },
      fetchFn,
      runningLocally: () => true,
    });
    expect(await get()).toBe("page");
    expect(calls).toHaveLength(0);
  });

  test("the hosted website has no server and asks nothing", async () => {
    const { fetchFn, calls } = recordingFetch();
    const get = createTokenSource({
      win: {},
      fetchFn,
      runningLocally: () => false,
    });
    expect(await get()).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  test("a dev server asks the server once and reuses the answer", async () => {
    const fetchFn = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ token: "dev" }),
        }) as Response,
    );
    const get = createTokenSource({
      win: {},
      fetchFn,
      runningLocally: () => true,
      baseUrl: SERVED,
    });
    expect(await Promise.all([get(), get()])).toEqual(["dev", "dev"]);
    expect(await get()).toBe("dev");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(`${SERVED}api/sessionToken`);
  });

  test("a refused request gives no token, and is tried again later", async () => {
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    let answer: { ok: boolean; status: number; json: () => Promise<unknown> } =
      {
        ok: false,
        status: 403,
        json: async () => ({ error: "refused" }),
      };
    const fetchFn = jest.fn(async () => answer as Response);
    const get = createTokenSource({
      win: {},
      fetchFn,
      runningLocally: () => true,
      baseUrl: SERVED,
    });
    expect(await get()).toBeUndefined();
    answer = { ok: true, status: 200, json: async () => ({ token: "later" }) };
    expect(await get()).toBe("later");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe("addSessionTokenToAxios", () => {
  function instanceRecordingHeaders() {
    const seen: Record<string, unknown>[] = [];
    const instance = axios.create({
      adapter: async (config) => {
        seen.push({ ...(config.headers as Record<string, unknown>) });
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      },
    });
    return { instance, seen };
  }
  const isBackend = (url: string) => isBackendUrl(url, "/", SERVED);

  test("adds the token to requests for the server", async () => {
    const { instance, seen } = instanceRecordingHeaders();
    addSessionTokenToAxios(instance, async () => "t0k3n", isBackend);
    await instance.get("http://localhost:8000/api/flows");
    expect(seen[0][SESSION_TOKEN_HEADER]).toBe("t0k3n");
  });

  test("not to other sites", async () => {
    const { instance, seen } = instanceRecordingHeaders();
    addSessionTokenToAxios(instance, async () => "t0k3n", isBackend);
    await instance.get("https://api.example.com/data");
    expect(seen[0][SESSION_TOKEN_HEADER]).toBeUndefined();
  });

  test("resolves a relative URL against baseURL", async () => {
    const { instance, seen } = instanceRecordingHeaders();
    addSessionTokenToAxios(instance, async () => "t0k3n", isBackend);
    await instance.get("api/flows", { baseURL: "http://localhost:8000/" });
    expect(seen[0][SESSION_TOKEN_HEADER]).toBe("t0k3n");
  });
});
