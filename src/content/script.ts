/** What a step's collapsible Copione shows (SPEC §4.2). */
import type { Lesson, ScriptLine, Step } from "./schema";

/** The step's own lines, the whole scene's for `script: "scene"`, or undefined when it has none. */
export function stepScript(lesson: Pick<Lesson, "scene">, step: Pick<Step, "script">): ScriptLine[] | undefined {
  return step.script === "scene" ? lesson.scene.lines : step.script;
}
