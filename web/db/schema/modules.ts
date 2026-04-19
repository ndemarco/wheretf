import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { orgs } from "./orgs";

export const modules = pgTable("modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Isolation: isolated. owner_org_id is populated for every row after
  // migration 0016 backfill; migration 0017 flips NOT NULL once repos
  // always populate it on new writes.
  ownerOrgId: uuid("owner_org_id").references(() => orgs.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description"),
  primaryDimensionLabel: text("primary_dimension_label").notNull(), // e.g., "level", "drawer"
  primaryDimensionCount: integer("primary_dimension_count").notNull(),
  metadata: jsonb("metadata"), // photos, physical location, notes — no prescribed shape
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
