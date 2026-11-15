/**
 * The M1 tables from SPEC §10.1–10.4. Content is not in the database: rows
 * point at content ids from the JSON files (`a2.u01.l01`, item and exchange
 * ids). Every table carries `user_id` so a second profile stays possible
 * (ADR-0001). `review_card` and `feedback_note` (§10.5–10.6) come in M2.
 *
 * After changing this file run `npm run db:generate` and commit the new SQL
 * under `drizzle/`.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
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

export const attemptActions = ["check", "solve", "rate", "reset"] as const;
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
