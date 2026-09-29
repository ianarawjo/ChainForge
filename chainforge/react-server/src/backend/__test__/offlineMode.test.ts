/*
 * @jest-environment jsdom
 */
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  OfflineModeError,
  assertProviderAllowedOffline,
  installOfflineGuard,
  isLocalHostname,
  isLocalURL,
  isOfflineMode,
  offlineBlockReason,
  resolvesLocally,
  setHostChecker,
  setOfflineMode,
  withOfflineGuard,
} from "../offlineMode";
import { LLMProvider } from "../models";

afterEach(() => {
  setOfflineMode(false);
  delete (window as any).__CF_OFFLINE_LOCKED;
});

describe("isLocalHostname", () => {
  test.each([
    "localhost",
    "LOCALHOST",
    "app.localhost",
    "127.0.0.1",
    "10.0.0.5",
    "172.16.4.1",
    "172.31.255.255",
    "192.168.1.20",
    "169.254.3.3",
    "100.100.1.1", // Tailscale
    "[::1]",
    "fd12:3456::1",
    "fe80::1",
    "0.0.0.0",
  ])("%s is local", (host) => expect(isLocalHostname(host)).toBe(true));

  test.each([
    "api.openai.com",
    "8.8.8.8",
    "172.32.0.1",
    "192.169.0.1",
    "100.128.0.1",
    "2001:4860:4860::8888",
    "",
    // Names aren't, until ChainForge's server has looked them up
    "labserver",
    "labmac.local",
  ])("%s is not local", (host) => expect(isLocalHostname(host)).toBe(false));

  test("names are local once ChainForge's server resolves them to local addresses", async () => {
    // On some networks a name without dots resolves to a public server
    const check = jest.fn(async (host: string) => host === "labserver");
    setHostChecker(check);
    try {
      expect(await resolvesLocally("labserver")).toBe(true);
      expect(isLocalHostname("LabServer")).toBe(true); // remembered
      expect(await resolvesLocally("proxy")).toBe(false);
      expect(isLocalHostname("proxy")).toBe(false);
      await resolvesLocally("labserver");
      expect(check).toHaveBeenCalledTimes(2); // not asked again
      // IP addresses are judged as they are
      expect(await resolvesLocally("8.8.8.8")).toBe(false);
      expect(check).toHaveBeenCalledTimes(2);
    } finally {
      setHostChecker(undefined);
    }
  });

  test("without a server to ask, names aren't local", async () => {
    setHostChecker(undefined);
    expect(await resolvesLocally("labserver")).toBe(false);
  });
});

test("isLocalURL counts the page's own site only when it's a ChainForge server", () => {
  const hosted = "https://chainforge.ai/play";
  // The hosted site is a remote server that takes uploads, e.g. shared flows
  expect(isLocalURL("/db/shareflow.php", hosted)).toBe(false);
  expect(isLocalURL("https://api.anthropic.com/v1/messages", hosted)).toBe(
    false,
  );
  expect(isLocalURL("http://localhost:11434/api/chat", hosted)).toBe(true);

  // `chainforge serve` enforces offline mode itself, even reached by a domain name
  (window as any).__CF_HOSTNAME = "0.0.0.0";
  expect(isLocalURL("/app/makeFetchCall", "https://cf.mylab.edu/")).toBe(true);
  delete (window as any).__CF_HOSTNAME;
});

describe("offline mode", () => {
  test("is off by default, and blocks nothing", () => {
    expect(isOfflineMode()).toBe(false);
    expect(
      offlineBlockReason("https://api.openai.com/v1/chat/completions", "POST"),
    ).toBeUndefined();
    expect(() =>
      assertProviderAllowedOffline(LLMProvider.OpenAI),
    ).not.toThrow();
  });

  test("is remembered, so it holds from the moment the page loads", () => {
    setOfflineMode(true);
    expect(window.localStorage.getItem("chainforge-offline-mode")).toBe("true");
  });

  test("can't be turned off when the server was started with --offline", () => {
    (window as any).__CF_OFFLINE_LOCKED = true;
    setOfflineMode(false);
    expect(isOfflineMode()).toBe(true);
  });

  test("blocks requests off the local network, but not model downloads", () => {
    setOfflineMode(true);
    expect(
      offlineBlockReason("https://api.openai.com/v1/chat/completions", "POST"),
    ).toMatch(/api\.openai\.com/);
    expect(
      offlineBlockReason("http://localhost:1234/v1/chat/completions", "POST"),
    ).toBeUndefined();
    expect(
      offlineBlockReason("http://192.168.0.9:8080/v1/chat/completions", "POST"),
    ).toBeUndefined();
    // Downloading model files sends nothing of the user's...
    expect(
      offlineBlockReason(
        "https://huggingface.co/mlc-ai/x/resolve/main/a.bin",
        "GET",
      ),
    ).toBeUndefined();
    expect(
      offlineBlockReason("https://cdn-lfs.huggingface.co/repos/abc", "GET"),
    ).toBeUndefined();
    // ...but sending prompts to the same sites does
    expect(
      offlineBlockReason("https://huggingface.co/api/x", "POST"),
    ).toBeDefined();
    expect(
      offlineBlockReason(
        "https://router.huggingface.co/v1/chat/completions",
        "GET",
      ),
    ).toBeDefined();
  });

  test("on the hosted site, only lets the site's own files through, not uploads to it", () => {
    setOfflineMode(true);
    // jsdom's page is at localhost, so check against a hosted page's URLs directly
    const hosted = "https://chainforge.ai";
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL(`${hosted}/play/`),
    });
    try {
      expect(
        offlineBlockReason(`${hosted}/examples/x.cforge`, "GET"),
      ).toBeUndefined();
      expect(offlineBlockReason(`${hosted}/db/shareflow.php`, "POST")).toMatch(
        /chainforge\.ai/,
      );
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    }
  });

  test("only allows local providers, on local servers", async () => {
    setOfflineMode(true);
    for (const provider of [
      LLMProvider.OpenAI,
      LLMProvider.Anthropic,
      LLMProvider.OpenRouter,
      LLMProvider.HuggingFace,
    ])
      await expect(assertProviderAllowedOffline(provider)).rejects.toThrow(
        OfflineModeError,
      );
    await assertProviderAllowedOffline(LLMProvider.WebLLM);
    await assertProviderAllowedOffline(LLMProvider.Custom);
    await assertProviderAllowedOffline(LLMProvider.Ollama, {
      ollama_url: "http://localhost:11434/api",
    });
    await assertProviderAllowedOffline(LLMProvider.OpenAICompatible, {
      base_url: "http://10.1.2.3:8000/v1",
    });
    await expect(
      assertProviderAllowedOffline(LLMProvider.OpenAICompatible, {
        base_url: "https://api.together.xyz/v1",
      }),
    ).rejects.toThrow(/not on this machine or your local network/);
  });

  test("a model's server named rather than numbered is looked up first", async () => {
    setOfflineMode(true);
    setHostChecker(async (host) => host === "gpu-box");
    try {
      await assertProviderAllowedOffline(LLMProvider.Ollama, {
        ollama_url: "http://gpu-box:11434/api",
      });
      await expect(
        assertProviderAllowedOffline(LLMProvider.OpenAICompatible, {
          base_url: "http://proxy:8080/v1", // resolves to a public address
        }),
      ).rejects.toThrow(OfflineModeError);
    } finally {
      setHostChecker(undefined);
    }
  });

  test("the fetch guard refuses blocked requests before they're sent", async () => {
    const inner = jest.fn(async () => new Response("{}"));
    const guarded = withOfflineGuard(inner as unknown as typeof fetch);

    await guarded("https://api.openai.com/v1/models");
    expect(inner).toHaveBeenCalledTimes(1);

    setOfflineMode(true);
    await expect(
      guarded("https://api.openai.com/v1/chat/completions", { method: "POST" }),
    ).rejects.toThrow(OfflineModeError);
    await guarded("http://localhost:11434/api/tags");
    expect(inner).toHaveBeenCalledTimes(2);
  });

  test("WebSockets, event streams and beacons are guarded too", () => {
    const opened: string[] = [];
    class FakeSocket {
      static OPEN = 1;
      constructor(url: string) {
        opened.push(url);
      }
    }
    const beacons: string[] = [];
    const win = {
      WebSocket: FakeSocket,
      EventSource: FakeSocket,
      navigator: {
        sendBeacon: (url: string) => {
          beacons.push(url);
          return true;
        },
      },
    } as any;
    installOfflineGuard(win);

    setOfflineMode(true);
    expect(() => new win.WebSocket("wss://relay.example.com/")).toThrow(
      OfflineModeError,
    );
    expect(() => new win.EventSource("https://stream.example.com/")).toThrow(
      OfflineModeError,
    );
    expect(win.navigator.sendBeacon("https://track.example.com/", "x")).toBe(
      false,
    );
    const socket = new win.WebSocket("ws://localhost:1234/");
    expect(socket).toBeInstanceOf(FakeSocket);
    expect(win.WebSocket.OPEN).toBe(1);
    expect(win.navigator.sendBeacon("http://localhost:8000/x", "x")).toBe(true);
    expect(opened).toEqual(["ws://localhost:1234/"]);
    expect(beacons).toEqual(["http://localhost:8000/x"]);
  });

  test("the XMLHttpRequest guard refuses blocked requests (e.g. from axios)", () => {
    const win = { XMLHttpRequest: class {} } as any;
    const send = jest.fn();
    win.XMLHttpRequest.prototype.open = jest.fn();
    win.XMLHttpRequest.prototype.send = send;
    installOfflineGuard(win);

    setOfflineMode(true);
    const blocked = new win.XMLHttpRequest();
    blocked.open("POST", "https://api.anthropic.com/v1/messages");
    expect(() => blocked.send("{}")).toThrow(OfflineModeError);

    const allowed = new win.XMLHttpRequest();
    allowed.open("GET", "http://127.0.0.1:8000/api/flows");
    allowed.send();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
