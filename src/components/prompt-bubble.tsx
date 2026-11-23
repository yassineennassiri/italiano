import type { ReactNode } from "react";
import type { Clip } from "@/audio/audio-service";
import type { Item } from "@/content/schema";
import { LinkedText } from "./linked-text";
import { SpeakButton } from "./speak-button";

/**
 * An item's prompt: a speech bubble with an accent border and a tail on the
 * left (SPEC §4.2, §7.1). With `speak`, a 🔊 button reads it (SPEC §11.1).
 */
export function PromptBubble({ speak, children }: { speak?: { id: string; clip: Clip | readonly Clip[] }; children: ReactNode }) {
  return (
    <p className="relative ml-2 inline-flex items-start gap-2 rounded-lg border-2 border-accent bg-background px-4 py-3 font-semibold text-brand after:absolute after:-left-[9px] after:bottom-3 after:size-4 after:rotate-45 after:border-b-2 after:border-l-2 after:border-accent after:bg-background">
      <span>{children}</span>
      {speak && <SpeakButton id={speak.id} clip={speak.clip} className="-my-1.5 -mr-2" />}
    </p>
  );
}

/**
 * An item's prompt bubble with its 🔊, or nothing when the item has no prompt.
 * Its vocab links render as links (SPEC §4.3).
 * The 🔊 reads the prompt, unless `clips` says what it plays instead (an
 * `audio_choice` clip, SPEC §5.2.8); `null` means no 🔊.
 */
export function ItemPrompt({ item, clips }: { item: Pick<Item, "id" | "prompt" | "prompt_audio">; clips?: readonly Clip[] | null }) {
  if (!item.prompt) return null;
  const clip = clips === undefined ? { text: item.prompt, audio: item.prompt_audio } : clips;
  return (
    <PromptBubble speak={clip ? { id: `prompt:${item.id}`, clip } : undefined}>
      <LinkedText text={item.prompt} />
    </PromptBubble>
  );
}
