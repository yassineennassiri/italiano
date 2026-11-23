"use client";

import { type PointerEvent, useEffect, useId, useRef, useState } from "react";

/**
 * Open/close state for a button that toggles a panel: Escape closes it and
 * returns focus to the button, a click outside closes it. Spreading
 * `hoverProps` on the root also opens it while a mouse is over the button or
 * the panel; a click then keeps it open after the mouse leaves.
 */
export function usePopover<Root extends HTMLElement = HTMLDivElement>() {
  /** Opened by a click, a tap or Enter: stays open until closed. */
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  const panelId = useId();
  const rootRef = useRef<Root>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setPinned(false);
    setHovered(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPinned(false);
      setHovered(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setHovered(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Touch "hover" comes with every tap, so only a mouse opens on hover.
  const onMouse = (value: boolean) => (event: PointerEvent) => {
    if (event.pointerType === "mouse") setHovered(value);
  };

  return {
    open,
    close,
    rootRef,
    buttonProps: {
      ref: buttonRef,
      type: "button" as const,
      "aria-expanded": open,
      "aria-controls": panelId,
      onClick: () => {
        if (pinned) close();
        else setPinned(true);
      },
    },
    panelProps: { id: panelId, hidden: !open },
    hoverProps: { onPointerEnter: onMouse(true), onPointerLeave: onMouse(false) },
  };
}
