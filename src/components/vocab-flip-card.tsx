"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabEntry } from "@/content/schema";
import { type Grade, grades } from "@/review/sm2";
import { ui } from "@/ui-it";
import { ACCENT_CLASS } from "./accent-link";
import { VocabTerm } from "./vocab-list";


/**
 * A vocab card in a review session (SPEC §10.5): the front shows the English
 * meaning, with no gender dot; the learner says the Italian aloud and presses
 * *Gira*. The back adds the term with article and plural, the forms line and
 * 🔊, and the four grade buttons *Ancora · Difficile · Bene · Facile*.
 */
export function VocabFlipCard({
  entry,
  source,
  autoFocus,
  onGrade,
}: {
  entry: VocabEntry;
  /** Where the entry comes from: the lesson and its vocabulary. */
  source: string;
  /** Focus *Gira* on mount: the session moved here from the card before. */
  autoFocus: boolean;
  onGrade: (grade: Grade) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const flip = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) flip.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    // Gira is gone once pressed: keep focus on the card.
    if (flipped) back.current?.focus();
  }, [flipped]);

  return (
    <section data-vocab-id={entry.id} className="mx-auto max-w-3xl">
      <p className="mt-2 text-sm text-muted">{source}</p>
      <div className="mt-6 rounded-lg border-2 border-line px-6 py-10 text-center">
        <p className="text-sm text-muted">{ui.review.vocabPrompt}</p>
        <p lang="en" className="mt-3 text-2xl font-bold">
          {entry.en}
        </p>
        {flipped ? (
          <div ref={back} tabIndex={-1} className="mt-8 border-t border-line pt-8 outline-none">
            <VocabTerm entry={entry} className="justify-center text-left text-xl" />
          </div>
        ) : (
          <button ref={flip} type="button" className={`${ACCENT_CLASS} mt-8`} onClick={() => setFlipped(true)}>
            {ui.review.flip}
          </button>
        )}
      </div>
      {flipped && (
        <div className="mt-10 flex flex-wrap justify-center gap-3 bg-tint py-8">
          {grades.map((grade) => (
            <button key={grade} type="button" className={ACCENT_CLASS} onClick={() => onGrade(grade)}>
              {ui.review.grade[grade]}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
