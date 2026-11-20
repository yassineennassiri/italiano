"use server";
/**
 * The progress Server Actions the client's write queue calls (SPEC §8). Input
 * is validated here, since a Server Action is reachable by any POST. A database
 * error throws, so the queue keeps the write and retries it.
 */
import { z } from "zod";
import { db } from "@/db";
import { PROFILE_ID } from "@/db/schema";
import { saveExerciseWrite, saveVisit } from "./store";

const exerciseWriteSchema = z.intersection(
  z.object({ eventId: z.uuid(), lessonId: z.string().min(1), exerciseId: z.string().min(1) }),
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("pick"), option: z.number().int().nonnegative() }),
    z.object({ kind: z.literal("solve") }),
  ]),
);

const visitSchema = z.strictObject({
  lessonId: z.string().min(1),
  location: z.string().regex(/^esercizi\/\d+$/),
});

/** "rejected" for malformed input: the queue drops it rather than retrying forever. */
export type WriteResult = "saved" | "ignored" | "rejected";

export async function recordExercise(input: unknown): Promise<WriteResult> {
  const parsed = exerciseWriteSchema.safeParse(input);
  if (!parsed.success) return "rejected";
  return saveExerciseWrite(db(), PROFILE_ID, parsed.data);
}

export async function recordVisit(input: unknown): Promise<WriteResult> {
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) return "rejected";
  return saveVisit(db(), PROFILE_ID, parsed.data);
}
