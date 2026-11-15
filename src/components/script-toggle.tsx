"use client";

import { useId, useState } from "react";
import type { ScriptLine } from "@/content/schema";
import { ui } from "@/ui-it";

/** Copione ⌄: the transcript a step uses, collapsed by default (SPEC §4.2). */
export function ScriptToggle({ lines }: { lines: ScriptLine[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1 rounded text-lg font-bold text-brand"
      >
        {ui.lesson.script}
        <svg viewBox="0 0 24 24" className={`size-5 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" focusable="false">
          <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
      <dl id={panelId} hidden={!open} className="mt-3 space-y-3 border-l-4 border-tint pl-4">
        {lines.map((line) => (
          <div key={line.id}>
            <dt className="text-xs font-bold uppercase tracking-wide text-muted">{line.speaker}</dt>
            <dd>{line.it}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
