import { RefObject, useEffect, useState } from "react";
import { MediaLookup } from "./backend/cache";
import { getThumbnail } from "./mediaThumbnails";

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

/**
 * An object URL for a downscaled copy of a stored image; see getThumbnail.
 * Same contract as useMediaUrl.
 */
export function useThumbnailUrl(
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
    let url: string | undefined;
    setState({ status: "loading" });

    getThumbnail(uid)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setState({ status: "error" });
          return;
        }
        // Per component: thumbnails are small, and this keeps ownership simple.
        url = URL.createObjectURL(blob);
        setState({ url, status: "ready" });
      })
      .catch((err) => {
        console.error(`Could not make thumbnail for ${uid}:`, err);
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [uid, enabled]);

  return state;
}

/**
 * Whether an element has come within `rootMargin` of the viewport. Stays true
 * once it has, so content loaded on first approach isn't unloaded and
 * refetched on every scroll.
 *
 * The element needs a non-zero size before it loads: an empty box counts as
 * in view, so a long list of empty placeholders would all load at once.
 */
export function useNearViewport(
  ref: RefObject<Element>,
  rootMargin = "300px",
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, ref, rootMargin]);

  return near;
}
