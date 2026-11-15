/** Test helpers: throwaway copies of the real content directory. */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

export const CONTENT_DIR = path.join(process.cwd(), "content");
export const LESSON_FILE = "levels/a2/units/01-arrivo-a-genova/lessons/01-benvenuto-a-genova.json";

const copies: string[] = [];

afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A copy of the real content, deleted after the test. */
export function copyContent(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "italiano-content-"));
  cpSync(CONTENT_DIR, dir, { recursive: true });
  copies.push(dir);
  return dir;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests mutate raw JSON
type Json = any;

/** Rewrites one JSON file of a content copy. */
export function editJson(dir: string, file: string, edit: (data: Json) => void) {
  const full = path.join(dir, file);
  const data = JSON.parse(readFileSync(full, "utf8"));
  edit(data);
  writeFileSync(full, JSON.stringify(data, null, 2));
}
