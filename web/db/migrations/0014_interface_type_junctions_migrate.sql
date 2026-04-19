-- Migrate from single-text interface-type columns to UUID-keyed junction
-- tables. Completes slice 2 of interface-type-management. After this
-- migration, all references to interface types are by interface_types.id
-- (UUID). Identifier is a mutable display slug.
--
-- Backfill resolves the text identifier in each row to interface_types.id
-- and writes a junction row. Rows whose identifier doesn't resolve are
-- dropped (shouldn't exist in dev; per spec "Drop unresolvable values").
-- Inserts drop their text column outright — per spec, inserts inherit
-- provided interfaces from their template; no override table.

-- ── template_versions.interface_type_provided → junction ──
INSERT INTO "template_version_interfaces_provided"
  ("template_version_id", "interface_type_id")
SELECT tv.id, it.id
FROM "template_versions" tv
JOIN "interface_types" it
  ON it.identifier = tv.interface_type_provided
WHERE tv.interface_type_provided IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── template_versions.interface_type_accepted → junction ──
INSERT INTO "template_version_interfaces_accepted"
  ("template_version_id", "interface_type_id")
SELECT tv.id, it.id
FROM "template_versions" tv
JOIN "interface_types" it
  ON it.identifier = tv.interface_type_accepted
WHERE tv.interface_type_accepted IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── locations.interface_type_accepted → junction ──
INSERT INTO "location_interfaces_accepted"
  ("location_id", "interface_type_id")
SELECT l.id, it.id
FROM "locations" l
JOIN "interface_types" it
  ON it.identifier = l.interface_type_accepted
WHERE l.interface_type_accepted IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── Drop old columns ──
ALTER TABLE "template_versions" DROP COLUMN "interface_type_provided";
ALTER TABLE "template_versions" DROP COLUMN "interface_type_accepted";
ALTER TABLE "template_versions" DROP COLUMN "unit_size";
ALTER TABLE "locations" DROP COLUMN "interface_type_accepted";
ALTER TABLE "inserts" DROP COLUMN "interface_type_provided";
