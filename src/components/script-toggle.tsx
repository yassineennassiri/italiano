"use client";

import { useId, useState } from "react";
import type { ScriptLine } from "@/content/schema";
import { ui } from "@/ui-it";
import { ChevronIcon } from "./chevron-icon";
import { ScriptLines } from "./script-lines";

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
      <div id={panelId} hidden={!open} className="mt-3 border-l-4 border-tint pl-2">
        <ScriptLines lines={lines} />
      </div>
    </div>
  );
}
