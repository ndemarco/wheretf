import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  locations,
  templates,
  templateVersions,
  assignments,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

async function createSingleInstanceTemplateVersion(pathSegments: string[]) {
  const [template] = await db
    .insert(templates)
    .values({
      name: `ad-hoc: ${pathSegments.join(":")}`,
      scope: "single_instance",
      currentVersion: 1,
      activeVersion: 1,
    })
    .returning();

  const [version] = await db
    .insert(templateVersions)
    .values({
      templateId: template.id,
      version: 1,
    })
    .returning();

  return version.id;
}

export const locationRepository = {
  async create({
    moduleId,
    parentId,
    label,
    pathSegments,
    locationType,
    interfaceTypeAccepted,
    templateVersionId,
    insertId,
    gridRow,
    gridColumn,
    metadata,
  }: {
    moduleId?: string | null;
    parentId?: string;
    label: string;
    pathSegments: string[];
    locationType: string;
    interfaceTypeAccepted?: string;
    templateVersionId?: string;
    insertId?: string;
    gridRow?: number;
    gridColumn?: number;
    metadata?: Record<string, unknown>;
  }) {
    const path = pathSegments.join(":");

    const resolvedTemplateVersionId =
      templateVersionId ??
      (await createSingleInstanceTemplateVersion(pathSegments));

    const [location] = await db
      .insert(locations)
      .values({
        moduleId,
        parentId,
        label,
        path,
        pathSegments,
        locationType,
        interfaceTypeAccepted,
        templateVersionId: resolvedTemplateVersionId,
        insertId,
        gridRow,
        gridColumn,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      actionType: "location.create",
      entityType: "location",
      entityId: location.id,
      beforeState: null,
      afterState: location,
    });

    return location;
  },

  async findById({ id }: { id: string }) {
    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, id));
    return location ?? null;
  },

  async findByPath({ moduleId, path }: { moduleId: string; path: string }) {
    const results = await db
      .select()
      .from(locations)
      .where(eq(locations.moduleId, moduleId));
    const match = results.find((l) => l.path === path);
    return match ?? null;
  },

  async findByModuleId({ moduleId }: { moduleId: string }) {
    return db
      .select()
      .from(locations)
      .where(eq(locations.moduleId, moduleId));
  },

  async findByInsertId({ insertId }: { insertId: string }) {
    return db
      .select()
      .from(locations)
      .where(eq(locations.insertId, insertId));
  },

  async findChildren({ parentId }: { parentId: string }) {
    return db
      .select()
      .from(locations)
      .where(eq(locations.parentId, parentId));
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    label?: string;
    locationType?: string;
    interfaceTypeAccepted?: string;
    templateVersionId?: string;
    gridRow?: number;
    gridColumn?: number;
    metadata?: Record<string, unknown>;
  }) {
    const before = await locationRepository.findById({ id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "location.update",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await locationRepository.findById({ id });
    if (!before) throw new Error(`Location ${id} not found`);

    await db.delete(locations).where(eq(locations.id, id));

    await transactionRepository.log({
      actionType: "location.delete",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async disable({ id, reason }: { id: string; reason?: string }) {
    const before = await locationRepository.findById({ id });
    if (!before) throw new Error(`Location ${id} not found`);

    // Per spec: existing assignments must be resolved before disabling.
    const [row] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(assignments)
      .where(eq(assignments.locationId, id));
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
      .where(eq(locations.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "location.disable",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async restrict({
    id,
    maxWidthMm,
    maxHeightMm,
    maxDepthMm,
    reason,
  }: {
    id: string;
    maxWidthMm?: number | null;
    maxHeightMm?: number | null;
    maxDepthMm?: number | null;
    reason?: string | null;
  }) {
    const before = await locationRepository.findById({ id });
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
      .where(eq(locations.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "location.restrict",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async clearRestrict({ id }: { id: string }) {
    return locationRepository.restrict({
      id,
      maxWidthMm: null,
      maxHeightMm: null,
      maxDepthMm: null,
      reason: null,
    });
  },

  async enable({ id }: { id: string }) {
    const before = await locationRepository.findById({ id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({
        isDisabled: false,
        disableReason: null,
        updatedAt: new Date(),
      })
      .where(eq(locations.id, id))
      .returning();

    await transactionRepository.log({
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
    originId,
    aliasIds,
  }: {
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
      .where(inArray(locations.id, allIds));

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
      .where(inArray(assignments.locationId, allIds));
    if (Number(asgRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot merge cells with active assignments. Unassign items first."
      );
    }

    // Already-merged check
    if (rows.some((r) => r.mergedIntoId)) {
      throw new Error("One or more cells are already merged");
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
          .where(eq(locations.id, r.id));
      }
    });

    await transactionRepository.log({
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
    parentId,
    labels,
    source,
  }: {
    parentId: string;
    labels: string[];
    source?: string; // 'ad_hoc' | 'template_option:<id>' | 'insert_template:<id>'
  }) {
    const parent = await locationRepository.findById({ id: parentId });
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
      .where(eq(assignments.locationId, parentId));
    if (Number(asgRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot divide a location with active assignments. Unassign items first."
      );
    }

    // Already divided?
    const existingChildren = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.parentId, parentId));
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
        .where(eq(locations.id, parentId));

      return created;
    });

    await transactionRepository.log({
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
  async undivide({ parentId }: { parentId: string }) {
    const parent = await locationRepository.findById({ id: parentId });
    if (!parent) throw new Error(`Location ${parentId} not found`);

    const children = await db
      .select()
      .from(locations)
      .where(eq(locations.parentId, parentId));
    if (children.length === 0) {
      throw new Error("Location is not divided");
    }

    const childIds = children.map((c) => c.id);

    const [asgRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(assignments)
      .where(inArray(assignments.locationId, childIds));
    if (Number(asgRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot undivide: children have active assignments. Unassign first."
      );
    }

    const [grandRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(locations)
      .where(inArray(locations.parentId, childIds));
    if (Number(grandRow?.c ?? 0) > 0) {
      throw new Error(
        "Cannot undivide: children have been subdivided themselves. Undivide them first."
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(locations).where(eq(locations.parentId, parentId));
      await tx
        .update(locations)
        .set({
          locationType: "leaf",
          subdivisionSource: null,
          updatedAt: new Date(),
        })
        .where(eq(locations.id, parentId));
    });

    await transactionRepository.log({
      actionType: "location.undivide",
      entityType: "location",
      entityId: parentId,
      beforeState: { childIds },
      afterState: null,
    });

    return { parentId, removed: childIds.length };
  },

  async unmerge({ originId }: { originId: string }) {
    const aliases = await db
      .select()
      .from(locations)
      .where(eq(locations.mergedIntoId, originId));
    if (aliases.length === 0) {
      throw new Error("No merged cells for this origin");
    }

    await db
      .update(locations)
      .set({ mergedIntoId: null, updatedAt: new Date() })
      .where(eq(locations.mergedIntoId, originId));

    await transactionRepository.log({
      actionType: "location.unmerge",
      entityType: "location",
      entityId: originId,
      beforeState: { aliasIds: aliases.map((a) => a.id) },
      afterState: null,
    });

    return { originId, aliasCount: aliases.length };
  },

  async setMergeAlias({
    id,
    mergedIntoId,
  }: {
    id: string;
    mergedIntoId: string;
  }) {
    const before = await locationRepository.findById({ id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({ mergedIntoId, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "location.setMergeAlias",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async clearMergeAlias({ id }: { id: string }) {
    const before = await locationRepository.findById({ id });
    if (!before) throw new Error(`Location ${id} not found`);

    const [updated] = await db
      .update(locations)
      .set({ mergedIntoId: null, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "location.clearMergeAlias",
      entityType: "location",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },
};
