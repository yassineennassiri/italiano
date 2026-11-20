"use server";
/**
 * The progress Server Actions the client's write queue calls (SPEC §8). Input
 * is validated here, since a Server Action is reachable by any POST. A database
 * error throws, so the queue keeps the write and retries it.
 */
import { db } from "@/db";
import { PROFILE_ID } from "@/db/schema";
import { exerciseWriteSchema, visitWriteSchema } from "./plan";
import { saveExerciseWrite, saveVisit, type WriteResponse } from "./store";

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
