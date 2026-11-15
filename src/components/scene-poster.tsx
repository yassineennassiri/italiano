import type { Scene } from "@/content/schema";
import { ui } from "@/ui-it";
import { MediaFrame } from "./media-frame";

/**
 * The scene in its poster state: the 16:9 illustration with the duration
 * (SPEC §4.1). The ▶ button and playback arrive with the scene player (#14).
 */
export function ScenePoster({ scene, lessonTitle }: { scene: Scene; lessonTitle: string }) {
  return (
    <MediaFrame src={scene.poster} alt={ui.lesson.posterAlt(lessonTitle)} priority>
      <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-sm font-semibold text-white">
        {ui.lesson.duration(scene.duration_s)}
      </span>
    </MediaFrame>
  );
}
