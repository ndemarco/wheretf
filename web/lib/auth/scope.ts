import { isNull, or, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// Build the SQL filter for an isolated table: `owner_org_id = :orgId`.
export function isolatedOrgFilter(col: AnyPgColumn, orgId: string): SQL {
  return eq(col, orgId);
}

// Build the SQL filter for an additive table:
// `(owner_org_id IS NULL OR owner_org_id = :orgId)`. NULL = global
// catalog row visible to every org; matching org = private row.
export function additiveOrgFilter(col: AnyPgColumn, orgId: string): SQL {
  return or(isNull(col), eq(col, orgId)) as SQL;
}
