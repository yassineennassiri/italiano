import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { lessonExercises } from "@/scoring/lesson";
import { dueSession, SESSION_SIZE } from "./session";

/** Every exercise of lessons 1 and 2 as a due card, in order. */
const due = ["a2.u01.l01", "a2.u01.l02"].flatMap((id) =>
  lessonExercises(loadLesson(id)!).map(({ id: refId }, index) => ({ id: `${id}-card-${index}`, kind: "item" as const, refId })),
);

/** Lesson 1's vocab entries as due cards. */
const vocab = loadLesson("a2.u01.l01")!.vocab.map((entry, index) => ({ id: `vocab-${index}`, kind: "vocab" as const, refId: `a2.u01.l01.${entry.id}` }));

describe("dueSession", () => {
  it("leaves out cards whose exercise the content no longer has, in the count and in the session", () => {
    const gone = { id: "gone", kind: "item" as const, refId: "a2.u01.l01.s99.i01" };
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
    expect(card.kind === "item" && card.item.type === "speak_rate" && card.item.exchanges.map((one) => one.id)).toEqual(["e2"]);
  });
});

describe("dueSession with vocab cards", () => {
  it("mixes vocab and item cards, and counts the due cards by kind", () => {
    const session = dueSession([...vocab.slice(0, 3), ...due.slice(0, 2)], Math.random);
    expect(session.total).toBe(5);
    expect(session.counts).toEqual({ vocab: 3, item: 2, error: 0 });
    expect(session.cards.map((card) => card.kind).sort()).toEqual(["item", "item", "vocab", "vocab", "vocab"]);
  });

  it("shows a vocab card with its entry and lesson, and leaves out a card whose entry is gone", () => {
    const gone = { id: "gone", kind: "vocab" as const, refId: "a2.u01.l01.v-nonesiste" };
    const session = dueSession([gone, vocab[0]], Math.random);
    expect(session.counts).toEqual({ vocab: 1, item: 0, error: 0 });
    const [card] = session.cards;
    expect(card.kind === "vocab" && [card.cardId, card.entry.id, card.lesson.id]).toEqual([vocab[0].id, "v-appartamento", "a2.u01.l01"]);
  });
});

describe("dueSession with error cards", () => {
  const error = {
    id: "error-0",
    kind: "error" as const,
    refId: "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    correction: { given: "voglio che tu esse", expected: "voglio che tu sia", errorTags: ["congiuntivo.volere_che"], note: "dal tutor" },
  };

  it("mixes error cards with the other kinds, and counts them", () => {
    const session = dueSession([error, vocab[0], due[0]], Math.random);
    expect(session.counts).toEqual({ vocab: 1, item: 1, error: 1 });
    expect(session.cards.map((card) => card.kind).sort()).toEqual(["error", "item", "vocab"]);
  });

  it("shows an error card with its correction and the English explanation of each tag", () => {
    const [card] = dueSession([error], Math.random).cards;
    expect(card).toEqual({
      kind: "error",
      cardId: "error-0",
      given: "voglio che tu esse",
      expected: "voglio che tu sia",
      note: "dal tutor",
      tags: [
        {
          id: "congiuntivo.volere_che",
          explanation: "After volere che, sperare che and bisogna che, the verb goes into the congiuntivo: voglio che tu sia, not voglio che tu esse.",
        },
      ],
    });
  });

  it("leaves out a tag error-tags.json no longer has", () => {
    const [card] = dueSession([{ ...error, correction: { ...error.correction, errorTags: ["gone.tag", "spelling.accent"] } }], Math.random).cards;
    expect(card.kind === "error" && card.tags.map((tag) => tag.id)).toEqual(["spelling.accent"]);
  });
});
