"use client";

import { useState } from "react";
import type { NoteGroup } from "@/feedback/notes";
import { submitFeedbackDone } from "@/progress/client";
import { ui } from "@/ui-it";

/**
 * `/feedback` (SPEC §10.6): the open notes grouped by level and lesson. *Fatto*
 * marks a note done; it stays in the list, ticked, until the next visit, so a
 * tick by mistake can be undone.
 */
export function FeedbackList({ groups }: { groups: readonly NoteGroup[] }) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const toggle = (noteId: string, checked: boolean) => {
    setDone((before) => {
      const after = new Set(before);
      if (checked) after.add(noteId);
      else after.delete(noteId);
      return after;
    });
    submitFeedbackDone(noteId, checked);
  };
  return (
    <div className="mt-6 space-y-6">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`${group.id}-heading`} className="rounded-lg bg-tint px-6 py-5">
          <h2 id={`${group.id}-heading`} className="text-xl font-bold text-brand">
            {group.title}
          </h2>
          <ul className="mt-3 space-y-3">
            {group.notes.map((note) => (
              <li key={note.id} className="rounded-lg border-2 border-line bg-background px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <code className="text-sm text-muted">{note.refId}</code>
                  <label className="flex items-center gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={done.has(note.id)}
                      onChange={(event) => toggle(note.id, event.target.checked)}
                      aria-describedby={`${note.id}-text`}
                      className="accent-brand"
                    />
                    {ui.feedback.done}
                  </label>
                </div>
                <p id={`${note.id}-text`} className={`mt-1 whitespace-pre-line ${done.has(note.id) ? "text-muted line-through" : ""}`}>
                  {note.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
