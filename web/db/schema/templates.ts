import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  currentVersion: integer("current_version").notNull().default(1),
  metadata: jsonb("metadata"), // manufacturer, product number, photos, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templateVersions = pgTable("template_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => templates.id),
  version: integer("version").notNull(),
  isParametric: boolean("is_parametric").notNull().default(false),

  // Grid structure
  rows: integer("rows"), // null for parametric until instantiated
  columns: integer("columns"),
  minRows: integer("min_rows"), // parametric constraints
  maxRows: integer("max_rows"),
  minColumns: integer("min_columns"),
  maxColumns: integer("max_columns"),
  unitSize: text("unit_size"), // e.g., "42mm" for Gridfinity

  // Labeling
  rowLabelScheme: text("row_label_scheme").notNull().default("alpha"), // alpha, numeric, custom
  columnLabelScheme: text("column_label_scheme").notNull().default("numeric"),
  originPosition: text("origin_position").notNull().default("top-left"),
  primaryAxis: text("primary_axis").notNull().default("row"),

  // Interface types
  interfaceTypeProvided: text("interface_type_provided"), // what this fits into (insert side)
  interfaceTypeAccepted: text("interface_type_accepted"), // what this accepts (receptacle side)

  // Constraints
  mergeConstraints: jsonb("merge_constraints"), // e.g., { allowedAxes: ["column"] }
  subdivisionOptions: jsonb("subdivision_options"), // available subdivision configurations
  physicalConstraints: jsonb("physical_constraints"), // soft/hard limits

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interfaceTypes = pgTable("interface_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull().unique(), // e.g., "plano-3600", "gridfinity-42mm"
  description: text("description"),
  physicalContract: jsonb("physical_contract"), // dimensions, mounting, clearance
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
