import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  currentVersion: integer("current_version").notNull().default(1),
  activeVersion: integer("active_version").notNull().default(1),
  scope: text("scope").notNull().default("shared"), // 'shared' | 'single_instance'
  isHidden: boolean("is_hidden").notNull().default(false), // soft-deleted when still referenced
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

  // Dividers
  rowDividersFixed: boolean("row_dividers_fixed").notNull().default(false),
  columnDividersFixed: boolean("column_dividers_fixed").notNull().default(false),

  // Continuous-dimension capacity (null for discrete-grid templates)
  isContinuous: boolean("is_continuous").notNull().default(false),
  widthMm: numeric("width_mm"),
  heightMm: numeric("height_mm"),
  depthMm: numeric("depth_mm"),
  rowPitchMm: numeric("row_pitch_mm"), // for rail-style locations
  overflowDirection: text("overflow_direction"), // 'up' | 'down' | null
  bufferMm: numeric("buffer_mm"), // insert-side clearance added to fit computation
  unitSystem: text("unit_system").notNull().default("metric"), // display-only; storage is mm

  // Constraints
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
