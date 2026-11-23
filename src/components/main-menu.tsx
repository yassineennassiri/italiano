"use client";

import Link from "next/link";
import { REVIEW_HUB_HREF, SETTINGS_HREF } from "@/content/lesson-nav";
import type { LevelCard } from "@/content/overview";
import { ui } from "@/ui-it";
import { usePopover } from "./use-popover";

export type MenuLevel = Pick<LevelCard, "id" | "title" | "href" | "available">;

/** The hamburger menu in the top bar (SPEC §3.1): Home, Ripasso, Impostazioni and the levels. */
export function MainMenu({ levels }: { levels: MenuLevel[] }) {
  const { open, close, rootRef, buttonProps, panelProps } = usePopover();
  const linkClass = "block rounded px-3 py-2 text-brand hover:bg-tint";

  return (
    <div ref={rootRef} className="relative">
      <button
        {...buttonProps}
        aria-label={open ? ui.topBar.closeMenu : ui.topBar.openMenu}
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
        {...panelProps}
        aria-label={ui.topBar.menuTitle}
        className="absolute right-0 top-12 z-30 w-64 rounded-md border border-line bg-white p-2 shadow-lg"
      >
        <ul>
          <li>
            <Link href="/" onClick={close} className={linkClass}>
              {ui.topBar.home}
            </Link>
          </li>
          <li>
            <Link href={REVIEW_HUB_HREF} onClick={close} className={linkClass}>
              {ui.topBar.review}
            </Link>
          </li>
          <li>
            <Link href={SETTINGS_HREF} onClick={close} className={linkClass}>
              {ui.topBar.settings}
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
