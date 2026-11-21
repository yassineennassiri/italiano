"use client";

import type { ReactNode } from "react";
import type { Item } from "@/content/schema";
import { ui } from "@/ui-it";
import { GAP_INPUT_CLASSES, GapFeedback, GappedItemLayout, GapText, useGappedItem } from "./gapped-item";

/**
 * A `dropdown` item (SPEC §5.2.1): an inline select per gap, with "…" until
 * one is chosen. Native selects, so the gaps work with Tab and the arrow keys.
 */
export function DropdownItem({ item, notes }: { item: Extract<Item, { type: "dropdown" }>; notes?: ReactNode }) {
  const { values, looks, locked, edit, check, solve } = useGappedItem(item);

  return (
    <GappedItemLayout item={item} notes={notes} locked={locked} onSolve={solve} onCheck={check}>
      <GapText
        text={item.text}
        gaps={item.gaps}
        renderGap={(gap, number) => (
          <>
            <select
              aria-label={ui.lesson.gapLabel(number)}
              value={values[gap.id] ?? ""}
              disabled={looks[gap.id].disabled}
              onChange={(event) => edit(gap.id, event.target.value)}
              className={`rounded-md border-2 px-2 py-0.5 font-semibold disabled:opacity-100 ${GAP_INPUT_CLASSES[looks[gap.id].look]}`}
            >
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
