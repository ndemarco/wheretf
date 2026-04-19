-- Interface types gain maturity + lifecycle state and an optional unit
-- system definition. Slice 1 of the interface-type-management work
-- (see specification/interface-type-management.md).
--
-- Also introduces junction tables that will replace the single-text
-- columns on template_versions / locations / inserts in slice 2.
-- The old columns stay in place for now so existing repo code keeps
-- working; junctions sit empty until the data-migration slice lands.

ALTER TABLE "interface_types"
  ADD COLUMN "maturity" text NOT NULL DEFAULT 'stable',
  ADD COLUMN "archived_at" timestamp,
  ADD COLUMN "unit_system" jsonb;

ALTER TABLE "interface_types"
  ADD CONSTRAINT "interface_types_maturity_check"
  CHECK ("maturity" IN ('draft', 'stable'));

CREATE TABLE "template_version_interfaces_provided" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_version_id" uuid NOT NULL
    REFERENCES "template_versions"("id") ON DELETE CASCADE,
  "interface_type_id" uuid NOT NULL
    REFERENCES "interface_types"("id") ON DELETE RESTRICT,
  CONSTRAINT "tv_interfaces_provided_unique"
    UNIQUE ("template_version_id", "interface_type_id")
);

CREATE TABLE "template_version_interfaces_accepted" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_version_id" uuid NOT NULL
    REFERENCES "template_versions"("id") ON DELETE CASCADE,
  "interface_type_id" uuid NOT NULL
    REFERENCES "interface_types"("id") ON DELETE RESTRICT,
  CONSTRAINT "tv_interfaces_accepted_unique"
    UNIQUE ("template_version_id", "interface_type_id")
);

CREATE TABLE "location_interfaces_accepted" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "location_id" uuid NOT NULL
    REFERENCES "locations"("id") ON DELETE CASCADE,
  "interface_type_id" uuid NOT NULL
    REFERENCES "interface_types"("id") ON DELETE RESTRICT,
  CONSTRAINT "location_interfaces_accepted_unique"
    UNIQUE ("location_id", "interface_type_id")
);
