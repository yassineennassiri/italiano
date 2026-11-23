"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { VocabEntry } from "@/content/schema";
import { usePopover } from "./use-popover";
import { VocabTerm } from "./vocab-list";

const LessonVocabContext = createContext<ReadonlyMap<string, VocabEntry>>(new Map());

/** The vocab entries that vocab links inside `children` open, from the lesson the text comes from. */
export function LessonVocab({ entries, children }: { entries: readonly VocabEntry[]; children: ReactNode }) {
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  return <LessonVocabContext value={byId}>{children}</LessonVocabContext>;
}

/**
 * A vocab link (SPEC §4.3): the word with a dotted underline, and a popover
 * with the term (article, plural, gender dot), its English and 🔊. It opens on
 * hover, on click or tap, and on Enter; Esc closes it. Without its entry in
 * the surrounding `LessonVocab`, the word shows plain.
 */
export function VocabLink({ word, vocabId }: { word: string; vocabId: string }) {
  const entry = useContext(LessonVocabContext).get(vocabId);
  const { rootRef, buttonProps, panelProps, hoverProps } = usePopover<HTMLSpanElement>();
  if (!entry) return word;
  return (
    // pointer-events-auto: a script line lets clicks through its text to the line's toggle, but not a link's.
    <span ref={rootRef} {...hoverProps} className="pointer-events-auto relative inline-block">
      <button
        {...buttonProps}
        data-vocab-link={entry.id}
        className="rounded underline decoration-dotted decoration-2 underline-offset-4 hover:decoration-solid"
      >
        {word}
      </button>
      {/* Padding, not margin, above the card: moving the mouse onto it mustn't leave the link. */}
      <span {...panelProps} className="absolute top-full left-0 z-20 w-72 max-w-[80vw] pt-1 text-left text-base leading-normal font-normal whitespace-normal text-foreground">
        <span className="block rounded-lg border border-line bg-background p-3 shadow-lg">
          <VocabTerm entry={entry} />
          <span lang="en" className="mt-1 block pl-11">
            {entry.en}
          </span>
        </span>
      </span>
    </span>
  );
}
