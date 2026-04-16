-- Create aspect_standards junction table (standards ↔ aspects many-to-many)
CREATE TABLE "aspect_standards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "aspect_id" uuid NOT NULL,
  "standard_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "aspect_standards_aspect_id_standard_id_unique" UNIQUE ("aspect_id", "standard_id")
);
--> statement-breakpoint
ALTER TABLE "aspect_standards"
  ADD CONSTRAINT "aspect_standards_aspect_id_aspects_id_fk"
    FOREIGN KEY ("aspect_id") REFERENCES "public"."aspects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aspect_standards"
  ADD CONSTRAINT "aspect_standards_standard_id_standards_id_fk"
    FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Migrate existing single-aspect FK data into junction table
INSERT INTO "aspect_standards" ("aspect_id", "standard_id")
SELECT "aspect_id", "id" FROM "standards" WHERE "aspect_id" IS NOT NULL;
--> statement-breakpoint
-- Drop old FK constraint and column from standards
ALTER TABLE "standards" DROP CONSTRAINT "standards_aspect_id_aspects_id_fk";
--> statement-breakpoint
ALTER TABLE "standards" DROP COLUMN "aspect_id";
