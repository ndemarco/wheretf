import { and, eq, inArray, isNull, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  inserts,
  locations,
  locationInterfacesAccepted,
  templates,
  templateVersions,
  templateVersionInterfacesProvided,
  interfaceTypes,
  modules,
  assignments,
} from "@/db/schema";
import { isolatedOrgFilter } from "@/lib/auth/scope";
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
  orgId: string,
  insertId: string,
  receptacle: InsertParentLocation
) {
  const cells = await tx
    .select()
    .from(locations)
    .where(
      and(
        isolatedOrgFilter(locations.ownerOrgId, orgId),
        eq(locations.insertId, insertId),
      ),
    );

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
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.id, cell.id),
        ),
      );
  }
}

// inserts is an isolated table. Every method is org-scoped.
export const insertRepository = {
  async create({
    userId,
    orgId,
    name,
    templateId,
    templateVersionId,
    rows,
    columns,
    overrides,
    metadata,
  }: {
    userId: string;
    orgId: string;
    name?: string;
    templateId?: string;
    templateVersionId?: string;
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
          ownerOrgId: orgId,
          uid,
          name,
          templateId,
          templateVersionId,
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
                ownerOrgId: orgId,
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
      userId,
      orgId,
      actionType: "insert.create",
      entityType: "insert",
      entityId: insert.id,
      beforeState: null,
      afterState: insert,
    });

    return insert;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [insert] = await db
      .select()
      .from(inserts)
      .where(
        and(isolatedOrgFilter(inserts.ownerOrgId, orgId), eq(inserts.id, id)),
      );
    return insert ?? null;
  },

  async findByLocationId({
    orgId,
    locationId,
  }: {
    orgId: string;
    locationId: string;
  }) {
    const [insert] = await db
      .select()
      .from(inserts)
      .where(
        and(
          isolatedOrgFilter(inserts.ownerOrgId, orgId),
          eq(inserts.locationId, locationId),
        ),
      );
    return insert ?? null;
  },

  async listUnplaced({ orgId }: { orgId: string }) {
    return db
      .select()
      .from(inserts)
      .where(
        and(
          isolatedOrgFilter(inserts.ownerOrgId, orgId),
          isNull(inserts.locationId),
        ),
      );
  },

  /**
   * For IN-4 placement UX. Given an insert, list receptacle locations where
   * it could be placed:
   *   - locationType = 'receptacle'
   *   - currently empty (no other insert pointing at it)
   *   - interface type compatible (or either side unspecified)
   *   - not the current host (already there)
   */
  async listCompatibleReceptacles({
    orgId,
    id,
  }: {
    orgId: string;
    id: string;
  }) {
    const insert = await insertRepository.findById({ orgId, id });
    if (!insert) throw new Error(`Insert ${id} not found`);

    // Inserts inherit provided interfaces from their template version
    // (no per-insert override — spec).
    const providedSet = new Set<string>();
    if (insert.templateVersionId) {
      const rows = await db
        .select({ id: templateVersionInterfacesProvided.interfaceTypeId })
        .from(templateVersionInterfacesProvided)
        .where(
          eq(
            templateVersionInterfacesProvided.templateVersionId,
            insert.templateVersionId,
          ),
        );
      for (const r of rows) providedSet.add(r.id);
    }

    const receptacles = await db
      .select({
        id: locations.id,
        path: locations.path,
        label: locations.label,
        moduleId: locations.moduleId,
        moduleName: modules.name,
      })
      .from(locations)
      .leftJoin(modules, eq(locations.moduleId, modules.id))
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.locationType, "receptacle"),
        ),
      );

    // Batch-load accepted interface sets for all candidate receptacles.
    const recIds = receptacles.map((r) => r.id);
    const acceptedByLoc = new Map<string, Set<string>>();
    if (recIds.length > 0) {
      const accRows = await db
        .select({
          locationId: locationInterfacesAccepted.locationId,
          interfaceTypeId: locationInterfacesAccepted.interfaceTypeId,
        })
        .from(locationInterfacesAccepted)
        .where(inArray(locationInterfacesAccepted.locationId, recIds));
      for (const r of accRows) {
        let s = acceptedByLoc.get(r.locationId);
        if (!s) {
          s = new Set();
          acceptedByLoc.set(r.locationId, s);
        }
        s.add(r.interfaceTypeId);
      }
    }

    // Find which receptacles are currently occupied.
    const occupants = await db
      .select({ locationId: inserts.locationId })
      .from(inserts)
      .where(
        and(
          isolatedOrgFilter(inserts.ownerOrgId, orgId),
          isNotNull(inserts.locationId),
        ),
      );
    const occupied = new Set(
      occupants.map((o) => o.locationId).filter(Boolean) as string[]
    );

    return receptacles
      .filter((r) => r.id !== insert.locationId) // skip current host
      .filter((r) => !occupied.has(r.id))
      .filter((r) => {
        // Compatibility: if either side is empty, allow (user rules the
        // storage); else require non-empty intersection.
        const accepts = acceptedByLoc.get(r.id);
        if (providedSet.size === 0 || !accepts || accepts.size === 0) {
          return true;
        }
        for (const id of providedSet) if (accepts.has(id)) return true;
        return false;
      });
  },

  /**
   * Rich list of inserts for the /inserts page. Joins template name,
   * current location path, and host module. Filters:
   *   - templateId: restrict to one template
   *   - interfaceTypeId: UUID of an interface_type. Matches when the
   *     insert's template version provides that interface.
   *   - placement: 'placed' | 'unplaced' | 'all' (default 'all')
   */
  async listWithDetails({
    orgId,
    templateId,
    interfaceTypeId,
    placement = "all",
    moduleId,
  }: {
    orgId: string;
    templateId?: string;
    interfaceTypeId?: string;
    placement?: "placed" | "unplaced" | "all";
    moduleId?: string;
  }) {
    const conditions: SQL[] = [isolatedOrgFilter(inserts.ownerOrgId, orgId)];

    if (templateId) conditions.push(eq(inserts.templateId, templateId));
    if (placement === "placed") conditions.push(isNotNull(inserts.locationId));
    if (placement === "unplaced") conditions.push(isNull(inserts.locationId));
    if (moduleId) conditions.push(eq(locations.moduleId, moduleId));

    if (interfaceTypeId) {
      // Match inserts whose template version provides the given interface.
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${templateVersionInterfacesProvided} tvp
          WHERE tvp.template_version_id = ${inserts.templateVersionId}
            AND tvp.interface_type_id = ${interfaceTypeId}
        )`,
      );
    }

    const where = and(...conditions);

    const rows = await db
      .select({
        insert: inserts,
        templateName: templates.name,
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

    // Batch-load provided interfaces per template version for the rows we
    // actually returned. Inserts inherit them; we surface the identifiers
    // so the page can render chips without another round-trip.
    const versionIds = Array.from(
      new Set(rows.map((r) => r.insert.templateVersionId).filter(Boolean)),
    ) as string[];
    const ifaceByVersion = new Map<
      string,
      { id: string; identifier: string }[]
    >();
    if (versionIds.length > 0) {
      const ifaceRows = await db
        .select({
          templateVersionId: templateVersionInterfacesProvided.templateVersionId,
          id: interfaceTypes.id,
          identifier: interfaceTypes.identifier,
        })
        .from(templateVersionInterfacesProvided)
        .innerJoin(
          interfaceTypes,
          eq(
            templateVersionInterfacesProvided.interfaceTypeId,
            interfaceTypes.id,
          ),
        )
        .where(
          inArray(
            templateVersionInterfacesProvided.templateVersionId,
            versionIds,
          ),
        );
      for (const r of ifaceRows) {
        let list = ifaceByVersion.get(r.templateVersionId);
        if (!list) {
          list = [];
          ifaceByVersion.set(r.templateVersionId, list);
        }
        list.push({ id: r.id, identifier: r.identifier });
      }
    }

    return rows.map((r) => ({
      ...r.insert,
      templateName: r.templateName,
      interfaceTypes: r.insert.templateVersionId
        ? ifaceByVersion.get(r.insert.templateVersionId) ?? []
        : [],
      rowDividersFixed: r.rowDividersFixed ?? false,
      columnDividersFixed: r.columnDividersFixed ?? false,
      locationPath: r.locationPath,
      moduleName: r.moduleName,
      cellCount: Number(r.cellCount ?? 0),
      assignedCount: Number(r.assignedCount ?? 0),
    }));
  },

  async place({
    userId,
    orgId,
    id,
    locationId,
  }: {
    userId: string;
    orgId: string;
    id: string;
    locationId: string;
  }) {
    const insert = await insertRepository.findById({ orgId, id });
    if (!insert) throw new Error(`Insert ${id} not found`);

    const [location] = await db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.id, locationId),
        ),
      );
    if (!location) throw new Error(`Location ${locationId} not found`);

    if (location.locationType !== "receptacle") {
      throw new Error(
        `Location ${locationId} is not a receptacle (type: ${location.locationType})`
      );
    }

    // Interface compatibility — set intersection. Inserts inherit provided
    // interfaces from their template version. If either side has no
    // interfaces declared, allow (user rules the storage).
    const providedIds = insert.templateVersionId
      ? (
          await db
            .select({ id: templateVersionInterfacesProvided.interfaceTypeId })
            .from(templateVersionInterfacesProvided)
            .where(
              eq(
                templateVersionInterfacesProvided.templateVersionId,
                insert.templateVersionId,
              ),
            )
        ).map((r) => r.id)
      : [];
    const acceptedIds = (
      await db
        .select({ id: locationInterfacesAccepted.interfaceTypeId })
        .from(locationInterfacesAccepted)
        .where(eq(locationInterfacesAccepted.locationId, location.id))
    ).map((r) => r.id);

    if (providedIds.length > 0 && acceptedIds.length > 0) {
      const acceptsSet = new Set(acceptedIds);
      const overlap = providedIds.some((id) => acceptsSet.has(id));
      if (!overlap) {
        throw new Error(
          `No compatible interface: insert provides [${providedIds.length}] interfaces; receptacle accepts [${acceptedIds.length}]; none match`,
        );
      }
    }

    // Refuse if the receptacle already holds another insert.
    const occupants = await db
      .select({ id: inserts.id })
      .from(inserts)
      .where(
        and(
          isolatedOrgFilter(inserts.ownerOrgId, orgId),
          eq(inserts.locationId, locationId),
        ),
      );
    if (occupants.find((o) => o.id !== id)) {
      throw new Error(
        `Location ${locationId} already holds another insert`
      );
    }

    const updated = await db.transaction(async (tx) => {
      const [ins] = await tx
        .update(inserts)
        .set({ locationId, updatedAt: new Date() })
        .where(
          and(
            isolatedOrgFilter(inserts.ownerOrgId, orgId),
            eq(inserts.id, id),
          ),
        )
        .returning();

      await reparentInsertCells(tx, orgId, id, location);

      return ins;
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "insert.place",
      entityType: "insert",
      entityId: id,
      beforeState: insert,
      afterState: updated,
    });

    return updated;
  },

  async removeFromLocation({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await insertRepository.findById({ orgId, id });
    if (!before) throw new Error(`Insert ${id} not found`);

    const updated = await db.transaction(async (tx) => {
      const [ins] = await tx
        .update(inserts)
        .set({ locationId: null, updatedAt: new Date() })
        .where(
          and(
            isolatedOrgFilter(inserts.ownerOrgId, orgId),
            eq(inserts.id, id),
          ),
        )
        .returning();

      // Cells travel with the insert. When unplaced, they stay bound
      // via insert_id but lose their parent (they're "on the floor").
      // Paths reflect just the insert's cell label until re-placed.
      const cells = await tx
        .select()
        .from(locations)
        .where(
          and(
            isolatedOrgFilter(locations.ownerOrgId, orgId),
            eq(locations.insertId, id),
          ),
        );
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
          .where(
            and(
              isolatedOrgFilter(locations.ownerOrgId, orgId),
              eq(locations.id, cell.id),
            ),
          );
      }

      return ins;
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "insert.removeFromLocation",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async update({
    userId,
    orgId,
    id,
    ...updates
  }: {
    userId: string;
    orgId: string;
    id: string;
    name?: string;
    templateId?: string;
    templateVersionId?: string;
    rows?: number;
    columns?: number;
    overrides?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const before = await insertRepository.findById({ orgId, id });
    if (!before) throw new Error(`Insert ${id} not found`);

    const [updated] = await db
      .update(inserts)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(isolatedOrgFilter(inserts.ownerOrgId, orgId), eq(inserts.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "insert.update",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await insertRepository.findById({ orgId, id });
    if (!before) throw new Error(`Insert ${id} not found`);

    await db
      .delete(inserts)
      .where(
        and(isolatedOrgFilter(inserts.ownerOrgId, orgId), eq(inserts.id, id)),
      );

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "insert.delete",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
