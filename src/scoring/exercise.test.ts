import { describe, expect, it } from "vitest";
import { applyEvents, isCompleted, UNTOUCHED } from "./exercise";

describe("exercise state", () => {
  it("starts untouched and not completed", () => {
    expect(UNTOUCHED).toEqual({ status: "untouched", firstCheckCorrect: null, points: 0 });
    expect(isCompleted(UNTOUCHED)).toBe(false);
  });

  it("earns 1 point and completes on a fully correct first Check", () => {
    const state = applyEvents([{ type: "check", correct: true }]);
    expect(state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    expect(isCompleted(state)).toBe(true);
  });

  it("completes with 0 points on a wrong first Check", () => {
    const state = applyEvents([{ type: "check", correct: false }]);
    expect(state).toEqual({ status: "checked_wrong", firstCheckCorrect: false, points: 0 });
    expect(isCompleted(state)).toBe(true);
  });

  it("scores 0 for a correct retry after a wrong Check, though it turns correct", () => {
    const state = applyEvents([
      { type: "check", correct: false },
      { type: "check", correct: false },
      { type: "check", correct: true },
    ]);
    expect(state).toEqual({ status: "checked_correct", firstCheckCorrect: false, points: 0 });
  });

  it("scores 0 for a Solve, before or after a wrong Check", () => {
    expect(applyEvents([{ type: "solve" }])).toMatchObject({ status: "solved", points: 0 });
    expect(applyEvents([{ type: "check", correct: false }, { type: "solve" }])).toMatchObject({ status: "solved", points: 0 });
    expect(isCompleted(applyEvents([{ type: "solve" }]))).toBe(true);
  });

  it("locks once correct or solved: later Checks and Solves change nothing", () => {
    const correct = applyEvents([{ type: "check", correct: true }]);
    expect(applyEvents([{ type: "solve" }, { type: "check", correct: false }], correct)).toEqual(correct);
    const solved = applyEvents([{ type: "solve" }]);
    expect(applyEvents([{ type: "check", correct: true }], solved)).toEqual(solved);
  });

  it("completes a self-rated exercise with 0 points, Bene included, and locks the choice", () => {
    const good = applyEvents([{ type: "rate", rating: "good" }]);
    expect(good).toEqual({ status: "rated_good", firstCheckCorrect: null, points: 0 });
    expect(isCompleted(good)).toBe(true);
    expect(applyEvents([{ type: "rate", rating: "not_great" }], good)).toEqual(good);
    expect(applyEvents([{ type: "rate", rating: "not_great" }])).toMatchObject({ status: "rated_not_great", points: 0 });
  });

  it("reopens the item for Correggi i miei errori but keeps the spent first Check, so a fix still scores 0", () => {
    const fixed = applyEvents([
      { type: "check", correct: false },
      { type: "reopen" },
      { type: "check", correct: true },
    ]);
    expect(fixed).toEqual({ status: "checked_correct", firstCheckCorrect: false, points: 0 });
    const reopened = applyEvents([{ type: "solve" }, { type: "reopen" }]);
    expect(reopened).toEqual({ status: "untouched", firstCheckCorrect: false, points: 0 });
    expect(isCompleted(reopened)).toBe(false);
    expect(applyEvents([{ type: "check", correct: true }], reopened).points).toBe(0);
  });

  it("does not reopen a correct or self-rated exercise, so no untouched exercise keeps a point", () => {
    const correct = applyEvents([{ type: "check", correct: true }]);
    expect(applyEvents([{ type: "reopen" }], correct)).toEqual(correct);
    const rated = applyEvents([{ type: "rate", rating: "not_great" }]);
    expect(applyEvents([{ type: "reopen" }], rated)).toEqual(rated);
  });
});
