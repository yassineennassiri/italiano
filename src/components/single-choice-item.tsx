"use client";

import type { Item } from "@/content/schema";
import { isLocked, optionLooks, type SingleChoiceAnswer } from "@/items/single-choice";
import type { ExerciseEntry } from "@/items/entry";
import { ui } from "@/ui-it";
import { ItemButton, OptionButton } from "./option-button";
import { PromptBubble } from "./prompt-bubble";
import { useExercise } from "./step-progress";

/**
 * A `single_choice` item (SPEC §5.2.4): the prompt bubble, then the options.
 * Clicking an option checks it at once.
 */
export function SingleChoiceItem({ item }: { item: Extract<Item, { options: string[]; answer: number }> }) {
  const [entry, dispatch] = useExercise(item);
  const looks = optionLooks(item, entry as ExerciseEntry<SingleChoiceAnswer>);

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <div>{item.prompt && <PromptBubble>{item.prompt}</PromptBubble>}</div>
      <div>
        <ul className="space-y-2">
          {item.options.map((option, index) => (
            <li key={index}>
              <OptionButton {...looks[index]} onClick={() => dispatch({ kind: "pick", option: index })}>
                {option}
              </OptionButton>
            </li>
          ))}
        </ul>
        {item.solvable && (
          <div className="mt-4 text-center">
            <ItemButton disabled={isLocked(entry)} onClick={() => dispatch({ kind: "solve" })}>
              {ui.lesson.solve}
            </ItemButton>
          </div>
        )}
      </div>
    </div>
  );
}
