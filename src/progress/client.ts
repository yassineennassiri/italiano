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
import type { FeedbackWrite } from "@/feedback/notes";
import type { NewCorrectionWrite } from "@/review/error-card";
import type { DrillWrite, ReviewWrite } from "@/review/plan";
import { LocalSettings } from "@/settings/local";
import type { Settings, SettingsWrite } from "@/settings/settings";
import {
  fetchSettings,
  recordCorrection,
  recordFeedback,
  recordFeedbackDone,
  recordDrill,
  recordExercise,
  recordFinish,
  recordNewCorrection,
  recordReset,
  recordReview,
  recordSettings,
  recordVisit,
} from "./actions";
import { openIndexedDbStore } from "./indexed-db-store";
import { LocalProgress, type ProgressResponse, type ProgressWrite } from "./local";
import { inResetScope, resetScope, type SavedEntry } from "./merge";
import type { ResetTarget, VisitWrite } from "./plan";
import { type Tabs, type TabMessage, WriteQueue } from "./write-queue";

const progress = new LocalProgress();
const settings = new LocalSettings();

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
    case "review":
      return recordReview(write.review);
    case "drill":
      return recordDrill(write.drill);
    case "newCorrection":
      return recordNewCorrection(write.newCorrection);
    case "settings":
      return recordSettings(write.settings);
    case "feedback":
      return recordFeedback(write.feedback);
    case "feedbackDone":
      return recordFeedbackDone(write.feedbackDone);
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
  landed: (write, response) => {
    progress.landed(write, response);
    if (write.type === "settings") settings.landed(write.settings, response);
  },
  restore: (write) => {
    progress.restore(write);
    if (write.type === "settings") settings.restore(write.settings);
  },
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
  progressQueue.enqueue({ type: "finish", finish: { lessonId, at: new Date().toISOString() } });
}

/** A review answer (SPEC §10.5): queued like every other write, so it waits offline and survives a reload. */
export function submitReview(review: ReviewWrite): void {
  progressQueue.enqueue({ type: "review", review });
}

/** A tag drill answer (SPEC §10.5): queued like a review answer. */
export function submitDrill(drill: DrillWrite): void {
  progressQueue.enqueue({ type: "drill", drill });
}

/** Aggiungi una correzione (SPEC §10.5): queued like every other write, so a correction saved offline isn't lost. */
export function submitNewCorrection(correction: Omit<NewCorrectionWrite, "eventId" | "at">): void {
  progressQueue.enqueue({ type: "newCorrection", newCorrection: { eventId: crypto.randomUUID(), at: new Date().toISOString(), ...correction } });
}

/** A feedback note (SPEC §10.6): queued like every other write, so a note written offline isn't lost. */
export function submitFeedback(note: Pick<FeedbackWrite, "scope" | "refId" | "text">): void {
  progressQueue.enqueue({ type: "feedback", feedback: { eventId: crypto.randomUUID(), at: new Date().toISOString(), ...note } });
}

/** *Fatto* ticked or unticked on `/feedback` (SPEC §10.6). */
export function submitFeedbackDone(noteId: string, done: boolean): void {
  progressQueue.enqueue({ type: "feedbackDone", feedbackDone: { noteId, done } });
}

let lastVisit: VisitWrite | undefined;

/** Records the step being viewed, so reopening the lesson resumes there. Repeats of the last visit are skipped. */
export function recordStepVisit(visit: VisitWrite): void {
  if (lastVisit?.lessonId === visit.lessonId && lastVisit.location === visit.location) return;
  lastVisit = visit;
  progressQueue.enqueue({ type: "visit", visit });
}

/** A change in Impostazioni (SPEC §10.1): this tab uses it at once, and it is queued like every other write. */
export function submitSettings(write: SettingsWrite): void {
  const queued: ProgressWrite = { type: "settings", settings: write };
  settings.show(write);
  progressQueue.enqueue(queued);
}

/** Subscribes to changes of this tab's settings, for `useSyncExternalStore`. */
export const subscribeSettings = (listener: () => void): (() => void) => settings.subscribe(listener);

/** Changes on every change of this tab's settings, for `useSyncExternalStore`. */
export const settingsVersion = (): number => settings.version;

/** This tab's settings; `standIn` (a page's own saved settings) counts until the server has sent any. */
export const currentSettings = (standIn?: Settings): Settings => settings.current(standIn);

/** The settings as a page read them from the server. */
export const receiveSettings = (saved: Settings): void => settings.receive(saved);

/** Asks the server for the saved settings, e.g. the other computer's latest change; keeps the ones it has when offline. */
export async function refreshSettings(): Promise<void> {
  try {
    settings.receive(await fetchSettings());
  } catch (error) {
    console.error("Could not load the settings; using the last ones known.", error);
  }
}
