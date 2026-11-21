/**
 * The browser side of progress (SPEC §8): the entries this tab changed, and the
 * write queue that sends every change to the Server Actions. Optimistic: an
 * entry changes at once and its write follows; each answer from the server
 * settles it (`merge.ts`). Lives for the tab, so moving between steps keeps
 * changes the server hasn't confirmed yet. Only event handlers and effects
 * change it, never render.
 */
import { applyAction, type Exercise, type ExerciseAction } from "@/items/engine";
import type { ExerciseEntry } from "@/items/entry";
import { applyEvent } from "@/scoring/exercise";
import { recordCorrection, recordExercise, recordFinish, recordVisit } from "./actions";
import { currentEntry, type LocalEntry, type SavedEntry, settleLocal } from "./merge";
import type { CorrectionWrite, ExerciseWrite, FinishWrite, VisitWrite } from "./plan";
import { WriteQueue } from "./write-queue";

type QueuedWrite =
  | { type: "exercise"; exercise: ExerciseWrite }
  | { type: "visit"; visit: VisitWrite }
  /** `reopen`: the exercises this tab reopened, settled with the server's answer. */
  | { type: "correction"; correction: CorrectionWrite; reopen: string[] }
  | { type: "finish"; finish: FinishWrite };

const localEntries = new Map<string, LocalEntry>();
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version++;
  for (const listener of listeners) listener();
}

/** Settles the local entry with the server's saved entry: none when nothing fitting is stored, or the write was rejected. */
function settle(exerciseId: string, saved: SavedEntry | undefined): void {
  const local = localEntries.get(exerciseId);
  if (!local) return;
  const settled = settleLocal(local, saved);
  if (settled) localEntries.set(exerciseId, settled);
  else localEntries.delete(exerciseId);
  changed();
}

/** A rejected write is malformed: it is logged and dropped. */
function logIfRejected(response: { result: string }, write: QueuedWrite): response is { result: "rejected" } {
  if (response.result !== "rejected") return false;
  console.error("The server rejected a progress write.", write);
  return true;
}

async function send(write: QueuedWrite): Promise<void> {
  switch (write.type) {
    case "exercise": {
      const response = await recordExercise(write.exercise);
      settle(write.exercise.exerciseId, logIfRejected(response, write) ? undefined : response.saved);
      return;
    }
    case "correction": {
      const response = await recordCorrection(write.correction);
      const saved = logIfRejected(response, write) ? {} : (response.saved ?? {});
      for (const exerciseId of write.reopen) settle(exerciseId, saved[exerciseId]);
      return;
    }
    case "visit":
      logIfRejected(await recordVisit(write.visit), write);
      return;
    case "finish":
      logIfRejected(await recordFinish(write.finish), write);
      return;
  }
}

export const progressQueue = new WriteQueue<QueuedWrite>(send);

if (typeof window !== "undefined") window.addEventListener("online", () => progressQueue.online());

/** Subscribes to changes of this tab's entries, for `useSyncExternalStore`. */
export function subscribeEntries(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes on every local change, for `useSyncExternalStore`. */
export const entriesVersion = () => version;

/** What an exercise shows: this tab's change, or the page's saved entry, whichever is current. */
export const entryOf = (exerciseId: string, saved: SavedEntry | undefined): ExerciseEntry =>
  currentEntry(localEntries.get(exerciseId), saved);

/** Shows `entry` for the exercise until the server answers the write that follows. */
function changeLocally(exerciseId: string, entry: ExerciseEntry): void {
  const local = localEntries.get(exerciseId);
  localEntries.set(exerciseId, { entry, pending: (local?.pending ?? 0) + 1, savedAt: local?.savedAt ?? null });
}

/** Applies a learner action now and queues its write. Does nothing when the action changes nothing. */
export function submitAction(
  lessonId: string,
  exercise: Exercise,
  saved: SavedEntry | undefined,
  contentHash: string,
  action: ExerciseAction,
): void {
  const outcome = applyAction(exercise, entryOf(exercise.id, saved), action);
  if (!outcome) return;
  changeLocally(exercise.id, outcome.entry);
  changed();
  progressQueue.enqueue({
    type: "exercise",
    exercise: { eventId: crypto.randomUUID(), lessonId, exerciseId: exercise.id, contentHash, at: new Date().toISOString(), ...action },
  });
}

/**
 * Correggi i miei errori (SPEC §4.4): reopens the exercises now, emptying their
 * inputs but keeping their spent first Check, and queues the write. The server
 * reopens what it has stored as wrong or solved.
 */
export function submitCorrection(lessonId: string, reopen: readonly string[], saved: Readonly<Record<string, SavedEntry>>): void {
  for (const exerciseId of reopen) {
    const { state } = entryOf(exerciseId, saved[exerciseId]);
    changeLocally(exerciseId, { state: applyEvent(state, { type: "reopen" }), answer: null });
  }
  changed();
  progressQueue.enqueue({ type: "correction", correction: { lessonId, at: new Date().toISOString() }, reopen: [...reopen] });
}

/** The Finish screen was reached: queues the write that completes the lesson. */
export function submitFinish(lessonId: string): void {
  progressQueue.enqueue({ type: "finish", finish: { lessonId } });
}

let lastVisit = "";

/** Records the step being viewed, so reopening the lesson resumes there. Repeats of the last visit are skipped. */
export function recordStepVisit(visit: VisitWrite): void {
  const key = `${visit.lessonId}/${visit.location}`;
  if (key === lastVisit) return;
  lastVisit = key;
  progressQueue.enqueue({ type: "visit", visit });
}
