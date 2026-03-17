import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { locations } from "./locations";

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  parameters: jsonb("parameters"), // array of { key, value, unit? } triples
  metadata: jsonb("metadata"), // images, datasheets, notes — no prescribed shape
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Co-storability: item-level relationship declaring which items can share a location
export const coStorability = pgTable("co_storability", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemAId: uuid("item_a_id")
    .notNull()
    .references(() => items.id),
  itemBId: uuid("item_b_id")
    .notNull()
    .references(() => items.id),
  reason: text("reason"), // e.g., "finish is obvious at a glance"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  assignmentType: text("assignment_type").notNull(), // "placed" | "provisional"
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
