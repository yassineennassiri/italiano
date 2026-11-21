"use server";
/**
 * The progress Server Actions the client's write queue calls (SPEC §8). Input
 * is validated here, since a Server Action is reachable by any POST. A database
 * error throws, so the queue keeps the write and retries it.
 */
import { db } from "@/db";
import { PROFILE_ID } from "@/db/schema";
import { correctionWriteSchema, exerciseWriteSchema, finishWriteSchema, visitWriteSchema } from "./plan";
import { type CorrectionResponse, saveCorrection, saveExerciseWrite, saveFinish, saveVisit, type WriteResponse } from "./store";

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
