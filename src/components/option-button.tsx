import type { ReactNode } from "react";
import type { InputLook, InputView } from "@/items/input-look";
import { FeedbackIcon } from "./item-controls";

/** The colours of an input's look; shared with word_order tiles. */
export const LOOK_CLASSES: Record<InputLook, string> = {
  idle: "bg-tint text-brand hover:bg-tint-strong",
  selected: "bg-brand text-white",
  correct: "bg-ok text-white",
  wrong: "bg-bad text-white",
  dimmed: "bg-tint text-muted opacity-60",
};

/** The speech-bubble tail on a right single_choice answer (SPEC §5.2.4). */
const TAIL_CLASSES = "after:absolute after:-right-[7px] after:bottom-3 after:size-3.5 after:rotate-45 after:bg-ok";

/** One full-width option of a choice item; feedback pairs colour with ✓ / ✗ (SPEC §5.1). */
export function OptionButton({
  look,
  disabled,
  pressed,
  tail,
  onClick,
  children,
}: InputView & {
  /** For options that toggle (multi_select): whether it is selected. */
  pressed?: boolean;
  /** Give a green option a speech-bubble tail (single_choice). */
  tail?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-semibold transition disabled:cursor-default ${LOOK_CLASSES[look]} ${tail && look === "correct" ? TAIL_CLASSES : ""}`}
    >
      <span className="flex-1">{children}</span>
      {(look === "correct" || look === "wrong") && <FeedbackIcon kind={look} />}
    </button>
  );
}
