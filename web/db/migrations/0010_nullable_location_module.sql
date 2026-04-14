-- Cells of unplaced insert have no module. Drop NOT NULL so create
-- of insert can materialize cells immediately (moduleId null until
-- first placement). Placement sets moduleId to the receptacle's.
ALTER TABLE "locations" ALTER COLUMN "module_id" DROP NOT NULL;
