/**
 * Where a flow being loaded into the editor came from.
 *
 * Loading a flow replaces the one on the canvas. Without a local server there
 * is only ever one flow in the browser, so media files the previous flow used
 * are unreachable afterwards -- yet they stay in IndexedDB and keep counting
 * against the storage budget unless cleared. Whether to clear depends on the
 * source, hence this type.
 */
export type FlowLoadSource =
  /** A .cforge or .json file the user opened. */
  | "file"
  /** An example flow from the Example Flows menu. */
  | "example"
  /** An OpenAI eval converted into a flow. */
  | "openai-eval"
  /** A flow opened from a share link. */
  | "shared-link"
  /** A flow picked from the saved-flows sidebar (local server only). */
  | "saved-flow"
  /** The starter flow shown when there is no autosave to restore. */
  | "starter"
  /** A .cfzip bundle, whose media files have already been imported. */
  | "bundle"
  /** The autosaved flow, restored on page load. */
  | "autosave";

/**
 * Whether loading a flow from `source` should first clear stored media.
 *
 * True whenever the incoming flow replaces the current one and brings its own
 * media (in its cache data) or none. False for:
 * - "bundle": importing a .cfzip clears media itself and then imports the
 *   bundle's files, before the flow is loaded; clearing again would delete them.
 * - "autosave": the restored flow is the current flow; its files are the ones
 *   in storage.
 * - "shared-link": opening a link can happen by accident, with no prompt
 *   first, so it shouldn't delete anything. Links are opened rarely enough
 *   that the leftover files aren't a real storage cost.
 */
export function flowLoadReplacesMedia(source: FlowLoadSource): boolean {
  switch (source) {
    case "file":
    case "example":
    case "openai-eval":
    case "saved-flow":
    case "starter":
      return true;
    case "bundle":
    case "autosave":
    case "shared-link":
      return false;
    default: {
      // Compile-time check that every source is handled.
      const unhandled: never = source;
      throw new Error(`Unknown flow load source: ${String(unhandled)}`);
    }
  }
}
