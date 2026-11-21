import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { applyAction, findItem, parseAnswer } from "./engine";
import { NEW_ENTRY } from "./entry";

const lesson = loadLesson("a2.u01.l01")!;
const I03 = "a2.u01.l01.s01.i03";

describe("the engine for multi_select", () => {
  it("finds the item and checks a selection with Controlla", () => {
    const item = findItem(lesson, I03)!;
    expect(item.type).toBe("multi_select");
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { selected: [0, 2, 3] } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores actions that belong to another item type", () => {
    const item = findItem(lesson, I03)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "pick", option: 0 })).toBeUndefined();
    const singleChoice = findItem(lesson, "a2.u01.l01.s01.i02")!;
    expect(applyAction(singleChoice, NEW_ENTRY, { kind: "check", answer: { selected: [0] } })).toBeUndefined();
  });

  it("restores a stored selection and refuses an answer of another shape", () => {
    const item = findItem(lesson, I03)!;
    expect(parseAnswer(item, { selected: [0, 1] })).toEqual({ answer: { selected: [0, 1] } });
    expect(parseAnswer(item, { picks: [0] })).toBeUndefined();
  });
});

describe("the engine for dropdown", () => {
  const I = "a2.u01.l01.s02.i01";

  it("checks the gap values sent with Controlla", () => {
    const item = findItem(lesson, I)!;
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { values: { g1: "la", g2: "lo", g3: "l'", g4: "il" } } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores a Controlla whose inputs are not gap values", () => {
    const item = findItem(lesson, I)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: { selected: [0] } })).toBeUndefined();
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: "la" })).toBeUndefined();
  });
});

describe("the engine for text_gap", () => {
  const I = "a2.u01.l01.s03.i01";

  it("checks the typed values sent with Controlla", () => {
    const item = findItem(lesson, I)!;
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { values: { g1: "i", g2: "gli", g3: "gli", g4: "le", g5: "gli" } } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores a Controlla with a value too long to be an answer", () => {
    const item = findItem(lesson, I)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: { values: { g1: "i".repeat(201) } } })).toBeUndefined();
  });
});

describe("the engine for word_order", () => {
  const I = "a2.u01.l01.s04.i01";

  it("checks the placed tiles sent with Controlla", () => {
    const item = findItem(lesson, I)!;
    expect(item.type).toBe("word_order");
    const outcome = applyAction(item, NEW_ENTRY, { kind: "check", answer: { placed: [0, 1, 2, 3, 4, 5, 6] } })!;
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
  });

  it("ignores a Controlla whose inputs are not a placement, and restores a stored one", () => {
    const item = findItem(lesson, I)!;
    expect(applyAction(item, NEW_ENTRY, { kind: "check", answer: { selected: [0] } })).toBeUndefined();
    expect(parseAnswer(item, { placed: [2, 0] })).toEqual({ answer: { placed: [2, 0] } });
    expect(parseAnswer(item, { values: {} })).toBeUndefined();
  });
});
