/**
 * Reading and writing review cards in Neon (SPEC §10.5), like
 * `progress/store.ts`: one batch of reads, a pure plan (`plan.ts`), one
 * batch of writes. Takes the client as a parameter.
 */
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { exerciseHashes } from "@/content/hash";
import { lessonIdOfExercise } from "@/content/ids";
import { loadErrorTags, loadLesson } from "@/content/load";
import type { Lesson } from "@/content/schema";
import type { Db } from "@/db/connect";
import { errorLog, exerciseAttempt, lessonProgress, profile, reviewCard, reviewLog } from "@/db/schema";
import { type ErrorCardFields, getsErrorCard, type NewCorrectionWrite, planErrorReview, planNewCorrection } from "./error-card";
import type { CardKind } from "./kinds";
import type { CardRow, GradedCard, ReviewLogRow, StoredCard } from "./item-card";
import { type DrillWrite, type ErrorReviewWrite, type ItemReviewWrite, planDrill, planReview, type ReviewWrite, type VocabReviewWrite } from "./plan";
import { chooseReviewItems, CLOCK_SKEW_MS, injectsReview } from "./ripasso";
import { RECENT_DAYS, type TopTag, topErrorTags } from "./top-tags";
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

/** The fields of an error card's row a review and a session read (`ErrorCardFields`). */
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
    const row = source && { source, given, expected };
    if (!row || !getsErrorCard(row)) return [];
    return [{ id, kind, refId, correction: { given: row.given, expected: row.expected, errorTags: errorTags ?? [], note } }];
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
  const writes = reviewWrites(db, userId, card, write, now);
  if (!writes) return { result: "ignored" };
  await db.batch(writes);
  return { result: "saved" };
}

/** A non-empty batch of writes. */
type Writes = [BatchItem<"pg">, ...BatchItem<"pg">[]];
/** A stored card with its kind, which decides how a review write applies to it, and an error card's row. */
type CardWithKind = StoredCard & { kind: CardKind; errorRow: ErrorCardFields | null };

/** The writes for a review answer, by the kind of answer; undefined when it doesn't fit the card. */
function reviewWrites(db: Db, userId: string, card: CardWithKind, write: ReviewWrite, now: Date): Writes | undefined {
  switch (write.kind) {
    case "grade":
      return vocabReviewWrites(db, userId, card, write, now);
    case "rewrite":
      return errorReviewWrites(db, userId, card, write, now);
    default:
      return itemReviewWrites(db, userId, card, write, now);
  }
}

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
  const plan = planErrorReview({ card, row, write, now });
  const writes = gradedWrites(db, userId, plan);
  if (plan.resolves) {
    writes.push(
      db
        .update(errorLog)
        .set({ resolved: true })
        .where(and(eq(errorLog.userId, userId), eq(errorLog.id, card.refId), eq(errorLog.resolved, false))),
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
  if (plan.resolves) writes.push(resolveItemErrors(db, userId, card.refId));
  return writes;
}

/**
 * *I miei errori più frequenti* (SPEC §10.5): the top 5 error tags by
 * unresolved error_log rows from the last 30 days, so a tag drops off as the
 * learner fixes it.
 */
export async function loadTopErrorTags(db: Db, userId: string, now: Date): Promise<TopTag[]> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const rows = await db
    .select({ errorTags: errorLog.errorTags })
    .from(errorLog)
    .where(and(eq(errorLog.userId, userId), eq(errorLog.resolved, false), gte(errorLog.createdAt, since)));
  return topErrorTags(rows, loadErrorTags());
}

/** The exercises that have an item card, which a tag drill prefers. */
export async function loadItemCardRefs(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ refId: reviewCard.refId })
    .from(reviewCard)
    .where(and(eq(reviewCard.userId, userId), eq(reviewCard.kind, "item")));
  return new Set(rows.map((row) => row.refId));
}

/**
 * One answer in a tag drill (SPEC §10.5), graded like a review against the
 * current content. With an item card, the card is rescheduled and logged
 * with source `drill`, and a third non-*again* grade in a row resolves its
 * error_log rows; without one, no card is made. Either way a `review` attempt
 * is written; `item_state` and the lesson % are never touched, and no
 * error_log row is added. "ignored" for an exercise the content doesn't
 * have, changed content, or a retry of a write already applied.
 */
export async function saveDrillWrite(db: Db, userId: string, write: DrillWrite, now = new Date()): Promise<ReviewResponse> {
  const lessonId = lessonIdOfExercise(write.exerciseId);
  const lesson = lessonId === undefined ? undefined : loadLesson(lessonId);
  if (!lesson) return { result: "ignored" };
  const [[card], [seen]] = await db.batch([
    itemCard(db, userId, write.exerciseId),
    db.select({ id: exerciseAttempt.id }).from(exerciseAttempt).where(eq(exerciseAttempt.id, write.eventId)),
  ]);
  const plan = seen ? undefined : planDrill({ lesson, hashes: exerciseHashes(lesson), card, write, now });
  if (!plan) return { result: "ignored" };
  const writes: Writes = [db.insert(exerciseAttempt).values({ ...plan.attempt, userId })];
  if (plan.card && plan.log) writes.push(...gradedWrites(db, userId, { card: plan.card, log: plan.log }));
  if (plan.resolves) writes.push(resolveItemErrors(db, userId, write.exerciseId));
  await db.batch(writes);
  return { result: "saved" };
}

/** Marks the exercise's unresolved error_log rows resolved: its card's third non-*again* grade in a row (§10.4). */
const resolveItemErrors = (db: Db, userId: string, exerciseId: string) =>
  db
    .update(errorLog)
    .set({ resolved: true })
    .where(and(eq(errorLog.userId, userId), eq(errorLog.itemId, exerciseId), eq(errorLog.resolved, false)));

/** A visit's Ripasso personale step: its exercise ids (empty for no step) and when they were chosen. */
export type RipassoChoice = { items: string[]; chosenAt: Date | null };

const NO_RIPASSO: RipassoChoice = { items: [], chosenAt: null };

/** The stored choice, and whether `inject_review` lets the step show at all. */
async function readRipasso(db: Db, userId: string, lessonId: string) {
  const [[owner], [stored]] = await db.batch([
    db.select({ settings: profile.settings }).from(profile).where(eq(profile.id, userId)),
    db
      .select({ items: lessonProgress.reviewItems, chosenAt: lessonProgress.reviewChosenAt })
      .from(lessonProgress)
      .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))),
  ]);
  return { on: injectsReview(owner?.settings), stored: stored?.items ? { items: stored.items, chosenAt: stored.chosenAt } : undefined };
}

/**
 * The visit's Ripasso personale step as stored, without ever choosing one:
 * for the Results page, where a reload after Finish has cleared the choice
 * must not start a new visit.
 */
export async function loadStoredRipasso(db: Db, userId: string, lessonId: string): Promise<RipassoChoice> {
  const { on, stored } = await readRipasso(db, userId, lessonId);
  return on && stored ? stored : NO_RIPASSO;
}

/**
 * The lesson's Ripasso personale step (SPEC §10.5, ADR-0005): the stored
 * choice, or on the first visit up to 3 due item cards chosen now and stored
 * in `lesson_progress.review_items`, empty when none is due. The choice then
 * stays until Finish or Azzera clears it, so the step count is the same on
 * every reload and both computers: when both choose at once, the first
 * stored choice wins. With `inject_review` off there is no step and nothing
 * is chosen. An existing row's `updated_at` is left alone (choosing is not
 * playing); a lesson never opened gets its row here, as its first step visit would.
 */
export async function loadRipassoChoice(db: Db, userId: string, lesson: Lesson, now: Date): Promise<RipassoChoice> {
  const { on, stored } = await readRipasso(db, userId, lesson.id);
  if (!on) return NO_RIPASSO;
  if (stored) return stored;

  const items = chooseReviewItems({ lesson, due: await loadDueCards(db, userId, now), load: loadLesson });
  const chosenNow = sql`${lessonProgress.reviewItems} is null`;
  const [row] = await db
    .insert(lessonProgress)
    .values({ userId, lessonId: lesson.id, contentVersion: lesson.version, reviewItems: items, reviewChosenAt: now })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        reviewItems: sql`case when ${chosenNow} then excluded.review_items else ${lessonProgress.reviewItems} end`,
        reviewChosenAt: sql`case when ${chosenNow} then excluded.review_chosen_at else ${lessonProgress.reviewChosenAt} end`,
      },
    })
    .returning({ items: lessonProgress.reviewItems, chosenAt: lessonProgress.reviewChosenAt });
  return { items: row.items ?? items, chosenAt: row.chosenAt };
}

/** An exercise of the step: its item card, and the first answer given to it in this visit, if any. */
export type RipassoExerciseRow = { exerciseId: string; cardId: string; answer?: { answer: unknown; correct: boolean | null } };

/**
 * The step's exercises in the chosen order, each with its item card and its
 * first answer since the choice: a `review` attempt whose review_log row has
 * source `ripasso_personale`. Exercises without a card are left out.
 */
export async function loadRipassoCards(db: Db, userId: string, choice: RipassoChoice): Promise<RipassoExerciseRow[]> {
  if (choice.items.length === 0) return [];
  const since = new Date((choice.chosenAt ?? new Date(0)).getTime() - CLOCK_SKEW_MS);
  const [cards, answers] = await db.batch([
    db
      .select({ id: reviewCard.id, refId: reviewCard.refId })
      .from(reviewCard)
      .where(and(eq(reviewCard.userId, userId), eq(reviewCard.kind, "item"), inArray(reviewCard.refId, choice.items))),
    db
      .select({ itemId: exerciseAttempt.itemId, answer: exerciseAttempt.answer, correct: exerciseAttempt.correct })
      .from(exerciseAttempt)
      .innerJoin(reviewLog, eq(reviewLog.id, exerciseAttempt.id))
      .where(
        and(
          eq(exerciseAttempt.userId, userId),
          eq(exerciseAttempt.action, "review"),
          inArray(exerciseAttempt.itemId, choice.items),
          eq(reviewLog.source, "ripasso_personale"),
          gte(exerciseAttempt.createdAt, since),
        ),
      )
      .orderBy(asc(exerciseAttempt.createdAt)),
  ]);
  const cardIds = new Map(cards.map((card) => [card.refId, card.id]));
  const firstAnswers = new Map<string, RipassoExerciseRow["answer"]>();
  for (const { itemId, answer, correct } of answers) if (!firstAnswers.has(itemId)) firstAnswers.set(itemId, { answer, correct });
  return choice.items.flatMap((exerciseId) => {
    const cardId = cardIds.get(exerciseId);
    if (cardId === undefined) return [];
    const answer = firstAnswers.get(exerciseId);
    return [answer ? { exerciseId, cardId, answer } : { exerciseId, cardId }];
  });
}
