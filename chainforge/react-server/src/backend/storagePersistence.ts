/**
 * Asks the browser not to clear ChainForge's storage, and tracks whether it
 * agreed.
 *
 * Without a local server, a flow and its responses live in localStorage and
 * uploaded or generated files in IndexedDB. By default browsers treat both as
 * "best effort": they may clear them to free up disk space, and Safari deletes
 * everything a site's scripts stored after 7 days of Safari use without
 * visiting that site. navigator.storage.persist() asks to be exempt from
 * clearing under storage pressure. Chrome and Safari decide silently (Chrome by
 * engagement, bookmarks and installs; Safari mostly for Home Screen and Dock
 * web apps); Firefox asks the user. So it's requested when someone saves real
 * work rather than on page load, and at most once per session.
 *
 * Even when granted, Safari documents no exemption from its 7-day deletion
 * except for Home Screen and Dock web apps, so Safari in a browser tab counts as
 * at risk either way. Callers show the user when storage is at risk, so they
 * can export their flow.
 */

export type StorageProtectionStatus = "unknown" | "protected" | "at-risk";

/** Why storage is at risk. */
export type StorageRiskReason = "declined" | "safari" | "unsupported";

export interface StorageProtection {
  status: StorageProtectionStatus;
  /** Set when status is "at-risk". */
  reason?: StorageRiskReason;
  /** Whether persistence was requested this session, i.e. work was saved. */
  requested: boolean;
}

type PersistManager = Pick<StorageManager, "persist" | "persisted">;

/** The browser environment; tests pass their own. */
export interface ProtectionEnv {
  /** The storage manager, or undefined where the Storage API is missing. */
  manager?: PersistManager;
  /** Whether this is Safari. */
  safari: boolean;
  /** Whether running as an installed web app (Home Screen or Dock). */
  standalone: boolean;
}

export const NOTICE_DISMISSED_KEY = "chainforge-storage-notice-dismissed";

function defaultEnv(): ProtectionEnv {
  let manager: PersistManager | undefined;
  let safari = false;
  let standalone = false;
  try {
    const storage = navigator.storage;
    if (
      typeof storage?.persist === "function" &&
      typeof storage?.persisted === "function"
    )
      manager = storage;
    // Chrome, Edge, Firefox and others on iOS and Android also say "Safari".
    safari = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(
      navigator.userAgent,
    );
    standalone =
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    // No navigator or window, e.g. outside a browser.
  }
  return { manager, safari, standalone };
}

let current: StorageProtection = { status: "unknown", requested: false };
let pendingRequest: Promise<StorageProtection> | undefined;
const listeners = new Set<(protection: StorageProtection) => void>();

function update(next: StorageProtection): StorageProtection {
  current = next;
  listeners.forEach((listener) => listener(current));
  return current;
}

/** The protection for storage the browser has or hasn't agreed to keep. */
function protectionFor(
  persisted: boolean,
  env: ProtectionEnv,
  requested: boolean,
): StorageProtection {
  if (env.safari && !env.standalone)
    return { status: "at-risk", reason: "safari", requested };
  return persisted
    ? { status: "protected", requested }
    : { status: "at-risk", reason: "declined", requested };
}

/** The latest known protection. */
export function getStorageProtection(): StorageProtection {
  return current;
}

/** Calls `listener` whenever protection changes. Returns an unsubscribe. */
export function subscribeStorageProtection(
  listener: (protection: StorageProtection) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Reads whether storage is already protected, without requesting it (so
 * without prompting). Doesn't override the result of a request.
 */
export async function checkStorageProtection(
  env: ProtectionEnv = defaultEnv(),
): Promise<StorageProtection> {
  if (pendingRequest || current.requested) return pendingRequest ?? current;
  if (!env.manager)
    return update({
      status: "at-risk",
      reason: "unsupported",
      requested: false,
    });
  try {
    const persisted = await env.manager.persisted();
    // A request may have started while this was reading.
    if (pendingRequest || current.requested) return pendingRequest ?? current;
    return update(protectionFor(persisted, env, false));
  } catch {
    return current;
  }
}

/**
 * Asks the browser to keep ChainForge's storage, once per session. Call it
 * when work is saved in the browser. Never throws.
 */
export function requestStorageProtection(
  env: ProtectionEnv = defaultEnv(),
): Promise<StorageProtection> {
  if (pendingRequest) return pendingRequest;
  if (current.requested) return Promise.resolve(current);
  pendingRequest = (async () => {
    if (!env.manager)
      return update({
        status: "at-risk",
        reason: "unsupported",
        requested: true,
      });
    let persisted = false;
    try {
      persisted =
        (await env.manager.persisted()) || (await env.manager.persist());
    } catch {
      // Treated as declined.
    }
    return update(protectionFor(persisted, env, true));
  })().finally(() => {
    pendingRequest = undefined;
  });
  return pendingRequest;
}

/** Forgets this session's protection state. For tests. */
export function resetStorageProtection(): void {
  current = { status: "unknown", requested: false };
  pendingRequest = undefined;
  listeners.clear();
}

type NoticeStorage = Pick<Storage, "getItem" | "setItem">;

const defaultNoticeStorage = (): NoticeStorage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** Whether the user dismissed the notice that storage is at risk. */
export function storageNoticeDismissed(
  storage: NoticeStorage | undefined = defaultNoticeStorage(),
): boolean {
  try {
    return storage?.getItem(NOTICE_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Remembers that the user dismissed the notice. */
export function dismissStorageNotice(
  storage: NoticeStorage | undefined = defaultNoticeStorage(),
): void {
  try {
    storage?.setItem(NOTICE_DISMISSED_KEY, "true");
  } catch {
    // Storage blocked or full: the notice may show again next session.
  }
}
