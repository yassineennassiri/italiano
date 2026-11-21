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
import { type ActionResponse, recordExercise, recordVisit } from "./actions";
import { currentEntry, type LocalEntry, type SavedEntry, settleLocal } from "./merge";
import type { ExerciseWrite, VisitWrite } from "./plan";
import { WriteQueue } from "./write-queue";

type QueuedWrite = { type: "exercise"; exercise: ExerciseWrite } | { type: "visit"; visit: VisitWrite };

const localEntries = new Map<string, LocalEntry>();
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version++;
  for (const listener of listeners) listener();
}

/** Settles the local entry with the server's answer. A rejected write is malformed: it is logged and dropped. */
function settle(exerciseId: string, response: ActionResponse): void {
  if (response.result === "rejected") console.error("The server rejected a progress write.", exerciseId);
  const local = localEntries.get(exerciseId);
  if (!local) return;
  const settled = settleLocal(local, response.result === "rejected" ? undefined : response.saved);
  if (settled) localEntries.set(exerciseId, settled);
  else localEntries.delete(exerciseId);
  changed();
}

async function send(write: QueuedWrite): Promise<void> {
  if (write.type === "exercise") settle(write.exercise.exerciseId, await recordExercise(write.exercise));
  else if ((await recordVisit(write.visit)).result === "rejected") console.error("The server rejected a visit.", write.visit);
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
  const local = localEntries.get(exercise.id);
  localEntries.set(exercise.id, { entry: outcome.entry, pending: (local?.pending ?? 0) + 1, savedAt: local?.savedAt ?? null });
  changed();
  progressQueue.enqueue({
    type: "exercise",
    exercise: { eventId: crypto.randomUUID(), lessonId, exerciseId: exercise.id, contentHash, at: new Date().toISOString(), ...action },
  });
}

let lastVisit = "";

/** Records the step being viewed, so reopening the lesson resumes there. Repeats of the last visit are skipped. */
export function recordStepVisit(visit: VisitWrite): void {
  const key = `${visit.lessonId}/${visit.location}`;
  if (key === lastVisit) return;
  lastVisit = key;
  progressQueue.enqueue({ type: "visit", visit });
}
