"use client";

import type { ReactNode } from "react";
import type { Exchange, Item } from "@/content/schema";
import { PromptBubble } from "./prompt-bubble";
import { SelfRating } from "./self-rating";
import { useExercise } from "./step-progress";

type SpeakRate = Extract<Item, { type: "speak_rate" }>;

/** One exchange (SPEC §5.2.11): the other line, my reply with its hint, the exchange's notes, then its own rating. */
function ExchangeRow({ item, exchange, notes }: { item: SpeakRate; exchange: Exchange; notes?: ReactNode }) {
  const [entry, dispatch] = useExercise(item, exchange);
  return (
    <li data-exchange-id={exchange.id}>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {/* The other character's line. #14 adds its 🔊 button beside the text. */}
        <div>
          <PromptBubble>{exchange.other}</PromptBubble>
        </div>
        <div>
          {/* My reply: a tinted bubble with its tail on the right, so it doesn't read as a button. */}
          <p className="relative mr-2 rounded-lg bg-tint-strong px-4 py-3 font-semibold text-brand after:absolute after:-right-[7px] after:bottom-3 after:size-3.5 after:rotate-45 after:bg-tint-strong">
            {exchange.me}
          </p>
          {exchange.hint && <p className="mt-1 px-4 text-sm text-muted italic">{exchange.hint}</p>}
        </div>
      </div>
      {notes}
      <SelfRating entry={entry} onRate={(rating) => dispatch({ kind: "rate", rating })} />
    </li>
  );
}

/**
 * A `speak_rate` item (SPEC §5.2.11): rows of exchanges, each its own exercise
 * with *Com'è andata?* and Bene / Non tanto bene. `exchangeNotes` are the
 * rendered notes of each exchange, by exchange id; `notes` are the item's own.
 */
export function SpeakRateItem({
  item,
  exchangeNotes,
  notes,
}: {
  item: SpeakRate;
  exchangeNotes: Readonly<Record<string, ReactNode>>;
  notes?: ReactNode;
}) {
  return (
    <>
      <ol className="space-y-10">
        {item.exchanges.map((exchange) => (
          <ExchangeRow key={exchange.id} item={item} exchange={exchange} notes={exchangeNotes[exchange.id]} />
        ))}
      </ol>
      {notes}
    </>
  );
}
