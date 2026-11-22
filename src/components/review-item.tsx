/**
 * An exercise as a review session or a tag drill shows it (SPEC §10.5): where
 * it comes from, its step's media, instruction and reading, and the item in
 * the normal item UI.
 */
import type { ErrorTag } from "@/content/load";
import { readingLayout } from "@/content/reading";
import type { ShownExercise } from "@/review/session";
import { ui } from "@/ui-it";
import { ItemSlot, StepMedia } from "./item-slot";
import { StepInstruction } from "./step-instruction";
import { StepReading } from "./step-reading";

export function ReviewItem({ shown: { lesson, step, item }, errorTags }: { shown: ShownExercise; errorTags: ReadonlyMap<string, ErrorTag> }) {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mt-2 text-sm text-muted">{ui.review.source(lesson.title, step.title)}</p>
      <StepMedia step={step} lesson={lesson} />
      <StepInstruction instruction={step.instruction} instructionEn={step.instruction_en} />
      {step.reading && <StepReading md={step.reading} layout={readingLayout(step)} />}
      <div className="mt-8">
        <ItemSlot item={item} scene={lesson.scene} errorTags={errorTags} />
      </div>
    </div>
  );
}
