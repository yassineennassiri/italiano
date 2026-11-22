"use client";

import type { ReactNode } from "react";
import type { Clip } from "@/audio/audio-service";
import type { Item } from "@/content/schema";
import { type ExerciseEntry, isLocked } from "@/items/entry";
import { optionLooks, type SingleChoiceAnswer } from "@/items/single-choice";
import { ItemControls } from "./item-controls";
import { ItemImage } from "./media-frame";
import { OptionButton } from "./option-button";
import { ItemPrompt } from "./prompt-bubble";
import { useExercise } from "./step-progress";

/**
 * A `single_choice` item (SPEC §5.2.4): the prompt bubble, then the options.
 * Clicking an option checks it at once. An `image_choice` item (SPEC §5.2.6)
 * is the same item with its image under the prompt bubble, and an
 * `audio_choice` item (§5.2.8) the same item whose 🔊 plays `promptClips`.
 */
export function SingleChoiceItem({
  item,
  notes,
  promptClips,
}: {
  item: Extract<Item, { options: string[]; answer: number }>;
  notes?: ReactNode;
  /** What the prompt's 🔊 plays, when not the prompt itself; empty for no 🔊. */
  promptClips?: readonly Clip[];
}) {
  const [entry, dispatch] = useExercise(item);
  const looks = optionLooks(item, entry as ExerciseEntry<SingleChoiceAnswer>);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <ItemPrompt item={item} clips={promptClips} />
          <ItemImage src={item.image} />
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
