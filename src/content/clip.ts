/**
 * A clip (SPEC §5.2.8, §5.2.10, §9.1): a span of scene lines, from `from_line`
 * to `to_line`, that an `audio_choice` 🔊, an `audio_gap` mini player or a
 * step's clip player plays. `content:check` makes sure a clip's lines exist
 * and run forward, so a bad clip here is a bug.
 */
import type { Scene, ScriptLine } from "./schema";

export type ClipSpan = { from_line: string; to_line: string };

/** The scene lines a clip plays, in scene order, both ends included. */
export function clipLines(scene: Pick<Scene, "lines">, clip: ClipSpan): ScriptLine[] {
  const indexOf = (lineId: string) => {
    const index = scene.lines.findIndex((line) => line.id === lineId);
    if (index === -1) throw new Error(`clip line "${lineId}" is not in the scene`);
    return index;
  };
  const from = indexOf(clip.from_line);
  const to = indexOf(clip.to_line);
  if (from > to) throw new Error(`clip runs backwards: "${clip.from_line}" comes after "${clip.to_line}"`);
  return scene.lines.slice(from, to + 1);
}
