import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  numeric,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { modules } from "./modules";
import { templates, templateVersions } from "./templates";
// Forward reference: inserts ↔ locations is intentionally asymmetric.
// inserts.locationId → locations.id (insert lives in a receptacle)
// locations.insertId → inserts.id (cell belongs to an insert)

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable: unplaced insert cells have no host module. Set on placement.
  moduleId: uuid("module_id").references(() => modules.id),
  parentId: uuid("parent_id").references((): AnyPgColumn => locations.id),
  label: text("label").notNull(), // position label within parent (e.g., "3", "B4", "Front")
  path: text("path").notNull(), // colon-delimited serialized path (e.g., "MUSE:3:B4")
  pathSegments: jsonb("path_segments").notNull(), // ordered array source of truth

  // Location type
  locationType: text("location_type").notNull(), // "receptacle" | "fixed" | "leaf"
  interfaceTypeAccepted: text("interface_type_accepted"), // for receptacles

  // Structure source — every location resolves dimensions through a template version
  templateVersionId: uuid("template_version_id")
    .notNull()
    .references(() => templateVersions.id),

  // Insert ownership (null for module-scoped locations like levels and fixed
  // subdivisions; set for every cell that belongs to a specific insert)
  insertId: uuid("insert_id"),

  // Grid position (if this location is within a grid)
  gridRow: integer("grid_row"),
  gridColumn: integer("grid_column"),

  // Subdivision origin
  subdivisionSource: text("subdivision_source"),
  // values: null | 'template_option:<id>' | 'insert_template:<id>' | 'ad_hoc'

  // Override state
  isDisabled: boolean("is_disabled").notNull().default(false),
  disableReason: text("disable_reason"),
  mergedIntoId: uuid("merged_into_id").references(
    (): AnyPgColumn => locations.id
  ), // alias target for merged positions

  // Capacity clamps (height-restricted overrides, finger grooves, etc.)
  maxWidthMm: numeric("max_width_mm"),
  maxHeightMm: numeric("max_height_mm"),
  maxDepthMm: numeric("max_depth_mm"),
  restrictReason: text("restrict_reason"),

  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inserts = pgTable("inserts", {
  id: uuid("id").primaryKey().defaultRandom(),
  uid: text("uid").unique(), // short alphanumeric identifier, writable to RFID tags
  name: text("name"), // optional user-given name for this specific insert
  templateId: uuid("template_id").references(() => templates.id),
  templateVersionId: uuid("template_version_id").references(
    () => templateVersions.id
  ),
  locationId: uuid("location_id").references(() => locations.id), // receptacle it's placed in (null if unplaced)
  interfaceTypeProvided: text("interface_type_provided"), // what interface this insert provides

  // Parametric instantiation
  rows: integer("rows"), // actual dimensions if parametric
  columns: integer("columns"),

  overrides: jsonb("overrides"), // structural modifications on this specific insert

  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
