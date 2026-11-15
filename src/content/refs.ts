/**
 * Walkers that collect what a lesson references outside itself: error tags
 * and media files. Each reference carries the JSON path it was found at, so
 * `content:check` can say exactly where a broken reference lives.
 */
import type { Item, Lesson, Note, ScriptLine, Step } from "./schema";

export type Ref = { value: string; path: PropertyKey[] };

function noteTags(notes: Note[] | undefined, at: PropertyKey[]): Ref[] {
  return (notes ?? []).flatMap((note, n) =>
    note.error_tag ? [{ value: note.error_tag, path: [...at, "notes", n, "error_tag"] }] : [],
  );
}

function itemTags(item: Item, at: PropertyKey[]): Ref[] {
  return [
    ...(item.error_tags ?? []).map((tag, t) => ({ value: tag, path: [...at, "error_tags", t] })),
    ...noteTags(item.notes, at),
    ...(item.type === "speak_rate"
      ? item.exchanges.flatMap((exchange, e) => noteTags(exchange.notes, [...at, "exchanges", e]))
      : []),
  ];
}

/** A one-element ref list when the field is set, else empty. */
function refIfSet(value: string | undefined, path: PropertyKey[]): Ref[] {
  return value ? [{ value, path }] : [];
}

function lineAudio(lines: ScriptLine[], at: PropertyKey[]): Ref[] {
  return lines.flatMap((line, l) => refIfSet(line.audio, [...at, l, "audio"]));
}

function itemMedia(item: Item, at: PropertyKey[]): Ref[] {
  return [
    ...refIfSet(item.prompt_audio, [...at, "prompt_audio"]),
    ...refIfSet(item.image, [...at, "image"]),
    ...(item.type === "speak_rate"
      ? item.exchanges.flatMap((exchange, e) => [
          ...refIfSet(exchange.other_audio, [...at, "exchanges", e, "other_audio"]),
          ...refIfSet(exchange.me_audio, [...at, "exchanges", e, "me_audio"]),
        ])
      : []),
  ];
}

function stepMedia(step: Step, s: number): Ref[] {
  const at = ["steps", s];
  return [
    ...(step.media?.kind === "image" ? [{ value: step.media.src, path: [...at, "media", "src"] }] : []),
    ...(Array.isArray(step.script) ? lineAudio(step.script, [...at, "script"]) : []),
    ...step.items.flatMap((item, i) => itemMedia(item, [...at, "items", i])),
  ];
}

/** Every media path (relative to `content/media`) a lesson references, in file order. */
export function mediaRefs(lesson: Lesson): Ref[] {
  const { scene } = lesson;
  return [
    { value: scene.poster, path: ["scene", "poster"] },
    ...scene.panels.map((panel, p) => ({ value: panel.image, path: ["scene", "panels", p, "image"] })),
    ...lineAudio(scene.lines, ["scene", "lines"]),
    ...lesson.steps.flatMap(stepMedia),
    ...lesson.grammar.flatMap((page, g) =>
      page.blocks.flatMap((block, b) =>
        block.kind === "example" ? refIfSet(block.image, ["grammar", g, "blocks", b, "image"]) : [],
      ),
    ),
    ...lesson.vocab.flatMap((entry, v) => [
      ...refIfSet(entry.image, ["vocab", v, "image"]),
      ...refIfSet(entry.audio, ["vocab", v, "audio"]),
    ]),
    ...(lesson.culture ? [{ value: lesson.culture.image, path: ["culture", "image"] }] : []),
  ];
}

export function errorTagRefs(lesson: Lesson): Ref[] {
  return lesson.steps.flatMap((step, s) =>
    step.items.flatMap((item, i) => itemTags(item, ["steps", s, "items", i])),
  );
}
