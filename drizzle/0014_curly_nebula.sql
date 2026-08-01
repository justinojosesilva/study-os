CREATE TYPE "public"."lesson_kind" AS ENUM('aula', 'lab');--> statement-breakpoint
CREATE TABLE "tutor_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"question" text,
	"answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "topic_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "kind" "lesson_kind" DEFAULT 'aula' NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_answers" ADD CONSTRAINT "tutor_answers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_answers" ADD CONSTRAINT "tutor_answers_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tutor_answers_owner_idx" ON "tutor_answers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tutor_answers_topic_idx" ON "tutor_answers" USING btree ("topic_id");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;