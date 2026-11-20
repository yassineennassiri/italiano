import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { UNTOUCHED } from "@/scoring/exercise";
import { type ExerciseEntry, NEW_ENTRY } from "./entry";
import { optionLooks, pickOption, type SingleChoiceAnswer, type SingleChoiceItem, solveSingleChoice } from "./single-choice";

/** "Com'è andato il viaggio di Adam?" from the example lesson (answer: option 0), made solvable. */
const item: SingleChoiceItem = { ...(loadLesson("a2.u01.l01")!.steps[0].items[1] as SingleChoiceItem), solvable: true };

type Entry = ExerciseEntry<SingleChoiceAnswer>;

describe("pickOption", () => {
  it("checks the right option at once: a point, and the item locks", () => {
    const result = pickOption(item, NEW_ENTRY, 0)!;
    expect(result.correct).toBe(true);
    expect(result.entry).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: true, points: 1 },
      answer: { picks: [0] },
    });
    expect(pickOption(item, result.entry, 1)).toBeUndefined();
  });

  it("marks a wrong option red and allows a retry, which scores 0 even when right", () => {
    const wrong = pickOption(item, NEW_ENTRY, 2)!;
    expect(wrong.correct).toBe(false);
    expect(wrong.entry.state).toEqual({ status: "checked_wrong", firstCheckCorrect: false, points: 0 });

    const retry = pickOption(item, wrong.entry, 0)!;
    expect(retry.correct).toBe(true);
    expect(retry.entry).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: false, points: 0 },
      answer: { picks: [2, 0] },
    });
  });

  it("ignores a second click on an option already marked wrong", () => {
    const wrong = pickOption(item, NEW_ENTRY, 2)!;
    expect(pickOption(item, wrong.entry, 2)).toBeUndefined();
  });
});

describe("solveSingleChoice", () => {
  it("solves a solvable item for 0 points and locks it", () => {
    const solved = solveSingleChoice(item, NEW_ENTRY)!.entry;
    expect(solved.state).toEqual({ status: "solved", firstCheckCorrect: false, points: 0 });
    expect(pickOption(item, solved, 0)).toBeUndefined();
  });

  it("does nothing for an item that is not solvable, or already locked", () => {
    expect(solveSingleChoice({ ...item, solvable: undefined }, NEW_ENTRY)).toBeUndefined();
    const correct = pickOption(item, NEW_ENTRY, 0)!.entry;
    expect(solveSingleChoice(item, correct)).toBeUndefined();
  });
});

describe("optionLooks", () => {
  it("leaves every option open before the first pick", () => {
    expect(optionLooks(item, NEW_ENTRY)).toEqual([
      { look: "idle", disabled: false },
      { look: "idle", disabled: false },
      { look: "idle", disabled: false },
    ]);
  });

  it("shows a wrong pick red (✗) and keeps the others open", () => {
    const entry: Entry = { state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 }, answer: { picks: [1] } };
    expect(optionLooks(item, entry)).toEqual([
      { look: "idle", disabled: false },
      { look: "wrong", disabled: true },
      { look: "idle", disabled: false },
    ]);
  });

  it("shows the right pick green (✓) and greys out the rest", () => {
    const entry: Entry = { state: { status: "checked_correct", firstCheckCorrect: false, points: 0 }, answer: { picks: [1, 0] } };
    expect(optionLooks(item, entry)).toEqual([
      { look: "correct", disabled: true },
      { look: "dimmed", disabled: true },
      { look: "dimmed", disabled: true },
    ]);
  });

  it("shows the solution green after Solve, with earlier wrong picks still red", () => {
    const entry: Entry = { state: { status: "solved", firstCheckCorrect: false, points: 0 }, answer: { picks: [2] } };
    expect(optionLooks(item, entry)).toEqual([
      { look: "correct", disabled: true },
      { look: "dimmed", disabled: true },
      { look: "wrong", disabled: true },
    ]);
  });

  it("treats an untouched state as no picks, whatever the stored answer", () => {
    expect(optionLooks(item, { state: UNTOUCHED, answer: null })[0]).toEqual({ look: "idle", disabled: false });
  });
});
