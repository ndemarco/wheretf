import { eq, and, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  interfaceTypes,
  templates,
  templateVersions,
  templateVersionInterfacesProvided,
  templateVersionInterfacesAccepted,
  locationInterfacesAccepted,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

type Maturity = "draft" | "stable";
type ListStatus = "active" | "archived" | "all";

export const interfaceTypeRepository = {
  async create({
    identifier,
    description,
    physicalContract,
    maturity,
    unitSystem,
  }: {
    identifier: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
    maturity?: Maturity;
    unitSystem?: Record<string, unknown>;
  }) {
    const [interfaceType] = await db
      .insert(interfaceTypes)
      .values({
        identifier,
        description,
        physicalContract,
        // Default to 'stable' — matches UX spec: the save button carries
        // the draft/stable intent, form has no explicit control.
        maturity: maturity ?? "stable",
        unitSystem,
      })
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.create",
      entityType: "interfaceType",
      entityId: interfaceType.id,
      beforeState: null,
      afterState: interfaceType,
    });

    return interfaceType;
  },

  async findById({ id }: { id: string }) {
    const [interfaceType] = await db
      .select()
      .from(interfaceTypes)
      .where(eq(interfaceTypes.id, id));
    return interfaceType ?? null;
  },

  async findByIdentifier({ identifier }: { identifier: string }) {
    const [interfaceType] = await db
      .select()
      .from(interfaceTypes)
      .where(eq(interfaceTypes.identifier, identifier));
    return interfaceType ?? null;
  },

  async list({ status = "all" }: { status?: ListStatus } = {}) {
    const base = db.select().from(interfaceTypes);
    if (status === "active") {
      return base.where(isNull(interfaceTypes.archivedAt));
    }
    if (status === "archived") {
      return base.where(isNotNull(interfaceTypes.archivedAt));
    }
    return base;
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    identifier?: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
    maturity?: Maturity;
    unitSystem?: Record<string, unknown> | null;
  }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    // Maturity guard — stable is terminal. Demotion creates ambiguous
    // semantics when refs already point at the type. See spec
    // "Maturity" → state machine one-directional.
    if (
      updates.maturity === "draft" &&
      before.maturity === "stable"
    ) {
      throw new Error(
        "Cannot demote stable → draft. Stable is terminal (one-way state machine).",
      );
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set(updates)
      .where(eq(interfaceTypes.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.update",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async archive({ id }: { id: string }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    if (before.archivedAt) {
      return before; // idempotent
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set({ archivedAt: new Date() })
      .where(eq(interfaceTypes.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.archive",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async unarchive({ id }: { id: string }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    if (!before.archivedAt) {
      return before; // idempotent
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set({ archivedAt: null })
      .where(eq(interfaceTypes.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.unarchive",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async usageCount({ id }: { id: string }) {
    const [providers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(templateVersionInterfacesProvided)
      .where(eq(templateVersionInterfacesProvided.interfaceTypeId, id));

    const [accepters] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(templateVersionInterfacesAccepted)
      .where(eq(templateVersionInterfacesAccepted.interfaceTypeId, id));

    const [receptacles] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(locationInterfacesAccepted)
      .where(eq(locationInterfacesAccepted.interfaceTypeId, id));

    return {
      providers: providers?.count ?? 0,
      accepters: accepters?.count ?? 0,
      receptacles: receptacles?.count ?? 0,
    };
  },

  /**
   * Merge one or more source interface types into a single target.
   * All junction rows pointing at a source are rewritten to point at the
   * target (dedup on conflict). For every affected template, a new
   * template version is minted capturing the remapped interface set —
   * per spec, interfaces-provided/accepted are versioned properties, so
   * a merge is a versioned event. Source rows are hard-deleted at the
   * end, bypassing the archive-gate (merge consolidates; tombstoning is
   * part of the operation).
   *
   * All work happens in a single transaction.
   */
  async merge({
    sourceIds,
    targetId,
  }: {
    sourceIds: string[];
    targetId: string;
  }) {
    if (!sourceIds || sourceIds.length === 0) {
      throw new Error("Merge requires at least one sourceId.");
    }
    if (sourceIds.includes(targetId)) {
      throw new Error("Merge target cannot also be a source.");
    }

    const target = await interfaceTypeRepository.findById({ id: targetId });
    if (!target) {
      throw new Error(`Merge target ${targetId} not found.`);
    }

    const sources = await db
      .select()
      .from(interfaceTypes)
      .where(inArray(interfaceTypes.id, sourceIds));
    if (sources.length !== sourceIds.length) {
      const found = new Set(sources.map((s) => s.id));
      const missing = sourceIds.filter((id) => !found.has(id));
      throw new Error(`Merge source not found: ${missing.join(", ")}`);
    }

    const result = await db.transaction(async (tx) => {
      // ── 1. Identify affected template versions (distinct) ──
      const affectedProvided = await tx
        .select({
          templateVersionId:
            templateVersionInterfacesProvided.templateVersionId,
        })
        .from(templateVersionInterfacesProvided)
        .where(
          inArray(
            templateVersionInterfacesProvided.interfaceTypeId,
            sourceIds,
          ),
        );
      const affectedAccepted = await tx
        .select({
          templateVersionId:
            templateVersionInterfacesAccepted.templateVersionId,
        })
        .from(templateVersionInterfacesAccepted)
        .where(
          inArray(
            templateVersionInterfacesAccepted.interfaceTypeId,
            sourceIds,
          ),
        );
      const affectedVersionIds = Array.from(
        new Set([
          ...affectedProvided.map((r) => r.templateVersionId),
          ...affectedAccepted.map((r) => r.templateVersionId),
        ]),
      );

      // ── 2. Rewrite template_version junctions: source → target ──
      // Strategy: SELECT distinct holders of source refs; INSERT target rows
      // with ON CONFLICT DO NOTHING to dedupe; DELETE source rows.
      let rewritesProvided = 0;
      let rewritesAccepted = 0;
      if (affectedProvided.length > 0) {
        const holders = Array.from(
          new Set(affectedProvided.map((r) => r.templateVersionId)),
        );
        await tx
          .insert(templateVersionInterfacesProvided)
          .values(
            holders.map((templateVersionId) => ({
              templateVersionId,
              interfaceTypeId: targetId,
            })),
          )
          .onConflictDoNothing();
        const deleted = await tx
          .delete(templateVersionInterfacesProvided)
          .where(
            inArray(
              templateVersionInterfacesProvided.interfaceTypeId,
              sourceIds,
            ),
          )
          .returning();
        rewritesProvided = deleted.length;
      }
      if (affectedAccepted.length > 0) {
        const holders = Array.from(
          new Set(affectedAccepted.map((r) => r.templateVersionId)),
        );
        await tx
          .insert(templateVersionInterfacesAccepted)
          .values(
            holders.map((templateVersionId) => ({
              templateVersionId,
              interfaceTypeId: targetId,
            })),
          )
          .onConflictDoNothing();
        const deleted = await tx
          .delete(templateVersionInterfacesAccepted)
          .where(
            inArray(
              templateVersionInterfacesAccepted.interfaceTypeId,
              sourceIds,
            ),
          )
          .returning();
        rewritesAccepted = deleted.length;
      }

      // ── 3. Rewrite location junctions: source → target ──
      const affectedLocations = await tx
        .select({ locationId: locationInterfacesAccepted.locationId })
        .from(locationInterfacesAccepted)
        .where(
          inArray(locationInterfacesAccepted.interfaceTypeId, sourceIds),
        );
      let rewritesLocations = 0;
      if (affectedLocations.length > 0) {
        const holders = Array.from(
          new Set(affectedLocations.map((r) => r.locationId)),
        );
        await tx
          .insert(locationInterfacesAccepted)
          .values(
            holders.map((locationId) => ({
              locationId,
              interfaceTypeId: targetId,
            })),
          )
          .onConflictDoNothing();
        const deleted = await tx
          .delete(locationInterfacesAccepted)
          .where(
            inArray(locationInterfacesAccepted.interfaceTypeId, sourceIds),
          )
          .returning();
        rewritesLocations = deleted.length;
      }

      // ── 4. Mint a new template version for each affected template ──
      // Captures the post-merge interface set as a distinct version so
      // consumers see a versioned trail of the merge. Junction rows for
      // the new version carry the already-remapped target refs, so we
      // snapshot the version's current junctions after step 2.
      let versionsMinted = 0;
      if (affectedVersionIds.length > 0) {
        // Map version -> template
        const versionRows = await tx
          .select()
          .from(templateVersions)
          .where(inArray(templateVersions.id, affectedVersionIds));
        const byTemplateId = new Map<string, typeof versionRows>();
        for (const v of versionRows) {
          const list = byTemplateId.get(v.templateId) ?? [];
          list.push(v);
          byTemplateId.set(v.templateId, list);
        }

        for (const [templateId, versions] of byTemplateId.entries()) {
          const [tmpl] = await tx
            .select()
            .from(templates)
            .where(eq(templates.id, templateId));
          if (!tmpl) continue;
          // Use the most-recent affected version as the structural clone source.
          const latest = versions.reduce((best, v) =>
            v.version > best.version ? v : best,
          versions[0]);

          const newVersionNumber = tmpl.currentVersion + 1;
          const {
            id: _oldId,
            version: _oldVersion,
            createdAt: _oldCreated,
            templateId: _oldTemplateId,
            ...clonedFields
          } = latest;
          void _oldId; void _oldVersion; void _oldCreated; void _oldTemplateId;

          const [newVersion] = await tx
            .insert(templateVersions)
            .values({
              ...clonedFields,
              templateId,
              version: newVersionNumber,
            })
            .returning();

          // Copy the latest version's junctions (already remapped in step 2).
          const providedRows = await tx
            .select()
            .from(templateVersionInterfacesProvided)
            .where(
              eq(
                templateVersionInterfacesProvided.templateVersionId,
                latest.id,
              ),
            );
          if (providedRows.length > 0) {
            await tx.insert(templateVersionInterfacesProvided).values(
              providedRows.map((r) => ({
                templateVersionId: newVersion.id,
                interfaceTypeId: r.interfaceTypeId,
              })),
            );
          }
          const acceptedRows = await tx
            .select()
            .from(templateVersionInterfacesAccepted)
            .where(
              eq(
                templateVersionInterfacesAccepted.templateVersionId,
                latest.id,
              ),
            );
          if (acceptedRows.length > 0) {
            await tx.insert(templateVersionInterfacesAccepted).values(
              acceptedRows.map((r) => ({
                templateVersionId: newVersion.id,
                interfaceTypeId: r.interfaceTypeId,
              })),
            );
          }

          await tx
            .update(templates)
            .set({ currentVersion: newVersionNumber, updatedAt: new Date() })
            .where(eq(templates.id, templateId));

          versionsMinted += 1;
        }
      }

      // ── 5. Delete source interface_types ──
      await tx.delete(interfaceTypes).where(inArray(interfaceTypes.id, sourceIds));

      return {
        referencesUpdated:
          rewritesProvided + rewritesAccepted + rewritesLocations,
        templateVersionsMinted: versionsMinted,
        sourcesDeleted: sources.length,
      };
    });

    await transactionRepository.log({
      actionType: "interfaceType.merge",
      entityType: "interfaceType",
      entityId: targetId,
      beforeState: {
        sourceIds,
        sources,
      },
      afterState: {
        targetId,
        referencesUpdated: result.referencesUpdated,
        templateVersionsMinted: result.templateVersionsMinted,
        sourcesDeleted: result.sourcesDeleted,
      },
    });

    return result;
  },

  async remove({ id }: { id: string }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    // Delete-gate: must be archived AND unused. Spec intent — hard
    // delete is the destructive endpoint; soft-retire is archive.
    if (!before.archivedAt) {
      throw new Error(
        `InterfaceType ${id} is not archived. Archive before deleting.`,
      );
    }

    const usage = await interfaceTypeRepository.usageCount({ id });
    const total = usage.providers + usage.accepters + usage.receptacles;
    if (total > 0) {
      throw new Error(
        `InterfaceType ${id} is in use (${total} references). Merge or unassign before deleting.`,
      );
    }

    await db.delete(interfaceTypes).where(eq(interfaceTypes.id, id));

    await transactionRepository.log({
      actionType: "interfaceType.delete",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
