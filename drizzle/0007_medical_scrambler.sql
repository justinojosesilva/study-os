CREATE TABLE "resume_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"headline" text,
	"summary" text,
	"target_role" text,
	"contact" jsonb,
	"highlights" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume_profiles" ADD CONSTRAINT "resume_profiles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resume_profiles_owner_idx" ON "resume_profiles" USING btree ("owner_id");