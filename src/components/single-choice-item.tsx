"use client";

import type { ReactNode } from "react";
import type { Item } from "@/content/schema";
import { type ExerciseEntry, isLocked } from "@/items/entry";
import { optionLooks, type SingleChoiceAnswer } from "@/items/single-choice";
import { ui } from "@/ui-it";
import { ItemControls } from "./item-controls";
import { MediaFrame } from "./media-frame";
import { OptionButton } from "./option-button";
import { ItemPrompt } from "./prompt-bubble";
import { useExercise } from "./step-progress";

/**
 * A `single_choice` item (SPEC §5.2.4): the prompt bubble, then the options.
 * Clicking an option checks it at once. An `image_choice` item (SPEC §5.2.6)
 * is the same item with its image under the prompt bubble.
 */
export function SingleChoiceItem({ item, notes }: { item: Extract<Item, { options: string[]; answer: number }>; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item);
  const looks = optionLooks(item, entry as ExerciseEntry<SingleChoiceAnswer>);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <ItemPrompt item={item} />
          {item.image && <MediaFrame src={item.image} alt={ui.lesson.itemImageAlt} fit="contain" />}
        </div>
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
