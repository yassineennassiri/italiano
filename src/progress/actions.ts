"use server";
/**
 * The progress Server Actions the client's write queue calls (SPEC §8). Input
 * is validated here, since a Server Action is reachable by any POST. A database
 * error throws, so the queue keeps the write and retries it.
 */
import { db } from "@/db";
import { PROFILE_ID } from "@/db/schema";
import { feedbackDoneWriteSchema, feedbackWriteSchema } from "@/feedback/notes";
import { saveFeedbackDone, saveFeedbackNote } from "@/feedback/store";
import { newCorrectionWriteSchema } from "@/review/error-card";
import { drillWriteSchema, reviewWriteSchema } from "@/review/plan";
import { saveDrillWrite, saveNewCorrection, saveReviewWrite } from "@/review/store";
import { type Settings, settingsWriteSchema } from "@/settings/settings";
import { loadSettings, saveSettings } from "@/settings/store";
import { correctionWriteSchema, exerciseWriteSchema, finishWriteSchema, resetWriteSchema, visitWriteSchema } from "./plan";
import {
  type CorrectionResponse,
  type ResetResponse,
  saveCorrection,
  saveExerciseWrite,
  saveFinish,
  saveReset,
  saveVisit,
  type WriteResponse,
} from "./store";

/** "rejected" is malformed input: the queue drops it rather than retrying it forever. */
export type ActionResponse = WriteResponse | { result: "rejected" };

/** Applies one learner action (a pick or Solve) and returns the exercise's entry as now saved. */
export async function recordExercise(input: unknown): Promise<ActionResponse> {
  const parsed = exerciseWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveExerciseWrite(db(), PROFILE_ID, parsed.data);
}

/** Records the step the learner is on, for resuming the lesson there. */
export async function recordVisit(input: unknown): Promise<ActionResponse> {
  const parsed = visitWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveVisit(db(), PROFILE_ID, parsed.data);
}

/** Correggi i miei errori: reopens the lesson's wrong and solved scorable items, and returns them as now saved. */
export async function recordCorrection(input: unknown): Promise<CorrectionResponse | { result: "rejected" }> {
  const parsed = correctionWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveCorrection(db(), PROFILE_ID, parsed.data);
}

/** The Finish screen was reached: the lesson is completed. */
export async function recordFinish(input: unknown): Promise<ActionResponse> {
  const parsed = finishWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveFinish(db(), PROFILE_ID, parsed.data);
}

/** Azzera, confirmed: clears the lesson's (or level's) exercises and puts its lessons back to not started. */
export async function recordReset(input: unknown): Promise<ResetResponse | { result: "rejected" }> {
  const parsed = resetWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveReset(db(), PROFILE_ID, parsed.data);
}

/** A review answer in the review hub: grades and reschedules its card (SPEC §10.5). Never touches the lesson's progress. */
export async function recordReview(input: unknown): Promise<ActionResponse> {
  const parsed = reviewWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveReviewWrite(db(), PROFILE_ID, parsed.data);
}

/** A tag drill answer: grades the exercise's item card if it has one, and never creates one (SPEC §10.5). */
export async function recordDrill(input: unknown): Promise<ActionResponse> {
  const parsed = drillWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveDrillWrite(db(), PROFILE_ID, parsed.data);
}

/** Aggiungi una correzione: a manual error_log row and its error card, due tomorrow (SPEC §10.5). */
export async function recordNewCorrection(input: unknown): Promise<ActionResponse> {
  const parsed = newCorrectionWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveNewCorrection(db(), PROFILE_ID, parsed.data);
}

/** A change in Impostazioni: merges the settings it names into `profile.settings` (SPEC §10.1). */
export async function recordSettings(input: unknown): Promise<ActionResponse> {
  const parsed = settingsWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveSettings(db(), PROFILE_ID, parsed.data);
}

/** A feedback note from the level overview or *Segnala un problema* (SPEC §10.6). */
export async function recordFeedback(input: unknown): Promise<ActionResponse> {
  const parsed = feedbackWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveFeedbackNote(db(), PROFILE_ID, parsed.data);
}

/** *Fatto* ticked or unticked on `/feedback` (SPEC §10.6). */
export async function recordFeedbackDone(input: unknown): Promise<ActionResponse> {
  const parsed = feedbackDoneWriteSchema.safeParse(input);
  if (!parsed.success) return { result: "rejected" };
  return saveFeedbackDone(db(), PROFILE_ID, parsed.data);
}

/** The synced settings as saved now, for a scene player that opens (SPEC §11.3). Throws when the database can't be read. */
export async function fetchSettings(): Promise<Settings> {
  return loadSettings(db(), PROFILE_ID);
}
