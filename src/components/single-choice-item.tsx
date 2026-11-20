"use client";

import type { Item } from "@/content/schema";
import { isLocked, type OptionLook, optionLooks, type SingleChoiceAnswer } from "@/items/single-choice";
import type { ExerciseEntry } from "@/items/entry";
import { ui } from "@/ui-it";
import { PromptBubble } from "./prompt-bubble";
import { useExercise } from "./step-progress";

const LOOK_CLASSES: Record<OptionLook, string> = {
  idle: "bg-tint text-brand hover:bg-tint-strong",
  correct:
    "bg-ok text-white after:absolute after:-right-[7px] after:bottom-3 after:size-3.5 after:rotate-45 after:bg-ok",
  wrong: "bg-bad text-white",
  dimmed: "bg-tint text-muted opacity-60",
};

/**
 * A `single_choice` item (SPEC §5.2.4): the prompt bubble, then the options.
 * Clicking an option checks it at once; feedback pairs colour with ✓ / ✗.
 */
export function SingleChoiceItem({ item }: { item: Extract<Item, { options: string[]; answer: number }> }) {
  const [entry, dispatch] = useExercise(item);
  const looks = optionLooks(item, entry as ExerciseEntry<SingleChoiceAnswer>);

  return (
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <div>{item.prompt && <PromptBubble>{item.prompt}</PromptBubble>}</div>
      <div>
        <ul className="space-y-2">
          {item.options.map((option, index) => {
            const { look, disabled } = looks[index];
            return (
              <li key={index}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => dispatch({ kind: "pick", option: index })}
                  className={`relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-semibold transition disabled:cursor-default ${LOOK_CLASSES[look]}`}
                >
                  <span className="flex-1">{option}</span>
                  {look === "correct" && <FeedbackIcon kind="correct" />}
                  {look === "wrong" && <FeedbackIcon kind="wrong" />}
                </button>
              </li>
            );
          })}
        </ul>
        {item.solvable && (
          <div className="mt-4 text-center">
            <button
              type="button"
              disabled={isLocked(entry)}
              onClick={() => dispatch({ kind: "solve" })}
              className="rounded-full border-2 border-brand px-6 py-1.5 font-bold text-brand hover:bg-tint disabled:opacity-40"
            >
              {ui.lesson.solve}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** ✓ or ✗ beside the colour, so feedback never relies on colour alone (SPEC §5.1). */
function FeedbackIcon({ kind }: { kind: "correct" | "wrong" }) {
  return (
    <span className="flex shrink-0 items-center">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
        <path
          d={kind === "correct" ? "M5 12.5 L10 17 L19 7" : "M6 6 L18 18 M18 6 L6 18"}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{kind === "correct" ? ui.lesson.correct : ui.lesson.wrong}</span>
    </span>
  );
}
