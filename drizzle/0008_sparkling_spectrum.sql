ALTER TABLE "resume_profiles" ADD COLUMN "public_slug" text;--> statement-breakpoint
ALTER TABLE "resume_profiles" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "resume_profiles_slug_idx" ON "resume_profiles" USING btree ("public_slug");