/**
 * This tab's view of progress (SPEC §8): the entries it changed and the
 * resets it asked for, laid over the entries the server sent with the page
 * until the server answers the writes (`merge.ts`). A write shows its change
 * when the learner acts, and again when a reload restores it from IndexedDB,
 * so the write carries what to show. Plain TypeScript: no React, no Next.js.
 */
import type { ExerciseEntry } from "@/items/entry";
import {
  currentEntry,
  inResetScope,
  type LocalEntry,
  type LocalReset,
  resetScope,
  type ResetScope,
  type SavedEntry,
  settleLocal,
} from "./merge";
import type { NewCorrectionWrite } from "@/review/error-card";
import type { ReviewWrite } from "@/review/plan";
import type { CorrectionWrite, ExerciseWrite, FinishWrite, ResetWrite, VisitWrite } from "./plan";
import type { CorrectionResponse, ResetResponse, WriteResponse } from "./store";

/** A progress write as the queue stores it: what goes to the server, and what this tab shows until it answers. */
export type ProgressWrite =
  /** `entry`: the exercise as the learner left it. */
  | { type: "exercise"; exercise: ExerciseWrite; entry: ExerciseEntry }
  | { type: "visit"; visit: VisitWrite }
  /** `reopened`: the exercises Correggi i miei errori reopened, as this tab shows them. */
  | { type: "correction"; correction: CorrectionWrite; reopened: Record<string, ExerciseEntry> }
  | { type: "finish"; finish: FinishWrite }
  | { type: "reset"; reset: ResetWrite }
  /** A review answer: the session shows its own entries, so this tab's lesson entries don't change. */
  | { type: "review"; review: ReviewWrite }
  /** Aggiungi una correzione: an error_log row and its error card; no lesson entry changes. */
  | { type: "newCorrection"; newCorrection: NewCorrectionWrite };

type Rejected = { result: "rejected" };

/** The server's answer to a progress write; "rejected" is malformed input, dropped rather than retried. */
export type ProgressResponse = WriteResponse | CorrectionResponse | ResetResponse | Rejected;

/** The entries and resets this tab shows over the page's saved entries, and the subscribers told of each change. */
export class LocalProgress {
  private readonly entries = new Map<string, LocalEntry>();
  /** The resets this tab shows, oldest first. */
  private readonly resets: { scope: ResetScope; local: LocalReset }[] = [];
  /** How many restored resets lead `resets`: they are older than this tab's own. */
  private restoredResets = 0;
  /** Exercises the learner changed in this tab: an older, restored write doesn't cover them. */
  private readonly changedHere = new Set<string>();
  /** The reset each reset write shows: the queue hands back the write object it was given. */
  private readonly resetOf = new WeakMap<ProgressWrite, LocalReset>();
  private readonly listeners = new Set<() => void>();
  private changes = 0;

  /** Subscribes to every change, for `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Changes on every change, for `useSyncExternalStore`. */
  get version(): number {
    return this.changes;
  }

  /** What an exercise shows: this tab's change, or the page's saved entry, whichever is current. */
  entryOf(exerciseId: string, saved: SavedEntry | undefined): ExerciseEntry {
    const reset = this.resets.findLast(({ scope }) => inResetScope(scope, exerciseId))?.local;
    return currentEntry(this.entries.get(exerciseId), saved, reset);
  }

  /** Shows a new write's change until the server answers it. */
  show(write: ProgressWrite): void {
    this.apply(write, false);
  }

  /**
   * Shows a write restored from IndexedDB after a reload, until the server
   * answers it. It is older than anything the learner did in this tab, which
   * it doesn't cover: the restore finishes a moment after the page loads.
   */
  restore(write: ProgressWrite): void {
    this.apply(write, true);
  }

  private apply(write: ProgressWrite, restored: boolean): void {
    switch (write.type) {
      case "exercise":
        this.changeLocally(write.exercise.exerciseId, write.entry, restored);
        break;
      case "correction":
        for (const [exerciseId, entry] of Object.entries(write.reopened)) this.changeLocally(exerciseId, entry, restored);
        break;
      case "reset": {
        const scope = resetScope(write.reset);
        for (const exerciseId of [...this.entries.keys()]) {
          if (inResetScope(scope, exerciseId) && !(restored && this.changedHere.has(exerciseId))) this.entries.delete(exerciseId);
        }
        const local: LocalReset = { resetAt: null };
        if (restored) this.resets.splice(this.restoredResets++, 0, { scope, local });
        else this.resets.push({ scope, local });
        this.resetOf.set(write, local);
        break;
      }
      case "visit":
      case "finish":
      case "review":
      case "newCorrection":
        return;
    }
    this.changed();
  }

  /** Settles a shown write with the server's answer. */
  landed(write: ProgressWrite, response: ProgressResponse): void {
    const rejected = response.result === "rejected";
    if (rejected) console.error("The server rejected a progress write.", write);
    switch (write.type) {
      case "exercise": {
        const answer = response as WriteResponse | Rejected;
        this.settle(write.exercise.exerciseId, answer.result === "rejected" ? undefined : answer.saved);
        break;
      }
      case "correction": {
        const answer = response as CorrectionResponse | Rejected;
        const saved = answer.result === "rejected" ? {} : (answer.saved ?? {});
        for (const exerciseId of Object.keys(write.reopened)) this.settle(exerciseId, saved[exerciseId]);
        break;
      }
      case "reset": {
        const answer = response as ResetResponse | Rejected;
        const local = this.resetOf.get(write);
        if (!local) return;
        if (answer.result === "saved") {
          local.resetAt = answer.resetAt;
        } else {
          // Nothing was reset: the saved entries count again.
          const index = this.resets.findIndex((reset) => reset.local === local);
          if (index !== -1) this.resets.splice(index, 1);
        }
        break;
      }
      case "visit":
      case "finish":
      case "review":
      case "newCorrection":
        return;
    }
    this.changed();
  }

  /** Shows `entry` for the exercise until the server answers the write that goes with it. */
  private changeLocally(exerciseId: string, entry: ExerciseEntry, restored: boolean): void {
    const local = this.entries.get(exerciseId);
    const newer = restored && this.changedHere.has(exerciseId) ? local?.entry : undefined;
    if (!restored) this.changedHere.add(exerciseId);
    this.entries.set(exerciseId, { entry: newer ?? entry, pending: (local?.pending ?? 0) + 1, savedAt: local?.savedAt ?? null });
  }

  /** Settles the local entry with the server's saved entry: none when nothing fitting is stored, or the write was rejected. */
  private settle(exerciseId: string, saved: SavedEntry | undefined): void {
    const local = this.entries.get(exerciseId);
    if (!local) return;
    const settled = settleLocal(local, saved);
    if (settled) this.entries.set(exerciseId, settled);
    else this.entries.delete(exerciseId);
  }

  private changed(): void {
    this.changes++;
    for (const listener of this.listeners) listener();
  }
}
