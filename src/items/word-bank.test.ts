import { describe, expect, it } from "vitest";
import { loadLesson } from "@/content/load";
import { NEW_ENTRY } from "./entry";
import { checkWordBank, placeTile, returnTile, shuffledBank, solveWordBank, type WordBankDraft, type WordBankItem, wordBankView } from "./word-bank";

/**
 * Step 9 of lesson 2: six gaps (una, un, un, una, un', un) and the bank
 * un, uno, una, un', un, una, un: three "un", two "una", and "uno" left over.
 */
const item = loadLesson("a2.u01.l02")!.steps[8].items[0] as WordBankItem;

describe("shuffledBank", () => {
  it("is the same for the same item id, wherever it runs", () => {
    // Pinned, so a change to the seeding (which would reshuffle every bank for the learner) fails here.
    expect(shuffledBank(item)).toEqual([4, 3, 0, 5, 1, 6, 2]);
    expect(shuffledBank({ ...item })).toEqual(shuffledBank(item));
  });
});

/** The text in each gap, in gap order; null for an empty gap. */
const texts = (draft: Parameters<typeof wordBankView>[2]) => Object.values(wordBankView(item, NEW_ENTRY, draft).gaps).map((gap) => gap.text);

describe("placing a tile", () => {
  it("starts with every gap empty and every tile in the bank, shuffled", () => {
    const view = wordBankView(item, NEW_ENTRY, {});
    expect(texts({})).toEqual([null, null, null, null, null, null]);
    expect(view.bank).toEqual([4, 3, 0, 5, 1, 6, 2]);
  });

  it("fills the first empty gap with the clicked tile and takes it out of the bank", () => {
    let draft = placeTile(item, NEW_ENTRY, {}, 5); // una
    draft = placeTile(item, NEW_ENTRY, draft, 0); // un
    expect(texts(draft)).toEqual(["una", "un", null, null, null, null]);
    expect(wordBankView(item, NEW_ENTRY, draft).bank).toEqual([4, 3, 1, 6, 2]);
  });
});

describe("returning a word", () => {
  it("empties the clicked gap and puts its tile back in its place in the bank", () => {
    let draft = placeTile(item, NEW_ENTRY, {}, 5);
    draft = placeTile(item, NEW_ENTRY, draft, 0);
    draft = returnTile(item, NEW_ENTRY, draft, "g1");
    expect(texts(draft)).toEqual([null, "un", null, null, null, null]);
    expect(wordBankView(item, NEW_ENTRY, draft).bank).toEqual([4, 3, 5, 1, 6, 2]);
  });

  it("refills the gap it emptied first, as the first empty gap", () => {
    let draft = placeTile(item, NEW_ENTRY, {}, 5);
    draft = placeTile(item, NEW_ENTRY, draft, 0);
    draft = returnTile(item, NEW_ENTRY, draft, "g1");
    draft = placeTile(item, NEW_ENTRY, draft, 3); // un'
    expect(texts(draft)).toEqual(["un'", "un", null, null, null, null]);
  });

  it("does nothing for an empty gap", () => {
    expect(returnTile(item, NEW_ENTRY, {}, "g3")).toEqual({});
  });
});

describe("duplicates and distractors", () => {
  it("places each of several tiles with the same word, and leaves the distractor over once every gap is full", () => {
    let draft = {};
    for (const tile of [5, 4, 0, 2, 3, 6]) draft = placeTile(item, NEW_ENTRY, draft, tile);
    expect(texts(draft)).toEqual(["una", "un", "un", "una", "un'", "un"]);
    expect(wordBankView(item, NEW_ENTRY, draft).bank).toEqual([1]);
  });

  it("does nothing when every gap is full", () => {
    let draft = {};
    for (const tile of [5, 4, 0, 2, 3, 6]) draft = placeTile(item, NEW_ENTRY, draft, tile);
    expect(placeTile(item, NEW_ENTRY, draft, 1)).toBe(draft);
  });

  it("does nothing for a tile already placed", () => {
    const draft = placeTile(item, NEW_ENTRY, {}, 5);
    expect(placeTile(item, NEW_ENTRY, draft, 5)).toBe(draft);
  });
});

/** Places the tiles in order into the first empty gaps, then checks the item. */
function checkTiles(entry: Parameters<typeof checkWordBank>[1], draft: WordBankDraft, tiles: number[]) {
  for (const tile of tiles) draft = placeTile(item, entry, draft, tile);
  return checkWordBank(item, entry, wordBankView(item, entry, draft).values)!;
}

const RIGHT = [5, 4, 0, 2, 3, 6]; // una un un una un' un
const TWO_WRONG = [5, 4, 3, 2, 0, 6]; // una un un' una un un: g3 and g5 swapped

describe("checking", () => {
  it("scores a right first Check, turns every gap green and locks the item", () => {
    const outcome = checkTiles(NEW_ENTRY, {}, RIGHT);
    expect(outcome.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: true, points: 1 });
    const view = wordBankView(item, outcome.entry, {});
    expect(Object.values(view.gaps).map((gap) => gap.view)).toEqual(Array(6).fill({ look: "correct", disabled: true }));
    expect(view.locked).toBe(true);
    expect(placeTile(item, outcome.entry, {}, 1)).toEqual({});
  });

  it("marks right gaps green and locked, wrong gaps red and editable, for 0 points", () => {
    const outcome = checkTiles(NEW_ENTRY, {}, TWO_WRONG);
    expect(outcome.correct).toBe(false);
    expect(outcome.entry.state.points).toBe(0);
    expect(outcome.result).toEqual({ g1: "correct", g2: "correct", g3: "wrong", g4: "correct", g5: "wrong", g6: "correct" });
    expect(outcome.errors).toEqual([
      { gapId: "g3", expected: "un", given: "un'" },
      { gapId: "g5", expected: "un'", given: "un" },
    ]);
    const looks = Object.values(wordBankView(item, outcome.entry, {}).gaps).map((gap) => gap.view.look);
    expect(looks).toEqual(["correct", "correct", "wrong", "correct", "wrong", "correct"]);
    expect(returnTile(item, outcome.entry, {}, "g1")).toEqual({});
  });

  it("clears a red gap's red when its word goes back, and a right re-check locks the item at 0 points", () => {
    const first = checkTiles(NEW_ENTRY, {}, TWO_WRONG).entry;
    let draft = returnTile(item, first, {}, "g3");
    draft = returnTile(item, first, draft, "g5");
    const view = wordBankView(item, first, draft);
    expect(view.gaps.g3).toEqual({ text: null, view: { look: "idle", disabled: false } });
    expect(view.bank.map((tile) => item.bank[tile]).sort()).toEqual(["un", "un'", "uno"]);
    const unTile = view.bank.find((tile) => item.bank[tile] === "un")!;
    const elidedTile = view.bank.find((tile) => item.bank[tile] === "un'")!;
    const second = checkTiles(first, draft, [unTile, elidedTile]);
    expect(second.entry.state).toEqual({ status: "checked_correct", firstCheckCorrect: false, points: 0 });
  });

  it("refuses a Check with words the bank doesn't hold, or more of a word than it holds", () => {
    expect(checkWordBank(item, NEW_ENTRY, { g1: "la" })).toBeUndefined();
    expect(checkWordBank(item, NEW_ENTRY, { g1: "una", g2: "una", g3: "una" })).toBeUndefined();
  });

  it("checks gaps left empty as wrong", () => {
    const outcome = checkTiles(NEW_ENTRY, {}, [5]);
    expect(outcome.result).toMatchObject({ g1: "correct", g2: "wrong" });
  });
});

describe("solving and reloading", () => {
  it("fills every gap with its answer and leaves the distractor in the bank", () => {
    const solved = solveWordBank(item, NEW_ENTRY)!;
    const view = wordBankView(item, solved.entry, {});
    expect(Object.values(view.gaps).map((gap) => gap.text)).toEqual(["una", "un", "un", "una", "un'", "un"]);
    expect(view.bank).toEqual([1]);
    expect(view.locked).toBe(true);
  });

  it("restores the placed tiles and the checked looks from the stored entry alone", () => {
    const stored = JSON.parse(JSON.stringify(checkTiles(NEW_ENTRY, {}, TWO_WRONG).entry));
    const view = wordBankView(item, stored, {});
    expect(Object.values(view.gaps).map((gap) => gap.text)).toEqual(["una", "un", "un'", "una", "un", "un"]);
    expect(Object.values(view.gaps).map((gap) => gap.view.look)).toEqual(["correct", "correct", "wrong", "correct", "wrong", "correct"]);
    expect(view.bank).toEqual([1]);
  });
});
