import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { applyAction, findExercise, isCheckAction, parseAnswer } from "./engine";
import { NEW_ENTRY } from "./entry";

const lesson = loadLesson("a2.u01.l01")!;
const I03 = "a2.u01.l01.s01.i03";

describe("the engine for multi_select", () => {
  it("finds the item and checks a selection with Controlla", () => {
    const item = findExercise(lesson, I03)!;
    expect(item.item.type).toBe("multi_select");
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { selected: [0, 2, 3] } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores actions that belong to another item type", () => {
    const item = findExercise(lesson, I03)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "pick", option: 0 })).toBeUndefined();
    const singleChoice = findExercise(lesson, "a2.u01.l01.s01.i02")!;
    expect(applyAction(singleChoice, NEW_ENTRY, { kind: "check", answer: { selected: [0] } })).toBeUndefined();
  });

  it("restores a stored selection and refuses an answer of another shape", () => {
    const item = findExercise(lesson, I03)!;
    expect(parseAnswer(item, { selected: [0, 1] })).toEqual({ answer: { selected: [0, 1] } });
    expect(parseAnswer(item, { picks: [0] })).toBeUndefined();
  });
});

describe("the engine for dropdown", () => {
  const I = "a2.u01.l01.s02.i01";

  it("checks the gap values sent with Controlla", () => {
    const item = findExercise(lesson, I)!;
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { values: { g1: "la", g2: "lo", g3: "l'", g4: "il" } } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores a Controlla whose inputs are not gap values", () => {
    const item = findExercise(lesson, I)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: { selected: [0] } })).toBeUndefined();
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: "la" })).toBeUndefined();
  });
});

describe("the engine for text_gap", () => {
  const I = "a2.u01.l01.s03.i01";

  it("checks the typed values sent with Controlla", () => {
    const item = findExercise(lesson, I)!;
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { values: { g1: "i", g2: "gli", g3: "gli", g4: "le", g5: "gli" } } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores a Controlla with a value too long to be an answer", () => {
    const item = findExercise(lesson, I)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: { values: { g1: "i".repeat(201) } } })).toBeUndefined();
  });
});

describe("the engine for word_order", () => {
  const I = "a2.u01.l01.s04.i01";

  it("checks the placed tiles sent with Controlla", () => {
    const item = findExercise(lesson, I)!;
    expect(item.item.type).toBe("word_order");
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { placed: [0, 1, 2, 3, 4, 5, 6] } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores a Controlla whose inputs are not a placement, and restores a stored one", () => {
    const item = findExercise(lesson, I)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: { selected: [0] } })).toBeUndefined();
    expect(parseAnswer(item, { placed: [2, 0] })).toEqual({ answer: { placed: [2, 0] } });
    expect(parseAnswer(item, { values: {} })).toBeUndefined();
  });
});

describe("the engine for image_choice", () => {
  const lesson2 = loadLesson("a2.u01.l02")!;
  const SPECCHIO = "a2.u01.l02.s08.i01";
  const LAVATRICE = "a2.u01.l02.s08.i02";

  it("checks a pick at once and scores a right first pick, as single_choice does", () => {
    const item = findExercise(lesson2, SPECCHIO)!;
    expect(item.item.type).toBe("image_choice");
    const outcome = applyAction(item, NEW_ENTRY, { kind: "pick", option: 0 })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("leaves the other option open after a wrong pick, and a right retry scores 0", () => {
    const item = findExercise(lesson2, LAVATRICE)!;
    const wrong = applyAction(item, NEW_ENTRY, { kind: "pick", option: 0 })!;
    expect(wrong.entry.state).toEqual({ status: "checked_wrong", firstCheckCorrect: false, points: 0 });
    expect(wrong.errors).toEqual([{ expected: "Una lavatrice.", given: "Un frigorifero." }]);
    const retry = applyAction(item, wrong.entry, { kind: "pick", option: 1 })!;
    expect(retry.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: false, points: 0 });
  });

  it("refuses Solve on an item that isn't solvable, and Controlla", () => {
    const item = findExercise(lesson2, SPECCHIO)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "solve" })).toBeUndefined();
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: { picks: [0] } })).toBeUndefined();
  });
});

describe("the engine for audio_choice", () => {
  const lesson2 = loadLesson("a2.u01.l02")!;
  const ASCENSORE = "a2.u01.l02.s05.i01";

  it("checks a pick at once and scores a right first pick, as single_choice does", () => {
    const item = findExercise(lesson2, ASCENSORE)!;
    expect(item.item.type).toBe("audio_choice");
    const outcome = applyAction(item, NEW_ENTRY, { kind: "pick", option: 0 })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("leaves the other options open after a wrong pick, and a right retry scores 0", () => {
    const item = findExercise(lesson2, ASCENSORE)!;
    const wrong = applyAction(item, NEW_ENTRY, { kind: "pick", option: 1 })!;
    expect(wrong.entry.state).toEqual({ status: "checked_wrong", firstCheckCorrect: false, points: 0 });
    expect(wrong.errors).toEqual([{ expected: "No, caro, ci sono solo le scale.", given: "Sì, l'ascensore è a destra." }]);
    const retry = applyAction(item, wrong.entry, { kind: "pick", option: 0 })!;
    expect(retry.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: false, points: 0 });
  });
});

describe("speaking exercises", () => {
  const E2 = "a2.u01.l01.s05.i01.e2";
  const PARLA = "a2.u01.l01.s06.i01";

  it("finds each exchange of a speak_rate item as its own exercise, but not the item itself", () => {
    const exercise = findExercise(lesson, E2)!;
    expect(exercise.id).toBe(E2);
    expect(exercise.item.id).toBe("a2.u01.l01.s05.i01");
    expect(exercise.exchange?.id).toBe("e2");
    expect(findExercise(lesson, "a2.u01.l01.s05.i01")).toBeUndefined();
    expect(findExercise(lesson, "a2.u01.l01.s05.i01.e9")).toBeUndefined();
  });

  it("rates an exchange and a Parla! task, and refuses a rating anywhere else", () => {
    const exchange = findExercise(lesson, E2)!;
    expect(applyAction(exchange, NEW_ENTRY, { kind: "rate", rating: "not_great" })!.entry.state.status).toBe("rated_not_great");
    const parla = findExercise(lesson, PARLA)!;
    expect(applyAction(parla, NEW_ENTRY, { kind: "rate", rating: "good", note: "gli" })!.entry.answer).toEqual({ rating: "good", note: "gli" });
    expect(applyAction(findExercise(lesson, I03)!, NEW_ENTRY, { kind: "rate", rating: "good" })).toBeUndefined();
    expect(applyAction(exchange, NEW_ENTRY, { kind: "check", answer: { selected: [0] } })).toBeUndefined();
  });

  it("restores a stored rating and refuses one of another shape", () => {
    const exchange = findExercise(lesson, E2)!;
    expect(parseAnswer(exchange, { rating: "good" })).toEqual({ answer: { rating: "good" } });
    expect(parseAnswer(exchange, { rating: "meh" })).toBeUndefined();
  });

  it("does not treat a rating as a Check", () => {
    expect(isCheckAction({ kind: "rate" })).toBe(false);
    expect(isCheckAction({ kind: "solve" })).toBe(false);
    expect(isCheckAction({ kind: "pick" })).toBe(true);
    expect(isCheckAction({ kind: "check" })).toBe(true);
  });
});
