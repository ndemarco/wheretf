import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { items } from "./items";

// System-managed visual labels for items
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  icon: text("icon"), // icon key for grid tile rendering
  color: text("color"), // hex color for visual grouping
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reusable parameter specs — atomic unit of item description
export const parameterDefinitions = pgTable("parameter_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  dataType: text("data_type").notNull(), // "numeric" | "text" | "boolean" | "enum"
  unit: text("unit"), // mm, inches, V, ohms — null if dimensionless
  defaultValue: jsonb("default_value"), // type-appropriate default
  constraints: jsonb("constraints"), // { enumValues?: string[], min?: number, max?: number }
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reusable parameter groups describing one facet of an item
export const aspects = pgTable("aspects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Which parameter definitions belong to an aspect
export const aspectParameters = pgTable(
  "aspect_parameters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aspectId: uuid("aspect_id")
      .notNull()
      .references(() => aspects.id, { onDelete: "cascade" }),
    parameterDefinitionId: uuid("parameter_definition_id")
      .notNull()
      .references(() => parameterDefinitions.id, { onDelete: "cascade" }),
    required: boolean("required").default(false).notNull(),
    defaultValue: jsonb("default_value"), // overrides paramDef default when applied via this aspect
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [unique().on(t.aspectId, t.parameterDefinitionId)]
);

// Categories applied to an item
export const itemCategories = pgTable(
  "item_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.itemId, t.categoryId)]
);

// Which aspects are applied to an item
export const itemAspects = pgTable(
  "item_aspects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    aspectId: uuid("aspect_id")
      .notNull()
      .references(() => aspects.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.itemId, t.aspectId)]
);

// Named classification system — carries lookup tables, linked to aspects via aspect_standards
export const standards = pgTable("standards", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  domainTag: text("domain_tag"), // e.g., "Unified Thread Standard" for UNC/UNF grouping
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction: aspects ↔ standards (many-to-many)
export const aspectStandards = pgTable(
  "aspect_standards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aspectId: uuid("aspect_id")
      .notNull()
      .references(() => aspects.id, { onDelete: "cascade" }),
    standardId: uuid("standard_id")
      .notNull()
      .references(() => standards.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.aspectId, t.standardId)]
);

// Which parameter definitions a standard covers (subset of parent aspect's parameters)
export const standardParameters = pgTable(
  "standard_parameters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    standardId: uuid("standard_id")
      .notNull()
      .references(() => standards.id, { onDelete: "cascade" }),
    parameterDefinitionId: uuid("parameter_definition_id")
      .notNull()
      .references(() => parameterDefinitions.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "key" | "derived" | "info"
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [unique().on(t.standardId, t.parameterDefinitionId)]
);

// Designation entries within a standard — the lookup table
export const standardDesignations = pgTable(
  "standard_designations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    standardId: uuid("standard_id")
      .notNull()
      .references(() => standards.id, { onDelete: "cascade" }),
    designation: text("designation").notNull(), // "#8-32", "M3x0.5", "0603", "#2"
    values: jsonb("values").notNull(), // { param_def_id: { value, source_value?, source_unit? }, ... }
    metadata: jsonb("metadata"), // notes, aliases, cross-references
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.standardId, t.designation)]
);

// Standards applied to an item (with optional designation selection)
export const itemStandards = pgTable(
  "item_standards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    standardId: uuid("standard_id")
      .notNull()
      .references(() => standards.id, { onDelete: "cascade" }),
    designationId: uuid("designation_id").references(
      () => standardDesignations.id,
      { onDelete: "set null" }
    ), // null if non-standard/custom
    isCustom: boolean("is_custom").default(false).notNull(), // true if user overrode derived values
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.itemId, t.standardId)]
);

// Actual parameter values on items
export const itemParameterValues = pgTable(
  "item_parameter_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    parameterDefinitionId: uuid("parameter_definition_id")
      .notNull()
      .references(() => parameterDefinitions.id, { onDelete: "cascade" }),
    itemAspectId: uuid("item_aspect_id").references(() => itemAspects.id, {
      onDelete: "cascade",
    }), // null = standalone parameter
    value: jsonb("value"), // type-appropriate value; null = unfilled
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.itemId, t.parameterDefinitionId, t.itemAspectId)]
);
