"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { insertAt } from "@/items/typing";
import { checkRewrite } from "@/review/error-card";
import type { ErrorSessionCard } from "@/review/session";
import type { GapVerdict } from "@/scoring/compare";
import { ui } from "@/ui-it";
import { CharacterHelper } from "./character-helper";
import { gapClasses } from "./gapped-item";
import { FeedbackIcon, ItemControls } from "./item-controls";

/** Untouched or edited since the last Check, checked (with its verdict), or solved. */
type Look = "idle" | GapVerdict | "solved";

/**
 * An error card in a review session (SPEC §10.5): my wrong version struck
 * through in red, the tags' English explanations (and the note) behind an
 * *Info* toggle, and an input for the corrected sentence. Controlla checks it
 * with the compare rules (§5.1), like a typed gap: right turns green and
 * locks, wrong turns red and stays editable, an accent-only miss adds
 * *Controlla l'accento*; Soluzione fills in the corrected version. The first
 * Check or Soluzione is the answer the card is graded on (`onAnswer`, with
 * null for Soluzione).
 */
export function ErrorCard({
  card,
  autoFocus,
  onAnswer,
}: {
  card: Pick<ErrorSessionCard, "cardId" | "given" | "expected" | "note" | "tags">;
  /** Focus the input on mount: the session moved here from the card before. */
  autoFocus: boolean;
  onAnswer: (text: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [look, setLook] = useState<Look>("idle");
  const [info, setInfo] = useState(false);
  const answered = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const locked = look === "correct" || look === "solved";
  const hasInfo = card.tags.length > 0 || card.note !== null;

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const answer = (given: string | null) => {
    if (answered.current) return;
    answered.current = true;
    onAnswer(given);
  };
  const check = () => {
    if (locked) return;
    setLook(checkRewrite(text, card.expected));
    answer(text);
  };
  const solve = () => {
    setText(card.expected);
    setLook("solved");
    answer(null);
  };
  const edit = (value: string) => {
    setText(value);
    if (look !== "idle") setLook("idle");
  };
  const insert = (character: string) => {
    const field = input.current;
    if (!field) return;
    const { value, cursor } = insertAt(field.value, field.selectionStart, field.selectionEnd, character);
    flushSync(() => edit(value));
    field.focus();
    field.setSelectionRange(cursor, cursor);
  };

  const feedback = look === "correct" ? "correct" : look === "wrong" || look === "accent_only" ? "wrong" : undefined;

  return (
    <section data-error-card={card.cardId} className="mx-auto max-w-3xl">
      <p className="mt-2 text-sm text-muted">{ui.review.errorSource}</p>
      <div className="mt-6 rounded-lg bg-tint px-6 py-6">
        <p>
          <span className="font-semibold">{ui.review.errorGiven}</span>{" "}
          <del className="text-lg text-bad decoration-2">{card.given}</del>
        </p>
        {hasInfo && (
          <div className="mt-3">
            <button
              type="button"
              aria-expanded={info}
              onClick={() => setInfo(!info)}
              className="rounded-full border-2 border-brand px-3 py-0.5 text-sm font-bold text-brand hover:bg-tint-strong"
            >
              {ui.review.info}
            </button>
            {info && (
              <div className="mt-3 space-y-2 text-sm">
                {card.tags.map((tag) => (
                  <p key={tag.id} lang="en">
                    {tag.explanation}
                  </p>
                ))}
                {/* The learner's own note, in whatever language they wrote it. */}
                {card.note !== null && <p className="italic">{card.note}</p>}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="mt-6 font-semibold">{ui.review.errorPrompt}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          ref={input}
          type="text"
          aria-label={ui.review.errorInput}
          value={text}
          disabled={locked}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => edit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            check();
          }}
          className={`min-w-0 flex-1 ${gapClasses(feedback ?? "idle")}`}
        />
        {feedback && (
          <span className={feedback === "correct" ? "text-ok" : "text-bad"}>
            <FeedbackIcon kind={feedback} />
          </span>
        )}
        <CharacterHelper disabled={locked} onInsert={insert} />
      </div>
      {look === "accent_only" && <p className="mt-1 text-sm font-semibold text-bad">{ui.lesson.accentHint}</p>}
      <ItemControls solvable locked={locked} onSolve={solve} onCheck={check} />
    </section>
  );
}
