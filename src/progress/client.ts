/**
 * The browser side of progress (SPEC §8): exercise entries the learner has
 * changed in this tab, and the write queue that sends every change to the
 * Server Actions. Optimistic: an entry changes at once and its write follows.
 * Lives for the tab, so moving between steps keeps local changes even before
 * the server has them. Only event handlers and effects change it, never render.
 */
import type { Item } from "@/content/schema";
import { applyAction, type ExerciseAction } from "@/items/engine";
import type { ExerciseEntry } from "@/items/entry";
import { recordExercise, recordVisit } from "./actions";
import type { ExerciseWrite } from "./plan";
import type { VisitWrite } from "./store";
import { WriteQueue } from "./write-queue";

type Write = { kind: "exercise"; write: ExerciseWrite } | { kind: "visit"; visit: VisitWrite };

/** A rejected write is malformed and would fail forever, so it is dropped (and logged) rather than retried. */
async function send(write: Write): Promise<void> {
  const result = write.kind === "exercise" ? await recordExercise(write.write) : await recordVisit(write.visit);
  if (result === "rejected") console.error("The server rejected a progress write.", write);
}

export const progressQueue = new WriteQueue<Write>(send);

if (typeof window !== "undefined") window.addEventListener("online", () => progressQueue.online());

const localEntries = new Map<string, ExerciseEntry>();
const listeners = new Set<() => void>();
let version = 0;

export function subscribeEntries(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes on every local change, for `useSyncExternalStore`. */
export const entriesVersion = () => version;

/** The entry this tab changed, if any; otherwise the page's server state applies. */
export const localEntry = (exerciseId: string): ExerciseEntry | undefined => localEntries.get(exerciseId);

/** Applies a learner action now and queues its write. Does nothing when the action changes nothing. */
export function act(lessonId: string, item: Item, current: ExerciseEntry, action: ExerciseAction): void {
  const outcome = applyAction(item, current, action);
  if (!outcome) return;
  localEntries.set(item.id, outcome.entry);
  version++;
  for (const listener of listeners) listener();
  progressQueue.enqueue({ kind: "exercise", write: { eventId: crypto.randomUUID(), lessonId, exerciseId: item.id, ...action } });
}

/** Records the step being viewed, so reopening the lesson resumes there. */
export function recordStepVisit(visit: VisitWrite): void {
  progressQueue.enqueue({ kind: "visit", visit });
}
