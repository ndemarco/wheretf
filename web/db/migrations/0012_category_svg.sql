-- Categories gain an optional inline SVG graphic. Used by item tiles
-- and taxonomy navigation in preference to the short-text `icon`
-- column when set.
ALTER TABLE "categories" ADD COLUMN "svg" text;
