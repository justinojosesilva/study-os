CREATE TABLE "topic_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
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
ALTER TABLE "topic_reviews" ADD CONSTRAINT "topic_reviews_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_reviews" ADD CONSTRAINT "topic_reviews_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_owner_idx" ON "topic_reviews" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "reviews_topic_reviewed_idx" ON "topic_reviews" USING btree ("topic_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "reviews_owner_due_idx" ON "topic_reviews" USING btree ("owner_id","due");