import type { ReactNode } from "react";
import type { Item } from "@/content/schema";
import { ClipPlayer } from "./clip-player";
import { ItemImage } from "./media-frame";
import { ItemPrompt } from "./prompt-bubble";
import { TextGapItem } from "./text-gap-item";
import type { PlaybackLine } from "./use-line-playback";

/**
 * An `audio_gap` item (SPEC §5.2.10, `[31]`): on the left the prompt bubble
 * and a mini clip player that plays only the item's clip, on the right the
 * document panel with typed gaps that behave exactly like `text_gap`'s. The
 * prompt gets a 🔊 only for its own `prompt_audio`, not a synthesised reading:
 * the mini player is what the learner listens to. An optional image sits below.
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
      <ItemPrompt item={item} clips={item.prompt_audio ? undefined : null} />
      <ClipPlayer lines={clip} />
      <ItemImage src={item.image} />
    </>
  );
  return <TextGapItem item={item} notes={notes} aside={aside} />;
}
