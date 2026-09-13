import { useEffect, useState } from "react";
import { MediaLookup } from "./backend/cache";

export type MediaUrlStatus = "idle" | "loading" | "ready" | "error";

/**
 * An object URL for a stored media file, for use as an <img src>.
 *
 * The URL is shared with any other component showing the same file, and is
 * released when this component unmounts or `uid` changes, so the browser can
 * free the bytes once nothing displays them.
 *
 * @param uid The media uid. Nothing is loaded while it is undefined.
 * @param enabled Pass false to defer loading, e.g. until the element nears the viewport.
 */
export function useMediaUrl(
  uid: string | undefined,
  enabled = true,
): { url?: string; status: MediaUrlStatus } {
  const [state, setState] = useState<{ url?: string; status: MediaUrlStatus }>({
    status: "idle",
  });

  useEffect(() => {
    if (!uid || !enabled) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    let acquired = false;
    setState({ status: "loading" });

    MediaLookup.acquireUrl(uid)
      .then((url) => {
        if (url === undefined) {
          if (!cancelled) setState({ status: "error" });
        } else if (cancelled) {
          // Unmounted (or uid changed) while loading; hand the URL straight back.
          MediaLookup.releaseUrl(uid);
        } else {
          acquired = true;
          setState({ url, status: "ready" });
        }
      })
      .catch((err) => {
        console.error(`Could not load media ${uid}:`, err);
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
      if (acquired) MediaLookup.releaseUrl(uid);
    };
  }, [uid, enabled]);

  return state;
}
