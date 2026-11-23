"use client";

import { useState } from "react";
import type { ScriptLine } from "@/content/schema";
import { ui } from "@/ui-it";
import { LinkedText } from "./linked-text";
import { SpeakButton } from "./speak-button";

/**
 * A script (SPEC §4.8): **SPEAKER:** above each line. Our additions: clicking a
 * line toggles its English underneath, and ▶ plays the line. A line's vocab
 * links (§4.3) open their popover instead: the toggle is a button laid under
 * the text, which lets clicks through to it everywhere but on a link.
 */
export function ScriptLines({ lines }: { lines: readonly ScriptLine[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((before) => {
      const next = new Set(before);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ol className="space-y-3">
      {lines.map((line) => (
        <li key={line.id} data-line-id={line.id} className="flex items-start gap-2">
          <SpeakButton id={`line:${line.id}`} clip={{ text: line.it, audio: line.audio }} icon="play" className="mt-3" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-muted uppercase">{ui.lesson.speakerLabel(line.speaker)}</p>
            <p className="group relative">
              <button
                type="button"
                aria-expanded={open.has(line.id)}
                aria-label={ui.lesson.showTranslation}
                title={ui.lesson.showTranslation}
                onClick={() => toggle(line.id)}
                className="absolute inset-0 rounded"
              />
              <span className="pointer-events-none relative group-hover:text-brand">
                <LinkedText text={line.it} />
              </span>
            </p>
            {open.has(line.id) && <p className="mt-1 text-sm text-muted italic">{line.en}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
