/**
 * Zod schemas for the content files (SPEC §9.1). The app's content types are
 * inferred from these schemas, so the schema is the single source of truth.
 *
 * Field language follows ADR-0003: no suffix = Italian, `_en` = English,
 * except the `md` prose of grammar text blocks and the culture page (English).
 */
import { z } from "zod";
import { GAP_MARKER } from "./gap-text";
import { LESSON_ID_PATTERN, unitId } from "./ids";

const id = z.string().min(1);
/** A path under `content/media`, e.g. `images/a2/u01/l01/poster.webp`. */
const mediaPath = z
  .string()
  .regex(/^[\w.-]+(\/[\w.-]+)*$/, "must be a relative path under content/media, with / separators")
  .refine((value) => !value.split("/").includes(".."), "must not contain ..");
/** Any non-empty string. */
const nonEmpty = z.string().min(1);

type IssueSink = { addIssue: (issue: { code: "custom"; message: string; path: PropertyKey[] }) => void };

function report(ctx: IssueSink, path: PropertyKey[], message: string) {
  ctx.addIssue({ code: "custom", message, path });
}

// ── Course ───────────────────────────────────────────────────────────────

export const unitSchema = z.strictObject({
  id,
  number: z.number().int().positive(),
  title: nonEmpty,
  planned_lessons: z.number().int().positive(),
  /** Lesson ids, in order. Empty for units with no lesson files yet. */
  lessons: z.array(id),
});

export const levelSchema = z
  .strictObject({
    id: z.enum(["a2", "b1", "b2"]),
    title: nonEmpty,
    description: nonEmpty,
    units: z.array(unitSchema),
  })
  .superRefine((level, ctx) => {
    const numbers = new Set<number>();
    level.units.forEach((unit, u) => {
      const expected = unitId(level.id, unit.number);
      if (unit.id !== expected) {
        report(ctx, ["units", u, "id"], `"${unit.id}" must be "${expected}" (level ${level.id}, unit ${unit.number})`);
      }
      if (numbers.has(unit.number)) report(ctx, ["units", u, "number"], `duplicate unit number ${unit.number}`);
      numbers.add(unit.number);
    });
  });

export const courseSchema = z.strictObject({
  levels: z.array(levelSchema),
});

// ── Error tags ───────────────────────────────────────────────────────────

export const errorTagSchema = z.strictObject({
  explanation_en: nonEmpty,
  /** The unit that teaches this tag. Omitted when no unit does. */
  unit: id.optional(),
  /** The grammar page that teaches it (e.g. `a2.u01.l01.gr2`), when it isn't the unit's first. */
  grammar_page: id.optional(),
});

/** Tag id (e.g. `article.elision`) → explanation and where it is taught. */
export const errorTagsSchema = z.record(z.string().min(1), errorTagSchema);

// ── Lesson ───────────────────────────────────────────────────────────────

export const scriptLineSchema = z.strictObject({
  id,
  speaker: id,
  it: nonEmpty,
  en: nonEmpty,
  audio: mediaPath.optional(),
});

export const sceneSchema = z.strictObject({
  poster: mediaPath,
  duration_s: z.number().positive(),
  /** Each panel is shown from its `from_line` onward. */
  panels: z.array(z.strictObject({ image: mediaPath, from_line: id })).min(1),
  lines: z.array(scriptLineSchema).min(1),
});

export const noteSchema = z.strictObject({
  kind: z.enum(["info", "tip", "new_words", "attenzione"]),
  text_en: nonEmpty,
  error_tag: id.optional(),
});

const itemBase = {
  id,
  prompt: nonEmpty.optional(),
  prompt_audio: mediaPath.optional(),
  image: mediaPath.optional(),
  notes: z.array(noteSchema).optional(),
  error_tags: z.array(id).optional(),
  solvable: z.boolean().optional(),
};

export const gapSchema = z.strictObject({
  id,
  answer: z.string().min(1),
  accept: z.array(z.string().min(1)).optional(),
  case_sensitive: z.boolean().optional(),
});

const dropdownGapSchema = gapSchema.extend({ options: z.array(z.string().min(1)).min(2) });

export const exchangeSchema = z.strictObject({
  /** "e1"; the full exercise id is the item id + "." + this id. */
  id,
  other: nonEmpty,
  other_audio: mediaPath.optional(),
  me: nonEmpty,
  me_audio: mediaPath.optional(),
  hint: nonEmpty.optional(),
  /** Rendered between this exchange and its rating. */
  notes: z.array(noteSchema).optional(),
});

const clipSchema = z.strictObject({ from_line: id, to_line: id });

/** Every `{{gN}}` marker needs a gap entry, and every gap entry a marker. */
function checkGapMarkers(item: { text: string; gaps: { id: string }[] }, ctx: IssueSink) {
  const markers = [...item.text.matchAll(GAP_MARKER)].map((match) => match[1]);
  const gapIds = item.gaps.map((gap) => gap.id);
  for (const marker of markers) {
    if (!gapIds.includes(marker)) report(ctx, ["text"], `gap marker {{${marker}}} has no gap entry`);
  }
  item.gaps.forEach((gap, i) => {
    if (!markers.includes(gap.id)) report(ctx, ["gaps", i], `gap ${gap.id} has no {{${gap.id}}} marker in text`);
  });
}

const itemVariants = z.discriminatedUnion("type", [
  z.strictObject({
    ...itemBase,
    type: z.literal("dropdown"),
    /** Uses `{{g1}}` gap markers. */
    text: nonEmpty,
    gaps: z.array(dropdownGapSchema).min(1),
  }),
  z.strictObject({
    ...itemBase,
    type: z.literal("text_gap"),
    text: nonEmpty,
    gaps: z.array(gapSchema).min(1),
    layout: z.enum(["default", "full"]).optional(),
  }),
  z.strictObject({
    ...itemBase,
    type: z.literal("word_bank"),
    text: nonEmpty,
    bank: z.array(z.string().min(1)).min(1),
    gaps: z.array(gapSchema).min(1),
  }),
  z.strictObject({
    ...itemBase,
    type: z.literal("audio_gap"),
    clip: clipSchema,
    text: nonEmpty,
    gaps: z.array(gapSchema).min(1),
  }),
  z.strictObject({
    ...itemBase,
    type: z.literal("word_order"),
    /** In the correct order; the app shuffles them. */
    tiles: z.array(z.string().min(1)).min(2),
    accept: z.array(z.array(z.string().min(1))).optional(),
    layout: z.enum(["words", "lines"]).optional(),
  }),
  z.strictObject({
    ...itemBase,
    type: z.enum(["single_choice", "image_choice", "audio_choice"]),
    options: z.array(z.string().min(1)).min(2),
    answer: z.number().int(),
  }),
  z.strictObject({
    ...itemBase,
    type: z.literal("multi_select"),
    options: z.array(z.string().min(1)).min(2),
    answers: z.array(z.number().int()).min(1),
  }),
  z.strictObject({
    ...itemBase,
    type: z.literal("speak_rate"),
    variant: z.enum(["dialogue", "read_along", "personal"]),
    exchanges: z.array(exchangeSchema).min(1),
  }),
  z.strictObject({
    ...itemBase,
    type: z.literal("parla"),
    task: nonEmpty,
    example: nonEmpty,
    checklist: z.array(nonEmpty).min(1),
  }),
]);

/** Reports every id after its first occurrence. */
function checkUnique(ids: string[], pathOf: (i: number) => PropertyKey[], label: string, ctx: IssueSink) {
  const seen = new Set<string>();
  ids.forEach((value, i) => {
    if (seen.has(value)) report(ctx, pathOf(i), `duplicate ${label} id "${value}"`);
    seen.add(value);
  });
}

function checkAnswerIndex(answer: number, options: string[], path: PropertyKey[], ctx: IssueSink) {
  if (answer < 0 || answer >= options.length) {
    report(ctx, path, `answer index ${answer} is out of range (${options.length} options)`);
  }
}

export const itemSchema = itemVariants.superRefine((item, ctx) => {
  if ("text" in item && "gaps" in item) checkGapMarkers(item, ctx);
  switch (item.type) {
    case "dropdown":
      item.gaps.forEach((gap, i) => {
        if (!gap.options.includes(gap.answer)) {
          report(ctx, ["gaps", i, "answer"], `answer "${gap.answer}" is not one of the options`);
        }
      });
      break;
    case "single_choice":
    case "image_choice":
    case "audio_choice":
      checkAnswerIndex(item.answer, item.options, ["answer"], ctx);
      break;
    case "multi_select":
      item.answers.forEach((answer, i) => checkAnswerIndex(answer, item.options, ["answers", i], ctx));
      if (new Set(item.answers).size !== item.answers.length) {
        report(ctx, ["answers"], "answer indexes must not repeat");
      }
      break;
    case "speak_rate":
      checkUnique(
        item.exchanges.map((exchange) => exchange.id),
        (i) => ["exchanges", i, "id"],
        "exchange",
        ctx,
      );
      break;
  }
});

export const stepMediaSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("scene") }),
  z.strictObject({ kind: z.literal("image"), src: mediaPath, alt: nonEmpty }),
  z.strictObject({ kind: z.literal("clip"), from_line: id, to_line: id }),
]);

export const stepSchema = z.strictObject({
  id,
  title: nonEmpty,
  instruction: nonEmpty,
  /** Shown behind the EN toggle; only for tricky instructions. */
  instruction_en: nonEmpty.optional(),
  media: stepMediaSchema.optional(),
  /** What the collapsible Copione shows. */
  script: z.union([z.literal("scene"), z.array(scriptLineSchema)]).optional(),
  /** Markdown document (reading steps). */
  reading: nonEmpty.optional(),
  items: z.array(itemSchema).min(1),
});

export const ruleSegmentSchema = z.strictObject({
  text: z.string().min(1),
  style: z.enum(["plain", "bold", "italic", "highlight"]).optional(),
});

const segmentRef = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);

export const ruleArrowSchema = z.strictObject({
  from: segmentRef,
  to: segmentRef,
  kind: z.enum(["down", "diagonal", "swap"]),
});

const grammarBlockVariants = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("text"), md: nonEmpty }),
  z.strictObject({
    kind: z.literal("example"),
    image: mediaPath.optional(),
    /** `**bold**` marks the target form. */
    it: nonEmpty,
    en: nonEmpty.optional(),
  }),
  z.strictObject({
    kind: z.literal("table"),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
  z.strictObject({
    kind: z.literal("rule"),
    rows: z.array(z.array(ruleSegmentSchema).min(1)).min(1),
    arrows: z.array(ruleArrowSchema).optional(),
  }),
  z.strictObject({
    kind: z.literal("terms"),
    items: z.array(z.strictObject({ term: nonEmpty, def_en: nonEmpty })).min(1),
  }),
]);

export const grammarBlockSchema = grammarBlockVariants.superRefine((block, ctx) => {
  if (block.kind !== "rule") return;
  block.arrows?.forEach((arrow, i) => {
    for (const end of ["from", "to"] as const) {
      const [row, segment] = arrow[end];
      if (block.rows[row]?.[segment] === undefined) {
        report(ctx, ["arrows", i, end], `no segment [${row}, ${segment}] in this rule`);
      }
    }
  });
});

export const grammarPageSchema = z.strictObject({
  id,
  title: nonEmpty,
  blocks: z.array(grammarBlockSchema).min(1),
});

export const vocabEntrySchema = z.strictObject({
  id,
  /** "la valigia" */
  it: nonEmpty,
  plural: nonEmpty.optional(),
  gender: z.enum(["m", "f"]).optional(),
  pos: z.enum(["noun", "verb", "adj", "adv", "phrase", "other"]),
  /** Free text: verb forms, "solo singolare", "dal genovese", … */
  forms: nonEmpty.optional(),
  /** Overrides the default sort (the headword without its article). */
  sort_key: nonEmpty.optional(),
  en: nonEmpty,
  image: mediaPath.optional(),
  audio: mediaPath.optional(),
});

export const culturePageSchema = z.strictObject({
  title: nonEmpty,
  image: mediaPath,
  /** English prose. */
  md: nonEmpty,
});

const lessonFields = z.strictObject({
  id: z.string().regex(LESSON_ID_PATTERN, 'must look like "a2.u01.l01"'),
  version: z.number().int().positive(),
  /** Drafts show a Bozza badge; both are playable and validated. */
  status: z.enum(["draft", "ready"]),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase words joined by hyphens"),
  title: nonEmpty,
  topic: nonEmpty,
  grammar_label: nonEmpty.optional(),
  summary: nonEmpty,
  objectives: z.array(nonEmpty).min(1),
  scene: sceneSchema,
  steps: z.array(stepSchema).min(1),
  grammar: z.array(grammarPageSchema),
  vocab: z.array(vocabEntrySchema),
  culture: culturePageSchema.optional(),
});

/**
 * IDs are hierarchical (SPEC §9): step `a2.u01.l01.s03`, item
 * `a2.u01.l01.s03.i02`, grammar page `a2.u01.l01.gr1`. Progress rows key on
 * them, so they must be unique and well-formed.
 */
function checkIds(lesson: z.infer<typeof lessonFields>, ctx: IssueSink) {
  const checkShape = (value: string, pattern: RegExp, expected: string, path: PropertyKey[]) => {
    if (!pattern.test(value)) report(ctx, path, `"${value}" must look like "${expected}"`);
  };
  const escape = (value: string) => value.replace(/\./g, "\\.");

  lesson.steps.forEach((step, s) => {
    checkShape(step.id, new RegExp(`^${escape(lesson.id)}\\.s\\d{2}$`), `${lesson.id}.sNN`, ["steps", s, "id"]);
    step.items.forEach((item, i) => {
      checkShape(item.id, new RegExp(`^${escape(step.id)}\\.i\\d{2}$`), `${step.id}.iNN`, ["steps", s, "items", i, "id"]);
    });
  });
  lesson.grammar.forEach((page, g) => {
    checkShape(page.id, new RegExp(`^${escape(lesson.id)}\\.gr\\d+$`), `${lesson.id}.grN`, ["grammar", g, "id"]);
  });

  checkUnique(lesson.steps.map((step) => step.id), (s) => ["steps", s, "id"], "step", ctx);
  const items = lesson.steps.flatMap((step, s) => step.items.map((item, i) => ({ id: item.id, path: ["steps", s, "items", i, "id"] })));
  checkUnique(items.map((item) => item.id), (n) => items[n].path, "item", ctx);
  checkUnique(lesson.grammar.map((page) => page.id), (g) => ["grammar", g, "id"], "grammar page", ctx);
  checkUnique(lesson.vocab.map((entry) => entry.id), (v) => ["vocab", v, "id"], "vocab", ctx);
}

export const lessonSchema = lessonFields.superRefine((lesson, ctx) => {
  const lineIds = lesson.scene.lines.map((line) => line.id);
  checkUnique(lineIds, (i) => ["scene", "lines", i, "id"], "scene line", ctx);
  const checkLine = (lineId: string, path: PropertyKey[]) => {
    if (!lineIds.includes(lineId)) report(ctx, path, `no scene line "${lineId}"`);
  };
  lesson.scene.panels.forEach((panel, i) => checkLine(panel.from_line, ["scene", "panels", i, "from_line"]));
  lesson.steps.forEach((step, s) => {
    if (step.media?.kind === "clip") {
      checkLine(step.media.from_line, ["steps", s, "media", "from_line"]);
      checkLine(step.media.to_line, ["steps", s, "media", "to_line"]);
    }
    step.items.forEach((item, i) => {
      if (item.type !== "audio_gap") return;
      checkLine(item.clip.from_line, ["steps", s, "items", i, "clip", "from_line"]);
      checkLine(item.clip.to_line, ["steps", s, "items", i, "clip", "to_line"]);
    });
  });

  checkIds(lesson, ctx);

  const last = lesson.steps.length - 1;
  if (!lesson.steps[last].items.some((item) => item.type === "parla")) {
    report(ctx, ["steps", last], "the last step must contain a parla item");
  }
});

export type Course = z.infer<typeof courseSchema>;
export type Level = z.infer<typeof levelSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type ErrorTags = z.infer<typeof errorTagsSchema>;
export type ErrorTagEntry = z.infer<typeof errorTagSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type ScriptLine = z.infer<typeof scriptLineSchema>;
export type Step = z.infer<typeof stepSchema>;
export type StepMedia = z.infer<typeof stepMediaSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Item = z.infer<typeof itemSchema>;
export type ItemType = Item["type"];
export type Gap = z.infer<typeof gapSchema>;
export type Exchange = z.infer<typeof exchangeSchema>;
export type GrammarPage = z.infer<typeof grammarPageSchema>;
export type GrammarBlock = z.infer<typeof grammarBlockSchema>;
/** One kind of grammar block: `GrammarBlockOf<"rule">`. */
export type GrammarBlockOf<K extends GrammarBlock["kind"]> = Extract<GrammarBlock, { kind: K }>;
export type RuleSegment = z.infer<typeof ruleSegmentSchema>;
export type RuleArrow = z.infer<typeof ruleArrowSchema>;
export type VocabEntry = z.infer<typeof vocabEntrySchema>;
export type CulturePage = z.infer<typeof culturePageSchema>;
