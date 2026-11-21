import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { NEW_ENTRY } from "./entry";
import { ACCENT_TAG, checkGapValues, type GappedItem, gapLooks, solveGaps } from "./gaps";
import { loadErrorTags } from "@/content/load";

/** "il vicolo → {{g1}} vicoli …" from the example lesson: i, gli, gli, le, gli. */
const plurals = loadLesson("a2.u01.l01")!.steps[2].items[0] as GappedItem;
const ALL_RIGHT = { g1: "i", g2: "gli", g3: "gli", g4: "le", g5: "gli" };
const TYPED = { typed: true };

/** A one-gap item with an accented answer and an alternative. */
const accented: GappedItem = {
  id: "x.i01",
  gaps: [{ id: "g1", answer: "è", accept: ["e'"] }],
  solvable: true,
};

describe("checkGapValues for typed gaps (text_gap)", () => {
  it("scores a point when the first Check gets every gap right, and locks the item", () => {
    const result = checkGapValues(plurals, NEW_ENTRY, ALL_RIGHT, TYPED)!;
    expect(result.correct).toBe(true);
    expect(result.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    expect(checkGapValues(plurals, result.entry, ALL_RIGHT, TYPED)).toBeUndefined();
  });

  it("trims and collapses whitespace, and takes an accept alternative", () => {
    expect(checkGapValues(plurals, NEW_ENTRY, { ...ALL_RIGHT, g2: "  gli " }, TYPED)!.correct).toBe(true);
    expect(checkGapValues(accented, NEW_ENTRY, { g1: "e’" }, TYPED)!.correct).toBe(true);
  });

  it("marks an accent-only miss wrong for 0 points, and logs it as spelling.accent", () => {
    const result = checkGapValues(accented, NEW_ENTRY, { g1: "e" }, TYPED)!;
    expect(result.correct).toBe(false);
    expect(result.entry.state).toEqual({ status: "checked_wrong", firstCheckCorrect: false, points: 0 });
    expect(result.result).toEqual({ g1: "accent_only" });
    expect(result.errors).toEqual([{ gapId: "g1", expected: "è", given: "e", errorTags: ["spelling.accent"] }]);
  });

  it("logs a plain wrong gap with the item's tags, and keeps right gaps locked for the retry", () => {
    const wrong = checkGapValues(plurals, NEW_ENTRY, { ...ALL_RIGHT, g2: "lo", g5: "" }, TYPED)!;
    expect(wrong.errors).toEqual([
      { gapId: "g2", expected: "gli", given: "lo" },
      { gapId: "g5", expected: "gli", given: "" },
    ]);
    const retry = checkGapValues(plurals, wrong.entry, { g1: "x", g2: "gli", g5: "gli" }, TYPED)!;
    expect(retry.entry).toEqual({ state: { status: "checked_correct", firstCheckCorrect: false, points: 0 }, answer: { values: ALL_RIGHT } });
  });

  it("ignores a gap the item doesn't have", () => {
    expect(checkGapValues(plurals, NEW_ENTRY, { ...ALL_RIGHT, g9: "i" }, TYPED)).toBeUndefined();
  });
});

describe("ACCENT_TAG", () => {
  it("is one of the content's error tags", () => {
    expect(loadErrorTags().map((tag) => tag.id)).toContain(ACCENT_TAG);
  });
});

describe("gapLooks for typed gaps", () => {
  it("shows the accent hint on a red accent-only gap until it is edited", () => {
    const wrong = checkGapValues(accented, NEW_ENTRY, { g1: "e" }, TYPED)!.entry;
    expect(gapLooks(accented, wrong, {}, TYPED)).toEqual({ g1: { look: "wrong", disabled: false, accentHint: true } });
    expect(gapLooks(accented, wrong, { g1: "é" }, TYPED)).toEqual({ g1: { look: "idle", disabled: false } });
  });

  it("fills in every gap on Solve", () => {
    expect(solveGaps(accented, NEW_ENTRY)!.entry.answer).toEqual({ values: { g1: "è" } });
  });
});
