/**
 * The content version shown in the footer (SPEC §3.1): a short fingerprint of
 * the course plan, error tags and lesson files, so the two computers can tell
 * whether they run the same content. Lesson `version` numbers can't do this,
 * because forgetting to bump one is allowed (SPEC §9).
 *
 * Each file is hashed as parsed JSON, so line endings and formatting (which
 * git may change per computer) don't change the version. Media is not hashed.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { findLessonFiles } from "./files";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function contentVersion(contentDir = CONTENT_DIR): string {
  const hash = createHash("sha256");
  for (const file of ["course.json", "error-tags.json", ...findLessonFiles(contentDir)]) {
    const json = JSON.parse(readFileSync(path.join(contentDir, file), "utf8"));
    hash.update(`${file}\n${JSON.stringify(json)}\n`);
  }
  return hash.digest("hex").slice(0, 7);
}
