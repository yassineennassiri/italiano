import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AccentLink } from "@/components/accent-link";
import { Breadcrumb } from "@/components/breadcrumb";
import { ItemSlot, StepMedia } from "@/components/item-slot";
import { ReviewItem } from "@/components/review-item";
import { type RipassoExercise, RipassoCounterText, RipassoProgress } from "@/components/ripasso-step";
import { ScriptToggle } from "@/components/script-toggle";
import { StepCounterText, StepProgress } from "@/components/step-progress";
import { StepInstruction } from "@/components/step-instruction";
import { StepReading } from "@/components/step-reading";
import { LessonVocab } from "@/components/vocab-link";
import { exerciseHashes } from "@/content/hash";
import { lessonIdOfExercise } from "@/content/ids";
import { type ErrorTag, loadErrorTags, loadLesson, loadLessonBySlug } from "@/content/load";
import { type StepPage, stepLocation, stepPage } from "@/content/lesson-nav";
import { readingLayout } from "@/content/reading";
import type { Lesson, Step } from "@/content/schema";
import { stepScript } from "@/content/script";
import { linkedVocab } from "@/content/vocab-links";
import { findExercise, parseAnswer } from "@/items/engine";
import { readLessonEntries, readRipassoCards, readStepLayout } from "@/progress/read";
import { ripassoEntry } from "@/review/ripasso";
import { type ShownExercise, shownExercise } from "@/review/session";
import type { RipassoChoice } from "@/review/store";
import { lessonExercises } from "@/scoring/lesson";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../../lesson-params";

export function generateStaticParams({ params }: { params: LessonRouteParams }) {
  const lesson = loadLessonBySlug(params.level, params.lesson);
  // One more than the lesson's steps: the place a Ripasso personale step may take (ADR-0005).
  const count = lesson ? lesson.steps.length + 1 : 0;
  return Array.from({ length: count }, (_, index) => ({ n: String(index + 1) }));
}

/**
 * An exercise step (SPEC §4.2) with its saved progress, or the visit's
 * Ripasso personale step (§10.5). Item types without a component yet show a
 * placeholder card.
 */
export default function StepRoute({ params }: PageProps<"/[level]/[lesson]/esercizi/[n]">) {
  return (
    <Suspense fallback={null}>
      <StepView params={params} />
    </Suspense>
  );
}

async function StepView({ params }: Pick<PageProps<"/[level]/[lesson]/esercizi/[n]">, "params">) {
  const lesson = await lessonFromParams(params);
  const { layout, choice } = await readStepLayout(lesson, { choose: true });
  const page = stepPage(lesson, (await params).n, layout) ?? notFound();
  const errorTags = new Map(loadErrorTags().map((tag) => [tag.id, tag]));
  return page.kind === "ripasso" ? (
    <RipassoStepView lesson={lesson} page={page} choice={choice} errorTags={errorTags} />
  ) : (
    <LessonStepView lesson={lesson} page={page} errorTags={errorTags} />
  );
}

type ViewProps = { lesson: Lesson; errorTags: ReadonlyMap<string, ErrorTag> };

async function LessonStepView({ lesson, page, errorTags }: ViewProps & { page: StepPage<Step> & { kind: "lesson" } }) {
  const { step, number, total, nextHref } = page;
  const counter = ui.lesson.stepCounter(number, total);
  const script = stepScript(lesson, step);
  const { saved, loaded } = await readLessonEntries(lesson);
  const allHashes = exerciseHashes(lesson);
  const hashes = Object.fromEntries(lessonExercises({ steps: [step] }).map(({ id }) => [id, allHashes.get(id)!]));

  return (
    <StepProgress lessonId={lesson.id} location={stepLocation(number)} saved={saved} loaded={loaded} hashes={hashes} step={step}>
      <Breadcrumb lesson={lesson} stepTitle={step.title} />
      <LessonVocab entries={linkedVocab(lesson)}>
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
      </LessonVocab>
      <StepFooter counter={counter} nextHref={nextHref}>
        <StepCounterText />
      </StepFooter>
    </StepProgress>
  );
}

/**
 * The Ripasso personale step: the exercises frozen for this visit, from other
 * lessons, each in the normal item UI under where it comes from, as in a
 * review session. An exercise whose content is gone is left out.
 */
async function RipassoStepView({ lesson, page, choice, errorTags }: ViewProps & { page: StepPage<Step>; choice: RipassoChoice }) {
  const { number, total, nextHref } = page;
  const counter = ui.lesson.stepCounter(number, total);
  const { cards, loaded } = await readRipassoCards(choice);
  const shown = cards.flatMap((card) => {
    const lessonId = lessonIdOfExercise(card.exerciseId);
    const source = lessonId === undefined ? undefined : loadLesson(lessonId);
    const exercise = source && shownExercise(source, card.exerciseId);
    return exercise ? [{ card, exercise, source }] : [];
  });
  const exercises: RipassoExercise[] = shown.map(({ card, exercise, source }) => ({
    exerciseId: card.exerciseId,
    cardId: card.cardId,
    contentHash: exercise.contentHash,
    ...(card.answer && { restored: restoredEntry(source, exercise, card.answer) }),
  }));

  return (
    <RipassoProgress
      lessonId={lesson.id}
      location={stepLocation(number)}
      visit={choice.chosenAt?.toISOString() ?? ""}
      exercises={exercises}
      loaded={loaded}
    >
      <Breadcrumb lesson={lesson} stepTitle={ui.lesson.ripasso.title} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <p className="mt-6 text-center text-sm tracking-widest text-muted">{counter}</p>
          <h1 className="mt-2 text-2xl font-bold text-brand">{ui.lesson.ripasso.title}</h1>
          <StepInstruction instruction={ui.lesson.ripasso.instruction} />
        </div>
        <div className="mt-8 space-y-14">
          {shown.map(({ exercise }) => (
            <ReviewItem key={exercise.exerciseId} shown={exercise} errorTags={errorTags} />
          ))}
        </div>
      </div>
      <StepFooter counter={counter} nextHref={nextHref}>
        <RipassoCounterText />
      </StepFooter>
    </RipassoProgress>
  );
}

/** The answer given earlier in this visit, while it still fits the exercise's content. */
function restoredEntry(source: Lesson, exercise: ShownExercise, answer: { answer: unknown; correct: boolean | null }) {
  const found = findExercise(source, exercise.exerciseId);
  const parsed = found && parseAnswer(found, answer.answer);
  return parsed ? ripassoEntry(exercise.item, { answer: parsed.answer, correct: answer.correct }) : undefined;
}

/** The footer band (SPEC §4.2): the live counter, Avanti, and "N / M" again. */
function StepFooter({ counter, nextHref, children }: { counter: string; nextHref: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 bg-tint py-8 text-center">
      {children}
      <AccentLink href={nextHref} className="mt-5">
        {ui.lesson.next}
      </AccentLink>
      <p className="mt-5 text-sm tracking-widest text-muted">{counter}</p>
    </div>
  );
}
