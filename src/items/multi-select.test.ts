import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { NEW_ENTRY } from "./entry";
import { checkMultiSelect, currentSelection, type MultiSelectItem, optionLooks, solveMultiSelect } from "./multi-select";

/** "Che cosa ha Adam con sé?" from the example lesson: valigia, bicicletta, zaino, ombrello; answers 0, 2, 3. */
const item: MultiSelectItem = { ...(loadLesson("a2.u01.l01")!.steps[0].items[2] as MultiSelectItem), solvable: true };

describe("checkMultiSelect", () => {
  it("scores a point when the first Check picks exactly the right options, and locks the item", () => {
    const result = checkMultiSelect(item, NEW_ENTRY, [3, 0, 2])!;
    expect(result.correct).toBe(true);
    expect(result.action).toBe("check");
    expect(result.entry).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: true, points: 1 },
      answer: { selected: [0, 2, 3] },
    });
    expect(checkMultiSelect(item, result.entry, [0, 2, 3])).toBeUndefined();
  });

  it("scores 0 for a wrong first Check, and records what was right and what was given", () => {
    const wrong = checkMultiSelect(item, NEW_ENTRY, [1, 0])!;
    expect(wrong.correct).toBe(false);
    expect(wrong.entry).toEqual({
      state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 },
      answer: { selected: [0, 1] },
    });
    expect(wrong.expected).toBe("la valigia, lo zaino, l'ombrello");
    expect(wrong.given).toBe("la valigia, la bicicletta");
  });

  it("keeps right picks from the last Check locked: a retry that leaves them out still counts them", () => {
    const wrong = checkMultiSelect(item, NEW_ENTRY, [0, 1])!.entry;
    const retry = checkMultiSelect(item, wrong, [2, 3])!;
    expect(retry.correct).toBe(true);
    expect(retry.entry).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: false, points: 0 },
      answer: { selected: [0, 2, 3] },
    });
  });

  it("ignores an empty selection or an index outside the options", () => {
    expect(checkMultiSelect(item, NEW_ENTRY, [])).toBeUndefined();
    expect(checkMultiSelect(item, NEW_ENTRY, [0, 4])).toBeUndefined();
  });
});

describe("solveMultiSelect", () => {
  it("solves for 0 points, keeps the last Check's selection, and locks the item", () => {
    const wrong = checkMultiSelect(item, NEW_ENTRY, [1])!.entry;
    const solved = solveMultiSelect(item, wrong)!;
    expect(solved.action).toBe("solve");
    expect(solved.entry).toEqual({ state: { status: "solved", firstCheckCorrect: false, points: 0 }, answer: { selected: [1] } });
    expect(checkMultiSelect(item, solved.entry, [0, 2, 3])).toBeUndefined();
  });

  it("does nothing for an item that is not solvable, or already locked", () => {
    expect(solveMultiSelect({ ...item, solvable: undefined }, NEW_ENTRY)).toBeUndefined();
    const correct = checkMultiSelect(item, NEW_ENTRY, [0, 2, 3])!.entry;
    expect(solveMultiSelect(item, correct)).toBeUndefined();
  });
});

describe("currentSelection", () => {
  it("starts from the last Check's selection and flips each option toggled since", () => {
    expect(currentSelection(NEW_ENTRY, [2, 0])).toEqual([0, 2]);
    const wrong = checkMultiSelect(item, NEW_ENTRY, [0, 1])!.entry;
    expect(currentSelection(wrong, [])).toEqual([0, 1]);
    expect(currentSelection(wrong, [1, 3])).toEqual([0, 3]);
  });
});

describe("optionLooks", () => {
  const idle = { look: "idle", disabled: false };
  const selected = { look: "selected", disabled: false };

  it("shows toggled-on options as selected before the first Check", () => {
    expect(optionLooks(item, NEW_ENTRY, [1])).toEqual([idle, selected, idle, idle]);
  });

  it("after a wrong Check: right picks green and locked, wrong picks red but still editable", () => {
    const wrong = checkMultiSelect(item, NEW_ENTRY, [0, 1])!.entry;
    expect(optionLooks(item, wrong, [0, 1])).toEqual([
      { look: "correct", disabled: true },
      { look: "wrong", disabled: false },
      idle,
      idle,
    ]);
  });

  it("clears the red as soon as a wrong pick is toggled off, and shows new picks as selected", () => {
    const wrong = checkMultiSelect(item, NEW_ENTRY, [0, 1])!.entry;
    expect(optionLooks(item, wrong, [0, 2])).toEqual([{ look: "correct", disabled: true }, idle, selected, idle]);
  });

  it("after a right Check: the right options green, the rest greyed out, all disabled", () => {
    const correct = checkMultiSelect(item, NEW_ENTRY, [0, 2, 3])!.entry;
    expect(optionLooks(item, correct, [0, 2, 3])).toEqual([
      { look: "correct", disabled: true },
      { look: "dimmed", disabled: true },
      { look: "correct", disabled: true },
      { look: "correct", disabled: true },
    ]);
  });

  it("after Solve: every right option green, the last Check's wrong picks still red, all disabled", () => {
    const solved = solveMultiSelect(item, checkMultiSelect(item, NEW_ENTRY, [1])!.entry)!.entry;
    expect(optionLooks(item, solved, [1])).toEqual([
      { look: "correct", disabled: true },
      { look: "wrong", disabled: true },
      { look: "correct", disabled: true },
      { look: "correct", disabled: true },
    ]);
  });
});
