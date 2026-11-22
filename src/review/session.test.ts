import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { lessonExercises } from "@/scoring/lesson";
import { dueSession, SESSION_SIZE } from "./session";

/** Every exercise of lessons 1 and 2 as a due card, in order. */
const due = ["a2.u01.l01", "a2.u01.l02"].flatMap((id) =>
  lessonExercises(loadLesson(id)!).map(({ id: refId }, index) => ({ id: `${id}-card-${index}`, refId })),
);

describe("dueSession", () => {
  it("leaves out cards whose exercise the content no longer has, in the count and in the session", () => {
    const gone = { id: "gone", refId: "a2.u01.l01.s99.i01" };
    const session = dueSession([gone, ...due.slice(0, 2)], Math.random);
    expect(session.total).toBe(2);
    expect(session.cards.map((card) => card.cardId).sort()).toEqual([due[0].id, due[1].id].sort());
  });

  it("takes the 20 most overdue cards, shuffled, and counts every due one", () => {
    expect(due.length).toBeGreaterThan(SESSION_SIZE);
    const session = dueSession(due, () => 0);
    expect(session.total).toBe(due.length);
    expect(session.cards.map((card) => card.cardId).sort()).toEqual(due.slice(0, SESSION_SIZE).map((card) => card.id).sort());
    expect(session.cards.map((card) => card.cardId)).not.toEqual(due.slice(0, SESSION_SIZE).map((card) => card.id));
  });

  it("shows a speaking exchange's card with that exchange only", () => {
    const exchange = due.find((card) => card.refId.endsWith(".e2"))!;
    const [card] = dueSession([exchange], Math.random).cards;
    expect(card.item.type === "speak_rate" && card.item.exchanges.map((one) => one.id)).toEqual(["e2"]);
  });
});
