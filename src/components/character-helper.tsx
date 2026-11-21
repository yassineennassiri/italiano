"use client";

import { useEffect, useRef } from "react";
import { ITALIAN_CHARACTERS } from "@/items/typing";
import { ui } from "@/ui-it";
import { usePopover } from "./use-popover";

/**
 * The Italian character helper (SPEC §5.1): a keyboard icon that opens a
 * palette of à è é ì ò ù À È. Keyboard first: opening it focuses the first
 * character, Tab moves along, Enter inserts, Escape closes.
 */
export function CharacterHelper({ disabled, onInsert }: { disabled: boolean; onInsert: (character: string) => void }) {
  const { open, close, rootRef, buttonProps, panelProps } = usePopover();
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        {...buttonProps}
        disabled={disabled}
        aria-label={ui.lesson.characterHelper}
        title={ui.lesson.characterHelper}
        className="rounded-md border-2 border-brand bg-background p-1 text-brand hover:bg-tint-strong disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
          <rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M6 10h1M10 10h1M14 10h1M18 10h1M7 14h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div
        {...panelProps}
        role="group"
        aria-label={ui.lesson.characterHelper}
        className="absolute right-0 z-10 mt-1 grid w-max grid-cols-4 gap-1 rounded-lg border-2 border-brand bg-background p-2 shadow-lg"
      >
        {ITALIAN_CHARACTERS.map((character, index) => (
          <button
            key={character}
            ref={index === 0 ? firstRef : undefined}
            type="button"
            aria-label={ui.lesson.insertCharacter(character)}
            onClick={() => {
              close();
              onInsert(character);
            }}
            className="size-9 rounded-md bg-tint text-lg font-semibold text-brand hover:bg-tint-strong"
          >
            {character}
          </button>
        ))}
      </div>
    </div>
  );
}
