import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  modules,
  locations,
  assignments,
  inserts,
} from "@/db/schema";
import { isolatedOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";

// modules is an isolated table. Every method is org-scoped.
export const moduleRepository = {
  async create({
    userId,
    orgId,
    name,
    description,
    primaryDimensionLabel,
    primaryDimensionCount,
    metadata,
  }: {
    userId: string;
    orgId: string;
    name: string;
    description?: string;
    primaryDimensionLabel: string;
    primaryDimensionCount: number;
    metadata?: Record<string, unknown>;
  }) {
    const [module] = await db
      .insert(modules)
      .values({
        ownerOrgId: orgId,
        name,
        description,
        primaryDimensionLabel,
        primaryDimensionCount,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "module.create",
      entityType: "module",
      entityId: module.id,
      beforeState: null,
      afterState: module,
    });

    return module;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [module] = await db
      .select()
      .from(modules)
      .where(and(isolatedOrgFilter(modules.ownerOrgId, orgId), eq(modules.id, id)));
    return module ?? null;
  },

  async findByName({ orgId, name }: { orgId: string; name: string }) {
    const [module] = await db
      .select()
      .from(modules)
      .where(and(isolatedOrgFilter(modules.ownerOrgId, orgId), eq(modules.name, name)));
    return module ?? null;
  },

  async list({ orgId }: { orgId: string }) {
    return db
      .select()
      .from(modules)
      .where(isolatedOrgFilter(modules.ownerOrgId, orgId));
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
    description?: string;
    primaryDimensionLabel?: string;
    primaryDimensionCount?: number;
    metadata?: Record<string, unknown>;
  }) {
    const before = await moduleRepository.findById({ orgId, id });
    if (!before) throw new Error(`Module ${id} not found`);

    const [updated] = await db
      .update(modules)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(isolatedOrgFilter(modules.ownerOrgId, orgId), eq(modules.id, id)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "module.update",
      entityType: "module",
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
    const before = await moduleRepository.findById({ orgId, id });
    if (!before) throw new Error(`Module ${id} not found`);

    await db
      .delete(modules)
      .where(and(isolatedOrgFilter(modules.ownerOrgId, orgId), eq(modules.id, id)));

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "module.delete",
      entityType: "module",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  /**
   * Summarize what a module contains prior to deletion.
   * Used by the GitHub-repo-style deletion dialog.
   */
  async getStats({ orgId, id }: { orgId: string; id: string }) {
    const module_ = await moduleRepository.findById({ orgId, id });
    if (!module_) throw new Error(`Module ${id} not found`);

    const locs = await db
      .select({ id: locations.id, parentId: locations.parentId })
      .from(locations)
      .where(
        and(
          isolatedOrgFilter(locations.ownerOrgId, orgId),
          eq(locations.moduleId, id),
        ),
      );

    const locationIds = locs.map((l) => l.id);
    const levelCount = locs.filter((l) => l.parentId === null).length;

    let assignmentCount = 0;
    let insertCount = 0;
    if (locationIds.length > 0) {
      const [asRow] = await db
        .select({ c: sql<number>`COUNT(*)` })
        .from(assignments)
        .where(
          and(
            isolatedOrgFilter(assignments.ownerOrgId, orgId),
            inArray(assignments.locationId, locationIds),
          ),
        );
      assignmentCount = Number(asRow?.c ?? 0);

      const [inRow] = await db
        .select({ c: sql<number>`COUNT(*)` })
        .from(inserts)
        .where(
          and(
            isolatedOrgFilter(inserts.ownerOrgId, orgId),
            inArray(inserts.locationId, locationIds),
          ),
        );
      insertCount = Number(inRow?.c ?? 0);
    }

    return {
      locationCount: locs.length,
      levelCount,
      assignmentCount,
      insertCount,
    };
  },

  /**
   * Cascade-delete a module and orphan its contents:
   * - assignments inside the module are removed (items become unassigned)
   * - inserts in the module's locations are unplaced (locationId = null)
   * - locations are deleted
   * - module is deleted
   * All in one transaction. Logged as a single module.deleteCascade entry.
   */
  async removeWithCascade({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await moduleRepository.findById({ orgId, id });
    if (!before) throw new Error(`Module ${id} not found`);

    const stats = await moduleRepository.getStats({ orgId, id });

    await db.transaction(async (tx) => {
      const locs = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(
          and(
            isolatedOrgFilter(locations.ownerOrgId, orgId),
            eq(locations.moduleId, id),
          ),
        );
      const locationIds = locs.map((l) => l.id);

      if (locationIds.length > 0) {
        await tx
          .delete(assignments)
          .where(
            and(
              isolatedOrgFilter(assignments.ownerOrgId, orgId),
              inArray(assignments.locationId, locationIds),
            ),
          );

        await tx
          .update(inserts)
          .set({ locationId: null, updatedAt: new Date() })
          .where(
            and(
              isolatedOrgFilter(inserts.ownerOrgId, orgId),
              inArray(inserts.locationId, locationIds),
            ),
          );

        await tx
          .delete(locations)
          .where(
            and(
              isolatedOrgFilter(locations.ownerOrgId, orgId),
              eq(locations.moduleId, id),
            ),
          );
      }

      await tx
        .delete(modules)
        .where(and(isolatedOrgFilter(modules.ownerOrgId, orgId), eq(modules.id, id)));
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "module.deleteCascade",
      entityType: "module",
      entityId: id,
      beforeState: { module: before, stats },
      afterState: null,
    });

    return stats;
  },
};
