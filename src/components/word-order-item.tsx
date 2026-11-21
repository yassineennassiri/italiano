"use client";

import { type ReactNode, useState } from "react";
import type { Item } from "@/content/schema";
import type { ExerciseEntry } from "@/items/entry";
import { moveTile, type WordOrderAnswer, wordOrderView } from "@/items/word-order";
import { ui } from "@/ui-it";
import { FeedbackIcon, ItemControls } from "./item-controls";
import { PromptBubble } from "./prompt-bubble";
import { useExercise } from "./step-progress";

const BOX_CLASSES = {
  idle: "border-dashed border-muted",
  correct: "border-solid border-ok",
  wrong: "border-solid border-bad",
} as const;

/** One tile: a light pill in the tray, dark once placed in the answer box. */
function Tile({ placed, disabled, onClick, children }: { placed: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  const look = placed ? "bg-brand text-white" : "bg-tint text-brand hover:bg-tint-strong";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-full px-4 py-1.5 font-semibold disabled:cursor-default ${look}`}>
      {children}
    </button>
  );
}

/**
 * A `word_order` item (SPEC §5.2.3): the prompt bubble on the left; on the
 * right a dotted answer box above the shuffled tiles. Clicking a tile moves it
 * to the end of the answer, clicking a placed tile sends it back. Controlla
 * turns the box border green or red; Soluzione, when the item is solvable,
 * places the tiles in order.
 */
export function WordOrderItem({ item, notes }: { item: Extract<Item, { type: "word_order" }>; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item);
  // The placement since the learner last moved a tile; null shows the last Check's.
  const [draft, setDraft] = useState<number[] | null>(null);
  const view = wordOrderView(item, entry as ExerciseEntry<WordOrderAnswer>, draft);

  const move = (tile: number) => setDraft(moveTile(view.placed, tile));
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
            data-look={view.box}
            className={`flex min-h-14 items-center gap-2 rounded-lg border-2 p-2 ${BOX_CLASSES[view.box]}`}
          >
            <div className="flex flex-1 flex-wrap gap-2">
              {view.placed.map((tile) => (
                <Tile key={tile} placed disabled={view.locked} onClick={() => move(tile)}>
                  {item.tiles[tile]}
                </Tile>
              ))}
            </div>
            {view.box !== "idle" && (
              <span className={view.box === "correct" ? "text-ok" : "text-bad"}>
                <FeedbackIcon kind={view.box} />
              </span>
            )}
          </div>
          <div role="group" aria-label={ui.lesson.tileTray} className="mt-4 flex min-h-10 flex-wrap gap-2">
            {view.tray.map((tile) => (
              <Tile key={tile} placed={false} disabled={view.locked} onClick={() => move(tile)}>
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
