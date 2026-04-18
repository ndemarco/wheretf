import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  numeric,
  unique,
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

  // Labeling
  rowLabelScheme: text("row_label_scheme").notNull().default("alpha"), // alpha, numeric, custom
  columnLabelScheme: text("column_label_scheme").notNull().default("numeric"),
  originPosition: text("origin_position").notNull().default("top-left"),
  primaryAxis: text("primary_axis").notNull().default("row"),

  // Interface types — read via template_version_interfaces_{provided,accepted}
  // junctions. Column removed in migration 0014.

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
  // IMPORTANT: identifier is a mutable display slug. All references to
  // interface types MUST be by `id` (UUID). Never join on `identifier`.
  // See specification/interface-type-management.md — load-bearing invariant.
  identifier: text("identifier").notNull().unique(), // e.g., "plano-3600", "gridfinity-42mm"
  description: text("description"),
  physicalContract: jsonb("physical_contract"), // dimensions, mounting, clearance
  maturity: text("maturity").notNull().default("stable"), // 'draft' | 'stable'
  archivedAt: timestamp("archived_at"), // null = active; non-null = archived
  unitSystem: jsonb("unit_system"), // per-axis convenience units: { width:{label,mm}, depth:{...}, height:{...} }
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction tables — keyed by interface_types.id (UUID). Never by identifier.
// Slice 2 will migrate templates/locations/inserts to read/write these; for
// now they are created empty and used only by the usage-count query path.
export const templateVersionInterfacesProvided = pgTable(
  "template_version_interfaces_provided",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateVersionId: uuid("template_version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "cascade" }),
    interfaceTypeId: uuid("interface_type_id")
      .notNull()
      .references(() => interfaceTypes.id, { onDelete: "restrict" }),
  },
  (t) => [unique().on(t.templateVersionId, t.interfaceTypeId)],
);

export const templateVersionInterfacesAccepted = pgTable(
  "template_version_interfaces_accepted",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateVersionId: uuid("template_version_id")
      .notNull()
      .references(() => templateVersions.id, { onDelete: "cascade" }),
    interfaceTypeId: uuid("interface_type_id")
      .notNull()
      .references(() => interfaceTypes.id, { onDelete: "restrict" }),
  },
  (t) => [unique().on(t.templateVersionId, t.interfaceTypeId)],
);

export const locationInterfacesAccepted = pgTable(
  "location_interfaces_accepted",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // FK to locations added in the locations schema to avoid circular import;
    // logically this is locations.id with ON DELETE CASCADE. Constraint added
    // manually in the migration.
    locationId: uuid("location_id").notNull(),
    interfaceTypeId: uuid("interface_type_id")
      .notNull()
      .references(() => interfaceTypes.id, { onDelete: "restrict" }),
  },
  (t) => [unique().on(t.locationId, t.interfaceTypeId)],
);
