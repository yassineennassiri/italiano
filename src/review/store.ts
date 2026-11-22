/**
 * Reading and writing review cards in Neon (SPEC §10.5), like
 * `progress/store.ts`: one batch of reads, a pure plan (`plan.ts`), one
 * batch of writes. Takes the client as a parameter.
 */
import { and, asc, eq, lte } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { exerciseHashes } from "@/content/hash";
import { lessonIdOfExercise } from "@/content/ids";
import { loadLesson } from "@/content/load";
import type { Db } from "@/db/connect";
import { errorLog, exerciseAttempt, reviewCard, reviewLog } from "@/db/schema";
import type { CardRow } from "./item-card";
import { planReview, type ReviewWrite } from "./plan";

/** What a review write did. */
export type ReviewResponse = { result: "saved" | "ignored" };

/** A due card: its id and the exercise it re-asks. */
export type DueCard = { id: string; refId: string };

/** The fields of a stored card that grading reads. */
const storedCardColumns = {
  id: reviewCard.id,
  refId: reviewCard.refId,
  intervalDays: reviewCard.intervalDays,
  ease: reviewCard.ease,
  reps: reviewCard.reps,
  lapses: reviewCard.lapses,
  streak: reviewCard.streak,
};

/** The exercise's item card, as a one-row query for a read batch. */
export const itemCard = (db: Db, userId: string, exerciseId: string) =>
  db
    .select(storedCardColumns)
    .from(reviewCard)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.kind, "item"), eq(reviewCard.refId, exerciseId)));

/** Creates the card, or regrades it when it exists: a concurrent create from the other computer keeps its id. */
export const upsertCard = (db: Db, userId: string, { id, kind, refId, ...schedule }: CardRow) =>
  db
    .insert(reviewCard)
    .values({ id, kind, refId, ...schedule, userId })
    .onConflictDoUpdate({ target: [reviewCard.userId, reviewCard.kind, reviewCard.refId], set: schedule });

/**
 * Every item card due by `now`, most overdue first. All of them: the session
 * leaves out cards whose exercise the content no longer has before it
 * counts and picks (`dueSession`). One learner has a few hundred at most.
 */
export async function loadDueCards(db: Db, userId: string, now: Date): Promise<DueCard[]> {
  return db
    .select({ id: reviewCard.id, refId: reviewCard.refId })
    .from(reviewCard)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.kind, "item"), lte(reviewCard.dueAt, now)))
    .orderBy(asc(reviewCard.dueAt), asc(reviewCard.id));
}

/**
 * Applies one review answer (SPEC §10.5): grades it against the current
 * content, reschedules the card, and writes `review_log` and a `review`
 * attempt. A third non-*again* grade in a row resolves the card's error_log
 * rows. `item_state` and the lesson % are never touched. "ignored" for an
 * unknown card, changed content, or a retry of a write already applied.
 */
export async function saveReviewWrite(db: Db, userId: string, write: ReviewWrite, now = new Date()): Promise<ReviewResponse> {
  const lessonId = lessonIdOfExercise(write.exerciseId);
  const lesson = lessonId === undefined ? undefined : loadLesson(lessonId);
  if (!lesson) return { result: "ignored" };
  const [[card], [seen]] = await db.batch([
    db
      .select(storedCardColumns)
      .from(reviewCard)
      .where(and(eq(reviewCard.userId, userId), eq(reviewCard.id, write.cardId))),
    db.select({ id: reviewLog.id }).from(reviewLog).where(eq(reviewLog.id, write.eventId)),
  ]);
  if (!card || seen) return { result: "ignored" };
  const plan = planReview({ lesson, hashes: exerciseHashes(lesson), card, write, now });
  if (!plan) return { result: "ignored" };

  const writes: BatchItem<"pg">[] = [
    db
      .update(reviewCard)
      .set(plan.card)
      .where(and(eq(reviewCard.userId, userId), eq(reviewCard.id, card.id))),
    db.insert(reviewLog).values({ ...plan.log, userId }),
    db.insert(exerciseAttempt).values({ ...plan.attempt, userId }),
  ];
  if (plan.resolves) {
    writes.push(
      db
        .update(errorLog)
        .set({ resolved: true })
        .where(and(eq(errorLog.userId, userId), eq(errorLog.itemId, card.refId), eq(errorLog.resolved, false))),
    );
  }
  await db.batch(writes as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return { result: "saved" };
}
