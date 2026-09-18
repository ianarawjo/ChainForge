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

/**
 * Whether a hostname is this machine or on a private network: loopback,
 * private and link-local IP ranges, .local and .localhost names, and bare
 * single-label names (e.g. "labserver"), which only resolve on a local network.
 * 100.64.0.0/10 is included since VPNs like Tailscale use it for private
 * networks of machines.
 */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (host.length === 0) return false;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  )
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

  // A name without dots can't be a public domain
  return !host.includes(".");
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
 * Why a request may not be sent in offline mode, or undefined if it may.
 * Always undefined when offline mode is off.
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
export function assertProviderAllowedOffline(
  provider: LLMProvider | undefined,
  params?: Dict,
): void {
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
  if (typeof url === "string" && url.trim() && !isLocalURL(url.trim()))
    throw new OfflineModeError(
      `Offline mode is on, and this model's server (${url}) is not on this machine or your local network. Point it at a local server, or turn off offline mode in Settings.`,
    );
}

type FetchFn = typeof fetch;

/** Wraps fetch so that, in offline mode, requests off the local network are refused. */
export function withOfflineGuard(fetchFn: FetchFn): FetchFn {
  return (input, init) => {
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
    const reason = offlineBlockReason(url, method);
    if (reason) return Promise.reject(new OfflineModeError(reason));
    return fetchFn(input, init);
  };
}

/** Installs the offline guard on this page's fetch and XMLHttpRequest. */
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
}
