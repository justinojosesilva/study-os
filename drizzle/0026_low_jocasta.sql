ALTER TABLE "lessons" ADD COLUMN "public_slug" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_public_slug_idx" ON "lessons" USING btree ("public_slug");