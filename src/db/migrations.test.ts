import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "drizzle");

function createdTables(): string[] {
  const sqlFiles = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql"))
    : [];
  const allSql = sqlFiles.map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf8")).join("\n");
  return [...allSql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"/g)].map((match) => match[1]).sort();
}

it("the committed migrations create exactly the M1 tables (SPEC §10.1–10.4)", () => {
  expect(createdTables()).toEqual(["error_log", "exercise_attempt", "item_state", "lesson_progress", "profile"]);
});
