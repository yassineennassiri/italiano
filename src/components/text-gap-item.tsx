"use client";

import { type ReactNode, useRef } from "react";
import { flushSync } from "react-dom";
import type { Item } from "@/content/schema";
import { insertAt } from "@/items/typing";
import { CharacterHelper } from "./character-helper";
import { GapFeedback, GappedItemLayout, GapText, useGappedItem } from "./gapped-item";

/** text_gap, and audio_gap, whose gaps behave the same (SPEC §5.2.10). */
type TypedGapContent = Extract<Item, { type: "text_gap" | "audio_gap" }>;

type TextGap = TypedGapContent["gaps"][number];

/** Inputs are sized to the answer (SPEC §5.2.2): the longest right answer, plus a character. */
const widthOf = (gap: TextGap) => Math.max(2, ...[gap.answer, ...(gap.accept ?? [])].map((answer) => answer.length)) + 1;

/**
 * A `text_gap` item, default layout (SPEC §5.2.2): a text input per gap, sized
 * to the answer. Enter checks the item and Tab moves between gaps; the
 * character helper inserts at the cursor of the gap last typed in. `aside`
 * replaces the left column (see `GappedItemLayout`).
 */
export function TextGapItem({ item, notes, aside }: { item: TypedGapContent; notes?: ReactNode; aside?: ReactNode }) {
  const { looks, locked, gapProps, edit, check, solve } = useGappedItem(item, { typed: true });
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const lastGap = useRef<string | null>(null);

  const insert = (character: string) => {
    const open = item.gaps.filter((gap) => !looks[gap.id].disabled);
    const gap = open.find((candidate) => candidate.id === lastGap.current) ?? open[0];
    const input = gap && inputs.current.get(gap.id);
    if (!input) return;
    const { value, cursor } = insertAt(input.value, input.selectionStart, input.selectionEnd, character);
    flushSync(() => edit(gap.id, value));
    input.focus();
    input.setSelectionRange(cursor, cursor);
  };

  return (
    <GappedItemLayout item={item} notes={notes} locked={locked} onSolve={solve} onCheck={check} aside={aside}>
      <div className="mb-2 flex justify-end">
        <CharacterHelper disabled={locked} onInsert={insert} />
      </div>
      <GapText
        text={item.text}
        gaps={item.gaps}
        renderGap={(gap, number) => (
          <>
            <input
              ref={(input) => {
                if (input) inputs.current.set(gap.id, input);
                else inputs.current.delete(gap.id);
              }}
              {...gapProps(gap.id, number)}
              type="text"
              size={widthOf(gap)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              // The gap last typed or clicked in, not just tabbed through on the way to the helper.
              onClick={() => (lastGap.current = gap.id)}
              onKeyUp={(event) => {
                if (event.key !== "Tab" && event.key !== "Shift") lastGap.current = gap.id;
              }}
              onChange={(event) => {
                lastGap.current = gap.id;
                edit(gap.id, event.target.value);
              }}
              onKeyDown={(event) => {
                // Not while an input method is composing a character.
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                check();
              }}
            />
            <GapFeedback view={looks[gap.id]} />
          </>
        )}
      />
    </GappedItemLayout>
  );
}
