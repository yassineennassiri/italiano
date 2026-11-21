/** Content media URLs. Apart from `media.ts`, which reads the disk, so Client Components can use it. */

/** The URL of a content media path, e.g. `images/a2/u01/l01/poster.webp`; the `/media` route serves it. */
export function mediaUrl(mediaPath: string): string {
  return `/media/${mediaPath}`;
}
