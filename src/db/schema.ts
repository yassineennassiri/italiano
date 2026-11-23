/**
 * The tables from SPEC §10.1–10.6. Content is not in the database: rows
 * point at content ids from the JSON files (`a2.u01.l01`, item and exchange
 * ids). Every table carries `user_id` so a second profile stays possible
 * (ADR-0001).
 *
 * After changing this file run `npm run db:generate` and commit the new SQL
 * under `drizzle/`.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { feedbackScopes } from "../feedback/notes";
import { cardKinds } from "../review/kinds";
import { grades } from "../review/sm2";
import { exerciseStatuses } from "../scoring/exercise";
import { lessonStatuses } from "../scoring/lesson";

/** The one learner. There is no login: every request uses this profile (SPEC §8, §10.1). */
export const PROFILE_ID = "00000000-0000-4000-8000-000000000001";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
// No ON DELETE CASCADE: deleting a profile must never wipe its error log (§10.4).
const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => profile.id);

/** A `CHECK (column IN (...))` constraint for a text column with fixed values. */
function oneOf(name: string, column: { name: string }, values: readonly string[]) {
  const list = sql.raw(values.map((value) => `'${value}'`).join(", "));
  return check(name, sql`${sql.identifier(column.name)} in (${list})`);
}

/** `review`: an answer given in the review hub or a Ripasso personale step (§10.3). */
export const attemptActions = ["check", "solve", "rate", "reset", "review"] as const;
export const errorSources = ["exercise", "speak_rate", "parla", "parla_note", "manual", "ai"] as const;

/** §10.1: one row with a fixed UUID, created by `npm run db:seed`. No login. */
export const profile = pgTable("profile", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

/** §10.2: one row per lesson the learner has opened. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: userId(),
    lessonId: text("lesson_id").notNull(),
    contentVersion: integer("content_version").notNull(),
    status: text("status", { enum: lessonStatuses }).notNull().default("not_started"),
    lastLocation: text("last_location"),
    /**
     * The exercise ids frozen for this visit's Ripasso personale step (§10.5,
     * ADR-0005): null = not chosen yet, empty = no step. Finish and Azzera clear it.
     */
    reviewItems: text("review_items").array(),
    /** When `review_items` was chosen: the step's answers given since then show again after a reload. */
    reviewChosenAt: timestamp("review_chosen_at", { withTimezone: true }),
    lastPercent: integer("last_percent"),
    bestPercent: integer("best_percent"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] }), oneOf("lesson_progress_status_check", t.status, lessonStatuses)],
);

/**
 * §10.3: the current state of one exercise. `item_id` is an exercise id: an
 * item id, or an exchange id for speaking items. A row whose `content_hash`
 * no longer matches the content is ignored on load. Reset deletes the rows.
 */
export const itemState = pgTable(
  "item_state",
  {
    userId: userId(),
    itemId: text("item_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    status: text("status", { enum: exerciseStatuses }).notNull(),
    firstCheckCorrect: boolean("first_check_correct"),
    points: smallint("points").notNull().default(0),
    answer: jsonb("answer"),
    contentHash: text("content_hash").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }),
    index("item_state_lesson_idx").on(t.userId, t.lessonId),
    oneOf("item_state_status_check", t.status, exerciseStatuses),
    check("item_state_points_check", sql`${t.points} in (0, 1)`),
  ],
);

/** §10.3: append-only history of every Check, Solve, self-rating and Reset. Never reset. */
export const exerciseAttempt = pgTable(
  "exercise_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    itemId: text("item_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    contentVersion: integer("content_version").notNull(),
    action: text("action", { enum: attemptActions }).notNull(),
    answer: jsonb("answer"),
    result: jsonb("result"),
    correct: boolean("correct"),
    createdAt: createdAt(),
  },
  (t) => [oneOf("exercise_attempt_action_check", t.action, attemptActions)],
);

/** §10.4: the permanent record of mistakes. Reset never clears it. */
export const errorLog = pgTable(
  "error_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    source: text("source", { enum: errorSources }).notNull(),
    lessonId: text("lesson_id"),
    itemId: text("item_id"),
    gapId: text("gap_id"),
    errorTags: text("error_tags").array().notNull().default(sql`'{}'::text[]`),
    expected: text("expected"),
    given: text("given"),
    note: text("note"),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [oneOf("error_log_source_check", t.source, errorSources)],
);

/** Where a review session answers a card (§10.5). */
export const sessionSources = ["hub", "drill", "ripasso_personale"] as const;
/**
 * What graded the card in a `review_log` row: a session, or `lesson`, a lesson
 * answer that graded an existing card *again* (§10.5). Logging those too
 * keeps the history complete for a later FSRS fit (ADR-0004).
 */
export const reviewSources = [...sessionSources, "lesson"] as const;

/**
 * §10.5: a spaced-repetition card, scheduled with SM-2 (ADR-0004). For `item`
 * cards `ref_id` is an exercise id. Reset (Azzera) never deletes cards.
 */
export const reviewCard = pgTable(
  "review_card",
  {
    id: uuid("id").primaryKey(),
    userId: userId(),
    kind: text("kind", { enum: cardKinds }).notNull(),
    refId: text("ref_id").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    intervalDays: doublePrecision("interval_days").notNull(),
    ease: doublePrecision("ease").notNull(),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastResult: text("last_result", { enum: grades }),
    /** Non-*again* grades in a row; 3 resolve the card's error_log rows. */
    streak: integer("streak").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("review_card_ref_unique").on(t.userId, t.kind, t.refId),
    index("review_card_due_idx").on(t.userId, t.dueAt),
    oneOf("review_card_kind_check", t.kind, cardKinds),
    oneOf("review_card_last_result_check", t.lastResult, grades),
  ],
);

/** §10.5: append-only, one row per review, the history a later FSRS fit needs (ADR-0004). `id` is the write's eventId. */
export const reviewLog = pgTable(
  "review_log",
  {
    id: uuid("id").primaryKey(),
    userId: userId(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => reviewCard.id),
    grade: text("grade", { enum: grades }).notNull(),
    intervalBefore: doublePrecision("interval_before").notNull(),
    intervalAfter: doublePrecision("interval_after").notNull(),
    easeBefore: doublePrecision("ease_before").notNull(),
    easeAfter: doublePrecision("ease_after").notNull(),
    source: text("source", { enum: reviewSources }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [oneOf("review_log_grade_check", t.grade, grades), oneOf("review_log_source_check", t.source, reviewSources)],
);

/**
 * §10.6: my notes about content to fix. `ref_id` is a level id for a level
 * note, or a lesson id plus the page (`a2.u01.l02/esercizi/4`) for a lesson
 * note. `id` is the write's eventId. *Fatto* sets `done`; Reset never touches it.
 */
export const feedbackNote = pgTable(
  "feedback_note",
  {
    id: uuid("id").primaryKey(),
    userId: userId(),
    scope: text("scope", { enum: feedbackScopes }).notNull(),
    refId: text("ref_id").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
    done: boolean("done").notNull().default(false),
  },
  (t) => [index("feedback_note_open_idx").on(t.userId, t.done), oneOf("feedback_note_scope_check", t.scope, feedbackScopes)],
);
