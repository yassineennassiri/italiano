/**
 * The browser side of progress (SPEC §8): this tab's local progress, and the
 * write queue that sends every change to the Server Actions. Optimistic: an
 * entry changes at once and its write follows; each answer from the server
 * settles it (`local.ts`). Writes wait in IndexedDB, so a reload shows the
 * ones still unsent and replays them; without IndexedDB they wait in memory.
 * Only event handlers and effects change it, never render.
 */
import { applyAction, type Exercise, type ExerciseAction } from "@/items/engine";
import type { ExerciseEntry } from "@/items/entry";
import { applyEvent } from "@/scoring/exercise";
import { recordCorrection, recordExercise, recordFinish, recordReset, recordVisit } from "./actions";
import { openIndexedDbStore } from "./indexed-db-store";
import { LocalProgress, type ProgressResponse, type ProgressWrite } from "./local";
import { inResetScope, resetScope, type SavedEntry } from "./merge";
import type { ResetTarget, VisitWrite } from "./plan";
import { type Tabs, type TabMessage, WriteQueue } from "./write-queue";

const progress = new LocalProgress();

function send(write: ProgressWrite): Promise<ProgressResponse> {
  switch (write.type) {
    case "exercise":
      return recordExercise(write.exercise);
    case "correction":
      return recordCorrection(write.correction);
    case "visit":
      return recordVisit(write.visit);
    case "finish":
      return recordFinish(write.finish);
    case "reset":
      return recordReset(write.reset);
  }
}

/** The browser's IndexedDB, or undefined where it is missing or reading it throws (blocked storage). */
function browserIndexedDb(): IDBFactory | undefined {
  try {
    return typeof indexedDB === "undefined" ? undefined : indexedDB;
  } catch {
    return undefined;
  }
}

const SHARED_NAME = "italiano-progress-writes";

/** The other tabs, through Web Locks and a BroadcastChannel; undefined where either is missing. */
function browserTabs(): Tabs<ProgressResponse> | undefined {
  if (typeof navigator === "undefined" || !navigator.locks || typeof BroadcastChannel === "undefined") return undefined;
  const channel = new BroadcastChannel(SHARED_NAME);
  return {
    lock: (lead) => void navigator.locks.request(SHARED_NAME, lead),
    post: (message) => channel.postMessage(message),
    listen: (receive) => {
      const onMessage = (event: MessageEvent<TabMessage<ProgressResponse>>) => receive(event.data);
      channel.addEventListener("message", onMessage);
      return () => channel.removeEventListener("message", onMessage);
    },
  };
}

const tabs = typeof window === "undefined" ? undefined : browserTabs();

/**
 * Every progress write of this tab. IndexedDB only where Web Locks and
 * BroadcastChannel let one tab flush it; elsewhere, and on the server, writes
 * wait in memory (M1).
 */
export const progressQueue = new WriteQueue<ProgressWrite, ProgressResponse>({
  send,
  landed: (write, response) => progress.landed(write, response),
  restore: (write) => progress.restore(write),
  store: tabs ? openIndexedDbStore(browserIndexedDb()) : undefined,
  tabs,
});

if (typeof window !== "undefined") window.addEventListener("online", () => progressQueue.online());

/** Shows a write's change now and queues it. */
function submit(write: ProgressWrite): void {
  progress.show(write);
  progressQueue.enqueue(write);
}

/** Subscribes to changes of this tab's entries, for `useSyncExternalStore`. */
export const subscribeEntries = (listener: () => void): (() => void) => progress.subscribe(listener);

/** Changes on every local change, for `useSyncExternalStore`. */
export const entriesVersion = (): number => progress.version;

/** What an exercise shows: this tab's change, or the page's saved entry, whichever is current. */
export const entryOf = (exerciseId: string, saved: SavedEntry | undefined): ExerciseEntry => progress.entryOf(exerciseId, saved);

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
  submit({
    type: "exercise",
    exercise: { eventId: crypto.randomUUID(), lessonId, exerciseId: exercise.id, contentHash, at: new Date().toISOString(), ...action },
    entry: outcome.entry,
  });
}

/**
 * Correggi i miei errori (SPEC §4.4): reopens the exercises now, emptying their
 * inputs but keeping their spent first Check, and queues the write. The server
 * reopens what it has stored as wrong or solved.
 */
export function submitCorrection(lessonId: string, reopen: readonly string[], saved: Readonly<Record<string, SavedEntry>>): void {
  const reopened: Record<string, ExerciseEntry> = {};
  for (const exerciseId of reopen) {
    const { state } = entryOf(exerciseId, saved[exerciseId]);
    reopened[exerciseId] = { state: applyEvent(state, { type: "reopen" }), answer: null };
  }
  submit({ type: "correction", correction: { lessonId, at: new Date().toISOString() }, reopened });
}

/**
 * Azzera, confirmed (SPEC §4.10): the lesson's (or level's) exercises show as
 * untouched at once, and the write that clears them is queued after any
 * writes still on the way.
 */
export function submitReset(target: ResetTarget): void {
  // The resume point is cleared too: the next visit is recorded again.
  if (lastVisit && inResetScope(resetScope(target), lastVisit.lessonId)) lastVisit = undefined;
  submit({ type: "reset", reset: { ...target, at: new Date().toISOString() } });
}

/** The Finish screen was reached: queues the write that completes the lesson. */
export function submitFinish(lessonId: string): void {
  progressQueue.enqueue({ type: "finish", finish: { lessonId } });
}

let lastVisit: VisitWrite | undefined;

/** Records the step being viewed, so reopening the lesson resumes there. Repeats of the last visit are skipped. */
export function recordStepVisit(visit: VisitWrite): void {
  if (lastVisit?.lessonId === visit.lessonId && lastVisit.location === visit.location) return;
  lastVisit = visit;
  progressQueue.enqueue({ type: "visit", visit });
}
