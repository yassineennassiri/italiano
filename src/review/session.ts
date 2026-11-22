/**
 * A review session's cards (SPEC §10.5): each due item card with the current
 * content of its exercise, so the session shows it in the normal item UI.
 * Server-side: it reads the content files.
 */
import { exerciseHashes } from "@/content/hash";
import { lessonIdOfExercise } from "@/content/ids";
import { loadLesson } from "@/content/load";
import type { Item, Lesson, Step } from "@/content/schema";
import { findExercise } from "@/items/engine";
import { shuffledIndexes } from "@/items/shuffle";

/** At most this many cards in one session. */
export const SESSION_SIZE = 20;

export type SessionCard = {
  cardId: string;
  exerciseId: string;
  contentHash: string;
  lesson: Lesson;
  step: Step;
  /** The item to show; for a speaking exchange, the item with only that exchange. */
  item: Item;
};

/**
 * The due cards whose exercise the content still has, shuffled with `random`.
 * A card whose exercise was removed from the content is left out.
 */
export function sessionCards(due: readonly { id: string; refId: string }[], random: () => number): SessionCard[] {
  const lessons = new Map<string, Lesson | undefined>();
  const cards: SessionCard[] = [];
  for (const { id, refId } of due) {
    const lessonId = lessonIdOfExercise(refId);
    if (lessonId === undefined) continue;
    if (!lessons.has(lessonId)) lessons.set(lessonId, loadLesson(lessonId));
    const lesson = lessons.get(lessonId);
    const exercise = lesson && findExercise(lesson, refId);
    const step = exercise && lesson.steps.find((candidate) => candidate.items.includes(exercise.item));
    if (!lesson || !exercise || !step) continue;
    const { item, exchange } = exercise;
    cards.push({
      cardId: id,
      exerciseId: refId,
      contentHash: exerciseHashes(lesson).get(refId)!,
      lesson,
      step,
      item: exchange && item.type === "speak_rate" ? { ...item, exchanges: [exchange] } : item,
    });
  }
  return shuffledIndexes(cards.length, random).map((index) => cards[index]);
}
