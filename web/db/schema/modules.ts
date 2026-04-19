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
  // Isolation: isolated. NOT NULL enforced at DB level since migration 0017.
  ownerOrgId: uuid("owner_org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  primaryDimensionLabel: text("primary_dimension_label").notNull(), // e.g., "level", "drawer"
  primaryDimensionCount: integer("primary_dimension_count").notNull(),
  metadata: jsonb("metadata"), // photos, physical location, notes — no prescribed shape
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
