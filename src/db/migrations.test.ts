import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { MIGRATIONS_DIR } from "./migrate";

function createdTables(): string[] {
  const sqlFiles = fs.existsSync(MIGRATIONS_DIR)
    ? fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql"))
    : [];
  const allSql = sqlFiles.map((file) => fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")).join("\n");
  return [...allSql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(\w+)"/g)].map((match) => match[1]).sort();
}

it("the committed migrations create exactly the M1 tables (SPEC §10.1–10.4)", () => {
  expect(createdTables()).toEqual(["error_log", "exercise_attempt", "item_state", "lesson_progress", "profile"]);
});
