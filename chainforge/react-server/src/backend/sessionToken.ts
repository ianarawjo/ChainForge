/**
 * Sends ChainForge's session token with every request to its own server.
 *
 * The server refuses requests without the token (chainforge/local_access.py),
 * so that web pages from other sites, which can also send requests to
 * localhost, cannot run code or read settings through it. The server writes
 * the token into the page it serves; this module adds it to every fetch and
 * axios request bound for that server, and to nothing else, so the token never
 * reaches a model provider or any other site.
 *
 * Installed once, before the app renders, by src/index.js.
 */

import axios, { AxiosInstance } from "axios";
import { APP_IS_RUNNING_LOCALLY, FLASK_BASE_URL } from "./utils";

export const SESSION_TOKEN_HEADER = "X-ChainForge-Token";

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function currentHref(): string {
  try {
    return window.location.href;
  } catch {
    return "http://localhost/";
  }
}

/** Whether a URL points at ChainForge's server, so should carry the token. */
export function isBackendUrl(
  url: string,
  baseUrl: string = FLASK_BASE_URL,
  pageHref: string = currentHref(),
): boolean {
  try {
    const target = new URL(url, pageHref);
    const base = new URL(baseUrl, pageHref);
    return (
      (target.protocol === "http:" || target.protocol === "https:") &&
      target.origin === base.origin
    );
  } catch {
    return false;
  }
}

/** The token ChainForge's server wrote into this page, if it served it. */
export function injectedSessionToken(win: object): string | undefined {
  const token = (win as { __CF_SESSION_TOKEN?: unknown }).__CF_SESSION_TOKEN;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

/**
 * Returns a function that gets the token.
 *
 * From the page when the server served it. Otherwise -- front-end development
 * against a separate dev server -- asks the server once, which answers only
 * origins allowed with --dev-origins. Undefined when there is no local server,
 * as on the hosted website.
 */
export function createTokenSource(options: {
  win: object;
  fetchFn: FetchFn;
  runningLocally?: () => boolean;
  baseUrl?: string;
}): () => Promise<string | undefined> {
  let pending: Promise<string | undefined> | undefined;
  return () => {
    const injected = injectedSessionToken(options.win);
    if (injected) return Promise.resolve(injected);
    if (!(options.runningLocally ?? APP_IS_RUNNING_LOCALLY)())
      return Promise.resolve(undefined);
    if (!pending) {
      pending = options
        .fetchFn(`${options.baseUrl ?? FLASK_BASE_URL}api/sessionToken`)
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok || typeof body?.token !== "string")
            throw new Error(body?.error ?? `HTTP ${res.status}`);
          return body.token as string;
        })
        .catch((err) => {
          // Try again on the next request, e.g. once the server is running.
          pending = undefined;
          console.warn(
            "Could not get a session token from the ChainForge server. When " +
              "developing the front end on its own dev server, start the server " +
              "with --dev-origins set to this page's origin.",
            err,
          );
          return undefined;
        });
    }
    return pending;
  };
}

/** Headers as a plain object, whatever form they were given in. */
function headersToObject(
  headers: HeadersInit | undefined,
): Record<string, string> {
  if (!headers) return {};
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  if (typeof (headers as Headers).forEach === "function") {
    const result: Record<string, string> = {};
    (headers as Headers).forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  return { ...(headers as Record<string, string>) };
}

/** Wraps fetch so requests to ChainForge's server carry the token. */
export function withSessionToken(
  fetchFn: FetchFn,
  getToken: () => Promise<string | undefined>,
  isBackend: (url: string) => boolean = (url) => isBackendUrl(url),
): FetchFn {
  return async (input, init) => {
    const isRequest =
      typeof Request !== "undefined" && input instanceof Request;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (!isBackend(url)) return fetchFn(input, init);

    const token = await getToken();
    if (!token) return fetchFn(input, init);

    const headers = {
      ...headersToObject(isRequest ? (input as Request).headers : undefined),
      ...headersToObject(init?.headers),
      [SESSION_TOKEN_HEADER]: token,
    };
    if (isRequest)
      return fetchFn(new Request(input as Request, { ...init, headers }));
    return fetchFn(input, { ...init, headers });
  };
}

/** Makes an axios instance add the token to requests for ChainForge's server. */
export function addSessionTokenToAxios(
  instance: AxiosInstance,
  getToken: () => Promise<string | undefined>,
  isBackend: (url: string) => boolean = (url) => isBackendUrl(url),
): number {
  return instance.interceptors.request.use(async (config) => {
    let url = config.url ?? "";
    if (config.baseURL) {
      try {
        url = new URL(url, new URL(config.baseURL, currentHref())).href;
      } catch {
        return config;
      }
    }
    if (!isBackend(url)) return config;
    const token = await getToken();
    if (token)
      config.headers = {
        ...(config.headers ?? {}),
        [SESSION_TOKEN_HEADER]: token,
      };
    return config;
  });
}

/** Adds the token to this page's fetch and axios requests to ChainForge's server. */
export function installBackendAuth(
  win: Window & typeof globalThis = window,
  axiosInstance: AxiosInstance = axios,
): void {
  const flag = win as unknown as { __cfBackendAuthInstalled?: boolean };
  if (flag.__cfBackendAuthInstalled || typeof win.fetch !== "function") return;
  flag.__cfBackendAuthInstalled = true;

  const originalFetch: FetchFn = win.fetch.bind(win);
  const getToken = createTokenSource({ win, fetchFn: originalFetch });
  win.fetch = withSessionToken(originalFetch, getToken);
  addSessionTokenToAxios(axiosInstance, getToken);
}
