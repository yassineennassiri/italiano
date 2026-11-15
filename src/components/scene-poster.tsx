import Image from "next/image";
import { mediaUrl } from "@/content/media";
import type { Scene } from "@/content/schema";
import { ui } from "@/ui-it";

/**
 * The scene in its poster state: the 16:9 illustration with the duration
 * (SPEC §4.1). Playback arrives with the scene player.
 */
export function ScenePoster({ scene, lessonTitle }: { scene: Scene; lessonTitle: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-tint">
      <Image
        src={mediaUrl(scene.poster)}
        alt={ui.lesson.posterAlt(lessonTitle)}
        fill
        sizes="(min-width: 1024px) 960px, 100vw"
        className="object-cover"
        priority
      />
      <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-sm font-semibold text-white">
        {ui.lesson.duration(scene.duration_s)}
      </span>
    </div>
  );
}
