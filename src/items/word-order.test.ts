import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { NEW_ENTRY } from "./entry";
import { checkWordOrder, moveTile, shuffledTiles, solveWordOrder, type WordOrderItem, wordOrderView } from "./word-order";

/** Step 4 of the example lesson: "Com'è andato il viaggio?" → Bene, / grazie, / ma / il treno / era / in ritardo / . */
const item = loadLesson("a2.u01.l01")!.steps[3].items[0] as WordOrderItem;

describe("shuffledTiles", () => {
  it("is the same for the same item id, wherever it runs", () => {
    // Pinned, so a change to the seeding (which would reshuffle every item for the learner) fails here.
    expect(shuffledTiles(item)).toEqual([0, 3, 6, 5, 4, 1, 2]);
    expect(shuffledTiles({ ...item })).toEqual(shuffledTiles(item));
  });

  it("is a permutation of the tiles", () => {
    expect([...shuffledTiles(item)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("never shows the tiles in a solved order", () => {
    for (let n = 0; n < 500; n++) {
      const two: WordOrderItem = { id: `x.${n}`, tiles: ["a", "b"] };
      expect(shuffledTiles(two)).toEqual([1, 0]);
      const withAccept: WordOrderItem = { id: `y.${n}`, tiles: ["a", "b", "c"], accept: [["b", "a", "c"], ["c", "a", "b"]] };
      const shown = shuffledTiles(withAccept).map((index) => withAccept.tiles[index]).join(" ");
      expect(["a b c", "b a c", "c a b"]).not.toContain(shown);
    }
  });

  it("treats tiles with the same text as interchangeable when avoiding the solved order", () => {
    for (let n = 0; n < 200; n++) {
      const twins: WordOrderItem = { id: `z.${n}`, tiles: [",", "a", ","] };
      const shown = shuffledTiles(twins).map((index) => twins.tiles[index]).join(" ");
      expect(shown).not.toBe(", a ,");
    }
  });

  it("finds the one unsolved order even when `accept` lists every other order", () => {
    // Every order of a b c but "c b a", which is not a rotation of the tiles.
    const others = [["a", "c", "b"], ["b", "a", "c"], ["b", "c", "a"], ["c", "a", "b"]];
    for (let n = 0; n < 200; n++) {
      const strict: WordOrderItem = { id: `w.${n}`, tiles: ["a", "b", "c"], accept: others };
      expect(shuffledTiles(strict)).toEqual([2, 1, 0]);
    }
  });

  it("still returns every tile when each order is a solution", () => {
    const either: WordOrderItem = { id: "v.1", tiles: ["a", "b"], accept: [["b", "a"]] };
    expect([...shuffledTiles(either)].sort()).toEqual([0, 1]);
  });
});

describe("checkWordOrder", () => {
  it("scores a point when the first Check places the tiles in order, and locks the item", () => {
    const result = checkWordOrder(item, NEW_ENTRY, [0, 1, 2, 3, 4, 5, 6])!;
    expect(result.correct).toBe(true);
    expect(result.action).toBe("check");
    expect(result.entry).toEqual({
      state: { status: "checked_correct", firstCheckCorrect: true, points: 1 },
      answer: { placed: [0, 1, 2, 3, 4, 5, 6] },
    });
    expect(result.errors).toEqual([]);
    expect(checkWordOrder(item, result.entry, [0, 1, 2, 3, 4, 5, 6])).toBeUndefined();
  });

  it("scores 0 for a wrong first Check, keeps the placement, and records the sentences", () => {
    const wrong = checkWordOrder(item, NEW_ENTRY, [0, 1, 2, 4, 3, 5, 6])!;
    expect(wrong.correct).toBe(false);
    expect(wrong.entry).toEqual({
      state: { status: "checked_wrong", firstCheckCorrect: false, points: 0 },
      answer: { placed: [0, 1, 2, 4, 3, 5, 6] },
    });
    expect(wrong.errors).toEqual([
      { expected: "Bene, grazie, ma il treno era in ritardo.", given: "Bene, grazie, ma era il treno in ritardo." },
    ]);
  });

  it("is wrong when tiles are left out, including when none are placed", () => {
    expect(checkWordOrder(item, NEW_ENTRY, [0, 1, 2, 3, 4, 5])!.correct).toBe(false);
    const empty = checkWordOrder(item, NEW_ENTRY, [])!;
    expect(empty.correct).toBe(false);
    expect(empty.errors).toEqual([{ expected: "Bene, grazie, ma il treno era in ritardo.", given: "" }]);
  });

  it("logs an elided tile joined to the next word", () => {
    const elided: WordOrderItem = { id: "t.4", tiles: ["Dov'è", "l'", "appartamento", "?"] };
    expect(checkWordOrder(elided, NEW_ENTRY, [1, 2, 0, 3])!.errors).toEqual([
      { expected: "Dov'è l'appartamento?", given: "l'appartamento Dov'è?" },
    ]);
    const truncated: WordOrderItem = { id: "t.5", tiles: ["Un", "po'", "di", "pane"] };
    expect(checkWordOrder(truncated, NEW_ENTRY, [])!.errors[0].expected).toBe("Un po' di pane");
  });

  it("accepts an `accept` alternative", () => {
    const flexible: WordOrderItem = { id: "t.2", tiles: ["in", "ufficio", "domani"], accept: [["domani", "in", "ufficio"]] };
    expect(checkWordOrder(flexible, NEW_ENTRY, [2, 0, 1])!.correct).toBe(true);
    expect(checkWordOrder(flexible, NEW_ENTRY, [1, 0, 2])!.correct).toBe(false);
  });

  it("lets a retry after a wrong Check come out right, for 0 points", () => {
    const wrong = checkWordOrder(item, NEW_ENTRY, [1, 0, 2, 3, 4, 5, 6])!.entry;
    const retry = checkWordOrder(item, wrong, [0, 1, 2, 3, 4, 5, 6])!;
    expect(retry.correct).toBe(true);
    expect(retry.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: false, points: 0 });
  });

  it("treats tiles with the same text as interchangeable", () => {
    const twins: WordOrderItem = { id: "t.3", tiles: ["Sì", ",", "grazie", ",", "signora"] };
    expect(checkWordOrder(twins, NEW_ENTRY, [0, 3, 2, 1, 4])!.correct).toBe(true);
  });

  it("ignores a placement with an index outside the tiles, or a tile placed twice", () => {
    expect(checkWordOrder(item, NEW_ENTRY, [0, 1, 2, 3, 4, 5, 7])).toBeUndefined();
    expect(checkWordOrder(item, NEW_ENTRY, [0, 0, 2, 3, 4, 5, 6])).toBeUndefined();
  });
});

describe("solveWordOrder", () => {
  const solvable: WordOrderItem = { ...item, solvable: true };

  it("solves for 0 points, places the tiles in order, and locks the item", () => {
    const wrong = checkWordOrder(solvable, NEW_ENTRY, [1, 0])!.entry;
    const solved = solveWordOrder(solvable, wrong)!;
    expect(solved.action).toBe("solve");
    expect(solved.correct).toBeNull();
    expect(solved.entry).toEqual({
      state: { status: "solved", firstCheckCorrect: false, points: 0 },
      answer: { placed: [0, 1, 2, 3, 4, 5, 6] },
    });
    expect(checkWordOrder(solvable, solved.entry, [0, 1, 2, 3, 4, 5, 6])).toBeUndefined();
  });

  it("does nothing for an item that is not solvable, or already locked", () => {
    expect(solveWordOrder(item, NEW_ENTRY)).toBeUndefined();
    const correct = checkWordOrder(solvable, NEW_ENTRY, [0, 1, 2, 3, 4, 5, 6])!.entry;
    expect(solveWordOrder(solvable, correct)).toBeUndefined();
  });
});

describe("moveTile", () => {
  it("appends a tile from the tray to the end of the answer, and sends a placed tile back", () => {
    expect(moveTile([], 3)).toEqual([3]);
    expect(moveTile([3, 0], 5)).toEqual([3, 0, 5]);
    expect(moveTile([3, 0, 5], 0)).toEqual([3, 5]);
  });
});

describe("wordOrderView", () => {
  const solvable: WordOrderItem = { ...item, solvable: true };

  it("starts with an empty, open answer box and every tile in the tray, shuffled", () => {
    expect(wordOrderView(item, NEW_ENTRY, null)).toEqual({ placed: [], tray: [0, 3, 6, 5, 4, 1, 2], look: "idle", locked: false });
  });

  it("keeps the tray in its shuffled order as tiles are placed", () => {
    expect(wordOrderView(item, NEW_ENTRY, [3, 0])).toEqual({ placed: [3, 0], tray: [6, 5, 4, 1, 2], look: "idle", locked: false });
  });

  it("shows a wrong Check's placement in a red box until the learner edits it", () => {
    const wrong = checkWordOrder(item, NEW_ENTRY, [1, 0])!.entry;
    expect(wordOrderView(item, wrong, null)).toEqual({ placed: [1, 0], tray: [3, 6, 5, 4, 2], look: "wrong", locked: false });
    expect(wordOrderView(item, wrong, [1])).toMatchObject({ placed: [1], look: "idle", locked: false });
  });

  it("shows a right or solved item in a green, locked box", () => {
    const right = checkWordOrder(item, NEW_ENTRY, [0, 1, 2, 3, 4, 5, 6])!.entry;
    expect(wordOrderView(item, right, null)).toEqual({ placed: [0, 1, 2, 3, 4, 5, 6], tray: [], look: "correct", locked: true });
    const solved = solveWordOrder(solvable, NEW_ENTRY)!.entry;
    expect(wordOrderView(solvable, solved, null)).toEqual({ placed: [0, 1, 2, 3, 4, 5, 6], tray: [], look: "correct", locked: true });
  });
});

describe("the lines layout", () => {
  /** Step 10 of A2.1.2: four script lines of Pina and Adam, in order. */
  const lines = loadLesson("a2.u01.l02")!
    .steps.flatMap((step) => step.items)
    .find((each) => each.id === "a2.u01.l02.s10.i01") as WordOrderItem;
  const [key, kitchen, bathroom, bedroom] = lines.tiles;

  it("shuffles the lines by the item id, never in the solved order", () => {
    // Pinned, so a change to the seeding (which would reshuffle the learner's lines) fails here.
    expect(shuffledTiles(lines)).toEqual([2, 1, 3, 0]);
  });

  it("checks, scores and solves the lines as it does words", () => {
    const right = checkWordOrder(lines, NEW_ENTRY, [0, 1, 2, 3])!;
    expect(right.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    const wrong = checkWordOrder(lines, NEW_ENTRY, [0, 2, 1, 3])!;
    expect(wrong.entry.state).toEqual({ status: "checked_wrong", firstCheckCorrect: false, points: 0 });
    expect(solveWordOrder(lines, wrong.entry)!.entry).toEqual({
      state: { status: "solved", firstCheckCorrect: false, points: 0 },
      answer: { placed: [0, 1, 2, 3] },
    });
  });

  it("logs a wrong Check's lines one after another, kept apart with a slash", () => {
    expect(checkWordOrder(lines, NEW_ENTRY, [0, 2, 1])!.errors).toEqual([
      { expected: [key, kitchen, bathroom, bedroom].join(" / "), given: [key, bathroom, kitchen].join(" / ") },
    ]);
  });
});
