CREATE TABLE "flashcard_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"flashcard_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"state" integer NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" real NOT NULL,
	"difficulty" real NOT NULL,
	"elapsed_days" integer DEFAULT 0 NOT NULL,
	"scheduled_days" integer DEFAULT 0 NOT NULL,
	"learning_steps" integer DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"last_review" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "reviews_owner_idx";--> statement-breakpoint
DROP INDEX "reviews_topic_reviewed_idx";--> statement-breakpoint
DROP INDEX "reviews_owner_due_idx";--> statement-breakpoint
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_reviews_owner_idx" ON "flashcard_reviews" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "card_reviews_card_reviewed_idx" ON "flashcard_reviews" USING btree ("flashcard_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "card_reviews_owner_due_idx" ON "flashcard_reviews" USING btree ("owner_id","due");--> statement-breakpoint
CREATE INDEX "flashcards_owner_idx" ON "flashcards" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "flashcards_topic_idx" ON "flashcards" USING btree ("topic_id");