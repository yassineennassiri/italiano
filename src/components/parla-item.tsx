"use client";

import { type ReactNode, useId, useState } from "react";
import type { Item } from "@/content/schema";
import { type ExerciseEntry, isLocked } from "@/items/entry";
import { NOTE_MAX_LENGTH, type RatingAnswer } from "@/items/self-rating";
import { ui } from "@/ui-it";
import { PromptBubble } from "./prompt-bubble";
import { SelfRating } from "./self-rating";
import { useExercise } from "./step-progress";

/**
 * A `parla` item (SPEC §5.2.12): the task, an example answer and the checklist
 * of target structures, then the optional *Su cosa hai esitato?* note and the
 * rating. The note is sent with the rating, so it locks with it.
 */
export function ParlaItem({ item, notes }: { item: Extract<Item, { type: "parla" }>; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item);
  const rated = entry as ExerciseEntry<RatingAnswer>;
  const locked = isLocked(entry);
  const [draft, setDraft] = useState("");
  const noteId = useId();

  return (
    <>
      <PromptBubble speak={{ id: `prompt:${item.id}`, clip: { text: item.task } }}>{item.task}</PromptBubble>
      <div className="mt-6 grid gap-4 md:grid-cols-2 md:items-start">
        <div className="rounded-lg bg-tint px-4 py-3">
          <h2 className="text-sm font-bold tracking-wide text-muted uppercase">{ui.lesson.parlaExample}</h2>
          <p className="mt-1 text-brand italic">{item.example}</p>
        </div>
        <div className="rounded-lg border-2 border-tint-strong px-4 py-3">
          <h2 className="text-sm font-bold tracking-wide text-muted uppercase">{ui.lesson.parlaChecklist}</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-brand">
            {item.checklist.map((target) => (
              <li key={target}>{target}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6">
        <label htmlFor={noteId} className="font-semibold text-brand">
          {ui.lesson.hesitationNote}
        </label>
        <textarea
          id={noteId}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          disabled={locked}
          value={locked ? (rated.answer?.note ?? "") : draft}
          placeholder={locked ? undefined : ui.lesson.hesitationPlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-2 block w-full rounded-lg border-2 border-tint-strong bg-background px-3 py-2 disabled:opacity-70"
        />
      </div>
      {notes}
      <SelfRating entry={entry} onRate={(rating) => dispatch({ kind: "rate", rating, note: draft })} />
    </>
  );
}
