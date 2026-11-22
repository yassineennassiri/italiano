/** How a step's `reading` shows (SPEC §4.2 item 6). */
import type { Step } from "./schema";

/** An intro paragraph above the items, or a document on a tinted panel. */
export type ReadingLayout = "intro" | "document";

/**
 * Above `image_choice` items the reading is their intro paragraph (SPEC
 * §5.2.6); anywhere else it is a document followed by its questions (SPEC §5.2.7).
 */
export function readingLayout(step: Pick<Step, "items">): ReadingLayout {
  return step.items.some((item) => item.type === "image_choice") ? "intro" : "document";
}
