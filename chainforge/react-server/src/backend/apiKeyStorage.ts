/**
 * Keeps the API keys entered in Settings across page reloads, for the hosted
 * web version. (Run locally, ChainForge saves them with its other settings on
 * the user's machine instead.)
 *
 * By default keys are kept only for the browser tab (sessionStorage): they
 * survive a reload, and are gone once the tab closes. The user can opt in to
 * remembering them on the device (localStorage) instead.
 *
 * Either way they are stored as plain text. Encrypting them wouldn't help
 * against the real risk, a script running on the page, since the page must be
 * able to decrypt them to use them; so we don't pretend otherwise.
 */
import { Dict } from "./typing";

const STORAGE_KEY = "chainforge-api-keys";

/** Storage can be unavailable or throw, e.g. in private windows. */
function storage(kind: "session" | "local"): Storage | undefined {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return undefined;
  }
}

function read(kind: "session" | "local"): Dict<string> | undefined {
  try {
    const raw = storage(kind)?.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    // Only non-empty strings; anything else is not a key.
    const keys = Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === "string" && value.trim().length > 0,
      ),
    ) as Dict<string>;
    return Object.keys(keys).length > 0 ? keys : undefined;
  } catch {
    return undefined;
  }
}

function remove(kind: "session" | "local"): void {
  try {
    storage(kind)?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing stored, or storage unavailable */
  }
}

/** Trims each value, and drops the empty ones. */
export function cleanAPIKeys(keys: Dict<unknown>): Dict<string> {
  const cleaned: Dict<string> = {};
  for (const [name, value] of Object.entries(keys))
    if (typeof value === "string" && value.trim().length > 0)
      cleaned[name] = value.trim();
  return cleaned;
}

/**
 * The stored keys, and whether they were remembered on the device (rather
 * than kept for this tab only).
 */
export function loadStoredAPIKeys(): {
  keys: Dict<string>;
  remembered: boolean;
} {
  const remembered = read("local");
  if (remembered) return { keys: remembered, remembered: true };
  return { keys: read("session") ?? {}, remembered: false };
}

/**
 * Stores keys for this tab, or on the device if `remember` is set. Only one
 * place holds them at a time, so unticking "remember" removes them from the
 * device.
 */
export function storeAPIKeys(keys: Dict<unknown>, remember: boolean): void {
  const cleaned = cleanAPIKeys(keys);
  const kind = remember ? "local" : "session";
  remove(remember ? "session" : "local");
  if (Object.keys(cleaned).length === 0) {
    remove(kind);
    return;
  }
  try {
    storage(kind)?.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* storage full or unavailable: keys still work until the page reloads */
  }
}

/** Removes stored keys from both the tab and the device. */
export function forgetStoredAPIKeys(): void {
  remove("session");
  remove("local");
}
