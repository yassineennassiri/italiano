/**
 * Corrections and error cards (SPEC §10.5): *Aggiungi una correzione* writes a
 * manual error_log row and its error card; the card shows the wrong version
 * and asks for the corrected one, checked with the compare rules (§5.1).
 * Pure: the store reads and writes the rows.
 */
import { z } from "zod";
import type { errorLog } from "@/db/schema";
import type { Row } from "@/progress/plan";
import { compareTyped, type GapVerdict } from "@/scoring/compare";
import { dueAt } from "./day";
import { type CardRow, type GradedCard, gradeCard, gradedAt, RESOLVE_STREAK, type ReviewLogRow, type StoredCard } from "./item-card";
import type { ErrorReviewWrite } from "./plan";
import { type Grade, NEW_SCHEDULE } from "./sm2";

/** The error_log sources an error card is built from: corrections, entered by hand now and by an AI later. */
const errorCardSources: readonly ErrorRow["source"][] = ["manual", "ai"];

type ErrorRow = typeof errorLog.$inferSelect;

/**
 * Whether an error_log row gets an error card: only one with both `given` and
 * `expected`, from a correction. Rows from exercises and speaking feed item
 * cards instead, and `parla_note` rows are only logged.
 */
export function getsErrorCard({ source, given, expected }: Pick<ErrorRow, "source" | "given" | "expected">): boolean {
  return errorCardSources.includes(source) && !!given?.trim() && !!expected?.trim();
}

/** Longer than any sentence a correction holds; keeps a stray paste out of the database. */
const MAX_TEXT = 1000;

/** A correction as the form sends it. Both texts are trimmed and can't be empty. */
export const newCorrectionWriteSchema = z.strictObject({
  /** Also the error_log row's id, so a retried write is applied once. */
  eventId: z.uuid(),
  /** When the learner saved it, on their computer. */
  at: z.iso.datetime(),
  /** *Cosa hai detto*. */
  given: z.string().trim().min(1).max(MAX_TEXT),
  /** *Versione corretta*. */
  expected: z.string().trim().min(1).max(MAX_TEXT),
  errorTags: z.array(z.string().min(1)).max(20),
  note: z.string().trim().max(MAX_TEXT),
});
export type NewCorrectionWrite = z.infer<typeof newCorrectionWriteSchema>;

/** The rows one correction writes. */
export type NewCorrectionPlan = { errorRow: Row<typeof errorLog>; card: CardRow };

/**
 * The manual error_log row and its error card, due the day after the learner
 * saved it; undefined when a tag isn't in `error-tags.json`.
 */
export function planNewCorrection({
  write,
  knownTags,
  now,
  newCardId = () => crypto.randomUUID(),
}: {
  write: NewCorrectionWrite;
  knownTags: ReadonlySet<string>;
  now: Date;
  newCardId?: () => string;
}): NewCorrectionPlan | undefined {
  if (!write.errorTags.every((tag) => knownTags.has(tag))) return undefined;
  const at = gradedAt(write.at, now);
  const errorRow = {
    id: write.eventId,
    source: "manual",
    errorTags: [...new Set(write.errorTags)],
    given: write.given,
    expected: write.expected,
    note: write.note === "" ? null : write.note,
    createdAt: at,
  } satisfies Row<typeof errorLog>;
  if (!getsErrorCard(errorRow)) return undefined;
  return {
    errorRow,
    card: {
      id: newCardId(),
      kind: "error",
      refId: write.eventId,
      dueAt: dueAt(at, 1),
      ...NEW_SCHEDULE,
      streak: 0,
      lastResult: null,
      updatedAt: now,
    },
  };
}

/**
 * A typed correction against the row's `expected`, with the compare rules of
 * a typed gap (§5.1): whitespace collapsed, apostrophes equal, accents and
 * case matter, and an accent-only miss told apart.
 */
export const checkRewrite = (text: string, expected: string): GapVerdict => compareTyped(text, { answer: expected });

/** An error card's grade: right → *good*, accent-only → *hard*, wrong or Soluzione (null) → *again* (§10.5). */
export function rewriteGrade(text: string | null, expected: string): Grade {
  if (text === null) return "again";
  const verdicts: Record<GapVerdict, Grade> = { correct: "good", accent_only: "hard", wrong: "again" };
  return verdicts[checkRewrite(text, expected)];
}

/**
 * An error card's answer, graded against its row: the card's new schedule
 * and its `review_log` row. There is no exercise behind it, so no
 * `exercise_attempt` row. A third non-*again* grade in a row resolves the row.
 */
export function planErrorReview({
  card,
  row,
  write,
  now,
}: {
  card: StoredCard;
  row: { expected: string };
  write: ErrorReviewWrite;
  now: Date;
}): { grade: Grade; card: GradedCard; log: ReviewLogRow; resolves: boolean } {
  const grade = rewriteGrade(write.text, row.expected);
  const graded = gradeCard({ card, grade, source: write.source, eventId: write.eventId, at: gradedAt(write.at, now), now });
  return { grade, ...graded, resolves: graded.card.streak >= RESOLVE_STREAK };
}
