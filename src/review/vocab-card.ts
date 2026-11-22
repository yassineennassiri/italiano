/**
 * Vocab cards (SPEC §10.5): finishing a lesson makes one per vocab entry, and
 * the learner grades a flip card with *Ancora · Difficile · Bene · Facile*.
 * The Finish write and the review write both call it.
 */
import { parseVocabCardRef, vocabCardRef } from "@/content/ids";
import { loadLesson } from "@/content/load";
import type { Lesson, VocabEntry } from "@/content/schema";
import { dueAt } from "./day";
import { type CardRow, type GradedCard, gradeCard, gradedAt, type ReviewLogRow, type StoredCard } from "./item-card";
import type { VocabReviewWrite } from "./plan";
import { NEW_SCHEDULE } from "./sm2";

export type { VocabReviewWrite };

/**
 * A new card for each of the lesson's vocab entries, due the next day. The
 * store inserts them only where the card doesn't exist yet, so finishing
 * again keeps the cards and their schedules.
 */
export function newVocabCards(lesson: Pick<Lesson, "id" | "vocab">, now: Date, newId: () => string = () => crypto.randomUUID()): CardRow[] {
  const due = dueAt(now, 1);
  return lesson.vocab.map((entry) => ({
    id: newId(),
    kind: "vocab",
    refId: vocabCardRef(lesson.id, entry.id),
    dueAt: due,
    ...NEW_SCHEDULE,
    streak: 0,
    lastResult: null,
    updatedAt: now,
  }));
}

/** A vocab card's entry and lesson in the current content; undefined once the entry is gone. */
export function findVocabEntry(refId: string): { lesson: Lesson; entry: VocabEntry } | undefined {
  const ref = parseVocabCardRef(refId);
  const lesson = ref && loadLesson(ref.lessonId);
  const entry = lesson?.vocab.find((candidate) => candidate.id === ref!.vocabId);
  return lesson && entry && { lesson, entry };
}

/**
 * A vocab card graded by the learner: *Ancora · Difficile · Bene · Facile*
 * are *again · hard · good · easy*. It writes the card's new schedule and its
 * `review_log` row. There is no exercise behind it, so no `exercise_attempt`
 * row, and a vocab card has no error_log rows to resolve.
 */
export function planVocabReview({ card, write, now }: { card: StoredCard; write: VocabReviewWrite; now: Date }): {
  card: GradedCard;
  log: ReviewLogRow;
} {
  return gradeCard({ card, grade: write.grade, source: write.source, eventId: write.eventId, at: gradedAt(write.at, now), now });
}
