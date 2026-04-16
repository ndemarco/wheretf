import { and, eq, isNull, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  inserts,
  locations,
  templates,
  templateVersions,
  modules,
  assignments,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";
import { getGridLabel } from "@/lib/gridLabels";

function generateUid(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let uid = "";
  for (let i = 0; i < 8; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return uid;
}

type InsertParentLocation = {
  id: string;
  path: string;
  pathSegments: unknown;
  // Nullable since 0010_nullable_location_module — unplaced inserts
  // carry no moduleId; reparent copies whatever the receptacle has.
  moduleId: string | null;
};

/**
 * When an insert is placed/moved into a receptacle, its top-level cells
 * (insert_id = this insert, parent_id IS NULL or pointed at an old
 * receptacle) become children of the new receptacle. Their subdivisions
 * (insert_id same, parent_id pointing at a cell) ride along via their
 * parent cell's new path.
 */
async function reparentInsertCells(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  insertId: string,
  receptacle: InsertParentLocation
) {
  const cells = await tx
    .select()
    .from(locations)
    .where(eq(locations.insertId, insertId));

  const receptaclePath = (receptacle.pathSegments as string[]) ?? [];
  const byId = new Map<string, (typeof cells)[number]>();
  for (const c of cells) byId.set(c.id, c);

  // Compute each cell's new path by walking up through known insert cells
  // until we hit a cell whose parent is outside the insert (top cell).
  function computeSegments(cell: (typeof cells)[number]): string[] {
    const trail: string[] = [cell.label];
    let cursor = cell;
    while (cursor.parentId && byId.has(cursor.parentId)) {
      cursor = byId.get(cursor.parentId)!;
      trail.unshift(cursor.label);
    }
    return [...receptaclePath, ...trail];
  }

  for (const cell of cells) {
    const newSegments = computeSegments(cell);
    const isTopLevelInInsert =
      !cell.parentId || !byId.has(cell.parentId);
    await tx
      .update(locations)
      .set({
        moduleId: receptacle.moduleId,
        parentId: isTopLevelInInsert ? receptacle.id : cell.parentId,
        path: newSegments.join(":"),
        pathSegments: newSegments,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, cell.id));
  }
}

export const insertRepository = {
  async create({
    name,
    templateId,
    templateVersionId,
    interfaceTypeProvided,
    rows,
    columns,
    overrides,
    metadata,
  }: {
    name?: string;
    templateId?: string;
    templateVersionId?: string;
    interfaceTypeProvided?: string;
    rows?: number;
    columns?: number;
    overrides?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const uid = generateUid();

    const insert = await db.transaction(async (tx) => {
      const [ins] = await tx
        .insert(inserts)
        .values({
          uid,
          name,
          templateId,
          templateVersionId,
          interfaceTypeProvided,
          rows,
          columns,
          overrides,
          metadata,
        })
        .returning();

      // Materialize cells now so the insert is physically "real" at
      // creation. Cells are unplaced: moduleId null, parentId null,
      // path = just the cell label. Placement fills in module/parent
      // and rebuilds paths.
      if (templateVersionId) {
        const [tv] = await tx
          .select()
          .from(templateVersions)
          .where(eq(templateVersions.id, templateVersionId));
        if (tv) {
          const gridRows = rows ?? tv.rows ?? 1;
          const gridCols = columns ?? tv.columns ?? 1;
          const origin = tv.originPosition || "top-left";
          const rowScheme = tv.rowLabelScheme || "alpha";
          const colScheme = tv.columnLabelScheme || "numeric";
          for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
              const rowLabel = getGridLabel(
                rowScheme,
                r,
                gridRows,
                origin,
                "row"
              );
              const colLabel = getGridLabel(
                colScheme,
                c,
                gridCols,
                origin,
                "col"
              );
              const cellLabel = `${rowLabel}${colLabel}`;
              await tx.insert(locations).values({
                moduleId: null,
                parentId: null,
                label: cellLabel,
                path: cellLabel,
                pathSegments: [cellLabel],
                locationType: "leaf",
                templateVersionId,
                insertId: ins.id,
                gridRow: r,
                gridColumn: c,
              });
            }
          }
        }
      }

      return ins;
    });

    await transactionRepository.log({
      actionType: "insert.create",
      entityType: "insert",
      entityId: insert.id,
      beforeState: null,
      afterState: insert,
    });

    return insert;
  },

  async findById({ id }: { id: string }) {
    const [insert] = await db
      .select()
      .from(inserts)
      .where(eq(inserts.id, id));
    return insert ?? null;
  },

  async findByLocationId({ locationId }: { locationId: string }) {
    const [insert] = await db
      .select()
      .from(inserts)
      .where(eq(inserts.locationId, locationId));
    return insert ?? null;
  },

  async listUnplaced() {
    return db.select().from(inserts).where(isNull(inserts.locationId));
  },

  /**
   * For IN-4 placement UX. Given an insert, list receptacle locations where
   * it could be placed:
   *   - locationType = 'receptacle'
   *   - currently empty (no other insert pointing at it)
   *   - interface type compatible (or either side unspecified)
   *   - not the current host (already there)
   */
  async listCompatibleReceptacles({ id }: { id: string }) {
    const insert = await insertRepository.findById({ id });
    if (!insert) throw new Error(`Insert ${id} not found`);

    // Resolve insert's effective interface type: explicit override first,
    // else template version's interfaceTypeProvided.
    let effectiveIface = insert.interfaceTypeProvided ?? null;
    if (!effectiveIface && insert.templateVersionId) {
      const [tv] = await db
        .select({ iface: templateVersions.interfaceTypeProvided })
        .from(templateVersions)
        .where(eq(templateVersions.id, insert.templateVersionId));
      effectiveIface = tv?.iface ?? null;
    }

    const receptacles = await db
      .select({
        id: locations.id,
        path: locations.path,
        label: locations.label,
        interfaceTypeAccepted: locations.interfaceTypeAccepted,
        moduleId: locations.moduleId,
        moduleName: modules.name,
      })
      .from(locations)
      .leftJoin(modules, eq(locations.moduleId, modules.id))
      .where(eq(locations.locationType, "receptacle"));

    // Find which receptacles are currently occupied.
    const occupants = await db
      .select({ locationId: inserts.locationId })
      .from(inserts)
      .where(isNotNull(inserts.locationId));
    const occupied = new Set(
      occupants.map((o) => o.locationId).filter(Boolean) as string[]
    );

    return receptacles
      .filter((r) => r.id !== insert.locationId) // skip current host
      .filter((r) => !occupied.has(r.id))
      .filter((r) => {
        // compatibility: if either side is null, allow; else must match
        const accepts = r.interfaceTypeAccepted ?? null;
        if (!effectiveIface || !accepts) return true;
        return effectiveIface === accepts;
      });
  },

  /**
   * Rich list of inserts for the /inserts page. Joins template name,
   * current location path, and host module. Filters:
   *   - templateId: restrict to one template
   *   - interfaceType: match insert.interfaceTypeProvided OR the template's
   *     current version's interfaceTypeProvided
   *   - placement: 'placed' | 'unplaced' | 'all' (default 'all')
   */
  async listWithDetails({
    templateId,
    interfaceType,
    placement = "all",
    moduleId,
  }: {
    templateId?: string;
    interfaceType?: string;
    placement?: "placed" | "unplaced" | "all";
    moduleId?: string;
  } = {}) {
    const conditions: SQL[] = [];

    if (templateId) conditions.push(eq(inserts.templateId, templateId));
    if (placement === "placed") conditions.push(isNotNull(inserts.locationId));
    if (placement === "unplaced") conditions.push(isNull(inserts.locationId));
    if (moduleId) conditions.push(eq(locations.moduleId, moduleId));

    if (interfaceType) {
      conditions.push(
        sql`(
          ${inserts.interfaceTypeProvided} = ${interfaceType}
          OR ${templateVersions.interfaceTypeProvided} = ${interfaceType}
        )`
      );
    }

    const where = conditions.length
      ? and(...conditions)
      : undefined;

    const rows = await db
      .select({
        insert: inserts,
        templateName: templates.name,
        templateInterfaceProvided: templateVersions.interfaceTypeProvided,
        rowDividersFixed: templateVersions.rowDividersFixed,
        columnDividersFixed: templateVersions.columnDividersFixed,
        locationPath: locations.path,
        moduleName: modules.name,
        cellCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${locations} c
          WHERE c.insert_id = ${inserts.id}
            AND NOT EXISTS (
              SELECT 1 FROM ${locations} cc WHERE cc.parent_id = c.id
            )
        )`.as("cellCount"),
        assignedCount: sql<number>`(
          SELECT COUNT(DISTINCT c.id)::int FROM ${locations} c
          INNER JOIN ${assignments} a ON a.location_id = c.id
          WHERE c.insert_id = ${inserts.id}
            AND NOT EXISTS (
              SELECT 1 FROM ${locations} cc WHERE cc.parent_id = c.id
            )
        )`.as("assignedCount"),
      })
      .from(inserts)
      .leftJoin(templates, eq(inserts.templateId, templates.id))
      .leftJoin(
        templateVersions,
        eq(inserts.templateVersionId, templateVersions.id)
      )
      .leftJoin(locations, eq(inserts.locationId, locations.id))
      .leftJoin(modules, eq(locations.moduleId, modules.id))
      .where(where);

    return rows.map((r) => ({
      ...r.insert,
      templateName: r.templateName,
      // effective interface type: insert-override first, else template default
      interfaceType:
        r.insert.interfaceTypeProvided ?? r.templateInterfaceProvided ?? null,
      rowDividersFixed: r.rowDividersFixed ?? false,
      columnDividersFixed: r.columnDividersFixed ?? false,
      locationPath: r.locationPath,
      moduleName: r.moduleName,
      cellCount: Number(r.cellCount ?? 0),
      assignedCount: Number(r.assignedCount ?? 0),
    }));
  },

  async place({ id, locationId }: { id: string; locationId: string }) {
    const insert = await insertRepository.findById({ id });
    if (!insert) throw new Error(`Insert ${id} not found`);

    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, locationId));
    if (!location) throw new Error(`Location ${locationId} not found`);

    if (location.locationType !== "receptacle") {
      throw new Error(
        `Location ${locationId} is not a receptacle (type: ${location.locationType})`
      );
    }

    if (
      insert.interfaceTypeProvided &&
      location.interfaceTypeAccepted &&
      insert.interfaceTypeProvided !== location.interfaceTypeAccepted
    ) {
      throw new Error(
        `Interface type mismatch: insert provides "${insert.interfaceTypeProvided}" but location accepts "${location.interfaceTypeAccepted}"`
      );
    }

    // Refuse if the receptacle already holds another insert.
    const occupants = await db
      .select({ id: inserts.id })
      .from(inserts)
      .where(eq(inserts.locationId, locationId));
    if (occupants.find((o) => o.id !== id)) {
      throw new Error(
        `Location ${locationId} already holds another insert`
      );
    }

    const updated = await db.transaction(async (tx) => {
      const [ins] = await tx
        .update(inserts)
        .set({ locationId, updatedAt: new Date() })
        .where(eq(inserts.id, id))
        .returning();

      await reparentInsertCells(tx, id, location);

      return ins;
    });

    await transactionRepository.log({
      actionType: "insert.place",
      entityType: "insert",
      entityId: id,
      beforeState: insert,
      afterState: updated,
    });

    return updated;
  },

  async removeFromLocation({ id }: { id: string }) {
    const before = await insertRepository.findById({ id });
    if (!before) throw new Error(`Insert ${id} not found`);

    const updated = await db.transaction(async (tx) => {
      const [ins] = await tx
        .update(inserts)
        .set({ locationId: null, updatedAt: new Date() })
        .where(eq(inserts.id, id))
        .returning();

      // Cells travel with the insert. When unplaced, they stay bound
      // via insert_id but lose their parent (they're "on the floor").
      // Paths reflect just the insert's cell label until re-placed.
      const cells = await tx
        .select()
        .from(locations)
        .where(eq(locations.insertId, id));
      for (const cell of cells) {
        const segments = [cell.label];
        await tx
          .update(locations)
          .set({
            moduleId: null,
            parentId: null,
            path: segments.join(":"),
            pathSegments: segments,
            updatedAt: new Date(),
          })
          .where(eq(locations.id, cell.id));
      }

      return ins;
    });

    await transactionRepository.log({
      actionType: "insert.removeFromLocation",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    templateId?: string;
    templateVersionId?: string;
    interfaceTypeProvided?: string;
    rows?: number;
    columns?: number;
    overrides?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const before = await insertRepository.findById({ id });
    if (!before) throw new Error(`Insert ${id} not found`);

    const [updated] = await db
      .update(inserts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inserts.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "insert.update",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await insertRepository.findById({ id });
    if (!before) throw new Error(`Insert ${id} not found`);

    await db.delete(inserts).where(eq(inserts.id, id));

    await transactionRepository.log({
      actionType: "insert.delete",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
