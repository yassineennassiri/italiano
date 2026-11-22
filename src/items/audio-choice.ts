/**
 * The `audio_choice` item (SPEC §5.2.8): it checks and scores like
 * `single_choice` (see the engine); what sets it apart is its 🔊.
 */
import type { Clip } from "@/audio/audio-service";
import { clipLines } from "@/content/clip";
import type { Item, Scene } from "@/content/schema";

type AudioChoiceItem = Pick<Extract<Item, { type: "audio_choice" }>, "prompt" | "prompt_audio" | "clip">;

/**
 * What the item's 🔊 plays: its clip's scene lines in order, else its
 * `prompt_audio`. Nothing, and so no 🔊, when it has neither.
 */
export function audioChoiceClips(item: AudioChoiceItem, scene: Pick<Scene, "lines">): Clip[] {
  if (item.clip) return clipLines(scene, item.clip).map((line) => ({ text: line.it, audio: line.audio }));
  if (item.prompt_audio) return [{ text: item.prompt ?? "", audio: item.prompt_audio }];
  return [];
}
