/**
 * The `word_order` item (SPEC §5.2.3): tiles shown shuffled, which the learner
 * clicks into an answer box. Controlla compares the placed sequence with the
 * tiles' order or an `accept` alternative; the whole box turns green (a point
 * if it was the first Check, and the item locks) or red, and a red box stays
 * editable for a retry at 0 points. Solve, when the item is `solvable`, places
 * the tiles in order for 0 points.
 */
import { z } from "zod";
import type { Item } from "@/content/schema";
import { applyEvent } from "@/scoring/exercise";
import { type ExerciseEntry, type ExerciseOutcome, isLocked } from "./entry";

export type WordOrderItem = Pick<Extract<Item, { type: "word_order" }>, "id" | "tiles" | "accept" | "solvable">;

/**
 * The stored answer: the tiles in the answer box at the last Check (after
 * Solve, the tiles in order), as indexes into `tiles`. Bounded, as it also
 * arrives with Controlla.
 */
export const wordOrderAnswerSchema = z.strictObject({ placed: z.array(z.number().int().nonnegative()).max(64) });
export type WordOrderAnswer = z.infer<typeof wordOrderAnswerSchema>;

type Entry = ExerciseEntry<WordOrderAnswer>;

/** FNV-1a: a 32-bit hash of the item id, the same on every computer. */
function seedOf(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small seeded generator of numbers in [0, 1). */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The sequences Check accepts: the tiles' own order, then each `accept` alternative. */
const solutions = (item: WordOrderItem): readonly (readonly string[])[] => [item.tiles, ...(item.accept ?? [])];

const sameSequence = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((text, i) => text === b[i]);

/** Whether these tiles, in this order, are a solution. */
const isSolution = (item: WordOrderItem, placed: readonly number[]) => {
  const texts = placed.map((index) => item.tiles[index]);
  return solutions(item).some((solution) => sameSequence(texts, solution));
};

const MAX_SHUFFLES = 20;

/**
 * The order the tiles are shown in, as indexes into `tiles`: shuffled with the
 * item id as the seed, so it is stable across reloads and computers, and never
 * already a solution. If every shuffle comes out solved (two tiles), the tiles
 * are rotated by one instead.
 */
export function shuffledTiles(item: WordOrderItem): number[] {
  const random = generator(seedOf(item.id));
  const indexes = item.tiles.map((_, index) => index);
  for (let attempt = 0; attempt < MAX_SHUFFLES; attempt++) {
    const order = [...indexes];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (!isSolution(item, order)) return order;
  }
  return [...indexes.slice(1), indexes[0]];
}

/** Tiles as a sentence, for the error log: spaced, with no space before punctuation tiles. */
const sentence = (texts: readonly string[]) => texts.join(" ").replace(/ ([.,;:!?…])/g, "$1");

/** Whether each index names a tile, and no tile is placed twice. */
const fits = (item: WordOrderItem, placed: readonly number[]) =>
  new Set(placed).size === placed.length && placed.every((index) => Number.isInteger(index) && index >= 0 && index < item.tiles.length);

/**
 * Checks the tiles in the answer box, or undefined when the Check does nothing
 * (locked item, a placement that doesn't fit the tiles). Tiles left out make it
 * wrong; nothing placed is a wrong Check, as Controlla is enabled while
 * untouched (SPEC §5.1).
 */
export function checkWordOrder(item: WordOrderItem, entry: Entry, placed: readonly number[]): ExerciseOutcome<WordOrderAnswer> | undefined {
  if (isLocked(entry) || !fits(item, placed)) return undefined;
  const correct = isSolution(item, placed);
  return {
    entry: { state: applyEvent(entry.state, { type: "check", correct }), answer: { placed: [...placed] } },
    action: "check",
    correct,
    errors: correct ? [] : [{ expected: sentence(item.tiles), given: sentence(placed.map((index) => item.tiles[index])) }],
  };
}

/** Solves the item, or undefined when it isn't solvable or is already locked. */
export function solveWordOrder(item: WordOrderItem, entry: Entry): ExerciseOutcome<WordOrderAnswer> | undefined {
  if (!item.solvable || isLocked(entry)) return undefined;
  return {
    entry: { state: applyEvent(entry.state, { type: "solve" }), answer: { placed: item.tiles.map((_, index) => index) } },
    action: "solve",
    correct: null,
    errors: [],
  };
}

/** A tile click: a tile in the tray goes to the end of the answer, a placed tile goes back to the tray. */
export const moveTile = (placed: readonly number[], tile: number): number[] =>
  placed.includes(tile) ? placed.filter((other) => other !== tile) : [...placed, tile];

/** What the item shows: the answer box's tiles and border, and the tray of tiles not placed. */
export type WordOrderView = {
  placed: number[];
  /** In the shuffled order. */
  tray: number[];
  /** The answer box border: green, red, or the plain dotted one. */
  box: "idle" | "correct" | "wrong";
  locked: boolean;
};

/**
 * The view for an entry and the learner's `draft` (the placement since they
 * last moved a tile, or null to show the last Check's). Moving a tile after a
 * wrong Check clears the red border (SPEC §5.1).
 */
export function wordOrderView(item: WordOrderItem, entry: Entry, draft: readonly number[] | null): WordOrderView {
  const locked = isLocked(entry);
  const checked = entry.state.status === "untouched" ? [] : (entry.answer?.placed ?? []);
  const placed = [...(locked ? checked : (draft ?? checked))];
  const box = locked ? "correct" : entry.state.status === "checked_wrong" && draft === null ? "wrong" : "idle";
  return { placed, tray: shuffledTiles(item).filter((index) => !placed.includes(index)), box, locked };
}
