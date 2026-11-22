import type { ReactNode } from "react";
import type { Item } from "@/content/schema";
import { ClipPlayer } from "./clip-player";
import { ItemPrompt } from "./prompt-bubble";
import { TextGapItem } from "./text-gap-item";
import type { PlaybackLine } from "./use-line-playback";

/**
 * An `audio_gap` item (SPEC §5.2.10, `[31]`): on the left the prompt bubble
 * and a mini clip player that plays only the item's clip, on the right the
 * document panel with typed gaps that behave exactly like `text_gap`'s. The
 * prompt has no 🔊 of its own: the mini player is what the learner listens to.
 */
export function AudioGapItem({
  item,
  clip,
  notes,
}: {
  item: Extract<Item, { type: "audio_gap" }>;
  /** The scene lines of the item's clip, in order. */
  clip: readonly PlaybackLine[];
  notes?: ReactNode;
}) {
  const aside = (
    <>
      <ItemPrompt item={item} clips={null} />
      <ClipPlayer lines={clip} />
    </>
  );
  return <TextGapItem item={item} notes={notes} aside={aside} />;
}
