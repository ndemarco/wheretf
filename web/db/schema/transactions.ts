import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id").references(
    (): AnyPgColumn => transactions.id
  ), // for compound transactions
  actionType: text("action_type").notNull(), // e.g., "assignment.create", "insert.relocate", "override.merge"
  entityType: text("entity_type").notNull(), // "assignment" | "insert" | "location" | "module" | "template" | "item"
  entityId: uuid("entity_id").notNull(), // ID of affected entity
  beforeState: jsonb("before_state"), // snapshot before change (null for creates)
  afterState: jsonb("after_state"), // snapshot after change (null for deletes)
  isUndone: boolean("is_undone").notNull().default(false),
  undoneByTransactionId: uuid("undone_by_transaction_id").references(
    (): AnyPgColumn => transactions.id
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
