ALTER TABLE "lessons" ADD COLUMN "material_id" uuid;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "material_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_material_idx" ON "lessons" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "sessions_material_idx" ON "study_sessions" USING btree ("material_id");