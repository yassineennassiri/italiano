/**
 * Self-rated exercises (SPEC §5.2.11, §5.2.12): each exchange of a `speak_rate`
 * item, and a `parla` item. *Bene* or *Non tanto bene* completes the exercise
 * and locks it; it never scores (ADR-0002). *Non tanto bene* is logged as an
 * error (source `speak_rate` or `parla`). Parla! also takes an optional
 * *Su cosa hai esitato?* note, sent with the rating and logged as `parla_note`.
 */
import { z } from "zod";
import type { Exchange, Item } from "@/content/schema";
import { applyEvent } from "@/scoring/exercise";
import { type ErrorDetail, type ExerciseEntry, type ExerciseOutcome, isLocked } from "./entry";
import type { InputView } from "./input-look";

export type SpeakRateItem = Pick<Extract<Item, { type: "speak_rate" }>, "id" | "exchanges">;

export const ratingSchema = z.enum(["good", "not_great"]);
/** Bene or Non tanto bene. */
export type Rating = z.infer<typeof ratingSchema>;

/** The longest hesitation note kept. */
export const NOTE_MAX_LENGTH = 1000;

/** The stored answer: the rating, and for Parla! the hesitation note if one was written. */
export const ratingAnswerSchema = z.strictObject({
  rating: ratingSchema,
  note: z.string().min(1).max(NOTE_MAX_LENGTH).optional(),
});
export type RatingAnswer = z.infer<typeof ratingAnswerSchema>;

type Entry = ExerciseEntry<RatingAnswer>;

/** The error tag a hesitation note is logged with, besides the item's own (SPEC §10.4). */
export const HESITATION_TAG = "speaking";

function rate(entry: Entry, rating: Rating, note: string | undefined, errors: ErrorDetail[]): ExerciseOutcome<RatingAnswer> | undefined {
  if (isLocked(entry)) return undefined;
  return {
    entry: { state: applyEvent(entry.state, { type: "rate", rating }), answer: { rating, ...(note && { note }) } },
    action: "rate",
    correct: null,
    errors,
  };
}

/** Rates one exchange, or undefined when it is already rated or comes with a note (only Parla! takes one). */
export function rateExchange(exchange: Pick<Exchange, "me">, entry: Entry, rating: Rating, note?: string): ExerciseOutcome<RatingAnswer> | undefined {
  if (note !== undefined) return undefined;
  return rate(entry, rating, undefined, rating === "not_great" ? [{ source: "speak_rate", expected: exchange.me }] : []);
}

/** Rates the Parla! task with its hesitation note (trimmed; a blank one is dropped), or undefined when already rated. */
export function rateParla(entry: Entry, rating: Rating, note?: string): ExerciseOutcome<RatingAnswer> | undefined {
  const kept = note?.trim().slice(0, NOTE_MAX_LENGTH) || undefined;
  const errors: ErrorDetail[] = [
    ...(rating === "not_great" ? [{ source: "parla" as const }] : []),
    ...(kept ? [{ source: "parla_note" as const, note: kept, errorTags: [HESITATION_TAG] }] : []),
  ];
  return rate(entry, rating, kept, errors);
}

/** The rating given, or null before. */
export function ratingOf(entry: Pick<ExerciseEntry, "state">): Rating | null {
  if (entry.state.status === "rated_good") return "good";
  if (entry.state.status === "rated_not_great") return "not_great";
  return null;
}

/** How Bene and Non tanto bene look: open until rated, then the choice highlighted and the other dimmed (SPEC §5.1). */
export function ratingViews(entry: Pick<ExerciseEntry, "state">): Record<Rating, InputView> {
  const rated = ratingOf(entry);
  const view = (rating: Rating): InputView =>
    rated === null ? { look: "idle", disabled: false } : { look: rated === rating ? "selected" : "dimmed", disabled: true };
  return { good: view("good"), not_great: view("not_great") };
}
