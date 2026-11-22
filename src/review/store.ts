/**
 * Reading and writing review cards in Neon (SPEC §10.5), like
 * `progress/store.ts`: one batch of reads, a pure plan (`plan.ts`), one
 * batch of writes. Takes the client as a parameter.
 */
import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { exerciseHashes } from "@/content/hash";
import { lessonIdOfExercise } from "@/content/ids";
import { loadErrorTags, loadLesson } from "@/content/load";
import type { Db } from "@/db/connect";
import { errorLog, exerciseAttempt, reviewCard, reviewLog } from "@/db/schema";
import { getsErrorCard, type NewCorrectionWrite, planErrorReview, planNewCorrection } from "./error-card";
import type { CardKind } from "./kinds";
import type { CardRow, GradedCard, ReviewLogRow, StoredCard } from "./item-card";
import { type ErrorReviewWrite, type ItemReviewWrite, planReview, type ReviewWrite, type VocabReviewWrite } from "./plan";
import { findVocabEntry, planVocabReview } from "./vocab-card";

/** What a review write did. */
export type ReviewResponse = { result: "saved" | "ignored" };

/** A correction as an error card shows it: its error_log row's texts, tags and note. */
export type Correction = { given: string; expected: string; errorTags: string[]; note: string | null };

/**
 * A due card: its id, kind, and the exercise or vocab entry it asks, or for
 * an error card its error_log row's id and the correction, which lives in the
 * database rather than the content files.
 */
export type DueCard = { id: string; kind: "vocab" | "item"; refId: string } | { id: string; kind: "error"; refId: string; correction: Correction };

/** An error card's error_log row, joined on `ref_id`; the user matches too, so no other profile's row is ever read. */
const errorRowOfCard = and(
  eq(reviewCard.kind, "error"),
  eq(errorLog.userId, reviewCard.userId),
  sql`${errorLog.id}::text = ${reviewCard.refId}`,
);

/** The fields of an error card's row a review and a session read. */
const errorRowColumns = { source: errorLog.source, given: errorLog.given, expected: errorLog.expected };

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

/** Inserts the cards that don't exist yet; an existing card (same kind and ref) keeps its id and schedule. */
export const insertNewCards = (db: Db, userId: string, cards: readonly CardRow[]) =>
  db
    .insert(reviewCard)
    .values(cards.map((card) => ({ ...card, userId })))
    .onConflictDoNothing({ target: [reviewCard.userId, reviewCard.kind, reviewCard.refId] });

/**
 * Every card due by `now`, most overdue first. All of them: the session
 * leaves out cards whose content is gone before it counts and picks
 * (`dueSession`). One learner has a few hundred at most. An error card comes
 * with its correction, and only while its row has both texts (§10.5).
 */
export async function loadDueCards(db: Db, userId: string, now: Date): Promise<DueCard[]> {
  const rows = await db
    .select({ id: reviewCard.id, kind: reviewCard.kind, refId: reviewCard.refId, ...errorRowColumns, errorTags: errorLog.errorTags, note: errorLog.note })
    .from(reviewCard)
    .leftJoin(errorLog, errorRowOfCard)
    .where(and(eq(reviewCard.userId, userId), lte(reviewCard.dueAt, now)))
    .orderBy(asc(reviewCard.dueAt), asc(reviewCard.id));
  return rows.flatMap(({ id, kind, refId, source, given, expected, errorTags, note }): DueCard[] => {
    if (kind !== "error") return [{ id, kind, refId }];
    if (!source || !getsErrorCard({ source, given, expected })) return [];
    return [{ id, kind, refId, correction: { given: given!, expected: expected!, errorTags: errorTags ?? [], note } }];
  });
}

/**
 * *Aggiungi una correzione* (SPEC §10.5): a manual error_log row with its
 * tags and its error card, due tomorrow. "ignored" for a retry of a write
 * already applied, or a tag `error-tags.json` doesn't have.
 */
export async function saveNewCorrection(db: Db, userId: string, write: NewCorrectionWrite, now = new Date()): Promise<ReviewResponse> {
  const [seen] = await db.select({ id: errorLog.id }).from(errorLog).where(eq(errorLog.id, write.eventId));
  const knownTags = new Set(loadErrorTags().map((tag) => tag.id));
  const plan = seen ? undefined : planNewCorrection({ write, knownTags, now });
  if (!plan) return { result: "ignored" };
  await db.batch([
    db
      .insert(errorLog)
      .values({ ...plan.errorRow, userId })
      .onConflictDoNothing({ target: errorLog.id }),
    insertNewCards(db, userId, [plan.card]),
  ]);
  return { result: "saved" };
}

/**
 * Applies one review answer (SPEC §10.5). An item card's answer is graded
 * against the current content and also writes a `review` attempt; a third
 * non-*again* grade in a row resolves the card's error_log rows. A vocab
 * card's grade is the learner's. Either way the card is rescheduled and the
 * review logged; `item_state` and the lesson % are never touched. "ignored"
 * for an unknown card, a write for the other kind of card, changed or
 * removed content, or a retry of a write already applied.
 */
export async function saveReviewWrite(db: Db, userId: string, write: ReviewWrite, now = new Date()): Promise<ReviewResponse> {
  const [[card], [seen]] = await db.batch([
    db
      .select({ ...storedCardColumns, kind: reviewCard.kind, errorRow: errorRowColumns })
      .from(reviewCard)
      .leftJoin(errorLog, errorRowOfCard)
      .where(and(eq(reviewCard.userId, userId), eq(reviewCard.id, write.cardId))),
    db.select({ id: reviewLog.id }).from(reviewLog).where(eq(reviewLog.id, write.eventId)),
  ]);
  if (!card || seen) return { result: "ignored" };
  const writes =
    write.kind === "grade"
      ? vocabReviewWrites(db, userId, card, write, now)
      : write.kind === "rewrite"
        ? errorReviewWrites(db, userId, card, write, now)
        : itemReviewWrites(db, userId, card, write, now);
  if (!writes) return { result: "ignored" };
  await db.batch(writes);
  return { result: "saved" };
}

/** A non-empty batch of writes. */
type Writes = [BatchItem<"pg">, ...BatchItem<"pg">[]];
/** A stored card with its kind, which decides how a review write applies to it, and an error card's row. */
type CardWithKind = StoredCard & {
  kind: CardKind;
  errorRow: { source: (typeof errorLog.$inferSelect)["source"]; given: string | null; expected: string | null } | null;
};

/** The card's new schedule and its review_log row. */
const gradedWrites = (db: Db, userId: string, graded: { card: GradedCard; log: ReviewLogRow }): Writes => [
  db
    .update(reviewCard)
    .set(graded.card)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.id, graded.card.id))),
  db.insert(reviewLog).values({ ...graded.log, userId }),
];

function vocabReviewWrites(db: Db, userId: string, card: CardWithKind, write: VocabReviewWrite, now: Date): Writes | undefined {
  if (card.kind !== "vocab" || !findVocabEntry(card.refId)) return undefined;
  return gradedWrites(db, userId, planVocabReview({ card, write, now }));
}

function errorReviewWrites(db: Db, userId: string, card: CardWithKind, write: ErrorReviewWrite, now: Date): Writes | undefined {
  const row = card.errorRow;
  if (card.kind !== "error" || !row || !getsErrorCard(row)) return undefined;
  const plan = planErrorReview({ card, row: { expected: row.expected! }, write, now });
  const writes = gradedWrites(db, userId, plan);
  if (plan.resolves) {
    writes.push(
      db
        .update(errorLog)
        .set({ resolved: true })
        .where(and(eq(errorLog.userId, userId), sql`${errorLog.id}::text = ${card.refId}`, eq(errorLog.resolved, false))),
    );
  }
  return writes;
}

function itemReviewWrites(db: Db, userId: string, card: CardWithKind, write: ItemReviewWrite, now: Date): Writes | undefined {
  const lessonId = lessonIdOfExercise(write.exerciseId);
  const lesson = lessonId === undefined ? undefined : loadLesson(lessonId);
  if (card.kind !== "item" || !lesson) return undefined;
  const plan = planReview({ lesson, hashes: exerciseHashes(lesson), card, write, now });
  if (!plan) return undefined;
  const writes = gradedWrites(db, userId, plan);
  writes.push(db.insert(exerciseAttempt).values({ ...plan.attempt, userId }));
  if (plan.resolves) {
    writes.push(
      db
        .update(errorLog)
        .set({ resolved: true })
        .where(and(eq(errorLog.userId, userId), eq(errorLog.itemId, card.refId), eq(errorLog.resolved, false))),
    );
  }
  return writes;
}
