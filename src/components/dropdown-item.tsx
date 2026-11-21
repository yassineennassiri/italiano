"use client";

import type { ReactNode } from "react";
import type { Item } from "@/content/schema";
import { ui } from "@/ui-it";
import { GapFeedback, GappedItemLayout, GapText, useGappedItem } from "./gapped-item";

/**
 * A `dropdown` item (SPEC §5.2.1): an inline select per gap, with "…" until
 * one is chosen. Native selects, so the gaps work with Tab and the arrow keys.
 */
export function DropdownItem({ item, notes }: { item: Extract<Item, { type: "dropdown" }>; notes?: ReactNode }) {
  const { looks, locked, gapProps, edit, check, solve } = useGappedItem(item, { typed: false });

  return (
    <GappedItemLayout item={item} notes={notes} locked={locked} onSolve={solve} onCheck={check}>
      <GapText
        text={item.text}
        gaps={item.gaps}
        renderGap={(gap, number) => (
          <>
            <select {...gapProps(gap.id, number)} onChange={(event) => edit(gap.id, event.target.value)}>
              <option value="" disabled>
                {ui.lesson.gapPlaceholder}
              </option>
              {gap.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <GapFeedback view={looks[gap.id]} />
          </>
        )}
      />
    </GappedItemLayout>
  );
}
