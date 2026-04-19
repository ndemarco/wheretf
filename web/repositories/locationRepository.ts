import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  locations,
  locationInterfacesAccepted,
  interfaceTypes,
  templates,
  templateVersions,
  assignments,
} from "@/db/schema";
import { isolatedOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";

// locations and location_interfaces_accepted are isolated tables.
// Every method is org-scoped. The ad-hoc template+version created by
// `create` is written with ownerOrgId = orgId (org-private, not global).

async function createSingleInstanceTemplateVersion(
  orgId: string,
  pathSegments: string[],
) {
  const [template] = await db
    .insert(templates)
    .values({
      ownerOrgId: orgId,
      name: `ad-hoc: ${pathSegments.join(":")}`,
      scope: "single_instance",
      currentVersion: 1,
      activeVersion: 1,
    })
    .returning();

  const [version] = await db
    .insert(templateVersions)
    .values({
      ownerOrgId: orgId,
      templateId: template.id,
      version: 1,
    })
    .returning();

  return version.id;
}

export const locationRepository = {
  async create({
    userId,
    orgId,
    moduleId,
    parentId,
    label,
    pathSegments,
    locationType,
    interfacesAcceptedIds,
    templateVersionId,
    insertId,
    gridRow,
    gridColumn,
    metadata,
  }: {
    userId: string;
    orgId: string;
    moduleId?: string | null;
    parentId?: string;
    label: string;
    pathSegments: string[];
    locationType: string;
    /** UUIDs of interface_types this receptacle accepts. */
    interfacesAcceptedIds?: string[];
    templateVersionId?: string;
    insertId?: string;
    gridRow?: number;
    gridColumn?: number;
    metadata?: Record<string, unknown>;
  }) {
    const path = pathSegments.join(":");

    const resolvedTemplateVersionId =
      templateVersionId ??
      (await createSingleInstanceTemplateVersion(orgId, pathSegments));

    const location = await db.transaction(async (tx) => {
      const [loc] = await tx
        .insert(locations)
        .values({
          ownerOrgId: orgId,
          moduleId,
          parentId,
          label,
          path,
          pathSegments,
          locationType,
          templateVersionId: resolvedTemplateVersionId,
          insertId,
          gridRow,
          gridColumn,
          metadata,
        })
        .returning();

      if (interfacesAcceptedIds?.length) {
        await tx.insert(locationInterfacesAccepted).values(
          interfacesAcceptedIds.map((interfaceTypeId) => ({
            ownerOrgId: orgId,
            locationId: loc.id,
            interfaceTypeId,
          })),
        );
      }

      return loc;
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.create",
      entityType: "location",
      entityId: location.id,
      beforeState: null,
      afterState: location,
    });

    return location;
  },

  /** Interface types this receptacle accepts. */
  async getAcceptedInterfaces({
    orgId,
    locationId,
  }: {
    orgId: string;
    locationId: string;
  }) {
    return db
      .select({
        id: interfaceTypes.id,
        identifier: interfaceTypes.identifier,
        description: interfaceTypes.description,
        maturity: interfaceTypes.maturity,
        archivedAt: interfaceTypes.archivedAt,
        unitSystem: interfaceTypes.unitSystem,
      })
      .from(locationInterfacesAccepted)
      .innerJoin(
        interfaceTypes,
        eq(locationInterfacesAccepted.interfaceTypeId, interfaceTypes.id),
      )
      .where(
        and(
          isolatedOrgFilter(locationInterfacesAccepted.ownerOrgId, orgId),
          eq(locationInterfacesAccepted.locationId, locationId),
        ),
      );
  },

  /** Batched version of getAcceptedInterfaces — returns a map keyed by locationId. */
  async getAcceptedInterfacesByLocationIds({
    orgId,
    locationIds,
  }: {
    orgId: string;
    locationIds: string[];
  }) {
    const map = new Map<
      string,
      {
        id: string;
        identifier: string;
        description: string | null;
        maturity: string;
        archivedAt: Date | null;
        unitSystem: unknown;
      }[]
    >();
    if (locationIds.length === 0) return map;
    const rows = await db
      .select({
        locationId: locationInterfacesAccepted.locationId,
        id: interfaceTypes.id,
        identifier: interfaceTypes.identifier,
        description: interfaceTypes.description,
        maturity: interfaceTypes.maturity,
        archivedAt: interfaceTypes.archivedAt,
        unitSystem: interfaceTypes.unitSystem,
      })
      .from(locationInterfacesAccepted)
      .innerJoin(
        interfaceTypes,
        eq(locationInterfacesAccepted.interfaceTypeId, interfaceTypes.id),
      )
      .where(
        and(
          isolatedOrgFilter(locationInterfacesAccepted.ownerOrgId, orgId),
          inArray(locationInterfacesAccepted.locationId, locationIds),
        ),
      );
    for (const r of rows) {
      const { locationId, ...iface } = r;
      let list = map.get(locationId);
      if (!list) {
        list = [];
        map.set(locationId, list);
      }
      list.push(iface);
    }
    return map;
  },

  /** Replace the accepted-interface set on a receptacle. */
  async setAcceptedInterfaces({
    userId,
    orgId,
    locationId,
    interfaceTypeIds,
  }: {
    userId: string;
    orgId: string;
    locationId: string;
    interfaceTypeIds: string[];
  }) {
    await db.transaction(async (tx) => {
      await tx
        .delete(locationInterfacesAccepted)
        .where(
          and(
            isolatedOrgFilter(locationInterfacesAccepted.ownerOrgId, orgId),
            eq(locationInterfacesAccepted.locationId, locationId),
          ),
        );
      if (interfaceTypeIds.length > 0) {
        await tx.insert(locationInterfacesAccepted).values(
          interfaceTypeIds.map((interfaceTypeId) => ({
            ownerOrgId: orgId,
            locationId,
            interfaceTypeId,
          })),
        );
      }
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.setAcceptedInterfaces",
      entityType: "location",
      entityId: locationId,
      beforeState: null,
      afterState: { interfaceTypeIds },
    });
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [location] = await db
      .select()
      .from(locations)
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      );
    return location ?? null;
  },

  async findByPath({
    orgId,
    moduleId,
    path,
  }: {
    orgId: string;
    moduleId: string;
    path: string;
  }) {
    const results = await db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.moduleId, moduleId),
        ),
      );
    const match = results.find((l) => l.path === path);
    return match ?? null;
  },

  async findByModuleId({
    orgId,
    moduleId,
  }: {
    orgId: string;
    moduleId: string;
  }) {
    return db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.moduleId, moduleId),
        ),
      )
      .orderBy(asc(locations.createdAt));
  },

  async findByInsertId({
    orgId,
    insertId,
  }: {
    orgId: string;
    insertId: string;
  }) {
    return db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.insertId, insertId),
        ),
      );
  },

  async findChildren({
    orgId,
    parentId,
  }: {
    orgId: string;
    parentId: string;
  }) {
    return db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.parentId, parentId),
        ),
      );
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
    label?: string;
    locationType?: string;
    templateVersionId?: string;
    gridRow?: number;
    gridColumn?: number;
    metadata?: Record<string, unknown>;
  }) {
    const before = await locationRepository.findById({ orgId, id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.update",
      entityType: "location",
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
    const before = await locationRepository.findById({ orgId, id });
    if (!before) throw new Error(`Location ${id} not found`);

    await db
      .delete(locations)
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      );

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.delete",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async disable({
    userId,
    orgId,
    id,
    reason,
  }: {
    userId: string;
    orgId: string;
    id: string;
    reason?: string;
  }) {
    const before = await locationRepository.findById({ orgId, id });
    if (!before) throw new Error(`Location ${id} not found`);

    // Per spec: existing assignments must be resolved before disabling.
    const [row] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.locationId, id),
        ),
      );
    if (Number(row?.c ?? 0) > 0) {
      throw new Error(
        "Cannot disable a location with active assignments. Unassign items first."
      );
    }

    const [updated] = await db
      .update(locations)
      .set({
        isDisabled: true,
        disableReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.disable",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async restrict({
    userId,
    orgId,
    id,
    maxWidthMm,
    maxHeightMm,
    maxDepthMm,
    reason,
  }: {
    userId: string;
    orgId: string;
    id: string;
    maxWidthMm?: number | null;
    maxHeightMm?: number | null;
    maxDepthMm?: number | null;
    reason?: string | null;
  }) {
    const before = await locationRepository.findById({ orgId, id });
    if (!before) throw new Error(`Location ${id} not found`);

    // NOTE: spec requires refusing the clamp when existing assignments
    // would no longer fit. Implementing that check needs a dimensional
    // model for items, which doesn't exist yet. For MVP, the clamp
    // is accepted unconditionally. Re-examine once item dimensions land.

    const [updated] = await db
      .update(locations)
      .set({
        maxWidthMm: maxWidthMm == null ? null : String(maxWidthMm),
        maxHeightMm: maxHeightMm == null ? null : String(maxHeightMm),
        maxDepthMm: maxDepthMm == null ? null : String(maxDepthMm),
        restrictReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.restrict",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async clearRestrict({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    return locationRepository.restrict({
      userId,
      orgId,
      id,
      maxWidthMm: null,
      maxHeightMm: null,
      maxDepthMm: null,
      reason: null,
    });
  },

  async enable({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await locationRepository.findById({ orgId, id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({
        isDisabled: false,
        disableReason: null,
        updatedAt: new Date(),
      })
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.enable",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  /**
   * Merge a contiguous set of cells into one. Origin cell keeps its row;
   * each other cell becomes an alias pointing to origin via mergedIntoId.
   * Validation:
   *   - all cells exist and share the same parent
   *   - all cells belong to the same insert (or all none)
   *   - all cells are adjacent (form a contiguous grid region)
   *   - no active assignments on any cell
   *   - template's dividersFixed constraints not violated (if applicable)
   */
  async merge({
    userId,
    orgId,
    originId,
    aliasIds,
  }: {
    userId: string;
    orgId: string;
    originId: string;
    aliasIds: string[];
  }) {
    if (aliasIds.length === 0) {
      throw new Error("Merge requires at least one alias cell");
    }
    const allIds = [originId, ...aliasIds.filter((a) => a !== originId)];

    const rows = await db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          inArray(locations.id, allIds),
        ),
      );

    if (rows.length !== allIds.length) {
      throw new Error("One or more cells not found");
    }

    const origin = rows.find((r) => r.id === originId)!;
    const others = rows.filter((r) => r.id !== originId);

    // Same parent
    if (others.some((r) => r.parentId !== origin.parentId)) {
      throw new Error("Cells must share the same parent to be merged");
    }
    // Same insert (or all null)
    if (others.some((r) => r.insertId !== origin.insertId)) {
      throw new Error("Cells must belong to the same insert to be merged");
    }

    // Assignments check
    const [asgRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          inArray(assignments.locationId, allIds),
        ),
      );
    if (Number(asgRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot merge cells with active assignments. Unassign items first."
      );
    }

    // Already-merged check
    if (rows.some((r) => r.mergedIntoId)) {
      throw new Error("One or more cells are already merged");
    }

    // Disabled-cell check: a disabled cell represents a structural
    // problem, not just a content state. Merging it away would lose
    // that signal. Enable it first if you really want it merged.
    if (rows.some((r) => r.isDisabled)) {
      throw new Error("Cannot merge disabled cells. Enable them first.");
    }

    // Adjacency: every cell must be reachable from origin via 4-neighbor
    // adjacency within the selected set.
    const grid = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      if (r.gridRow == null || r.gridColumn == null) {
        throw new Error(
          "Merge supports grid cells only (gridRow/gridColumn required)"
        );
      }
      grid.set(`${r.gridRow},${r.gridColumn}`, r);
    }
    const visited = new Set<string>([origin.id]);
    const queue: Array<typeof origin> = [origin];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const neighbors = [
        [cur.gridRow! - 1, cur.gridColumn!],
        [cur.gridRow! + 1, cur.gridColumn!],
        [cur.gridRow!, cur.gridColumn! - 1],
        [cur.gridRow!, cur.gridColumn! + 1],
      ];
      for (const [nr, nc] of neighbors) {
        const n = grid.get(`${nr},${nc}`);
        if (n && !visited.has(n.id)) {
          visited.add(n.id);
          queue.push(n);
        }
      }
    }
    if (visited.size !== rows.length) {
      throw new Error("Cells must be contiguous (4-connected) to be merged");
    }

    // Divider axis constraint (only enforced when all cells share a templateVersion).
    // If all on same version and it says rowDividersFixed / columnDividersFixed,
    // refuse merges that span that axis.
    if (origin.templateVersionId) {
      const [tv] = await db
        .select()
        .from(templateVersions)
        .where(eq(templateVersions.id, origin.templateVersionId));
      if (tv) {
        const rowsSpanned = new Set(rows.map((r) => r.gridRow));
        const colsSpanned = new Set(rows.map((r) => r.gridColumn));
        if (tv.rowDividersFixed && rowsSpanned.size > 1) {
          throw new Error(
            "Template has fixed row dividers; merge cannot span rows"
          );
        }
        if (tv.columnDividersFixed && colsSpanned.size > 1) {
          throw new Error(
            "Template has fixed column dividers; merge cannot span columns"
          );
        }
      }
    }

    await db.transaction(async (tx) => {
      for (const r of others) {
        await tx
          .update(locations)
          .set({ mergedIntoId: originId, updatedAt: new Date() })
          .where(
            and(
              isolatedOrgFilter(locations.ownerOrgId, orgId),
              eq(locations.id, r.id),
            ),
          );
      }
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.merge",
      entityType: "location",
      entityId: originId,
      beforeState: { originId, aliasIds },
      afterState: null,
    });

    return { originId, aliasIds };
  },

  /**
   * Split a leaf location into named child locations.
   * Prerequisite: no active assignments on the parent.
   * Children inherit insertId and moduleId; paths extend the parent path.
   * Parent becomes non-leaf (no longer valid assignment target).
   */
  async divide({
    userId,
    orgId,
    parentId,
    labels,
    source,
  }: {
    userId: string;
    orgId: string;
    parentId: string;
    labels: string[];
    source?: string; // 'ad_hoc' | 'template_option:<id>' | 'insert_template:<id>'
  }) {
    const parent = await locationRepository.findById({ orgId, id: parentId });
    if (!parent) throw new Error(`Location ${parentId} not found`);

    if (labels.length < 2) {
      throw new Error("Divide requires at least two child labels");
    }
    const trimmed = labels.map((l) => l.trim()).filter((l) => l.length > 0);
    if (trimmed.length !== labels.length) {
      throw new Error("Child labels must be non-empty");
    }
    if (new Set(trimmed).size !== trimmed.length) {
      throw new Error("Child labels must be unique");
    }

    // Active assignments check
    const [asgRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.locationId, parentId),
        ),
      );
    if (Number(asgRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot divide a location with active assignments. Unassign items first."
      );
    }

    // Already divided?
    const existingChildren = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.parentId, parentId),
        ),
      );
    if (existingChildren.length > 0) {
      throw new Error("Location is already divided");
    }

    const parentSegments = (parent.pathSegments as string[]) ?? [
      parent.label,
    ];

    const children = await db.transaction(async (tx) => {
      const created: Array<{ id: string; label: string; path: string }> = [];
      for (const label of trimmed) {
        const segments = [...parentSegments, label];
        const [row] = await tx
          .insert(locations)
          .values({
            ownerOrgId: orgId,
            moduleId: parent.moduleId,
            parentId,
            label,
            path: segments.join(":"),
            pathSegments: segments,
            locationType: "leaf",
            templateVersionId: parent.templateVersionId,
            insertId: parent.insertId,
          })
          .returning();
        created.push({ id: row.id, label: row.label, path: row.path });
      }

      await tx
        .update(locations)
        .set({
          locationType: "fixed", // parent no longer a leaf
          subdivisionSource: source ?? "ad_hoc",
          updatedAt: new Date(),
        })
        .where(
          and(
            isolatedOrgFilter(locations.ownerOrgId, orgId),
            eq(locations.id, parentId),
          ),
        );

      return created;
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.divide",
      entityType: "location",
      entityId: parentId,
      beforeState: { parentId },
      afterState: { children },
    });

    return children;
  },

  /**
   * Collapse a divided parent back to a leaf. Refuses if any child
   * has assignments or has been divided itself.
   */
  async undivide({
    userId,
    orgId,
    parentId,
  }: {
    userId: string;
    orgId: string;
    parentId: string;
  }) {
    const parent = await locationRepository.findById({ orgId, id: parentId });
    if (!parent) throw new Error(`Location ${parentId} not found`);

    const children = await db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.parentId, parentId),
        ),
      );
    if (children.length === 0) {
      throw new Error("Location is not divided");
    }

    const childIds = children.map((c) => c.id);

    const [asgRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          inArray(assignments.locationId, childIds),
        ),
      );
    if (Number(asgRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot undivide: children have active assignments. Unassign first."
      );
    }

    const [grandRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          inArray(locations.parentId, childIds),
        ),
      );
    if (Number(grandRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot undivide: children have been subdivided themselves. Undivide them first."
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(locations)
        .where(
          and(
            isolatedOrgFilter(locations.ownerOrgId, orgId),
            eq(locations.parentId, parentId),
          ),
        );
      await tx
        .update(locations)
        .set({
          locationType: "leaf",
          subdivisionSource: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            isolatedOrgFilter(locations.ownerOrgId, orgId),
            eq(locations.id, parentId),
          ),
        );
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.undivide",
      entityType: "location",
      entityId: parentId,
      beforeState: { childIds },
      afterState: null,
    });

    return { parentId, removed: childIds.length };
  },

  async unmerge({
    userId,
    orgId,
    originId,
  }: {
    userId: string;
    orgId: string;
    originId: string;
  }) {
    const aliases = await db
      .select()
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.mergedIntoId, originId),
        ),
      );
    if (aliases.length === 0) {
      throw new Error("No merged cells for this origin");
    }

    await db
      .update(locations)
      .set({ mergedIntoId: null, updatedAt: new Date() })
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.mergedIntoId, originId),
        ),
      );

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.unmerge",
      entityType: "location",
      entityId: originId,
      beforeState: { aliasIds: aliases.map((a) => a.id) },
      afterState: null,
    });

    return { originId, aliasCount: aliases.length };
  },

  async setMergeAlias({
    userId,
    orgId,
    id,
    mergedIntoId,
  }: {
    userId: string;
    orgId: string;
    id: string;
    mergedIntoId: string;
  }) {
    const before = await locationRepository.findById({ orgId, id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({ mergedIntoId, updatedAt: new Date() })
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.setMergeAlias",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async clearMergeAlias({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await locationRepository.findById({ orgId, id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({ mergedIntoId: null, updatedAt: new Date() })
      .where(
        and(isolatedOrgFilter(locations.ownerOrgId, orgId), eq(locations.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "location.clearMergeAlias",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },
};
