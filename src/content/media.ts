/**
 * Serving content media (images now, audio later) from `content/media`, which
 * is not a public folder: pages link to `/media/<path>` and the route handler
 * resolves the request here.
 */
import { statSync } from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "./files";

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
};

/** A safe path segment: letters, digits, `_`, `-` and `.`, but not `.` or `..` alone. */
const SEGMENT = /^(?!\.{1,2}$)[\w.-]+$/;

/** The URL of a content media path, e.g. `images/a2/u01/l01/poster.webp`. */
export function mediaUrl(mediaPath: string): string {
  return `/media/${mediaPath}`;
}

/** The file for a `/media/...` request, or undefined if it is unsafe, of an unknown type, or missing. */
export function mediaFile(
  segments: readonly string[],
  contentDir = CONTENT_DIR,
): { file: string; contentType: string } | undefined {
  if (segments.length === 0 || !segments.every((segment) => SEGMENT.test(segment))) return undefined;
  const contentType = CONTENT_TYPES[path.extname(segments[segments.length - 1]).toLowerCase()];
  if (!contentType) return undefined;
  const file = path.join(contentDir, "media", ...segments);
  try {
    return statSync(file).isFile() ? { file, contentType } : undefined;
  } catch {
    return undefined;
  }
}
