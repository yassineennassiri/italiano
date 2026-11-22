CREATE TABLE "review_card" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"interval_days" double precision NOT NULL,
	"ease" double precision NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_result" text,
	"streak" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_card_ref_unique" UNIQUE("user_id","kind","ref_id"),
	CONSTRAINT "review_card_kind_check" CHECK ("kind" in ('vocab', 'item', 'error')),
	CONSTRAINT "review_card_last_result_check" CHECK ("last_result" in ('again', 'hard', 'good', 'easy'))
);
--> statement-breakpoint
CREATE TABLE "review_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"grade" text NOT NULL,
	"interval_before" double precision NOT NULL,
	"interval_after" double precision NOT NULL,
	"ease_before" double precision NOT NULL,
	"ease_after" double precision NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_log_grade_check" CHECK ("grade" in ('again', 'hard', 'good', 'easy')),
	CONSTRAINT "review_log_source_check" CHECK ("source" in ('hub', 'drill', 'ripasso_personale'))
);
--> statement-breakpoint
ALTER TABLE "exercise_attempt" DROP CONSTRAINT "exercise_attempt_action_check";--> statement-breakpoint
ALTER TABLE "review_card" ADD CONSTRAINT "review_card_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_log" ADD CONSTRAINT "review_log_card_id_review_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."review_card"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_card_due_idx" ON "review_card" USING btree ("user_id","due_at");--> statement-breakpoint
ALTER TABLE "exercise_attempt" ADD CONSTRAINT "exercise_attempt_action_check" CHECK ("action" in ('check', 'solve', 'rate', 'reset', 'review'));