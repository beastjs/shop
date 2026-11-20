import type { ProductMedia } from "./types";

/** Images in display order: primary first, then by sortOrder. */
export function galleryImages(media: ProductMedia[]): ProductMedia[] {
  return media
    .filter((m) => m.type === "image" && m.url)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
}

/**
 * Seeded photos are Unsplash "small" URLs (400px wide). Unsplash serves any width via its
 * `w` param, so ask for one that matches where the image is shown instead of upscaling 400px.
 */
export function sizedImage(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "images.unsplash.com") return url;
    u.searchParams.set("w", String(width));
    return u.toString();
  } catch {
    return url;
  }
}

/** Widths the product page renders at — preloading must request these exact URLs to hit the cache. */
export const PREVIEW_WIDTH = 1600;
export const THUMB_WIDTH = 200;
export const previewSrc = (url: string) => sizedImage(url, PREVIEW_WIDTH);
export const thumbSrc = (url: string) => sizedImage(url, THUMB_WIDTH);

const warmed = new Map<string, Promise<void>>();

/** Fetches and decodes an image once per session; repeat calls share the same promise. */
function preloadImage(src: string): Promise<void> {
  let pending = warmed.get(src);
  if (!pending) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    pending = img.decode().catch(() => {
      // A failed preload must not fail navigation; the page will just load it normally.
      warmed.delete(src);
    });
    warmed.set(src, pending);
  }
  return pending;
}

/**
 * Warms the product page's images while the user is still hovering the card.
 * Thumbnails and secondary previews load in the background; the result resolves once the main
 * preview is decoded, or after `waitMs` at most so a slow image never holds the route hostage.
 */
export function warmProductImages(media: ProductMedia[], waitMs = 600): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  const images = galleryImages(media);
  if (images.length === 0) return Promise.resolve();
  const main = preloadImage(previewSrc(images[0].url));
  for (const image of images) void preloadImage(thumbSrc(image.url));
  for (const image of images.slice(1)) void preloadImage(previewSrc(image.url));
  return Promise.race([main, new Promise<void>((resolve) => setTimeout(resolve, waitMs))]);
}
