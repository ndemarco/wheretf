-- parameter_definitions gains a short human description and optional
-- search terms (aliases/synonyms) to help the AI-assisted bulk aspect
-- importer + future natural-language item search.
ALTER TABLE "parameter_definitions" ADD COLUMN "description" text;
ALTER TABLE "parameter_definitions" ADD COLUMN "search_terms" text[];
