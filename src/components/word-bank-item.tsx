"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Item } from "@/content/schema";
import type { ExerciseEntry } from "@/items/entry";
import type { GapsAnswer } from "@/items/gaps";
import { placeTile, returnTile, type WordBankDraft, wordBankView } from "@/items/word-bank";
import { ui } from "@/ui-it";
import { GAP_INPUT_CLASSES, GapFeedback, GappedItemLayout, GapText } from "./gapped-item";
import { useExercise } from "./step-progress";
import { Tile } from "./word-order-item";

/** Where focus goes after a move, read once after the render that made it. */
type Refocus = { to: "bank"; index: number } | { to: "tile"; tile: number };

/**
 * A `word_bank` item (SPEC §5.2.9): the text panel with its gaps, and the bank
 * of tiles right-aligned below it. Clicking a tile fills the first empty gap;
 * clicking a filled gap sends its word back to the bank. Check and Solve work
 * per gap, as in text_gap. Tiles and filled gaps are buttons, so it all works
 * with Tab and Enter.
 */
export function WordBankItem({ item, notes }: { item: Extract<Item, { type: "word_bank" }>; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item);
  const current = entry as ExerciseEntry<GapsAnswer>;
  // The tile moves since the last Check; cleared by Check and Solve.
  const [draft, setDraft] = useState<WordBankDraft>({});
  const view = wordBankView(item, current, draft);

  // A moved tile leaves the bank or comes back to it, so focus follows it (keyboard use, SPEC §5.1).
  const bankRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<Refocus | null>(null);
  useEffect(() => {
    const moved = refocus.current;
    if (!moved) return;
    refocus.current = null;
    const tiles = [...(bankRef.current?.querySelectorAll<HTMLButtonElement>("button[data-tile]") ?? [])];
    const target = moved.to === "tile" ? tiles.find((tile) => tile.dataset.tile === String(moved.tile)) : (tiles[Math.min(moved.index, tiles.length - 1)] ?? tiles.at(-1));
    target?.focus();
  });

  const place = (tile: number, index: number) => {
    const next = placeTile(item, current, draft, tile);
    if (next === draft) return;
    refocus.current = { to: "bank", index };
    setDraft(next);
  };
  const giveBack = (gapId: string) => {
    const next = returnTile(item, current, draft, gapId);
    if (next === draft) return;
    // The tile that came back is the one in the bank now that wasn't before.
    const returned = wordBankView(item, current, next).bank.find((tile) => !view.bank.includes(tile));
    if (returned !== undefined) refocus.current = { to: "tile", tile: returned };
    setDraft(next);
  };
  const check = () => {
    dispatch({ kind: "check", answer: { values: view.values } });
    setDraft({});
  };
  const solve = () => {
    dispatch({ kind: "solve" });
    setDraft({});
  };

  return (
    <GappedItemLayout item={item} notes={notes} locked={view.locked} onSolve={solve} onCheck={check}>
      <GapText
        text={item.text}
        gaps={item.gaps}
        renderGap={(gap, number) => {
          const { text, view: look } = view.gaps[gap.id];
          return (
            <>
              {text === null ? (
                <span
                  role="img"
                  aria-label={ui.lesson.gapLabel(number)}
                  data-gap={gap.id}
                  className="inline-block h-8 min-w-12 rounded-md border-2 border-dashed border-muted align-middle"
                />
              ) : (
                <button
                  type="button"
                  data-gap={gap.id}
                  aria-label={ui.lesson.filledGapLabel(number, text)}
                  disabled={look.disabled}
                  onClick={() => giveBack(gap.id)}
                  className={`rounded-md border-2 px-1.5 py-0.5 font-semibold disabled:cursor-default disabled:opacity-100 ${GAP_INPUT_CLASSES[look.look]}`}
                >
                  {text}
                </button>
              )}
              <GapFeedback view={look} />
            </>
          );
        }}
      />
      <div ref={bankRef} role="group" aria-label={ui.lesson.wordBank} className="mt-4 flex min-h-10 flex-wrap justify-end gap-2">
        {view.bank.map((tile, index) => (
          <Tile key={tile} tile={tile} placed={false} disabled={view.locked} onClick={() => place(tile, index)}>
            {item.bank[tile]}
          </Tile>
        ))}
      </div>
    </GappedItemLayout>
  );
}
