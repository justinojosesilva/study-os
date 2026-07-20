CREATE TYPE "public"."certification_status" AS ENUM('planned', 'scheduled', 'passed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"goal_id" uuid,
	"title" text NOT NULL,
	"provider" text NOT NULL,
	"code" text,
	"status" "certification_status" DEFAULT 'planned' NOT NULL,
	"exam_date" timestamp with time zone,
	"obtained_date" timestamp with time zone,
	"expires_date" timestamp with time zone,
	"score" text,
	"cost_cents" integer,
	"credential_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certifications_owner_idx" ON "certifications" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "certifications_goal_idx" ON "certifications" USING btree ("goal_id");