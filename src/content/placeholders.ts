/**
 * Placeholder images (SPEC §11.2): a solid colour plus a caption, written for
 * every referenced image that doesn't exist yet, so the app and
 * `content:check` work before real illustrations are made.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { findLessonFiles } from "./files";
import { mediaRefs } from "./refs";
import { lessonSchema } from "./schema";

const IMAGE_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);

/** Posters and scene panels are 16:9 at 1600 px (§11.2); everything else is 800 px wide. */
function sizeFor(mediaPath: string): { width: number; height: number } {
  const name = path.posix.basename(mediaPath);
  return /^(poster|panel-)/.test(name) ? { width: 1600, height: 900 } : { width: 800, height: 600 };
}

/** A stable, muted colour per path, so neighbouring panels are easy to tell apart. */
function colourFor(mediaPath: string): string {
  let hash = 0;
  for (const char of mediaPath) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360}, 45%, 55%)`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function placeholderSvg(mediaPath: string): string {
  const { width, height } = sizeFor(mediaPath);
  const title = path.posix.basename(mediaPath, path.posix.extname(mediaPath));
  const big = Math.round(width / 16);
  const small = Math.round(width / 50);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${colourFor(mediaPath)}"/>
  <g font-family="sans-serif" fill="#ffffff" text-anchor="middle">
    <text x="50%" y="50%" font-size="${big}" font-weight="bold">${escapeXml(title)}</text>
    <text x="50%" y="${height / 2 + big}" font-size="${small}">${escapeXml(mediaPath)}</text>
  </g>
</svg>`;
}

/** Image paths referenced by every valid lesson, without duplicates. */
function referencedImages(contentDir: string): string[] {
  const images = new Set<string>();
  for (const file of findLessonFiles(contentDir)) {
    const parsed = lessonSchema.safeParse(JSON.parse(readFileSync(path.join(contentDir, file), "utf8")));
    if (!parsed.success) continue; // content:check reports it
    for (const ref of mediaRefs(parsed.data)) {
      if (IMAGE_EXTENSIONS.has(path.posix.extname(ref.value).toLowerCase())) images.add(ref.value);
    }
  }
  return [...images];
}

/** Writes a placeholder for each missing referenced image; returns the paths it created. */
export async function generatePlaceholders(contentDir: string): Promise<string[]> {
  const created: string[] = [];
  for (const mediaPath of referencedImages(contentDir)) {
    const target = path.join(contentDir, "media", mediaPath);
    if (existsSync(target)) continue;
    mkdirSync(path.dirname(target), { recursive: true });
    await sharp(Buffer.from(placeholderSvg(mediaPath))).toFile(target);
    created.push(mediaPath);
  }
  return created;
}
