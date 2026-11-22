/**
 * A review session's cards (SPEC §10.5): each due card with its current
 * content, an item card's exercise to show in the normal item UI, a vocab
 * card's entry to show as a flip card, an error card's correction with its
 * tags' explanations. Server-side: it reads the content files.
 */
import { exerciseHashes } from "@/content/hash";
import { lessonIdOfExercise } from "@/content/ids";
import { type ErrorTag, loadErrorTags, loadLesson } from "@/content/load";
import type { Item, Lesson, Step, VocabEntry } from "@/content/schema";
import { findExercise } from "@/items/engine";
import { shuffledIndexes } from "@/items/shuffle";
import type { ExplainedTag } from "./error-card";
import { type CardKind, countByKind } from "./kinds";
import type { DueCard } from "./store";
import { findVocabEntry } from "./vocab-card";

/** At most this many cards in one session. */
export const SESSION_SIZE = 20;

/** An item card as the session shows it: its exercise's current content, and what its review write sends. */
export type ItemSessionCard = {
  kind: "item";
  cardId: string;
  exerciseId: string;
  contentHash: string;
  lesson: Lesson;
  step: Step;
  /** The item to show; for a speaking exchange, the item with only that exchange. */
  item: Item;
};

/** A vocab card as the session shows it: its entry's current content, and the lesson it comes from. */
export type VocabSessionCard = { kind: "vocab"; cardId: string; lesson: Lesson; entry: VocabEntry };

/**
 * An error card as the session shows it: the wrong version, the version to
 * type, and behind *Info* the English explanation of each of its tags and the note.
 */
export type ErrorSessionCard = {
  kind: "error";
  cardId: string;
  given: string;
  expected: string;
  note: string | null;
  tags: ExplainedTag[];
};

/** A card as the session shows it. */
export type SessionCard = ItemSessionCard | VocabSessionCard | ErrorSessionCard;

/** What a review session shows: how many cards are due, in all and by kind, and the session's cards. */
export type DueSession = { total: number; counts: Record<CardKind, number>; cards: SessionCard[] };

/**
 * The due cards whose exercise or vocab entry the content still has, so a
 * card whose content was removed is neither counted nor shown. The session takes the
 * 20 most overdue (`due` comes most overdue first) and shuffles them with `random`.
 */
export function dueSession(due: readonly DueCard[], random: () => number): DueSession {
  const cards = showableCards(due);
  const session = cards.slice(0, SESSION_SIZE);
  return {
    total: cards.length,
    counts: countByKind(cards),
    cards: shuffledIndexes(session.length, random).map((index) => session[index]),
  };
}

/** The due cards with their current content, in order; cards whose content is gone are left out. */
function showableCards(due: readonly DueCard[]): SessionCard[] {
  const lessons = new Map<string, Lesson | undefined>();
  let errorTags: ReadonlyMap<string, ErrorTag> | undefined;
  const explained = (ids: readonly string[]): ExplainedTag[] => {
    errorTags ??= new Map(loadErrorTags().map((tag) => [tag.id, tag]));
    return ids.flatMap((tag) => {
      const found = errorTags!.get(tag);
      return found ? [{ id: tag, explanation: found.explanation_en }] : [];
    });
  };
  const cards: SessionCard[] = [];
  for (const card of due) {
    if (card.kind === "error") {
      const { given, expected, note, errorTags: ids } = card.correction;
      cards.push({ kind: "error", cardId: card.id, given, expected, note, tags: explained(ids) });
      continue;
    }
    const { id, kind, refId } = card;
    if (kind === "vocab") {
      const found = findVocabEntry(refId);
      if (found) cards.push({ kind, cardId: id, ...found });
      continue;
    }
    const lessonId = lessonIdOfExercise(refId);
    if (lessonId === undefined) continue;
    if (!lessons.has(lessonId)) lessons.set(lessonId, loadLesson(lessonId));
    const lesson = lessons.get(lessonId);
    const exercise = lesson && findExercise(lesson, refId);
    const step = exercise && lesson.steps.find((candidate) => candidate.items.includes(exercise.item));
    if (!lesson || !exercise || !step) continue;
    const { item, exchange } = exercise;
    cards.push({
      kind,
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
