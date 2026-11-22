-- Backfill (SPEC §10.5): when vocab cards ship, every lesson already
-- completed gets one vocab card per vocab entry, due at the next midnight in
-- Genoa. The database doesn't have the content, so the entries are listed
-- here as the content had them when this migration was written. Cards that
-- exist already keep their schedule. Runs once, with the migration.
INSERT INTO "review_card" ("id", "user_id", "kind", "ref_id", "due_at", "interval_days", "ease", "reps", "lapses", "streak")
SELECT gen_random_uuid(), "lesson_progress"."user_id", 'vocab', "vocab"."ref_id",
  (date_trunc('day', now() AT TIME ZONE 'Europe/Rome') + interval '1 day') AT TIME ZONE 'Europe/Rome',
  1, 2.5, 0, 0, 0
FROM "lesson_progress"
JOIN (VALUES
  ('a2.u01.l01', 'a2.u01.l01.v-appartamento'),
  ('a2.u01.l01', 'a2.u01.l01.v-caruggio'),
  ('a2.u01.l01', 'a2.u01.l01.v-ombrello'),
  ('a2.u01.l01', 'a2.u01.l01.v-perdersi'),
  ('a2.u01.l01', 'a2.u01.l01.v-ritardo'),
  ('a2.u01.l01', 'a2.u01.l01.v-straniero'),
  ('a2.u01.l01', 'a2.u01.l01.v-valigia'),
  ('a2.u01.l01', 'a2.u01.l01.v-viaggio'),
  ('a2.u01.l01', 'a2.u01.l01.v-vicolo'),
  ('a2.u01.l01', 'a2.u01.l01.v-zaino'),
  ('a2.u01.l02', 'a2.u01.l02.v-altana'),
  ('a2.u01.l02', 'a2.u01.l02.v-ardesia'),
  ('a2.u01.l02', 'a2.u01.l02.v-armadio'),
  ('a2.u01.l02', 'a2.u01.l02.v-bagno'),
  ('a2.u01.l02', 'a2.u01.l02.v-bicchiere'),
  ('a2.u01.l02', 'a2.u01.l02.v-camera'),
  ('a2.u01.l02', 'a2.u01.l02.v-chiave'),
  ('a2.u01.l02', 'a2.u01.l02.v-cucina'),
  ('a2.u01.l02', 'a2.u01.l02.v-frigorifero'),
  ('a2.u01.l02', 'a2.u01.l02.v-lavatrice'),
  ('a2.u01.l02', 'a2.u01.l02.v-luce'),
  ('a2.u01.l02', 'a2.u01.l02.v-mano'),
  ('a2.u01.l02', 'a2.u01.l02.v-problema'),
  ('a2.u01.l02', 'a2.u01.l02.v-scala'),
  ('a2.u01.l02', 'a2.u01.l02.v-specchio')
) AS "vocab" ("lesson_id", "ref_id") ON "vocab"."lesson_id" = "lesson_progress"."lesson_id"
WHERE "lesson_progress"."status" = 'completed'
ON CONFLICT ("user_id", "kind", "ref_id") DO NOTHING;
