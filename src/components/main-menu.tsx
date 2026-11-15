"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ui } from "@/ui-it";

export type MenuLevel = { id: string; title: string; href: string; available: boolean };

/** The hamburger menu in the top bar (SPEC §3.1): Home and the levels. */
export function MainMenu({ levels }: { levels: MenuLevel[] }) {
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

  const close = () => setOpen(false);
  const linkClass = "block rounded px-3 py-2 text-brand hover:bg-tint";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? ui.topBar.closeMenu : ui.topBar.openMenu}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded text-brand hover:bg-tint"
      >
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" focusable="false">
          {open ? (
            <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M4 7 H20 M4 12 H20 M4 17 H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <nav
        id={panelId}
        hidden={!open}
        aria-label={ui.topBar.menuTitle}
        className="absolute right-0 top-12 z-30 w-64 rounded-md border border-line bg-white p-2 shadow-lg"
      >
        <ul>
          <li>
            <Link href="/" onClick={close} className={linkClass}>
              {ui.topBar.home}
            </Link>
          </li>
        </ul>
        <p className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{ui.topBar.levels}</p>
        <ul>
          {levels.map((level) => (
            <li key={level.id}>
              {level.available ? (
                <Link href={level.href} onClick={close} className={linkClass}>
                  {level.title}
                </Link>
              ) : (
                <span className="flex justify-between px-3 py-2 text-muted">
                  {level.title}
                  <span className="text-xs">{ui.comingSoon}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
