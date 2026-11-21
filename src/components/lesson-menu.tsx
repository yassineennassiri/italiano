"use client";

import Link from "next/link";
import type { MenuEntry } from "@/content/lesson-nav";
import { ui } from "@/ui-it";
import { ChevronIcon } from "./chevron-icon";
import { ResetDialog, useResetDialog } from "./reset-dialog";
import { usePopover } from "./use-popover";

/**
 * The lesson menu behind the lesson bar's chevron (SPEC §3.1, `[23]`), with
 * *Azzera gli esercizi* before *Panoramica del corso* (§4.10).
 */
export function LessonMenu({ entries, lessonId, lessonTitle }: { entries: MenuEntry[]; lessonId: string; lessonTitle: string }) {
  const { open, close, rootRef, buttonProps, panelProps } = usePopover();
  const reset = useResetDialog();
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
              {entry.page === "corso" && (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    reset.open();
                  }}
                  className="mb-1 block w-full rounded px-4 py-3 text-left font-semibold text-white hover:bg-white/15 focus-visible:outline-white"
                >
                  {ui.reset.lessonButton}
                </button>
              )}
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
      <ResetDialog
        target={{ scope: "lesson", lessonId }}
        question={ui.reset.lessonQuestion}
        text={ui.reset.lessonText(lessonTitle)}
        dialogRef={reset.dialogRef}
      />
    </div>
  );
}
