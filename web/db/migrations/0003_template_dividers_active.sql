-- Add activeVersion to templates table
ALTER TABLE "templates" ADD COLUMN "active_version" integer NOT NULL DEFAULT 1;

-- Add divider columns to template_versions
ALTER TABLE "template_versions" ADD COLUMN "row_dividers_fixed" boolean NOT NULL DEFAULT false;
ALTER TABLE "template_versions" ADD COLUMN "column_dividers_fixed" boolean NOT NULL DEFAULT false;

-- Drop merge_constraints column (replaced by row_dividers_fixed and column_dividers_fixed)
ALTER TABLE "template_versions" DROP COLUMN IF EXISTS "merge_constraints";
