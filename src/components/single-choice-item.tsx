"use client";

import type { ReactNode } from "react";
import type { Item } from "@/content/schema";
import { type ExerciseEntry, isLocked } from "@/items/entry";
import { optionLooks, type SingleChoiceAnswer } from "@/items/single-choice";
import { ItemControls } from "./item-controls";
import { OptionButton } from "./option-button";
import { PromptBubble } from "./prompt-bubble";
import { useExercise } from "./step-progress";

/**
 * A `single_choice` item (SPEC §5.2.4): the prompt bubble, then the options.
 * Clicking an option checks it at once.
 */
export function SingleChoiceItem({ item, notes }: { item: Extract<Item, { options: string[]; answer: number }>; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item);
  const looks = optionLooks(item, entry as ExerciseEntry<SingleChoiceAnswer>);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div>{item.prompt && <PromptBubble>{item.prompt}</PromptBubble>}</div>
        <div>
          <ul className="space-y-2">
            {item.options.map((option, index) => (
              <li key={index}>
                <OptionButton {...looks[index]} tail onClick={() => dispatch({ kind: "pick", option: index })}>
                  {option}
                </OptionButton>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ItemControls notes={notes} solvable={item.solvable} locked={isLocked(entry)} onSolve={() => dispatch({ kind: "solve" })} />
    </>
  );
}
