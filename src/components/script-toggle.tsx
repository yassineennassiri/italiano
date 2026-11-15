"use client";

import { useId, useState } from "react";
import type { ScriptLine } from "@/content/schema";
import { ui } from "@/ui-it";
import { ChevronIcon } from "./chevron-icon";

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
        <ChevronIcon open={open} className="size-5" />
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
