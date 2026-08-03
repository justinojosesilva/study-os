ALTER TABLE "notes" ADD COLUMN "lesson_id" uuid;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "anchor_slug" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "quote" text;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_lesson_idx" ON "notes" USING btree ("lesson_id");