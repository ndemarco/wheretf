-- Phase C.1: add owner_org_id to every additive + isolated table,
-- seed a default org, backfill isolated rows, add FK constraints.
-- NOT NULL on isolated tables is deferred to 0017, after repos always
-- populate owner_org_id on new writes.
--
-- Isolated tables (backfilled to default org):
--   modules, inserts, locations, assignments,
--   location_interfaces_accepted, transactions
-- Additive tables (left NULL = global catalog):
--   templates, template_versions,
--   template_version_interfaces_provided/accepted,
--   items, item_aspects, item_parameter_values, item_categories,
--   item_standards, co_storability, categories,
--   parameter_definitions, aspects, aspect_parameters, standards,
--   standard_parameters, standard_designations, aspect_standards,
--   interface_types

-- Isolated
ALTER TABLE "modules"                         ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "inserts"                         ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "locations"                       ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "assignments"                     ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "location_interfaces_accepted"    ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "transactions"                    ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "transactions"                    ADD COLUMN IF NOT EXISTS "actor_user_id" uuid;
--> statement-breakpoint

-- Additive
ALTER TABLE "templates"                               ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "template_versions"                       ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "template_version_interfaces_provided"    ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "template_version_interfaces_accepted"    ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "items"                                   ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "item_aspects"                            ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "item_parameter_values"                   ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "item_categories"                         ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "item_standards"                          ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "co_storability"                          ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "categories"                              ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "parameter_definitions"                   ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "aspects"                                 ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "aspect_parameters"                       ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "standards"                               ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "standard_parameters"                     ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "standard_designations"                   ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "aspect_standards"                        ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
ALTER TABLE "interface_types"                         ADD COLUMN IF NOT EXISTS "owner_org_id" uuid;
--> statement-breakpoint

-- Seed default user + org, backfill isolated rows. Idempotent.
DO $$
DECLARE
  seed_user_id uuid;
  seed_org_id uuid;
BEGIN
  SELECT id INTO seed_user_id FROM "users" WHERE email = 'default@wheretf.local';
  IF seed_user_id IS NULL THEN
    INSERT INTO "users" (email, name, is_admin)
    VALUES ('default@wheretf.local', 'default', true)
    RETURNING id INTO seed_user_id;
  END IF;

  SELECT id INTO seed_org_id FROM "orgs" WHERE slug = 'default';
  IF seed_org_id IS NULL THEN
    INSERT INTO "orgs" (name, slug, plan)
    VALUES ('Default', 'default', 'paid')
    RETURNING id INTO seed_org_id;
  END IF;

  INSERT INTO "user_orgs" (user_id, org_id, role)
  VALUES (seed_user_id, seed_org_id, 'owner')
  ON CONFLICT DO NOTHING;

  UPDATE "modules"                      SET owner_org_id = seed_org_id WHERE owner_org_id IS NULL;
  UPDATE "inserts"                      SET owner_org_id = seed_org_id WHERE owner_org_id IS NULL;
  UPDATE "locations"                    SET owner_org_id = seed_org_id WHERE owner_org_id IS NULL;
  UPDATE "assignments"                  SET owner_org_id = seed_org_id WHERE owner_org_id IS NULL;
  UPDATE "location_interfaces_accepted" SET owner_org_id = seed_org_id WHERE owner_org_id IS NULL;
  UPDATE "transactions"
    SET owner_org_id = seed_org_id,
        actor_user_id = seed_user_id
    WHERE owner_org_id IS NULL;
END $$;
--> statement-breakpoint

-- FK constraints. Isolated + additive alike; no NOT NULL yet.
ALTER TABLE "modules"                         ADD CONSTRAINT "modules_owner_org_id_fk"                         FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "inserts"                         ADD CONSTRAINT "inserts_owner_org_id_fk"                         FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "locations"                       ADD CONSTRAINT "locations_owner_org_id_fk"                       FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "assignments"                     ADD CONSTRAINT "assignments_owner_org_id_fk"                     FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "location_interfaces_accepted"    ADD CONSTRAINT "location_interfaces_accepted_owner_org_id_fk"    FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "transactions"                    ADD CONSTRAINT "transactions_owner_org_id_fk"                    FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "transactions"                    ADD CONSTRAINT "transactions_actor_user_id_fk"                   FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "templates"                               ADD CONSTRAINT "templates_owner_org_id_fk"                               FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "template_versions"                       ADD CONSTRAINT "template_versions_owner_org_id_fk"                       FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "template_version_interfaces_provided"    ADD CONSTRAINT "template_version_interfaces_provided_owner_org_id_fk"    FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "template_version_interfaces_accepted"    ADD CONSTRAINT "template_version_interfaces_accepted_owner_org_id_fk"    FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "items"                                   ADD CONSTRAINT "items_owner_org_id_fk"                                   FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "item_aspects"                            ADD CONSTRAINT "item_aspects_owner_org_id_fk"                            FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "item_parameter_values"                   ADD CONSTRAINT "item_parameter_values_owner_org_id_fk"                   FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "item_categories"                         ADD CONSTRAINT "item_categories_owner_org_id_fk"                         FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "item_standards"                          ADD CONSTRAINT "item_standards_owner_org_id_fk"                          FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "co_storability"                          ADD CONSTRAINT "co_storability_owner_org_id_fk"                          FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "categories"                              ADD CONSTRAINT "categories_owner_org_id_fk"                              FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "parameter_definitions"                   ADD CONSTRAINT "parameter_definitions_owner_org_id_fk"                   FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "aspects"                                 ADD CONSTRAINT "aspects_owner_org_id_fk"                                 FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "aspect_parameters"                       ADD CONSTRAINT "aspect_parameters_owner_org_id_fk"                       FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "standards"                               ADD CONSTRAINT "standards_owner_org_id_fk"                               FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "standard_parameters"                     ADD CONSTRAINT "standard_parameters_owner_org_id_fk"                     FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "standard_designations"                   ADD CONSTRAINT "standard_designations_owner_org_id_fk"                   FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "aspect_standards"                        ADD CONSTRAINT "aspect_standards_owner_org_id_fk"                        FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
ALTER TABLE "interface_types"                         ADD CONSTRAINT "interface_types_owner_org_id_fk"                         FOREIGN KEY ("owner_org_id") REFERENCES "orgs"("id") ON DELETE CASCADE;
