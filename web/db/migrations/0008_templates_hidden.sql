-- TP-2: templates can be hidden (soft-deleted) when still referenced.
-- Hidden templates remain resolvable for existing inserts/locations
-- but are filtered out of pickers and default listings.
ALTER TABLE "templates"
  ADD COLUMN "is_hidden" boolean NOT NULL DEFAULT false;
