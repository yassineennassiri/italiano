/**
 * The `word_bank` item (SPEC §5.2.9): gaps filled from a bank of tiles, which
 * may hold duplicates and distractors. Clicking a tile fills the first empty
 * gap; clicking a filled gap returns its word to the bank. Check, Solve and
 * the per-gap feedback are the gapped items' (`./gaps`), with chosen gaps:
 * there is no accent hint.
 */
import type { Item } from "@/content/schema";
import { type ExerciseEntry, type ExerciseOutcome, isLocked } from "./entry";
import { checkGapValues, currentValues, type GapMode, type GapsAnswer, type GapValues, type GapView, gapLooks, solveGaps } from "./gaps";
import { seededRandom, shuffledIndexes } from "./shuffle";

export type WordBankItem = Pick<Extract<Item, { type: "word_bank" }>, "id" | "bank" | "gaps" | "solvable">;

/** The order the bank's tiles are shown in, as indexes into `bank`: shuffled with the item id as the seed. */
export const shuffledBank = (item: WordBankItem): number[] => shuffledIndexes(item.bank.length, seededRandom(item.id));

type Entry = ExerciseEntry<GapsAnswer>;

/** Chosen gaps: an option that differs only by an accent is plainly wrong. */
const MODE: GapMode = { typed: false };

/**
 * The learner's tile moves since the last Check: gap id → the bank index of
 * the tile placed in it, or null for a gap whose tile went back to the bank.
 */
export type WordBankDraft = Readonly<Record<string, number | null>>;

/**
 * Which tile is in each gap: the last Check's values, given tiles of the same
 * text in the shown order, with the draft on top. A stored word the bank
 * doesn't hold (content changed since) shows in its gap with no tile.
 */
function placementOf(item: WordBankItem, entry: Entry, draft: WordBankDraft): Record<string, { tile: number | null; text: string } | null> {
  const values = currentValues(entry, {});
  const used = new Set(Object.values(draft).filter((tile) => tile !== null));
  const placement: Record<string, { tile: number | null; text: string } | null> = {};
  for (const gap of item.gaps) {
    const drafted = draft[gap.id];
    if (drafted !== undefined) {
      placement[gap.id] = drafted === null ? null : { tile: drafted, text: item.bank[drafted] };
      continue;
    }
    const text = values[gap.id];
    if (!text) {
      placement[gap.id] = null;
      continue;
    }
    const tile = shuffledBank(item).find((index) => !used.has(index) && item.bank[index] === text) ?? null;
    if (tile !== null) used.add(tile);
    placement[gap.id] = { tile, text };
  }
  return placement;
}

/** What the item shows: each gap's word and look, and the tiles left in the bank. */
export type WordBankView = {
  /** In gap order. */
  gaps: Record<string, { text: string | null; view: GapView }>;
  /** Bank indexes, in the shown order. */
  bank: number[];
  /** The words in the gaps, which Controlla sends; empty gaps are left out. */
  values: GapValues;
  locked: boolean;
};

/** The view for an entry and the learner's draft. Moving a tile in or out of a red gap clears its red (SPEC §5.1). */
export function wordBankView(item: WordBankItem, entry: Entry, draft: WordBankDraft): WordBankView {
  const placement = placementOf(item, entry, draft);
  const edits = Object.fromEntries(Object.keys(draft).map((gapId) => [gapId, placement[gapId]?.text ?? ""]));
  const looks = gapLooks(item, entry, edits, MODE);
  const placed = new Set(Object.values(placement).map((gap) => gap?.tile));
  return {
    gaps: Object.fromEntries(item.gaps.map((gap) => [gap.id, { text: placement[gap.id]?.text ?? null, view: looks[gap.id] }])),
    bank: shuffledBank(item).filter((tile) => !placed.has(tile)),
    values: Object.fromEntries(item.gaps.flatMap((gap) => (placement[gap.id] ? [[gap.id, placement[gap.id]!.text]] : []))),
    locked: isLocked(entry),
  };
}

/** A bank tile click: the tile fills the first empty gap. Nothing happens when no gap is empty or the tile isn't in the bank. */
export function placeTile(item: WordBankItem, entry: Entry, draft: WordBankDraft, tile: number): WordBankDraft {
  const view = wordBankView(item, entry, draft);
  const empty = item.gaps.find((gap) => view.gaps[gap.id].text === null && !view.gaps[gap.id].view.disabled);
  if (!empty || !view.bank.includes(tile)) return draft;
  return { ...draft, [empty.id]: tile };
}

/** A filled gap click: its word goes back to the bank. Nothing happens for an empty or locked gap. */
export function returnTile(item: WordBankItem, entry: Entry, draft: WordBankDraft, gapId: string): WordBankDraft {
  const gap = wordBankView(item, entry, draft).gaps[gapId];
  if (!gap || gap.text === null || gap.view.disabled) return draft;
  return { ...draft, [gapId]: null };
}

/** Whether the bank holds these words: each one, as many times as it is used. Empty values are empty gaps. */
export function fitsBank(bank: readonly string[], values: GapValues): boolean {
  const left = new Map<string, number>();
  for (const word of bank) left.set(word, (left.get(word) ?? 0) + 1);
  return Object.values(values).every((word) => {
    if (word === "") return true;
    const count = left.get(word) ?? 0;
    left.set(word, count - 1);
    return count > 0;
  });
}

/**
 * Checks the words in the gaps, as for any gapped item, or undefined when the
 * Check does nothing: a locked item, a gap the item doesn't have, or words
 * that can't all come from the bank.
 */
export function checkWordBank(item: WordBankItem, entry: Entry, values: GapValues): ExerciseOutcome<GapsAnswer> | undefined {
  const outcome = checkGapValues(item, entry, values, MODE);
  return outcome?.entry.answer && fitsBank(item.bank, outcome.entry.answer.values) ? outcome : undefined;
}

/** Solves the item, or undefined when it isn't solvable or is already locked. content:check makes sure the bank holds every answer. */
export const solveWordBank = (item: WordBankItem, entry: Entry): ExerciseOutcome<GapsAnswer> | undefined => solveGaps(item, entry);
