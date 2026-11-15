CREATE TABLE "error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"lesson_id" text,
	"item_id" text,
	"gap_id" text,
	"error_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"expected" text,
	"given" text,
	"note" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_log_source_check" CHECK ("source" in ('exercise', 'speak_rate', 'parla', 'parla_note', 'manual', 'ai'))
);
--> statement-breakpoint
CREATE TABLE "exercise_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"content_version" integer NOT NULL,
	"action" text NOT NULL,
	"answer" jsonb,
	"result" jsonb,
	"correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_attempt_action_check" CHECK ("action" in ('check', 'solve', 'rate', 'reset'))
);
--> statement-breakpoint
CREATE TABLE "item_state" (
	"user_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"status" text NOT NULL,
	"first_check_correct" boolean,
	"points" smallint DEFAULT 0 NOT NULL,
	"answer" jsonb,
	"content_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_state_user_id_item_id_pk" PRIMARY KEY("user_id","item_id"),
	CONSTRAINT "item_state_status_check" CHECK ("status" in ('untouched', 'checked_correct', 'checked_wrong', 'solved', 'rated_good', 'rated_not_great')),
	CONSTRAINT "item_state_points_check" CHECK ("item_state"."points" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"content_version" integer NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"last_location" text,
	"last_percent" integer,
	"best_percent" integer,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id"),
	CONSTRAINT "lesson_progress_status_check" CHECK ("status" in ('not_started', 'in_progress', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_log" ADD CONSTRAINT "error_log_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempt" ADD CONSTRAINT "exercise_attempt_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_state" ADD CONSTRAINT "item_state_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_state_lesson_idx" ON "item_state" USING btree ("user_id","lesson_id");