-- Phase C.4: flip owner_org_id to NOT NULL on every isolated table.
-- All repos now populate it on new writes (Phase C.2) so any lingering
-- NULLs would only be stray rows from the nullable window between 0016
-- and this migration. Backfill is idempotent — if nothing's NULL, the
-- UPDATEs are no-ops.
--
-- Isolated tables: modules, inserts, locations, assignments,
-- location_interfaces_accepted, transactions.

DO $$
DECLARE
  default_org_id uuid;
BEGIN
  SELECT id INTO default_org_id FROM "orgs" WHERE slug = 'default';
  IF default_org_id IS NULL THEN
    -- Migration 0016 seeded the default org. If it's gone, the system
    -- has been re-seeded somehow; skip the backfill (0017 will still
    -- succeed only if no isolated NULLs remain).
    RAISE NOTICE 'default org not found; skipping backfill';
  ELSE
    UPDATE "modules"                      SET owner_org_id = default_org_id WHERE owner_org_id IS NULL;
    UPDATE "inserts"                      SET owner_org_id = default_org_id WHERE owner_org_id IS NULL;
    UPDATE "locations"                    SET owner_org_id = default_org_id WHERE owner_org_id IS NULL;
    UPDATE "assignments"                  SET owner_org_id = default_org_id WHERE owner_org_id IS NULL;
    UPDATE "location_interfaces_accepted" SET owner_org_id = default_org_id WHERE owner_org_id IS NULL;
    UPDATE "transactions"                 SET owner_org_id = default_org_id WHERE owner_org_id IS NULL;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "modules"                      ALTER COLUMN "owner_org_id" SET NOT NULL;
ALTER TABLE "inserts"                      ALTER COLUMN "owner_org_id" SET NOT NULL;
ALTER TABLE "locations"                    ALTER COLUMN "owner_org_id" SET NOT NULL;
ALTER TABLE "assignments"                  ALTER COLUMN "owner_org_id" SET NOT NULL;
ALTER TABLE "location_interfaces_accepted" ALTER COLUMN "owner_org_id" SET NOT NULL;
ALTER TABLE "transactions"                 ALTER COLUMN "owner_org_id" SET NOT NULL;
