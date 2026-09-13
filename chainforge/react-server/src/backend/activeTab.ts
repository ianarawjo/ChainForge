/**
 * Which ChainForge tab the user last used, shared across tabs via localStorage.
 *
 * Saving when a tab is hidden or closed protects recent work, but every open
 * tab of the app does it. An old tab left open in the background still holds
 * the flow as it was when that tab loaded; closing it would save that stale
 * flow over newer work saved from another tab. So only the tab the user last
 * used may save on hide or close.
 */

export const ACTIVE_TAB_KEY = "chainforge-active-tab";

type TabStorage = Pick<Storage, "getItem" | "setItem">;

const defaultStorage = (): TabStorage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

/** Marks this tab as the one the user is using. */
export function claimActiveTab(
  tabId: string,
  storage: TabStorage | undefined = defaultStorage(),
): void {
  try {
    // Called on every click and key press, so skip the write when unchanged.
    if (storage && storage.getItem(ACTIVE_TAB_KEY) !== tabId)
      storage.setItem(ACTIVE_TAB_KEY, tabId);
  } catch {
    // Storage blocked or full: fall back to every tab counting as active.
  }
}

/**
 * Whether this tab may save on hide or close. True when no tab has claimed
 * activity yet, or storage is unavailable, so work is never dropped just
 * because the bookkeeping couldn't be done.
 */
export function isActiveTab(
  tabId: string,
  storage: TabStorage | undefined = defaultStorage(),
): boolean {
  try {
    const active = storage?.getItem(ACTIVE_TAB_KEY);
    return active === null || active === undefined || active === tabId;
  } catch {
    return true;
  }
}
