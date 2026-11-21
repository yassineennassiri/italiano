import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { AccentLink } from "@/components/accent-link";
import { Breadcrumb } from "@/components/breadcrumb";
import { DropdownItem } from "@/components/dropdown-item";
import { MediaFrame } from "@/components/media-frame";
import { MultiSelectItem } from "@/components/multi-select-item";
import { NoteRow } from "@/components/note-row";
import { ParlaItem } from "@/components/parla-item";
import { PromptBubble } from "@/components/prompt-bubble";
import { ScenePoster } from "@/components/scene-poster";
import { ScriptToggle } from "@/components/script-toggle";
import { SingleChoiceItem } from "@/components/single-choice-item";
import { SpeakRateItem } from "@/components/speak-rate-item";
import { StepCounterText, StepProgress } from "@/components/step-progress";
import { StepInstruction } from "@/components/step-instruction";
import { TextGapItem } from "@/components/text-gap-item";
import { WordOrderItem } from "@/components/word-order-item";
import { exerciseHashes } from "@/content/hash";
import { type ErrorTag, loadErrorTags, loadLessonBySlug } from "@/content/load";
import { stepLocation, stepPage } from "@/content/lesson-nav";
import type { Item, Lesson, Note, Step } from "@/content/schema";
import { stepScript } from "@/content/script";
import { readLessonEntries } from "@/progress/read";
import { lessonExercises } from "@/scoring/lesson";
import { ui } from "@/ui-it";
import { type LessonRouteParams, lessonFromParams } from "../../lesson-params";

export function generateStaticParams({ params }: { params: LessonRouteParams }) {
  const lesson = loadLessonBySlug(params.level, params.lesson);
  return (lesson?.steps ?? []).map((_, index) => ({ n: String(index + 1) }));
}

/** An exercise step (SPEC §4.2) with its saved progress. Item types without an engine yet show their prompt only. */
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
          <div className="mt-8 space-y-10">
            {step.items.map((item) => (
              <ItemSlot key={item.id} item={item} errorTags={errorTags} />
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

/**
 * An item's interaction, with its notes placed before Soluzione / Controlla
 * (SPEC §4.2). `renderNotes` renders a list of notes, for a speaking item's
 * exchanges (between an exchange and its rating, SPEC §4.3).
 */
function ItemInteraction({ item, notes, renderNotes }: { item: Item; notes: ReactNode; renderNotes: (notes?: Note[]) => ReactNode }) {
  switch (item.type) {
    case "single_choice":
      return <SingleChoiceItem item={item} notes={notes} />;
    case "multi_select":
      return <MultiSelectItem item={item} notes={notes} />;
    case "dropdown":
      return <DropdownItem item={item} notes={notes} />;
    case "text_gap":
      return <TextGapItem item={item} notes={notes} />;
    case "word_order":
      return <WordOrderItem item={item} notes={notes} />;
    case "speak_rate": {
      const exchangeNotes = Object.fromEntries(item.exchanges.map((exchange) => [exchange.id, renderNotes(exchange.notes)]));
      return <SpeakRateItem item={item} exchangeNotes={exchangeNotes} notes={notes} />;
    }
    case "parla":
      return <ParlaItem item={item} notes={notes} />;
    default:
      // No engine yet: just the prompt, then the notes.
      return (
        <>
          {item.prompt && <PromptBubble>{item.prompt}</PromptBubble>}
          {notes}
        </>
      );
  }
}

/** One item: its interaction (or just its prompt, for types without an engine yet) and its notes. */
function ItemSlot({ item, errorTags }: { item: Item; errorTags: ReadonlyMap<string, ErrorTag> }) {
  const renderNotes = (notes?: Note[]) =>
    notes && (
      <div className="mt-4 space-y-2 pl-2">
        {notes.map((note, index) => (
          <NoteRow key={index} note={note} errorTag={note.error_tag ? errorTags.get(note.error_tag) : undefined} />
        ))}
      </div>
    );
  return (
    <section data-item-id={item.id} data-item-type={item.type}>
      <ItemInteraction item={item} notes={renderNotes(item.notes)} renderNotes={renderNotes} />
    </section>
  );
}
