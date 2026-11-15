/** Reading and parsing content files, shared by the loader and `content:check`. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";

/** The real content directory, `content/` in the project root. */
export const CONTENT_DIR = path.join(process.cwd(), "content");

/** Relative (posix) paths of every lesson file under `levels/`, sorted. */
export function findLessonFiles(contentDir: string): string[] {
  const levelsDir = path.join(contentDir, "levels");
  if (!existsSync(levelsDir)) return [];
  return readdirSync(levelsDir, { recursive: true, encoding: "utf8" })
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => /(^|\/)lessons\/[^/]+\.json$/.test(file))
    .map((file) => `levels/${file}`)
    .sort();
}

/** `["steps", 1, "items", 0]` → `steps[1].items[0]` */
export function formatPath(issuePath: readonly PropertyKey[]): string {
  return issuePath
    .map((key, i) => (typeof key === "number" ? `[${key}]` : `${i === 0 ? "" : "."}${String(key)}`))
    .join("");
}

/** Parsed JSON, or undefined after recording why it couldn't be read. */
export function readJson(contentDir: string, file: string, problems: string[]): unknown {
  try {
    return JSON.parse(readFileSync(path.join(contentDir, file), "utf8"));
  } catch (error) {
    problems.push(`${file}: cannot read JSON: ${(error as Error).message}`);
    return undefined;
  }
}

/** Validated data, or undefined after recording one problem per schema issue. */
export function parse<T>(file: string, raw: unknown, schema: z.ZodType<T>, problems: string[]): T | undefined {
  if (raw === undefined) return undefined;
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const where = formatPath(issue.path);
    problems.push(`${file}: ${where ? `${where}: ` : ""}${issue.message}`);
  }
  return undefined;
}

/** Reads and validates one file, throwing every problem at once if it is invalid. */
export function readContentFile<T>(contentDir: string, file: string, schema: z.ZodType<T>): T {
  const problems: string[] = [];
  const data = parse(file, readJson(contentDir, file, problems), schema, problems);
  if (data === undefined) throw new Error(`Invalid content (run npm run content:check):\n${problems.join("\n")}`);
  return data;
}
