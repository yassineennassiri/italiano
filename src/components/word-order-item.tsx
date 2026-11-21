"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Item } from "@/content/schema";
import type { ExerciseEntry } from "@/items/entry";
import { moveTile, type WordOrderAnswer, type WordOrderView, wordOrderView } from "@/items/word-order";
import { ui } from "@/ui-it";
import { FeedbackIcon, ItemControls } from "./item-controls";
import { LOOK_CLASSES } from "./option-button";
import { PromptBubble } from "./prompt-bubble";
import { useExercise } from "./step-progress";

const BOX_CLASSES: Record<WordOrderView["look"], string> = {
  idle: "border-dashed border-muted",
  correct: "border-solid border-ok",
  wrong: "border-solid border-bad",
};

/** One tile: a light pill in the tray, dark once placed in the answer box. */
function Tile({ placed, disabled, onClick, children }: { placed: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 font-semibold disabled:cursor-default ${LOOK_CLASSES[placed ? "selected" : "idle"]}`}
    >
      {children}
    </button>
  );
}

type Group = "box" | "tray";

/**
 * A `word_order` item (SPEC §5.2.3): the prompt bubble on the left; on the
 * right a dashed answer box above the shuffled tiles. Clicking a tile moves it
 * to the end of the answer, clicking a placed tile sends it back. Controlla
 * turns the box border green or red; Soluzione, when the item is solvable,
 * places the tiles in order.
 */
export function WordOrderItem({ item, notes }: { item: Extract<Item, { type: "word_order" }>; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item);
  // The placement since the learner last moved a tile; null shows the last Check's.
  const [draft, setDraft] = useState<number[] | null>(null);
  const view = wordOrderView(item, entry as ExerciseEntry<WordOrderAnswer>, draft);

  // A moved tile leaves its group, so focus goes to the tile now in its place (keyboard use, SPEC §5.1).
  const boxRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  // Where the last moved tile was; read once, after the render that moved it.
  const refocus = useRef<{ group: Group; index: number } | null>(null);
  useEffect(() => {
    const moved = refocus.current;
    if (!moved) return;
    refocus.current = null;
    const tilesIn = (group: Group) => [...((group === "box" ? boxRef : trayRef).current?.querySelectorAll("button") ?? [])];
    const left = tilesIn(moved.group);
    const other = tilesIn(moved.group === "box" ? "tray" : "box");
    (left[Math.min(moved.index, left.length - 1)] ?? other.at(-1))?.focus();
  });

  const move = (tile: number, group: Group, index: number) => {
    refocus.current = { group, index };
    setDraft(moveTile(view.placed, tile));
  };
  const check = () => {
    dispatch({ kind: "check", answer: { placed: view.placed } });
    setDraft(null);
  };
  const solve = () => {
    dispatch({ kind: "solve" });
    setDraft(null);
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div>{item.prompt && <PromptBubble>{item.prompt}</PromptBubble>}</div>
        <div>
          <div
            role="group"
            aria-label={ui.lesson.answerBox}
            data-look={view.look}
            className={`flex min-h-14 items-center gap-2 rounded-lg border-2 p-2 ${BOX_CLASSES[view.look]}`}
          >
            <div ref={boxRef} className="flex flex-1 flex-wrap gap-2">
              {view.placed.map((tile, index) => (
                <Tile key={tile} placed disabled={view.locked} onClick={() => move(tile, "box", index)}>
                  {item.tiles[tile]}
                </Tile>
              ))}
            </div>
            {view.look !== "idle" && (
              <span className={view.look === "correct" ? "text-ok" : "text-bad"}>
                <FeedbackIcon kind={view.look} />
              </span>
            )}
          </div>
          <div ref={trayRef} role="group" aria-label={ui.lesson.tileTray} className="mt-4 flex min-h-10 flex-wrap gap-2">
            {view.tray.map((tile, index) => (
              <Tile key={tile} placed={false} disabled={view.locked} onClick={() => move(tile, "tray", index)}>
                {item.tiles[tile]}
              </Tile>
            ))}
          </div>
        </div>
      </div>
      <ItemControls notes={notes} solvable={item.solvable} locked={view.locked} onSolve={solve} onCheck={check} />
    </>
  );
}
