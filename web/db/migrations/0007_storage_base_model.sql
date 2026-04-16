-- Storage base model: continuous-dimension capacity, template scope, capacity clamps
-- Decisions:
--   1. Every location requires a template (templates.scope distinguishes shared vs. single_instance)
--   2. Subdivisions stay recursive on locations (subdivisionSource tracks origin)
--   3. Capacity clamps (maxWidth/Height/Depth + reason) live as columns on locations
--   4. All physical dimensions stored in millimeters (SI canonical); unit_system is display-only

-- templates.scope: 'shared' (default, appears in pickers) | 'single_instance' (auto-created for ad-hoc locations)
ALTER TABLE "templates"
  ADD COLUMN "scope" text NOT NULL DEFAULT 'shared';

-- templateVersions: continuous-dimension capacity
ALTER TABLE "template_versions"
  ADD COLUMN "is_continuous" boolean NOT NULL DEFAULT false,
  ADD COLUMN "width_mm" numeric,
  ADD COLUMN "height_mm" numeric,
  ADD COLUMN "depth_mm" numeric,
  ADD COLUMN "row_pitch_mm" numeric,
  ADD COLUMN "overflow_direction" text,
  ADD COLUMN "buffer_mm" numeric,
  ADD COLUMN "unit_system" text NOT NULL DEFAULT 'metric';

-- locations: subdivision source tracking
ALTER TABLE "locations"
  ADD COLUMN "subdivision_source" text;
-- values: null (no subdivision) | 'template_option:<id>' | 'insert_template:<id>' | 'ad_hoc'

-- locations: capacity clamps (height-restricted overrides and similar)
ALTER TABLE "locations"
  ADD COLUMN "max_width_mm" numeric,
  ADD COLUMN "max_height_mm" numeric,
  ADD COLUMN "max_depth_mm" numeric,
  ADD COLUMN "restrict_reason" text;

-- Enforce: every location resolves dimensions through a template version.
-- If existing rows have NULL template_version_id, this will fail loudly — clean up before applying.
ALTER TABLE "locations"
  ALTER COLUMN "template_version_id" SET NOT NULL;
