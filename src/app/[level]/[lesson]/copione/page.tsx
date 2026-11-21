import { Suspense } from "react";
import { ScenePlayer } from "@/components/scene-player";
import { ScriptLines } from "@/components/script-lines";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../lesson-params";

/**
 * The script page (SPEC §4.8), reached from the lesson menu: the scene player,
 * then *Copione* and the whole script. A line toggles its English; ▶ plays it.
 */
export default function ScriptPage({ params }: PageProps<"/[level]/[lesson]/copione">) {
  return (
    <Suspense fallback={null}>
      <Script params={params} />
    </Suspense>
  );
}

async function Script({ params }: { params: Promise<LessonRouteParams> }) {
  const lesson = await lessonFromParams(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <ScenePlayer scene={lesson.scene} lessonTitle={lesson.title} />
      <div className="mx-auto mt-8 max-w-3xl">
        <h2 className="text-2xl font-bold text-brand">{ui.lesson.script}</h2>
        <div className="mt-4">
          <ScriptLines lines={lesson.scene.lines} />
        </div>
      </div>
    </div>
  );
}
