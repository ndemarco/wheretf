import { eq, sql } from "drizzle-orm";
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
    moduleId: string;
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
