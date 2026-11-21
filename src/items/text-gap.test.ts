import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { NEW_ENTRY } from "./entry";
import { checkGapValues as checkTextGap, type GappedItem, gapLooks, solveGaps } from "./gaps";

/** "il vicolo → {{g1}} vicoli …" from the example lesson: i, gli, gli, le, gli. */
const plurals = loadLesson("a2.u01.l01")!.steps[2].items[0] as GappedItem;
const ALL_RIGHT = { g1: "i", g2: "gli", g3: "gli", g4: "le", g5: "gli" };

/** A one-gap item with an accented answer and an alternative. */
const accented: GappedItem = {
  id: "x.i01",
  gaps: [{ id: "g1", answer: "è", accept: ["e'"] }],
  solvable: true,
};

describe("checkTextGap", () => {
  it("scores a point when the first Check gets every gap right, and locks the item", () => {
    const result = checkTextGap(plurals, NEW_ENTRY, ALL_RIGHT)!;
    expect(result.correct).toBe(true);
    expect(result.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    expect(checkTextGap(plurals, result.entry, ALL_RIGHT)).toBeUndefined();
  });

  it("trims and collapses whitespace, and takes an accept alternative", () => {
    expect(checkTextGap(plurals, NEW_ENTRY, { ...ALL_RIGHT, g2: "  gli " })!.correct).toBe(true);
    expect(checkTextGap(accented, NEW_ENTRY, { g1: "e’" })!.correct).toBe(true);
  });

  it("marks an accent-only miss wrong for 0 points, and logs it as spelling.accent", () => {
    const result = checkTextGap(accented, NEW_ENTRY, { g1: "e" })!;
    expect(result.correct).toBe(false);
    expect(result.entry.state).toEqual({ status: "checked_wrong", firstCheckCorrect: false, points: 0 });
    expect(result.result).toEqual({ g1: "accent_only" });
    expect(result.errors).toEqual([{ gapId: "g1", expected: "è", given: "e", tags: ["spelling.accent"] }]);
  });

  it("logs a plain wrong gap with the item's tags, and keeps right gaps locked for the retry", () => {
    const wrong = checkTextGap(plurals, NEW_ENTRY, { ...ALL_RIGHT, g2: "lo", g5: "" })!;
    expect(wrong.errors).toEqual([
      { gapId: "g2", expected: "gli", given: "lo" },
      { gapId: "g5", expected: "gli", given: "" },
    ]);
    const retry = checkTextGap(plurals, wrong.entry, { g1: "x", g2: "gli", g5: "gli" })!;
    expect(retry.entry).toEqual({ state: { status: "checked_correct", firstCheckCorrect: false, points: 0 }, answer: { values: ALL_RIGHT } });
  });

  it("ignores a gap the item doesn't have", () => {
    expect(checkTextGap(plurals, NEW_ENTRY, { ...ALL_RIGHT, g9: "i" })).toBeUndefined();
  });
});

describe("gapLooks for typed gaps", () => {
  it("shows the accent hint on a red accent-only gap until it is edited", () => {
    const wrong = checkTextGap(accented, NEW_ENTRY, { g1: "e" })!.entry;
    expect(gapLooks(accented, wrong, {})).toEqual({ g1: { look: "wrong", disabled: false, accentHint: true } });
    expect(gapLooks(accented, wrong, { g1: "é" })).toEqual({ g1: { look: "idle", disabled: false } });
  });

  it("fills in every gap on Solve", () => {
    expect(solveGaps(accented, NEW_ENTRY)!.entry.answer).toEqual({ values: { g1: "è" } });
  });
});
