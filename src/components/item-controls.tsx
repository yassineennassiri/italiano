import type { ReactNode } from "react";
import { ui } from "@/ui-it";

/** Soluzione (secondary) or Controlla (`accent`) under an item (SPEC §4.2). */
function ItemControlButton({
  disabled,
  accent = false,
  onClick,
  children,
}: {
  disabled: boolean;
  accent?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const look = accent ? "border-accent bg-accent text-foreground hover:brightness-95" : "border-brand text-brand hover:bg-tint";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border-2 px-6 py-1.5 font-bold disabled:opacity-40 ${look}`}
    >
      {children}
    </button>
  );
}

/**
 * The end of an item (SPEC §4.2): its notes, then Soluzione (when the item is
 * solvable) and Controlla (when the item has a Check button), centred.
 */
export function ItemControls({
  notes,
  solvable,
  locked,
  onSolve,
  onCheck,
}: {
  notes?: ReactNode;
  solvable?: boolean;
  locked: boolean;
  onSolve: () => void;
  /** Left out for items checked on click (single_choice). */
  onCheck?: () => void;
}) {
  return (
    <>
      {notes}
      {(solvable || onCheck) && (
        <div className="mt-4 flex justify-center gap-3">
          {solvable && (
            <ItemControlButton disabled={locked} onClick={onSolve}>
              {ui.lesson.solve}
            </ItemControlButton>
          )}
          {onCheck && (
            <ItemControlButton accent disabled={locked} onClick={onCheck}>
              {ui.lesson.check}
            </ItemControlButton>
          )}
        </div>
      )}
    </>
  );
}

/** ✓ or ✗ beside the colour, so feedback never relies on colour alone (SPEC §5.1). */
export function FeedbackIcon({ kind }: { kind: "correct" | "wrong" }) {
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
