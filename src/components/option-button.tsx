import type { ReactNode } from "react";
import type { MultiSelectLook } from "@/items/multi-select";
import { ui } from "@/ui-it";

const LOOK_CLASSES: Record<MultiSelectLook, string> = {
  idle: "bg-tint text-brand hover:bg-tint-strong",
  selected: "bg-brand text-white",
  correct:
    "bg-ok text-white after:absolute after:-right-[7px] after:bottom-3 after:size-3.5 after:rotate-45 after:bg-ok",
  wrong: "bg-bad text-white",
  dimmed: "bg-tint text-muted opacity-60",
};

/** One full-width option of a choice item; feedback pairs colour with ✓ / ✗ (SPEC §5.1). */
export function OptionButton({
  look,
  disabled,
  pressed,
  onClick,
  children,
}: {
  look: MultiSelectLook;
  disabled: boolean;
  /** For options that toggle (multi_select): whether it is selected. */
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left font-semibold transition disabled:cursor-default ${LOOK_CLASSES[look]}`}
    >
      <span className="flex-1">{children}</span>
      {(look === "correct" || look === "wrong") && <FeedbackIcon kind={look} />}
    </button>
  );
}

/** Soluzione or Controlla under an item. */
export function ItemButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border-2 border-brand px-6 py-1.5 font-bold text-brand hover:bg-tint disabled:opacity-40"
    >
      {children}
    </button>
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
