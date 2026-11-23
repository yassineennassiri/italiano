/**
 * Feedback notes in the database (SPEC §10.6): saving a note, ticking
 * *Fatto*, and reading the open ones.
 */
import { and, asc, eq } from "drizzle-orm";
import { loadLesson } from "@/content/load";
import type { Db } from "@/db/connect";
import { feedbackNote } from "@/db/schema";
import type { WriteResponse } from "@/progress/store";
import { gradedAt } from "@/review/item-card";
import type { FeedbackDoneWrite, FeedbackWrite, OpenNote } from "./notes";

/**
 * Saves a new note, dated when I wrote it (never later than now). "ignored"
 * for a retry of a note already saved, or a lesson note on a lesson that
 * doesn't exist.
 */
export async function saveFeedbackNote(db: Db, userId: string, write: FeedbackWrite, now = new Date()): Promise<WriteResponse> {
  if (write.scope === "lesson" && !loadLesson(write.refId.split("/")[0])) return { result: "ignored" };
  const inserted = await db
    .insert(feedbackNote)
    .values({ id: write.eventId, userId, scope: write.scope, refId: write.refId, text: write.text, createdAt: gradedAt(write.at, now) })
    .onConflictDoNothing({ target: feedbackNote.id })
    .returning({ id: feedbackNote.id });
  return { result: inserted.length > 0 ? "saved" : "ignored" };
}

/** *Fatto* ticked or unticked; "ignored" for a note that isn't this profile's. */
export async function saveFeedbackDone(db: Db, userId: string, write: FeedbackDoneWrite): Promise<WriteResponse> {
  const updated = await db
    .update(feedbackNote)
    .set({ done: write.done })
    .where(and(eq(feedbackNote.userId, userId), eq(feedbackNote.id, write.noteId)))
    .returning({ id: feedbackNote.id });
  return { result: updated.length > 0 ? "saved" : "ignored" };
}

/** The notes not marked *Fatto*, oldest first. */
export async function loadOpenNotes(db: Db, userId: string): Promise<OpenNote[]> {
  return db
    .select({ id: feedbackNote.id, scope: feedbackNote.scope, refId: feedbackNote.refId, text: feedbackNote.text, createdAt: feedbackNote.createdAt })
    .from(feedbackNote)
    .where(and(eq(feedbackNote.userId, userId), eq(feedbackNote.done, false)))
    .orderBy(asc(feedbackNote.createdAt), asc(feedbackNote.id));
}
