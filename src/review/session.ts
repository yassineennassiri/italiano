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
import type { DueCard } from "./store";

/** At most this many cards in one session. */
export const SESSION_SIZE = 20;

/** A card as the session shows it: its exercise's current content, and what its review write sends. */
export type SessionCard = {
  cardId: string;
  exerciseId: string;
  contentHash: string;
  lesson: Lesson;
  step: Step;
  /** The item to show; for a speaking exchange, the item with only that exchange. */
  item: Item;
};

/** What a review session shows: how many cards are due, and the session's cards. */
export type DueSession = { total: number; cards: SessionCard[] };

/**
 * The due cards whose exercise the content still has, so a card whose
 * exercise was removed is neither counted nor shown. The session takes the
 * 20 most overdue (`due` comes most overdue first) and shuffles them with `random`.
 */
export function dueSession(due: readonly DueCard[], random: () => number): DueSession {
  const cards = showableCards(due);
  const session = cards.slice(0, SESSION_SIZE);
  return { total: cards.length, cards: shuffledIndexes(session.length, random).map((index) => session[index]) };
}

/** The due cards with their exercise's current content, in order; cards whose exercise is gone are left out. */
function showableCards(due: readonly DueCard[]): SessionCard[] {
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
  return cards;
}
