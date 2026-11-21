"use client";

import { useState } from "react";
import { splitGapText } from "@/content/gap-text";
import type { Item } from "@/content/schema";
import { currentValues, type DropdownAnswer, gapLooks, type GapValues } from "@/items/dropdown";
import { type ExerciseEntry, isLocked } from "@/items/entry";
import type { OptionLook } from "@/items/option-look";
import { ui } from "@/ui-it";
import { MediaFrame } from "./media-frame";
import { FeedbackIcon, SolveAndCheck } from "./option-button";
import { PromptBubble } from "./prompt-bubble";
import { useExercise } from "./step-progress";

const SELECT_CLASSES: Partial<Record<OptionLook, string>> = {
  idle: "border-brand bg-background text-brand",
  correct: "border-ok bg-ok text-white",
  wrong: "border-bad bg-bad text-white",
};

/**
 * A `dropdown` item (SPEC §5.2.1): an optional image and the prompt bubble,
 * then the text with an inline select per gap. Controlla checks every gap;
 * Soluzione, when the item is solvable, fills them in. Native selects, so the
 * gaps work with Tab and the arrow keys.
 */
export function DropdownItem({ item }: { item: Extract<Item, { type: "dropdown" }> }) {
  const [entry, dispatch] = useExercise(item);
  const current = entry as ExerciseEntry<DropdownAnswer>;
  // Gaps changed since the last Check; the values are the last Check's with these on top.
  const [edits, setEdits] = useState<GapValues>({});
  const values = currentValues(current, edits);
  const looks = gapLooks(item, current, values);
  const gapNumbers = new Map(item.gaps.map((gap, index) => [gap.id, index + 1]));

  const check = () => {
    dispatch({ kind: "check", answer: { values } });
    setEdits({});
  };
  const solve = () => {
    dispatch({ kind: "solve" });
    setEdits({});
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <div className="space-y-4">
        {item.prompt && <PromptBubble>{item.prompt}</PromptBubble>}
        {item.image && <MediaFrame src={item.image} alt={ui.lesson.itemImageAlt} fit="contain" />}
      </div>
      <div>
        <p className="whitespace-pre-line rounded-lg bg-tint px-4 py-4 leading-loose text-brand">
          {splitGapText(item.text).map((piece, index) => {
            if ("text" in piece) return <span key={index}>{piece.text}</span>;
            const gap = item.gaps.find((candidate) => candidate.id === piece.gap)!;
            const { look, disabled } = looks[gap.id];
            return (
              <span key={index} className="inline-flex items-center gap-1 align-middle">
                <select
                  aria-label={ui.lesson.gapLabel(gapNumbers.get(gap.id)!)}
                  value={values[gap.id] ?? ""}
                  disabled={disabled}
                  onChange={(event) => setEdits((before) => ({ ...before, [gap.id]: event.target.value }))}
                  className={`rounded-md border-2 px-2 py-0.5 font-semibold disabled:opacity-100 ${SELECT_CLASSES[look]}`}
                >
                  <option value="" disabled>
                    {ui.lesson.gapPlaceholder}
                  </option>
                  {gap.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {(look === "correct" || look === "wrong") && (
                  <span className={look === "correct" ? "text-ok" : "text-bad"}>
                    <FeedbackIcon kind={look} />
                  </span>
                )}
              </span>
            );
          })}
        </p>
        <SolveAndCheck solvable={item.solvable} locked={isLocked(entry)} onSolve={solve} onCheck={check} />
      </div>
    </div>
  );
}
