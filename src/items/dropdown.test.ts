import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { checkDropdown, currentValues, type DropdownItem, gapLooks, solveDropdown } from "./dropdown";
import { NEW_ENTRY } from "./entry";

/** "{{g1}} valigia, {{g2}} zaino, {{g3}} ombrello e {{g4}} computer." from the example lesson: la, lo, l', il. */
const item: DropdownItem = { ...(loadLesson("a2.u01.l01")!.steps[1].items[0] as DropdownItem), solvable: true };

const ALL_RIGHT = { g1: "la", g2: "lo", g3: "l'", g4: "il" };

describe("checkDropdown", () => {
  it("scores a point when the first Check gets every gap right, and locks the item", () => {
    const result = checkDropdown(item, NEW_ENTRY, ALL_RIGHT)!;
    expect(result.correct).toBe(true);
    expect(result.entry).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: true, points: 1 },
      answer: { values: ALL_RIGHT },
    });
    expect(result.mistakes).toEqual([]);
    expect(checkDropdown(item, result.entry, ALL_RIGHT)).toBeUndefined();
  });

  it("scores 0 for a wrong first Check, with a mistake per wrong or unchosen gap", () => {
    const wrong = checkDropdown(item, NEW_ENTRY, { g1: "la", g2: "il", g3: "la" })!;
    expect(wrong.correct).toBe(false);
    expect(wrong.entry).toEqual({
      state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 },
      answer: { values: { g1: "la", g2: "il", g3: "la" } },
    });
    expect(wrong.mistakes).toEqual([
      { gapId: "g2", expected: "lo", given: "il" },
      { gapId: "g3", expected: "l'", given: "la" },
      { gapId: "g4", expected: "il", given: "" },
    ]);
  });

  it("keeps the gaps right at the last Check locked, and a right retry scores 0", () => {
    const wrong = checkDropdown(item, NEW_ENTRY, { g1: "la", g2: "il", g3: "l'", g4: "lo" })!.entry;
    const retry = checkDropdown(item, wrong, { g1: "il", g2: "lo", g4: "il" })!;
    expect(retry.correct).toBe(true);
    expect(retry.entry).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: false, points: 0 },
      answer: { values: ALL_RIGHT },
    });
  });

  it("ignores a value that isn't one of its gap's options, or a gap the item doesn't have", () => {
    expect(checkDropdown(item, NEW_ENTRY, { ...ALL_RIGHT, g1: "gli" })).toBeUndefined();
    expect(checkDropdown(item, NEW_ENTRY, { ...ALL_RIGHT, g9: "la" })).toBeUndefined();
  });
});

describe("solveDropdown", () => {
  it("fills in every gap for 0 points and locks the item", () => {
    const wrong = checkDropdown(item, NEW_ENTRY, { g1: "il" })!.entry;
    const solved = solveDropdown(item, wrong)!;
    expect(solved.action).toBe("solve");
    expect(solved.entry).toEqual({ state: { status: "solved", firstCheckCorrect: false, points: 0 }, answer: { values: ALL_RIGHT } });
    expect(checkDropdown(item, solved.entry, ALL_RIGHT)).toBeUndefined();
  });

  it("does nothing for an item that is not solvable, or already locked", () => {
    expect(solveDropdown({ ...item, solvable: undefined }, NEW_ENTRY)).toBeUndefined();
    expect(solveDropdown(item, checkDropdown(item, NEW_ENTRY, ALL_RIGHT)!.entry)).toBeUndefined();
  });
});

describe("currentValues", () => {
  it("starts from the last Check's values, with the gaps changed since on top", () => {
    expect(currentValues(NEW_ENTRY, { g2: "lo" })).toEqual({ g2: "lo" });
    const wrong = checkDropdown(item, NEW_ENTRY, { g1: "la", g2: "il" })!.entry;
    expect(currentValues(wrong, { g2: "lo", g3: "l'" })).toEqual({ g1: "la", g2: "lo", g3: "l'" });
  });
});

describe("gapLooks", () => {
  const idle = { look: "idle", disabled: false };
  const green = { look: "correct", disabled: true };
  const red = { look: "wrong", disabled: false };

  it("leaves every gap open before the first Check", () => {
    expect(gapLooks(item, NEW_ENTRY, { g1: "la" })).toEqual({ g1: idle, g2: idle, g3: idle, g4: idle });
  });

  it("after a wrong Check: right gaps green and locked, wrong and unchosen gaps red but editable", () => {
    const wrong = checkDropdown(item, NEW_ENTRY, { g1: "la", g2: "il", g3: "l'" })!.entry;
    expect(gapLooks(item, wrong, currentValues(wrong, {}))).toEqual({ g1: green, g2: red, g3: green, g4: red });
  });

  it("clears a gap's red as soon as its value changes", () => {
    const wrong = checkDropdown(item, NEW_ENTRY, { g1: "la", g2: "il", g3: "l'" })!.entry;
    expect(gapLooks(item, wrong, currentValues(wrong, { g2: "la", g4: "il" }))).toEqual({ g1: green, g2: idle, g3: green, g4: idle });
  });

  it("shows every gap green and disabled once right or solved", () => {
    const solved = solveDropdown(item, NEW_ENTRY)!.entry;
    expect(gapLooks(item, solved, currentValues(solved, {}))).toEqual({ g1: green, g2: green, g3: green, g4: green });
  });
});
