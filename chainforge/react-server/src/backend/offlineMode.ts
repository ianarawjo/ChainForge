/**
 * Offline mode: prompts, responses and documents stay on this machine, or on
 * the user's local network. For work with data that must not be sent to a
 * cloud provider, such as data from human-subjects research.
 *
 * It is enforced in three places, so that one missed code path doesn't leak:
 *
 * - Before a model is called (`assertProviderAllowedOffline`), which gives a
 *   clear error naming the provider.
 * - On every fetch and XMLHttpRequest the page makes (`installOfflineGuard`),
 *   which catches anything else, e.g. AI support features or SDKs.
 * - On ChainForge's own server (chainforge/offline_mode.py), for the requests
 *   it makes on the page's behalf, like RAG embeddings and proxied fetches.
 *
 * Model files may still be downloaded (e.g. in-browser models from Hugging
 * Face): downloading sends nothing of the user's. And code the user writes
 * themselves -- custom providers, Python evaluators -- runs as written.
 *
 * `chainforge serve --offline` turns it on for everyone using that server, and
 * keeps it from being turned off in the app.
 */

import { LLMProvider } from "./models";
import { Dict } from "./typing";

export class OfflineModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineModeError";
  }
}

/** Where the setting is kept, so it holds from the moment the page loads. */
const STORAGE_KEY = "chainforge-offline-mode";

function readStoredSetting(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let _offline: boolean | undefined;

/** Whether the server was started with --offline, which the app can't turn off. */
export function isOfflineModeLocked(): boolean {
  try {
    return (window as any).__CF_OFFLINE_LOCKED === true;
  } catch {
    return false;
  }
}

export function isOfflineMode(): boolean {
  if (isOfflineModeLocked()) return true;
  if (_offline === undefined) _offline = readStoredSetting();
  return _offline;
}

export function setOfflineMode(on: boolean): void {
  _offline = on;
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "true" : "false");
  } catch {
    /* storage unavailable: the setting lasts until the page reloads */
  }
}

function normalizeHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

function isIPAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

/**
 * Other names, e.g. "labserver" or "labmac.local", count as local only once
 * ChainForge's server has resolved them to local addresses: a browser can't
 * look names up itself, and on some networks a name without dots resolves
 * to a public server (through a DNS search domain). Results, by name.
 */
const RESOLVED_TTL_MS = 5 * 60_000;
const resolvedHosts = new Map<string, { local: boolean; at: number }>();
let checkHost: ((host: string) => Promise<boolean>) | undefined;

/** Sets how names are checked: by asking ChainForge's server (see index.js). */
export function setHostChecker(
  check: ((host: string) => Promise<boolean>) | undefined,
): void {
  checkHost = check;
  resolvedHosts.clear();
}

/**
 * Whether a name resolves only to local addresses, asking ChainForge's server
 * (remembered for a few minutes). False when there's no server to ask.
 */
export async function resolvesLocally(hostname: string): Promise<boolean> {
  const host = normalizeHost(hostname);
  if (isLocalHostname(host)) return true;
  if (isIPAddress(host) || !checkHost) return false;
  const known = resolvedHosts.get(host);
  if (known && Date.now() - known.at < RESOLVED_TTL_MS) return known.local;
  let local = false;
  try {
    local = await checkHost(host);
  } catch {
    local = false;
  }
  resolvedHosts.set(host, { local, at: Date.now() });
  return local;
}

/**
 * Whether a hostname is this machine or on a private network, as far as can
 * be told without looking it up: loopback, private and link-local IP ranges,
 * .localhost names, and names ChainForge's server has resolved to local
 * addresses (see resolvesLocally). 100.64.0.0/10 is included since VPNs like
 * Tailscale use it for private networks of machines.
 */
export function isLocalHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (host.length === 0) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0")
    return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])];
    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }

  if (host.includes(":")) {
    // IPv6: loopback, unique local (fc00::/7) and link-local (fe80::/10)
    if (host === "::1") return true;
    return (
      /^f[cd][0-9a-f]{0,2}:/.test(host) || /^fe[89ab][0-9a-f]?:/.test(host)
    );
  }

  const known = resolvedHosts.get(host);
  return (
    known !== undefined &&
    known.local &&
    Date.now() - known.at < RESOLVED_TTL_MS
  );
}

function pageHref(): string {
  try {
    return window.location.href;
  } catch {
    return "http://localhost/";
  }
}

/** Whether the page was served by a ChainForge server (`chainforge serve`), which enforces offline mode itself. */
function servedByChainForgeServer(): boolean {
  try {
    return (window as any).__CF_HOSTNAME !== undefined;
  } catch {
    return false;
  }
}

/**
 * Whether a URL is on this machine or the local network. Requests to the site
 * the page came from count too when that site is a ChainForge server, which
 * enforces offline mode on its side (e.g. `chainforge serve` reached by a
 * domain name). The hosted app's site is not: it is a remote server that
 * accepts uploads, such as shared flows.
 */
export function isLocalURL(url: string, base: string = pageHref()): boolean {
  try {
    const target = new URL(url, base);
    if (target.protocol === "data:" || target.protocol === "blob:") return true;
    if (servedByChainForgeServer() && target.origin === new URL(base).origin)
      return true;
    return isLocalHostname(target.hostname);
  } catch {
    return false;
  }
}

/**
 * Sites that in-browser models (WebLLM, Transformers.js) and the in-browser
 * Python runtime download their files from. Only downloads are let through:
 * a request that sends anything (e.g. a POST to a Hugging Face inference API)
 * is still blocked.
 */
const DOWNLOAD_HOSTS = [
  "huggingface.co",
  "hf.co",
  "raw.githubusercontent.com",
  "objects.githubusercontent.com",
  "github.com",
  "cdn.jsdelivr.net",
];

function isDownloadHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  // The inference router takes prompts, even though it's on huggingface.co
  if (host === "router.huggingface.co" || host.startsWith("api-inference."))
    return false;
  return DOWNLOAD_HOSTS.some((h) => host === h || host.endsWith("." + h));
}

/**
 * Like offlineBlockReason, but looks up a name the page can't judge by
 * itself first (see resolvesLocally).
 */
export async function offlineBlockReasonAfterLookup(
  url: string,
  method = "GET",
): Promise<string | undefined> {
  // Nothing to look up for what's already known to be local, which includes
  // ChainForge's own server (so asking it about a name doesn't loop)
  if (!isOfflineMode() || isLocalURL(url)) return undefined;
  try {
    await resolvesLocally(new URL(url, pageHref()).hostname);
  } catch {
    /* not a URL: judged as given */
  }
  return offlineBlockReason(url, method);
}

/**
 * Why a request may not be sent in offline mode, or undefined if it may.
 * Always undefined when offline mode is off. Names not yet looked up (see
 * offlineBlockReasonAfterLookup) count as not local.
 */
export function offlineBlockReason(
  url: string,
  method = "GET",
): string | undefined {
  if (!isOfflineMode()) return undefined;
  if (isLocalURL(url)) return undefined;
  let hostname = url;
  let sameOrigin = false;
  try {
    const target = new URL(url, pageHref());
    hostname = target.hostname;
    sameOrigin = target.origin === new URL(pageHref()).origin;
  } catch {
    /* report the URL as given */
  }
  const m = method.toUpperCase();
  // Downloads send nothing of the user's: the app's own files (e.g. example
  // flows, on the hosted site), and model files
  if ((m === "GET" || m === "HEAD") && (sameOrigin || isDownloadHost(hostname)))
    return undefined;
  return `Offline mode is on, so ChainForge did not send a request to ${hostname}. Turn off offline mode in Settings to use online services.`;
}

/** Names for providers, for error messages. */
const PROVIDER_NAMES: Partial<Record<LLMProvider, string>> = {
  [LLMProvider.OpenAI]: "OpenAI",
  [LLMProvider.Azure_OpenAI]: "Azure OpenAI",
  [LLMProvider.Anthropic]: "Anthropic",
  [LLMProvider.Google]: "Google",
  [LLMProvider.HuggingFace]: "Hugging Face",
  [LLMProvider.Bedrock]: "Amazon Bedrock",
  [LLMProvider.Together]: "Together",
  [LLMProvider.DeepSeek]: "DeepSeek",
  [LLMProvider.MiniMax]: "MiniMax",
  [LLMProvider.OpenRouter]: "OpenRouter",
};

/**
 * Whether a provider runs models locally. For providers that reach a server
 * (Ollama, OpenAI-compatible servers), whether that depends on its URL, which
 * `assertProviderAllowedOffline` checks.
 */
export function isLocalProvider(provider: LLMProvider | undefined): boolean {
  return (
    provider === LLMProvider.WebLLM ||
    provider === LLMProvider.Ollama ||
    provider === LLMProvider.OpenAICompatible ||
    provider === LLMProvider.Custom
  );
}

/** Throws an OfflineModeError if offline mode is on and calling this model would send data off the local network. */
export async function assertProviderAllowedOffline(
  provider: LLMProvider | undefined,
  params?: Dict,
): Promise<void> {
  if (!isOfflineMode()) return;
  if (!isLocalProvider(provider)) {
    const name = (provider && PROVIDER_NAMES[provider]) ?? "This provider";
    throw new OfflineModeError(
      `Offline mode is on, so ${name} models can't be used: they would send your prompts to ${name}'s servers. Use a local model (Ollama, an OpenAI-compatible server, or an in-browser model), or turn off offline mode in Settings.`,
    );
  }
  const url =
    provider === LLMProvider.Ollama
      ? params?.ollama_url
      : provider === LLMProvider.OpenAICompatible
        ? params?.base_url
        : undefined;
  if (typeof url !== "string" || !url.trim()) return;
  try {
    await resolvesLocally(new URL(url.trim()).hostname);
  } catch {
    /* not a URL: judged as given */
  }
  if (!isLocalURL(url.trim()))
    throw new OfflineModeError(
      `Offline mode is on, and this model's server (${url}) is not on this machine or your local network. Point it at a local server, or turn off offline mode in Settings.`,
    );
}

type FetchFn = typeof fetch;

/** Wraps fetch so that, in offline mode, requests off the local network are refused. */
export function withOfflineGuard(fetchFn: FetchFn): FetchFn {
  return async (input, init) => {
    const isRequest =
      typeof Request !== "undefined" && input instanceof Request;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method =
      init?.method ?? (isRequest ? (input as Request).method : "GET");
    const reason = await offlineBlockReasonAfterLookup(url, method);
    if (reason) throw new OfflineModeError(reason);
    return fetchFn(input, init);
  };
}

/**
 * Installs the offline guard on this page's ways of sending requests: fetch,
 * XMLHttpRequest, WebSocket, EventSource and navigator.sendBeacon.
 * XMLHttpRequest can't wait for a name to be looked up, so it counts only
 * names already found local. Code running in workers (the in-browser Python
 * that runs evaluators, in-browser models downloading their files) has its
 * own fetch and isn't covered: code users write runs as written.
 */
export function installOfflineGuard(win: Window & typeof globalThis): void {
  const flag = win as unknown as { __cfOfflineGuardInstalled?: boolean };
  if (flag.__cfOfflineGuardInstalled) return;
  flag.__cfOfflineGuardInstalled = true;

  if (typeof win.fetch === "function")
    win.fetch = withOfflineGuard(win.fetch.bind(win));

  const XHR = win.XMLHttpRequest;
  if (XHR) {
    const open = XHR.prototype.open;
    const send = XHR.prototype.send;
    XHR.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
      (this as any).__cfRequest = { method: args[0], url: String(args[1]) };
      return (open as any).apply(this, args);
    };
    XHR.prototype.send = function (this: XMLHttpRequest, ...args: any[]) {
      const req = (this as any).__cfRequest;
      const reason = req ? offlineBlockReason(req.url, req.method) : undefined;
      if (reason) throw new OfflineModeError(reason);
      return (send as any).apply(this, args);
    };
  }

  // A WebSocket or event stream sends and receives from where it connects;
  // each is checked as a request with a body
  const guardConstructor = (name: "WebSocket" | "EventSource") => {
    const Original = (win as any)[name];
    if (typeof Original !== "function") return;
    const Guarded = function (
      this: unknown,
      url: string | URL,
      ...rest: any[]
    ) {
      const reason = offlineBlockReason(String(url), "POST");
      if (reason) throw new OfflineModeError(reason);
      return new Original(url, ...rest);
    } as any;
    Guarded.prototype = Original.prototype;
    Object.setPrototypeOf(Guarded, Original); // keeps constants like WebSocket.OPEN
    (win as any)[name] = Guarded;
  };
  guardConstructor("WebSocket");
  guardConstructor("EventSource");

  const nav = win.navigator as Navigator | undefined;
  if (nav && typeof nav.sendBeacon === "function") {
    const sendBeacon = nav.sendBeacon.bind(nav);
    nav.sendBeacon = (url: string | URL, data?: BodyInit | null) =>
      offlineBlockReason(String(url), "POST") ? false : sendBeacon(url, data);
  }
}
