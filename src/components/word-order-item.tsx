"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Item } from "@/content/schema";
import type { ExerciseEntry } from "@/items/entry";
import { moveTile, type WordOrderAnswer, type WordOrderView, wordOrderView } from "@/items/word-order";
import { ui } from "@/ui-it";
import { FeedbackIcon, ItemControls } from "./item-controls";
import { LOOK_CLASSES } from "./option-button";
import { ItemPrompt } from "./prompt-bubble";
import { useExercise } from "./step-progress";

const BOX_CLASSES: Record<WordOrderView["look"], string> = {
  idle: "border-dashed border-muted",
  correct: "border-solid border-ok",
  wrong: "border-solid border-bad",
};

type Layout = NonNullable<Extract<Item, { type: "word_order" }>["layout"]>;

/**
 * What changes between the layouts. Words: pills wrapping along a row, the
 * prompt column on the left even when there is no prompt. Lines: full-width
 * bars, one under another, in one column with any prompt above the box.
 */
const LAYOUTS: Record<Layout, { tile: string; flow: string; columns: string; trayLabel: string; promptColumn: boolean }> = {
  words: {
    tile: "rounded-full px-4 py-1.5 font-semibold",
    flow: "flex-wrap",
    columns: "md:grid-cols-2 md:items-start",
    trayLabel: ui.lesson.tileTray,
    promptColumn: true,
  },
  lines: {
    tile: "w-full rounded-lg px-4 py-2 text-left font-medium",
    flow: "flex-col",
    columns: "",
    trayLabel: ui.lesson.lineTray,
    promptColumn: false,
  },
};

/** One tile: light in the tray, dark once placed in the answer box. word_bank's bank shares it. */
export function Tile({
  tile,
  placed,
  disabled,
  onClick,
  layout = "words",
  children,
}: {
  /** The tile's index, for finding it again to move focus to it. */
  tile?: number;
  placed: boolean;
  disabled: boolean;
  onClick: () => void;
  layout?: Layout;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-tile={tile}
      disabled={disabled}
      onClick={onClick}
      className={`${LAYOUTS[layout].tile} disabled:cursor-default ${LOOK_CLASSES[placed ? "selected" : "idle"]}`}
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
 * places the tiles in order. In the lines layout (SPEC §5.2.13, "put the lines
 * in order") the tiles are whole script lines, stacked full width in the box
 * and the tray, and the item takes one column: any prompt goes above the box.
 */
export function WordOrderItem({ item, notes }: { item: Extract<Item, { type: "word_order" }>; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item);
  // The placement since the learner last moved a tile; null shows the last Check's.
  const [draft, setDraft] = useState<number[] | null>(null);
  const view = wordOrderView(item, entry as ExerciseEntry<WordOrderAnswer>, draft);
  const layout = item.layout ?? "words";
  const { flow, columns, trayLabel, promptColumn } = LAYOUTS[layout];
  const tileIn = (group: Group, tile: number, index: number) => (
    <Tile key={tile} placed={group === "box"} disabled={view.locked} layout={layout} onClick={() => move(tile, group, index)}>
      {item.tiles[tile]}
    </Tile>
  );

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
      <div className={`grid gap-4 ${columns}`}>
        {(promptColumn || item.prompt) && <div><ItemPrompt item={item} /></div>}
        <div>
          <div
            role="group"
            aria-label={ui.lesson.answerBox}
            data-look={view.look}
            className={`flex min-h-14 items-center gap-2 rounded-lg border-2 p-2 ${BOX_CLASSES[view.look]}`}
          >
            <div ref={boxRef} className={`flex min-w-0 flex-1 gap-2 ${flow}`}>
              {view.placed.map((tile, index) => tileIn("box", tile, index))}
            </div>
            {view.look !== "idle" && (
              <span className={view.look === "correct" ? "text-ok" : "text-bad"}>
                <FeedbackIcon kind={view.look} />
              </span>
            )}
          </div>
          <div ref={trayRef} role="group" aria-label={trayLabel} className={`mt-4 flex min-h-10 gap-2 ${flow}`}>
            {view.tray.map((tile, index) => tileIn("tray", tile, index))}
          </div>
        </div>
      </div>
      <ItemControls notes={notes} solvable={item.solvable} locked={view.locked} onSolve={solve} onCheck={check} />
    </>
  );
}
