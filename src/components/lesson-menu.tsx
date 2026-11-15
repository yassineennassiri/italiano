"use client";

import Link from "next/link";
import type { MenuEntry } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { ChevronIcon } from "./chevron-icon";
import { usePopover } from "./use-popover";

/** The lesson menu behind the lesson bar's chevron (SPEC §3.1, `[23]`). */
export function LessonMenu({ entries }: { entries: MenuEntry[] }) {
  const { open, close, rootRef, buttonProps, panelProps } = usePopover();
  return (
    <div ref={rootRef} className="relative">
      <button
        {...buttonProps}
        aria-label={open ? ui.lesson.closeMenu : ui.lesson.openMenu}
        className="flex size-10 items-center justify-center rounded text-white hover:bg-white/15 focus-visible:outline-white"
      >
        <ChevronIcon open={open} />
      </button>
      <nav
        {...panelProps}
        aria-label={ui.lesson.openMenu}
        className="absolute right-0 top-12 z-30 w-72 rounded-b-md bg-brand-light p-3 shadow-lg"
      >
        <ul>
          {entries.map((entry) => (
            <li key={entry.page}>
              <Link
                href={entry.href}
                onClick={close}
                className="block rounded px-4 py-3 font-semibold text-white hover:bg-white/15 focus-visible:outline-white"
              >
                {ui.lesson.menu[entry.page]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
