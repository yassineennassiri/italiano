"use client";

import { useState } from "react";
import type { Item } from "@/content/schema";
import { type ExerciseEntry, isLocked } from "@/items/entry";
import { currentSelection, type MultiSelectAnswer, optionLooks } from "@/items/multi-select";
import { OptionButton, SolveAndCheck } from "./option-button";
import { PromptBubble } from "./prompt-bubble";
import { useExercise } from "./step-progress";

/**
 * A `multi_select` item (SPEC §5.2.5): the prompt bubble, then options that
 * toggle on and off. Controlla checks the selection; Soluzione, when the item
 * is solvable, fills in the right options.
 */
export function MultiSelectItem({ item }: { item: Extract<Item, { type: "multi_select" }> }) {
  const [entry, dispatch] = useExercise(item);
  const current = entry as ExerciseEntry<MultiSelectAnswer>;
  // Options clicked since the last Check; the selection is the last Check's with these flipped.
  const [toggled, setToggled] = useState<number[]>([]);
  const selection = currentSelection(current, toggled);
  const looks = optionLooks(item, current, selection);

  const toggle = (index: number) =>
    setToggled((before) => (before.includes(index) ? before.filter((other) => other !== index) : [...before, index]));
  const check = () => {
    dispatch({ kind: "check", answer: { selected: selection } });
    setToggled([]);
  };
  const solve = () => {
    dispatch({ kind: "solve" });
    setToggled([]);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <div>{item.prompt && <PromptBubble>{item.prompt}</PromptBubble>}</div>
      <div>
        <ul className="space-y-2">
          {item.options.map((option, index) => (
            <li key={index}>
              <OptionButton {...looks[index]} pressed={selection.includes(index)} onClick={() => toggle(index)}>
                {option}
              </OptionButton>
            </li>
          ))}
        </ul>
        <SolveAndCheck solvable={item.solvable} locked={isLocked(entry)} onSolve={solve} onCheck={check} />
      </div>
    </div>
  );
}
