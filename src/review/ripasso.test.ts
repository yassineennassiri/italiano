import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { chooseReviewItems, RIPASSO_SIZE, ripassoCounts, ripassoEntry } from "./ripasso";

const lesson2 = () => loadLesson("a2.u01.l02")!;
const item = (refId: string) => ({ kind: "item" as const, refId });

// Lesson 2's items carry article.lo, article.indefinite_apostrophe and gender.noun_ending.
const L1_LO = "a2.u01.l01.s02.i01"; // article.elision, article.lo: overlaps
const L1_GLI = "a2.u01.l01.s03.i01"; // article.plural_gli: no overlap
const L1_UNTAGGED = "a2.u01.l01.s01.i01";
const L1_EXCHANGE = "a2.u01.l01.s05.i01.e2"; // article.elision, register.lei: no overlap
const L1_PREP = "a2.u01.l01.s04.i02"; // article.elision, prep.articulated: no overlap

describe("chooseReviewItems (Ripasso personale)", () => {
  it("chooses up to 3 due item cards from other lessons, those sharing a tag with the lesson first, each group most overdue first", () => {
    const due = [item(L1_GLI), item(L1_UNTAGGED), item(L1_LO), item(L1_EXCHANGE), item(L1_PREP)];
    expect(RIPASSO_SIZE).toBe(3);
    expect(chooseReviewItems({ lesson: lesson2(), due, load: loadLesson })).toEqual([L1_LO, L1_GLI, L1_UNTAGGED]);
  });

  it("takes any due item cards when none shares a tag with the lesson", () => {
    const due = [item(L1_EXCHANGE), item(L1_GLI)];
    expect(chooseReviewItems({ lesson: lesson2(), due, load: loadLesson })).toEqual([L1_EXCHANGE, L1_GLI]);
  });

  it("leaves out the lesson's own items, vocab and error cards, and exercises the content no longer has", () => {
    const due = [
      item("a2.u01.l02.s02.i01"),
      { kind: "vocab" as const, refId: "a2.u01.l01.v-ombrello" },
      { kind: "error" as const, refId: "8a3c5f8e-0000-4000-8000-000000000000" },
      item("a2.u01.l01.s99.i01"),
      item("a2.u09.l01.s01.i01"),
    ];
    expect(chooseReviewItems({ lesson: lesson2(), due, load: loadLesson })).toEqual([]);
  });
});

describe("ripassoEntry (an answer already given in this visit, after a reload)", () => {
  it("shows a first Check right or wrong, or Soluzione, with its inputs and never a point", () => {
    expect(ripassoEntry({ type: "single_choice" }, { answer: { picks: [1] }, correct: true })).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: true, points: 0 },
      answer: { picks: [1] },
    });
    expect(ripassoEntry({ type: "text_gap" }, { answer: { values: { g1: "il" } }, correct: false })).toEqual({
      state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 },
      answer: { values: { g1: "il" } },
    });
    expect(ripassoEntry({ type: "dropdown" }, { answer: { values: { g1: "lo" } }, correct: null }).state).toEqual({
      status: "solved",
      firstCheckCorrect: false,
      points: 0,
    });
  });

  it("shows a speaking exchange's self-rating", () => {
    expect(ripassoEntry({ type: "speak_rate" }, { answer: { rating: "not_great" }, correct: null }).state).toEqual({
      status: "rated_not_great",
      firstCheckCorrect: null,
      points: 0,
    });
    expect(ripassoEntry({ type: "speak_rate" }, { answer: { rating: "good" }, correct: null }).state.status).toBe("rated_good");
  });
});

describe("ripassoCounts (the step's footer)", () => {
  it("counts its exercises in X di Y but never their points", () => {
    const right = { status: "checked_correct" as const, firstCheckCorrect: true, points: 1 as const };
    const untouched = { status: "untouched" as const, firstCheckCorrect: null, points: 0 as const };
    expect(ripassoCounts([right, untouched, right])).toEqual({ completed: 2, total: 3, points: 0 });
  });
});
