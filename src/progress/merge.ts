/**
 * Which state an exercise shows in this tab (SPEC §8): its own changes while
 * their writes are on the way, otherwise whichever state the server saved last,
 * whether it came with the page or with this tab's last write. That way a
 * change from the other computer shows up once this tab's writes have landed.
 */
import { type ExerciseEntry, NEW_ENTRY } from "@/items/entry";
import type { ResetTarget } from "./plan";

/** An entry as the server saved it; `savedAt` is `item_state.updated_at` (ISO). */
export type SavedEntry = { entry: ExerciseEntry; savedAt: string };

/** An entry this tab changed: how many of its writes are still unconfirmed, and when the last one was saved. */
export type LocalEntry = { entry: ExerciseEntry; pending: number; savedAt: string | null };

/**
 * An Azzera this tab asked for: `resetAt` is null while it is on the way, then
 * the server's time of the reset (comparable with `savedAt`).
 */
export type LocalReset = { resetAt: string | null };

/**
 * The entry to show, from this tab's change (if any) and the page's saved entry
 * (if any). After an Azzera covering the exercise, a saved entry counts only
 * when it was saved after the reset landed.
 */
export function currentEntry(local: LocalEntry | undefined, pageSaved: SavedEntry | undefined, reset?: LocalReset): ExerciseEntry {
  const saved = reset && (reset.resetAt === null || (pageSaved && pageSaved.savedAt <= reset.resetAt)) ? undefined : pageSaved;
  if (!local) return saved?.entry ?? NEW_ENTRY;
  if (local.pending > 0 || !saved) return local.entry;
  return local.savedAt !== null && local.savedAt >= saved.savedAt ? local.entry : saved.entry;
}

/** The local entry after one of its writes is answered with the server's saved entry, or undefined to forget it. */
export function settleLocal(local: LocalEntry, saved: SavedEntry | undefined): LocalEntry | undefined {
  const pending = local.pending - 1;
  if (pending > 0) return { entry: local.entry, pending, savedAt: saved?.savedAt ?? local.savedAt };
  return saved && { entry: saved.entry, pending: 0, savedAt: saved.savedAt };
}

/** The exercise-id prefix an Azzera covers: ids are hierarchical (`a2.u01.l01.s03.i02`, SPEC §9). */
export type ResetScope = string;

export function resetScope(target: ResetTarget): ResetScope {
  return `${target.scope === "lesson" ? target.lessonId : target.levelId}.`;
}

/** Whether an Azzera of `scope` covers the exercise. */
export function inResetScope(scope: ResetScope, exerciseId: string): boolean {
  return exerciseId.startsWith(scope);
}
