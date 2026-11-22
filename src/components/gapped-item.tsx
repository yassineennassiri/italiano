"use client";

import { type ReactNode, useState } from "react";
import { splitGapText } from "@/content/gap-text";
import type { Item } from "@/content/schema";
import { type ExerciseEntry, isLocked } from "@/items/entry";
import { currentValues, type GapMode, type GapView, gapLooks, type GappedItem, type GapsAnswer, type GapValues } from "@/items/gaps";
import { ui } from "@/ui-it";
import { FeedbackIcon, ItemControls } from "./item-controls";
import { ItemImage } from "./media-frame";
import { ItemPrompt } from "./prompt-bubble";
import { useExercise } from "./step-progress";

type GappedContent = Extract<Item, { type: "dropdown" | "text_gap" | "word_bank" }>;

/** The input classes for each gap look; word_bank's filled gaps share them. */
export const GAP_INPUT_CLASSES: Partial<Record<GapView["look"], string>> = {
  idle: "border-brand bg-background text-brand",
  correct: "border-ok bg-ok text-white",
  wrong: "border-bad bg-bad text-white",
};

/**
 * One gapped item's state: its values (the last Check's, with this tab's edits
 * on top), each gap's look, and the actions. Edits are cleared by Check and Solve.
 */
export function useGappedItem(item: Exclude<GappedContent, { type: "word_bank" }> & GappedItem, mode: GapMode) {
  const [entry, dispatch] = useExercise(item);
  const current = entry as ExerciseEntry<GapsAnswer>;
  const [edits, setEdits] = useState<GapValues>({});
  const values = currentValues(current, edits);
  const looks = gapLooks(item, current, edits, mode);
  return {
    looks,
    locked: isLocked(entry),
    /** The props every gap's input or select shares: its name, value, state and look. */
    gapProps: (gapId: string, number: number) => ({
      "aria-label": ui.lesson.gapLabel(number),
      value: values[gapId] ?? "",
      disabled: looks[gapId].disabled,
      className: `rounded-md border-2 px-1.5 py-0.5 font-semibold disabled:opacity-100 ${GAP_INPUT_CLASSES[looks[gapId].look]}`,
    }),
    edit: (gapId: string, value: string) => setEdits((before) => ({ ...before, [gapId]: value })),
    check: () => {
      dispatch({ kind: "check", answer: { values } });
      setEdits({});
    },
    solve: () => {
      dispatch({ kind: "solve" });
      setEdits({});
    },
  };
}

/**
 * The default gapped-item layout (SPEC §5.2.1, §5.2.2): the prompt bubble and
 * an optional image on the left, the text panel on the right, then the notes
 * and Soluzione / Controlla.
 */
export function GappedItemLayout({
  item,
  notes,
  locked,
  onSolve,
  onCheck,
  children,
}: {
  item: Pick<GappedContent, "id" | "prompt" | "prompt_audio" | "image" | "solvable">;
  notes?: ReactNode;
  locked: boolean;
  onSolve: () => void;
  onCheck: () => void;
  /** The text panel. */
  children: ReactNode;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <ItemPrompt item={item} />
          <ItemImage src={item.image} />
        </div>
        <div>{children}</div>
      </div>
      <ItemControls notes={notes} solvable={item.solvable} locked={locked} onSolve={onSolve} onCheck={onCheck} />
    </>
  );
}

/** The item's text with each `{{gN}}` marker replaced by `renderGap(gap, its 1-based number)`. */
export function GapText<G extends { id: string }>({ text, gaps, renderGap }: { text: string; gaps: readonly G[]; renderGap: (gap: G, number: number) => ReactNode }) {
  return (
    <p className="whitespace-pre-line rounded-lg bg-tint px-4 py-4 leading-loose text-brand">
      {splitGapText(text).map((piece, index) => {
        if ("text" in piece) return <span key={index}>{piece.text}</span>;
        const number = gaps.findIndex((gap) => gap.id === piece.gap) + 1;
        // content:check guarantees every marker has a gap.
        if (number === 0) throw new Error(`Gap marker {{${piece.gap}}} has no gap.`);
        return (
          <span key={index} className="inline-flex flex-wrap items-center gap-1 align-middle">
            {renderGap(gaps[number - 1], number)}
          </span>
        );
      })}
    </p>
  );
}

/** A checked gap's ✓ / ✗, with *Controlla l'accento* for an accent-only miss. */
export function GapFeedback({ view }: { view: GapView }) {
  if (view.look !== "correct" && view.look !== "wrong") return null;
  return (
    <>
      <span className={view.look === "correct" ? "text-ok" : "text-bad"}>
        <FeedbackIcon kind={view.look} />
      </span>
      {view.accentHint && <span className="text-sm font-semibold text-bad">{ui.lesson.accentHint}</span>}
    </>
  );
}
