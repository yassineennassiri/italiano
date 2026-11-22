import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccentLink } from "@/components/accent-link";
import { Breadcrumb } from "@/components/breadcrumb";
import { ItemSlot, StepMedia } from "@/components/item-slot";
import { ScriptToggle } from "@/components/script-toggle";
import { StepCounterText, StepProgress } from "@/components/step-progress";
import { StepInstruction } from "@/components/step-instruction";
import { StepReading } from "@/components/step-reading";
import { exerciseHashes } from "@/content/hash";
import { loadErrorTags, loadLessonBySlug } from "@/content/load";
import { stepLocation, stepPage } from "@/content/lesson-nav";
import { readingLayout } from "@/content/reading";
import { stepScript } from "@/content/script";
import { readLessonEntries } from "@/progress/read";
import { lessonExercises } from "@/scoring/lesson";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../../lesson-params";

export function generateStaticParams({ params }: { params: LessonRouteParams }) {
  const lesson = loadLessonBySlug(params.level, params.lesson);
  return (lesson?.steps ?? []).map((_, index) => ({ n: String(index + 1) }));
}

/** An exercise step (SPEC §4.2) with its saved progress. Item types without a component yet show a placeholder card. */
export default function StepRoute({ params }: PageProps<"/[level]/[lesson]/esercizi/[n]">) {
  return (
    <Suspense fallback={null}>
      <StepView params={params} />
    </Suspense>
  );
}

async function StepView({ params }: Pick<PageProps<"/[level]/[lesson]/esercizi/[n]">, "params">) {
  const lesson = await lessonFromParams(params);
  const page = stepPage(lesson, (await params).n) ?? notFound();
  const { step, number, total, nextHref } = page;
  const counter = ui.lesson.stepCounter(number, total);
  const script = stepScript(lesson, step);
  const errorTags = new Map(loadErrorTags().map((tag) => [tag.id, tag]));
  const { saved, loaded } = await readLessonEntries(lesson);
  const allHashes = exerciseHashes(lesson);
  const hashes = Object.fromEntries(lessonExercises({ steps: [step] }).map(({ id }) => [id, allHashes.get(id)!]));

  return (
    <StepProgress lessonId={lesson.id} location={stepLocation(number)} saved={saved} loaded={loaded} hashes={hashes} step={step}>
      <Breadcrumb lesson={lesson} stepTitle={step.title} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <StepMedia step={step} lesson={lesson} />
        <div className="mx-auto max-w-3xl">
          <p className="mt-6 text-center text-sm tracking-widest text-muted">{counter}</p>
          <h1 className="mt-2 text-2xl font-bold text-brand">{step.title}</h1>
          <StepInstruction instruction={step.instruction} instructionEn={step.instruction_en} />
          {script && <ScriptToggle lines={script} />}
          {step.reading && <StepReading md={step.reading} layout={readingLayout(step)} />}
          <div className="mt-8 space-y-10">
            {step.items.map((item) => (
              <ItemSlot key={item.id} item={item} scene={lesson.scene} errorTags={errorTags} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-10 bg-tint py-8 text-center">
        <StepCounterText />
        <AccentLink href={nextHref} className="mt-5">
          {ui.lesson.next}
        </AccentLink>
        <p className="mt-5 text-sm tracking-widest text-muted">{counter}</p>
      </div>
    </StepProgress>
  );
}
