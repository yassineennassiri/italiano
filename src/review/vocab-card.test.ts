import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { reviewWriteSchema, type VocabReviewWrite } from "./plan";
import { newVocabCards, planVocabReview } from "./vocab-card";

/** 11:00 in Genoa on 20 November; the next day starts at 23:00 UTC. */
const NOW = new Date("2026-11-20T10:00:00.000Z");
const TOMORROW = new Date("2026-11-20T23:00:00.000Z");

describe("newVocabCards (finishing a lesson, SPEC §10.5)", () => {
  const lesson = loadLesson("a2.u01.l01")!;

  it("makes one new card per vocab entry, named by lesson and vocab id, due the next day", () => {
    let next = 0;
    const cards = newVocabCards(lesson, NOW, NOW, () => `card-${next++}`);
    expect(cards).toHaveLength(lesson.vocab.length);
    expect(cards.map((card) => card.refId)).toContain("a2.u01.l01.v-ombrello");
    expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
    for (const card of cards) {
      expect(card).toMatchObject({ kind: "vocab", dueAt: TOMORROW, intervalDays: 1, ease: 2.5, reps: 0, lapses: 0, streak: 0, lastResult: null });
    }
  });
});

describe("planVocabReview (the flip card's four buttons, SPEC §10.5)", () => {
  const CARD_ID = "0b6a3f9e-5c1d-4e2a-8f7b-3c9d1e2f4a5b";
  const AT = "2026-11-21T07:59:00.000Z";
  const LATER = new Date("2026-11-21T08:00:00.000Z");
  /** A card graded good once: its next good is 6 days. */
  const card = { id: CARD_ID, refId: "a2.u01.l01.v-ombrello", intervalDays: 1, ease: 2.5, reps: 1, lapses: 0, streak: 1 };
  const write = (grade: string) =>
    reviewWriteSchema.parse({ eventId: "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f", cardId: CARD_ID, at: AT, source: "hub", kind: "grade", grade }) as VocabReviewWrite;

  it("Bene grades good: the card is rescheduled with SM-2 and the review logged", () => {
    const plan = planVocabReview({ card, write: write("good"), now: LATER });
    expect(plan.card).toMatchObject({ id: CARD_ID, intervalDays: 6, reps: 2, streak: 2, lastResult: "good", dueAt: new Date("2026-11-26T23:00:00Z") });
    expect(plan.log).toMatchObject({ id: "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f", cardId: CARD_ID, grade: "good", intervalBefore: 1, intervalAfter: 6, source: "hub", createdAt: new Date(AT) });
  });

  it("Ancora grades again: due tomorrow, a lapse, the streak back to 0", () => {
    const plan = planVocabReview({ card, write: write("again"), now: LATER });
    expect(plan.card).toMatchObject({ intervalDays: 1, reps: 0, lapses: 1, streak: 0, lastResult: "again", dueAt: new Date("2026-11-21T23:00:00Z") });
  });

  it("Difficile and Facile grade hard and easy", () => {
    expect(planVocabReview({ card, write: write("hard"), now: LATER }).card).toMatchObject({ lastResult: "hard", intervalDays: 1.2, ease: 2.35 });
    expect(planVocabReview({ card, write: write("easy"), now: LATER }).card).toMatchObject({ lastResult: "easy", intervalDays: 7.8, ease: 2.65 });
  });

  it("the write accepts only the four grades", () => {
    expect(() => write("perfect")).toThrow();
  });
});
