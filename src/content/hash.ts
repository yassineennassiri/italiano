/**
 * Content hashes per exercise (SPEC §10.3). An `item_state` row stores the hash
 * of its exercise when written; on load, a row whose hash no longer matches is
 * ignored, so a changed item starts fresh while the others keep their state.
 * Notes are left out: they explain an item without changing it. Vocab links
 * hash as their plain word, so adding links never resets progress (ADR-0006).
 */
import { createHash } from "node:crypto";
import { exchangeExerciseId } from "./ids";
import type { Lesson } from "./schema";
import { plainVocabLinks } from "./vocab-links";

/** JSON with sorted keys, so reordering fields in a file doesn't change a hash. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([key, field]) => key !== "notes" && field !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, field]) => `${JSON.stringify(key)}:${canonical(field)}`).join(",")}}`;
  }
  return JSON.stringify(typeof value === "string" ? plainVocabLinks(value) : value);
}

const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex").slice(0, 16);

/** Exercise id → hash of its content: the item, or for speaking items each exchange. */
export function exerciseHashes(lesson: Pick<Lesson, "steps">): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const step of lesson.steps) {
    for (const item of step.items) {
      if (item.type === "speak_rate") {
        for (const exchange of item.exchanges) hashes.set(exchangeExerciseId(item.id, exchange.id), hash(exchange));
      } else {
        hashes.set(item.id, hash(item));
      }
    }
  }
  return hashes;
}
