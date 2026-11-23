CREATE TABLE "feedback_note" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"ref_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	CONSTRAINT "feedback_note_scope_check" CHECK ("scope" in ('level', 'lesson', 'item'))
);
--> statement-breakpoint
ALTER TABLE "feedback_note" ADD CONSTRAINT "feedback_note_user_id_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_note_open_idx" ON "feedback_note" USING btree ("user_id","done");