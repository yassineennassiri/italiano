"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Open/close state for a button that toggles a panel: Escape closes it and
 * returns focus to the button, a click outside closes it.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return {
    open,
    close: () => setOpen(false),
    rootRef,
    buttonProps: {
      ref: buttonRef,
      type: "button" as const,
      "aria-expanded": open,
      "aria-controls": panelId,
      onClick: () => setOpen((value) => !value),
    },
    panelProps: { id: panelId, hidden: !open },
  };
}
