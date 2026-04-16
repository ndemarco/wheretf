-- IN-3 foundation: locations.insert_id binds a cell row to the insert it
-- belongs to, so cells (and their per-cell overrides + assignments) travel
-- with the insert when it's relocated, matching storage-model.md.
--
-- After this migration:
--   insert_id IS NULL          → module-owned location (level, fixed subdivision)
--   insert_id IS NOT NULL      → cell inside a specific insert
--   parent_id is a *derived*   → reflects the insert's current placement
--   pointer when insert_id is
--   set; null when unplaced

ALTER TABLE "locations"
  ADD COLUMN "insert_id" uuid REFERENCES "inserts"("id") ON DELETE CASCADE;

-- Backfill: today every cell has parent_id = receptacle, and the receptacle
-- has exactly one insert (inserts.location_id = receptacle id).
UPDATE "locations" l
  SET "insert_id" = i.id
  FROM "inserts" i
  WHERE i."location_id" = l."parent_id"
    AND l."parent_id" IS NOT NULL;

CREATE INDEX "locations_insert_id_idx" ON "locations" ("insert_id");
