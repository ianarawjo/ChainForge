import { MediaLookup } from "./backend/cache";

/**
 * Longest side of a generated thumbnail, in pixels. Large enough to stay sharp
 * at the image grid's biggest cell size on high-DPI screens.
 */
export const THUMBNAIL_SIZE = 384;

/**
 * Thumbnails are small (tens of KB), but a long session can view thousands of
 * images, so only this many are kept, least recently used dropped first.
 */
const MAX_CACHED_THUMBNAILS = 1500;

const cache = new Map<string, Promise<Blob | undefined>>();

async function renderThumbnail(uid: string): Promise<Blob | undefined> {
  const original = await MediaLookup.get(uid);
  if (!original) return undefined;

  try {
    const bitmap = await createImageBitmap(original);
    const scale = THUMBNAIL_SIZE / Math.max(bitmap.width, bitmap.height);
    if (scale >= 1) {
      // Already small; a copy would only cost memory.
      bitmap.close();
      return original;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return original;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // WebP keeps transparency; browsers without WebP encoding fall back to PNG.
    const thumbnail = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    return thumbnail ?? original;
  } catch {
    // Formats the browser can't decode into a bitmap (e.g. SVG): show as-is.
    return original;
  }
}

/**
 * A downscaled copy of a stored image, for grids of many small images:
 * decoding full-size images just to draw them at 100px costs far more memory.
 * Resolves undefined if the image is unavailable.
 */
export function getThumbnail(uid: string): Promise<Blob | undefined> {
  const cached = cache.get(uid);
  if (cached) {
    // Mark as recently used.
    cache.delete(uid);
    cache.set(uid, cached);
    return cached;
  }

  const pending = renderThumbnail(uid);
  cache.set(uid, pending);
  pending.then((blob) => {
    // Don't remember a failure; the file may become available later.
    if (!blob) cache.delete(uid);
  });

  if (cache.size > MAX_CACHED_THUMBNAILS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return pending;
}
