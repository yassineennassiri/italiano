import { describe, expect, it } from "vitest";
import { exerciseHashes } from "@/content/hash";
import { loadLesson } from "@/content/load";
import { copyContent, editJson, LESSON_FILE } from "@/content/test-content";
import { type ItemReviewWrite, planReview, reviewWriteSchema } from "./plan";

const NOW = new Date("2026-11-21T08:00:00Z");
const AT = "2026-11-21T07:59:00.000Z";
const I02 = "a2.u01.l01.s01.i02";
const TEXT_GAP = "a2.u01.l01.s03.i01";
const E2 = "a2.u01.l01.s05.i01.e2";
const CARD_ID = "0b6a3f9e-5c1d-4e2a-8f7b-3c9d1e2f4a5b";

/** The example lesson, s01.i02 solvable and s03.i01's first gap expecting "è". */
function lesson() {
  const dir = copyContent();
  editJson(dir, LESSON_FILE, (content) => {
    content.steps[0].items[1].solvable = true;
    content.steps[2].items[0].gaps[0].answer = "è";
  });
  const loaded = loadLesson("a2.u01.l01", dir)!;
  return { lesson: loaded, hashes: exerciseHashes(loaded) };
}

/** A card just made by a mistake: due today, never reviewed. */
const card = (refId: string, fields = {}) => ({ id: CARD_ID, refId, intervalDays: 1, ease: 2.5, reps: 0, lapses: 0, streak: 0, ...fields });

function review(refId: string, action: Record<string, unknown>, fields = {}) {
  const { lesson: content, hashes } = lesson();
  const write = { eventId: "evt-1", cardId: CARD_ID, exerciseId: refId, contentHash: hashes.get(refId)!, at: AT, source: "hub", ...action } as ItemReviewWrite;
  return planReview({ lesson: content, hashes, card: card(refId, fields), write, now: NOW });
}

describe("planReview (SPEC §10.5, ADR-0004)", () => {
  it("grades a right answer good, reschedules the card, and logs the review and a review attempt", () => {
    const plan = review(I02, { kind: "pick", option: 0 })!;
    expect(plan.grade).toBe("good");
    expect(plan.card).toMatchObject({ id: CARD_ID, intervalDays: 1, reps: 1, streak: 1, lastResult: "good", dueAt: new Date("2026-11-21T23:00:00Z") });
    expect(plan.log).toEqual({
      id: "evt-1",
      cardId: CARD_ID,
      grade: "good",
      intervalBefore: 1,
      intervalAfter: 1,
      easeBefore: 2.5,
      easeAfter: 2.5,
      source: "hub",
      createdAt: new Date(AT),
    });
    expect(plan.attempt).toMatchObject({ itemId: I02, lessonId: "a2.u01.l01", action: "review", answer: { picks: [0] }, correct: true });
    expect(plan.resolves).toBe(false);
  });

  it("grades a wrong answer and Soluzione again", () => {
    expect(review(I02, { kind: "pick", option: 2 })!.grade).toBe("again");
    expect(review(I02, { kind: "solve" })!).toMatchObject({ grade: "again", card: { lapses: 1, streak: 0 } });
  });

  it("grades an accent-only miss hard, and a miss that is also wrong elsewhere again", () => {
    const values = { g1: "e", g2: "gli", g3: "gli", g4: "le", g5: "gli" };
    expect(review(TEXT_GAP, { kind: "check", answer: { values } })!.grade).toBe("hard");
    expect(review(TEXT_GAP, { kind: "check", answer: { values: { ...values, g2: "lo" } } })!.grade).toBe("again");
  });

  it("maps Bene / Non tanto bene on a speaking exchange to good / again", () => {
    expect(review(E2, { kind: "rate", rating: "good" })!.grade).toBe("good");
    expect(review(E2, { kind: "rate", rating: "not_great" })!.grade).toBe("again");
  });

  it("resolves the card's errors on the third non-again grade in a row, not before, and not after a lapse", () => {
    expect(review(I02, { kind: "pick", option: 0 }, { streak: 1 })!.resolves).toBe(false);
    expect(review(I02, { kind: "pick", option: 0 }, { streak: 2 })!).toMatchObject({ resolves: true, card: { streak: 3 } });
    expect(review(I02, { kind: "pick", option: 2 }, { streak: 2 })!).toMatchObject({ resolves: false, card: { streak: 0 } });
  });

  it("schedules an answer synced late from when it was given", () => {
    // Answered offline at 09:00 in Genoa on 19 November, synced on 21 November.
    const plan = review(I02, { kind: "pick", option: 0, at: "2026-11-19T08:00:00.000Z" })!;
    expect(plan.card.dueAt).toEqual(new Date("2026-11-19T23:00:00Z"));
    expect(plan.log.createdAt).toEqual(new Date("2026-11-19T08:00:00.000Z"));
  });

  it("plans nothing for content that changed since, another exercise, or an action that does nothing", () => {
    expect(review(I02, { kind: "pick", option: 0, contentHash: "stale" })).toBeUndefined();
    expect(review(I02, { kind: "pick", option: 0, exerciseId: TEXT_GAP })).toBeUndefined();
    expect(review(E2, { kind: "solve" })).toBeUndefined();
  });

  it("accepts a review write from the client, and rejects one without a card", () => {
    const write = { eventId: "6f1c2a4e-0b7d-4c3e-9a51-2d8e7f4b1c90", cardId: CARD_ID, exerciseId: I02, contentHash: "h", at: AT, source: "hub", kind: "pick", option: 0 };
    expect(reviewWriteSchema.safeParse(write).success).toBe(true);
    expect(reviewWriteSchema.safeParse({ ...write, cardId: undefined }).success).toBe(false);
  });
});
