CREATE TYPE "public"."goal_category" AS ENUM('faculdade', 'profissional', 'certificacao');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'paused', 'done', 'archived');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('book', 'pdf', 'video', 'course', 'article', 'link');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('todo', 'learning', 'mastered');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"why" text,
	"category" "goal_category" NOT NULL,
	"target_date" timestamp with time zone,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"goal_id" uuid,
	"type" "material_type" NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"topic_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_min" integer NOT NULL,
	"comprehension" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "topic_status" DEFAULT 'todo' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_owner_idx" ON "goals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "materials_owner_idx" ON "materials" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "materials_goal_idx" ON "materials" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "sessions_owner_idx" ON "study_sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "sessions_owner_started_idx" ON "study_sessions" USING btree ("owner_id","started_at");--> statement-breakpoint
CREATE INDEX "sessions_topic_idx" ON "study_sessions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topics_owner_idx" ON "topics" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "topics_goal_idx" ON "topics" USING btree ("goal_id");