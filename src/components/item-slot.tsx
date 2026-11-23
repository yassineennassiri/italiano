/**
 * A step's media and one item's interaction with its notes, as a step page
 * shows them (SPEC §4.2). The review session (§10.5) shows a card's item the
 * same way. The items read and change their exercise through the
 * `ExerciseProgress` around them.
 */
import type { ReactNode } from "react";
import { clipLines } from "@/content/clip";
import type { ErrorTag } from "@/content/load";
import type { Item, Lesson, Note, Scene, Step } from "@/content/schema";
import type { Settings } from "@/settings/settings";
import { audioChoiceClips } from "@/items/audio-choice";
import { ui } from "@/ui-it";
import { AudioGapItem } from "./audio-gap-item";
import { ClipPlayer } from "./clip-player";
import { DropdownItem } from "./dropdown-item";
import { MediaFrame } from "./media-frame";
import { MultiSelectItem } from "./multi-select-item";
import { NoteRow } from "./note-row";
import { ParlaItem } from "./parla-item";
import { ScenePlayer } from "./scene-player";
import { SingleChoiceItem } from "./single-choice-item";
import { SpeakRateItem } from "./speak-rate-item";
import { TextGapItem } from "./text-gap-item";
import { WordBankItem } from "./word-bank-item";
import { WordOrderItem } from "./word-order-item";

/** The step's media above its items: the scene, an image or a clip. `settings`: the saved ones, for the scene player, when the page read them. */
export function StepMedia({ step, lesson, settings }: { step: Step; lesson: Lesson; settings?: Settings }) {
  switch (step.media?.kind) {
    case "scene":
      return <ScenePlayer scene={lesson.scene} lessonTitle={lesson.title} settings={settings} />;
    case "image":
      return <MediaFrame src={step.media.src} alt={step.media.alt} fit="contain" />;
    case "clip":
      return <ClipPlayer lines={clipLines(lesson.scene, step.media)} />;
    default:
      return null;
  }
}

/**
 * An item's interaction, with its notes placed before Soluzione / Controlla
 * (SPEC §4.2). `renderNotes` renders a list of notes, for a speaking item's
 * exchanges (between an exchange and its rating, SPEC §4.3).
 */
function ItemInteraction({
  item,
  scene,
  notes,
  renderNotes,
}: {
  item: Item;
  scene: Scene;
  notes: ReactNode;
  renderNotes: (notes?: Note[]) => ReactNode;
}) {
  switch (item.type) {
    case "single_choice":
    case "image_choice":
      return <SingleChoiceItem item={item} notes={notes} />;
    case "audio_choice":
      return <SingleChoiceItem item={item} notes={notes} promptClips={audioChoiceClips(item, scene)} />;
    case "multi_select":
      return <MultiSelectItem item={item} notes={notes} />;
    case "dropdown":
      return <DropdownItem item={item} notes={notes} />;
    case "text_gap":
      return <TextGapItem item={item} notes={notes} />;
    case "word_bank":
      return <WordBankItem item={item} notes={notes} />;
    case "audio_gap":
      return <AudioGapItem item={item} clip={clipLines(scene, item.clip)} notes={notes} />;
    case "word_order":
      return <WordOrderItem item={item} notes={notes} />;
    case "speak_rate": {
      const exchangeNotes = Object.fromEntries(item.exchanges.map((exchange) => [exchange.id, renderNotes(exchange.notes)]));
      return <SpeakRateItem item={item} exchangeNotes={exchangeNotes} notes={notes} />;
    }
    case "parla":
      return <ParlaItem item={item} notes={notes} />;
    default:
      // No component yet: a plain card. The item still counts as an unattempted exercise.
      return <UnbuiltItem />;
  }
}

/** In place of an item whose type has no component yet; its notes wait for the component too. */
function UnbuiltItem() {
  return <p className="rounded-lg border-2 border-dashed border-line bg-tint px-4 py-6 text-center text-muted">{ui.lesson.unbuiltItem}</p>;
}

/** One item: its interaction and its notes, or a placeholder card for types without a component yet. */
export function ItemSlot({ item, scene, errorTags }: { item: Item; scene: Scene; errorTags: ReadonlyMap<string, ErrorTag> }) {
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
      <ItemInteraction item={item} scene={scene} notes={renderNotes(item.notes)} renderNotes={renderNotes} />
    </section>
  );
}
