-- Backfill (SPEC §10.5): when review cards ship, every exercise with an
-- unresolved error_log row from an exercise or a speaking exchange gets an
-- item card, due at the next midnight in Genoa. Accent-only misses
-- (`spelling.accent`) never make a card. Runs once, with the migration.
INSERT INTO "review_card" ("id", "user_id", "kind", "ref_id", "due_at", "interval_days", "ease", "reps", "lapses", "streak")
SELECT gen_random_uuid(), "user_id", 'item', "item_id",
  (date_trunc('day', now() AT TIME ZONE 'Europe/Rome') + interval '1 day') AT TIME ZONE 'Europe/Rome',
  1, 2.5, 0, 0, 0
FROM (
  SELECT DISTINCT "user_id", "item_id"
  FROM "error_log"
  WHERE NOT "resolved"
    AND "source" IN ('exercise', 'speak_rate')
    AND "item_id" IS NOT NULL
    AND NOT ('spelling.accent' = ANY ("error_tags"))
) AS "errors"
ON CONFLICT ("user_id", "kind", "ref_id") DO NOTHING;
