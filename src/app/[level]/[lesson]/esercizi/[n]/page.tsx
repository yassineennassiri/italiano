import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccentLink } from "@/components/accent-link";
import { Breadcrumb } from "@/components/breadcrumb";
import { MediaFrame } from "@/components/media-frame";
import { NoteRow } from "@/components/note-row";
import { ScenePoster } from "@/components/scene-poster";
import { ScriptToggle } from "@/components/script-toggle";
import { StepInstruction } from "@/components/step-instruction";
import { type ErrorTag, loadErrorTags, loadLessonBySlug } from "@/content/load";
import { stepPage } from "@/content/lesson-nav";
import type { Item, Lesson, Step } from "@/content/schema";
import { stepScript } from "@/content/script";
import { lessonExercises } from "@/scoring/lesson";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../../lesson-params";

export function generateStaticParams({ params }: { params: LessonRouteParams }) {
  const lesson = loadLessonBySlug(params.level, params.lesson);
  return (lesson?.steps ?? []).map((_, index) => ({ n: String(index + 1) }));
}

/** An exercise step (SPEC §4.2). The items' interactions arrive with the item engine. */
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
  const exercises = lessonExercises(lesson).filter((exercise) => exercise.stepId === step.id);
  const counter = ui.lesson.stepCounter(number, total);
  const script = stepScript(lesson, step);
  const errorTags = new Map(loadErrorTags().map((tag) => [tag.id, tag]));

  return (
    <>
      <Breadcrumb lesson={lesson} stepTitle={step.title} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <StepMedia step={step} lesson={lesson} />
        <div className="mx-auto max-w-3xl">
          <p className="mt-6 text-center text-sm tracking-widest text-muted">{counter}</p>
          <h1 className="mt-2 text-2xl font-bold text-brand">{step.title}</h1>
          <StepInstruction instruction={step.instruction} instructionEn={step.instruction_en} />
          {script && <ScriptToggle lines={script} />}
          <div className="mt-8 space-y-10">
            {step.items.map((item) => (
              <ItemSlot key={item.id} item={item} errorTags={errorTags} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-10 bg-tint py-8 text-center">
        {/* Zeros until the item engine feeds the scoring core's counts (SPEC §6.2). */}
        <p>{ui.lesson.footerCounter({ completed: 0, total: exercises.length, points: 0 })}</p>
        <AccentLink href={nextHref} className="mt-5">
          {ui.lesson.next}
        </AccentLink>
        <p className="mt-5 text-sm tracking-widest text-muted">{counter}</p>
      </div>
    </>
  );
}

function StepMedia({ step, lesson }: { step: Step; lesson: Lesson }) {
  switch (step.media?.kind) {
    case "scene":
      return <ScenePoster scene={lesson.scene} lessonTitle={lesson.title} />;
    case "image":
      return <MediaFrame src={step.media.src} alt={step.media.alt} fit="contain" />;
    default:
      // No media, or a clip (M2).
      return null;
  }
}

/** Where an item's interaction goes: its prompt bubble now, its controls with the item engine. */
function ItemSlot({ item, errorTags }: { item: Item; errorTags: ReadonlyMap<string, ErrorTag> }) {
  return (
    <section data-item-id={item.id} data-item-type={item.type}>
      {item.prompt && (
        <p className="relative ml-2 inline-block rounded-lg border-2 border-accent bg-background px-4 py-3 font-semibold text-brand after:absolute after:-left-[9px] after:bottom-3 after:size-4 after:rotate-45 after:border-b-2 after:border-l-2 after:border-accent after:bg-background">
          {item.prompt}
        </p>
      )}
      {item.notes && (
        <div className="mt-4 space-y-2 pl-2">
          {item.notes.map((note, index) => (
            <NoteRow key={index} note={note} errorTag={note.error_tag ? errorTags.get(note.error_tag) : undefined} />
          ))}
        </div>
      )}
    </section>
  );
}
