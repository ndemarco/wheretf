import { eq, and, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  interfaceTypes,
  templates,
  templateVersions,
  templateVersionInterfacesProvided,
  templateVersionInterfacesAccepted,
  locationInterfacesAccepted,
  locations,
} from "@/db/schema";
import { additiveOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";

type Maturity = "draft" | "stable";
type ListStatus = "active" | "archived" | "all";

// interface_types is an additive table. Shared physical contracts
// (e.g. "plano-3600") live as global rows (owner_org_id IS NULL);
// orgs may add private contracts (e.g. a custom 3D-printed receptacle)
// by passing `asGlobal: false` or omitting it on create.
export const interfaceTypeRepository = {
  async create({
    userId,
    orgId,
    asGlobal,
    identifier,
    description,
    physicalContract,
    maturity,
    unitSystem,
  }: {
    userId: string;
    orgId: string;
    asGlobal?: boolean;
    identifier: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
    maturity?: Maturity;
    unitSystem?: Record<string, unknown>;
  }) {
    const ownerOrgId = asGlobal ? null : orgId;
    const [interfaceType] = await db
      .insert(interfaceTypes)
      .values({
        ownerOrgId,
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
      userId,
      orgId,
      actionType: "interfaceType.create",
      entityType: "interfaceType",
      entityId: interfaceType.id,
      beforeState: null,
      afterState: interfaceType,
    });

    return interfaceType;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [interfaceType] = await db
      .select()
      .from(interfaceTypes)
      .where(
        and(
          additiveOrgFilter(interfaceTypes.ownerOrgId, orgId),
          eq(interfaceTypes.id, id),
        ),
      );
    return interfaceType ?? null;
  },

  async findByIdentifier({
    orgId,
    identifier,
  }: {
    orgId: string;
    identifier: string;
  }) {
    const [interfaceType] = await db
      .select()
      .from(interfaceTypes)
      .where(
        and(
          additiveOrgFilter(interfaceTypes.ownerOrgId, orgId),
          eq(interfaceTypes.identifier, identifier),
        ),
      );
    return interfaceType ?? null;
  },

  async list({
    orgId,
    status = "all",
  }: {
    orgId: string;
    status?: ListStatus;
  }) {
    const scope = additiveOrgFilter(interfaceTypes.ownerOrgId, orgId);
    if (status === "active") {
      return db
        .select()
        .from(interfaceTypes)
        .where(and(scope, isNull(interfaceTypes.archivedAt)));
    }
    if (status === "archived") {
      return db
        .select()
        .from(interfaceTypes)
        .where(and(scope, isNotNull(interfaceTypes.archivedAt)));
    }
    return db.select().from(interfaceTypes).where(scope);
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
    identifier?: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
    maturity?: Maturity;
    unitSystem?: Record<string, unknown> | null;
  }) {
    const before = await interfaceTypeRepository.findById({ orgId, id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    // Maturity guard — stable is terminal. Demotion creates ambiguous
    // semantics when refs already point at the type. See spec
    // "Maturity" → state machine one-directional.
    if (updates.maturity === "draft" && before.maturity === "stable") {
      throw new Error(
        "Cannot demote stable → draft. Stable is terminal (one-way state machine).",
      );
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set(updates)
      .where(
        and(
          additiveOrgFilter(interfaceTypes.ownerOrgId, orgId),
          eq(interfaceTypes.id, id),
        ),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "interfaceType.update",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async archive({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await interfaceTypeRepository.findById({ orgId, id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    if (before.archivedAt) {
      return before; // idempotent
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set({ archivedAt: new Date() })
      .where(
        and(
          additiveOrgFilter(interfaceTypes.ownerOrgId, orgId),
          eq(interfaceTypes.id, id),
        ),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "interfaceType.archive",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async unarchive({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await interfaceTypeRepository.findById({ orgId, id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    if (!before.archivedAt) {
      return before; // idempotent
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set({ archivedAt: null })
      .where(
        and(
          additiveOrgFilter(interfaceTypes.ownerOrgId, orgId),
          eq(interfaceTypes.id, id),
        ),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "interfaceType.unarchive",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async usageCount({ orgId, id }: { orgId: string; id: string }) {
    const [providers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(templateVersionInterfacesProvided)
      .where(
        and(
          additiveOrgFilter(
            templateVersionInterfacesProvided.ownerOrgId,
            orgId,
          ),
          eq(templateVersionInterfacesProvided.interfaceTypeId, id),
        ),
      );

    const [accepters] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(templateVersionInterfacesAccepted)
      .where(
        and(
          additiveOrgFilter(
            templateVersionInterfacesAccepted.ownerOrgId,
            orgId,
          ),
          eq(templateVersionInterfacesAccepted.interfaceTypeId, id),
        ),
      );

    const [receptacles] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(locationInterfacesAccepted)
      .where(
        and(
          eq(locationInterfacesAccepted.ownerOrgId, orgId),
          eq(locationInterfacesAccepted.interfaceTypeId, id),
        ),
      );

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
   * end.
   *
   * Scope: only interface_types visible to `orgId` (global ∪ own) and
   * template/location junctions owned by (or global-shared with) the
   * org are affected. Cross-tenant merges are not supported.
   */
  async merge({
    userId,
    orgId,
    sourceIds,
    targetId,
  }: {
    userId: string;
    orgId: string;
    sourceIds: string[];
    targetId: string;
  }) {
    if (!sourceIds || sourceIds.length === 0) {
      throw new Error("Merge requires at least one sourceId.");
    }
    if (sourceIds.includes(targetId)) {
      throw new Error("Merge target cannot also be a source.");
    }

    const target = await interfaceTypeRepository.findById({ orgId, id: targetId });
    if (!target) {
      throw new Error(`Merge target ${targetId} not found.`);
    }

    const scope = additiveOrgFilter(interfaceTypes.ownerOrgId, orgId);
    const sources = await db
      .select()
      .from(interfaceTypes)
      .where(and(scope, inArray(interfaceTypes.id, sourceIds)));
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
          ownerOrgId: templateVersionInterfacesProvided.ownerOrgId,
        })
        .from(templateVersionInterfacesProvided)
        .where(
          and(
            additiveOrgFilter(
              templateVersionInterfacesProvided.ownerOrgId,
              orgId,
            ),
            inArray(
              templateVersionInterfacesProvided.interfaceTypeId,
              sourceIds,
            ),
          ),
        );
      const affectedAccepted = await tx
        .select({
          templateVersionId:
            templateVersionInterfacesAccepted.templateVersionId,
          ownerOrgId: templateVersionInterfacesAccepted.ownerOrgId,
        })
        .from(templateVersionInterfacesAccepted)
        .where(
          and(
            additiveOrgFilter(
              templateVersionInterfacesAccepted.ownerOrgId,
              orgId,
            ),
            inArray(
              templateVersionInterfacesAccepted.interfaceTypeId,
              sourceIds,
            ),
          ),
        );
      const affectedVersionIds = Array.from(
        new Set([
          ...affectedProvided.map((r) => r.templateVersionId),
          ...affectedAccepted.map((r) => r.templateVersionId),
        ]),
      );

      // ── 2. Rewrite template_version junctions: source → target ──
      // Dedupe holders; preserve each holder's ownerOrgId on the new row.
      let rewritesProvided = 0;
      let rewritesAccepted = 0;
      if (affectedProvided.length > 0) {
        const holderOwner = new Map<string, string | null>();
        for (const r of affectedProvided) holderOwner.set(r.templateVersionId, r.ownerOrgId);
        await tx
          .insert(templateVersionInterfacesProvided)
          .values(
            Array.from(holderOwner.entries()).map(([templateVersionId, ownerOrgId]) => ({
              ownerOrgId,
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
        const holderOwner = new Map<string, string | null>();
        for (const r of affectedAccepted) holderOwner.set(r.templateVersionId, r.ownerOrgId);
        await tx
          .insert(templateVersionInterfacesAccepted)
          .values(
            Array.from(holderOwner.entries()).map(([templateVersionId, ownerOrgId]) => ({
              ownerOrgId,
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
      // location_interfaces_accepted is isolated; only this org's rows.
      const affectedLocations = await tx
        .select({
          locationId: locationInterfacesAccepted.locationId,
          ownerOrgId: locationInterfacesAccepted.ownerOrgId,
        })
        .from(locationInterfacesAccepted)
        .where(
          and(
            eq(locationInterfacesAccepted.ownerOrgId, orgId),
            inArray(locationInterfacesAccepted.interfaceTypeId, sourceIds),
          ),
        );
      let rewritesLocations = 0;
      if (affectedLocations.length > 0) {
        // location_interfaces_accepted is isolated + NOT NULL, so ownerOrgId
        // for every affected row equals orgId (we filtered on that above).
        const uniqueLocationIds = Array.from(
          new Set(affectedLocations.map((r) => r.locationId)),
        );
        await tx
          .insert(locationInterfacesAccepted)
          .values(
            uniqueLocationIds.map((locationId) => ({
              ownerOrgId: orgId,
              locationId,
              interfaceTypeId: targetId,
            })),
          )
          .onConflictDoNothing();
        const deleted = await tx
          .delete(locationInterfacesAccepted)
          .where(
            and(
              eq(locationInterfacesAccepted.ownerOrgId, orgId),
              inArray(locationInterfacesAccepted.interfaceTypeId, sourceIds),
            ),
          )
          .returning();
        rewritesLocations = deleted.length;
      }

      // ── 4. Mint a new template version for each affected template ──
      let versionsMinted = 0;
      if (affectedVersionIds.length > 0) {
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
          const latest = versions.reduce(
            (best, v) => (v.version > best.version ? v : best),
            versions[0],
          );

          const newVersionNumber = tmpl.currentVersion + 1;
          const {
            id: _oldId,
            version: _oldVersion,
            createdAt: _oldCreated,
            templateId: _oldTemplateId,
            ...clonedFields
          } = latest;
          void _oldId;
          void _oldVersion;
          void _oldCreated;
          void _oldTemplateId;

          const [newVersion] = await tx
            .insert(templateVersions)
            .values({
              ...clonedFields,
              ownerOrgId: tmpl.ownerOrgId,
              templateId,
              version: newVersionNumber,
            })
            .returning();

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
                ownerOrgId: r.ownerOrgId,
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
                ownerOrgId: r.ownerOrgId,
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

      // ── 5. Delete source interface_types (scope-filtered) ──
      await tx
        .delete(interfaceTypes)
        .where(
          and(
            additiveOrgFilter(interfaceTypes.ownerOrgId, orgId),
            inArray(interfaceTypes.id, sourceIds),
          ),
        );

      return {
        referencesUpdated:
          rewritesProvided + rewritesAccepted + rewritesLocations,
        templateVersionsMinted: versionsMinted,
        sourcesDeleted: sources.length,
      };
    });

    await transactionRepository.log({
      userId,
      orgId,
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

  async remove({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await interfaceTypeRepository.findById({ orgId, id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    // Delete-gate: must be archived AND unused. Spec intent — hard
    // delete is the destructive endpoint; soft-retire is archive.
    if (!before.archivedAt) {
      throw new Error(
        `InterfaceType ${id} is not archived. Archive before deleting.`,
      );
    }

    const usage = await interfaceTypeRepository.usageCount({ orgId, id });
    const total = usage.providers + usage.accepters + usage.receptacles;
    if (total > 0) {
      throw new Error(
        `InterfaceType ${id} is in use (${total} references). Merge or unassign before deleting.`,
      );
    }

    await db
      .delete(interfaceTypes)
      .where(
        and(
          additiveOrgFilter(interfaceTypes.ownerOrgId, orgId),
          eq(interfaceTypes.id, id),
        ),
      );

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "interfaceType.delete",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
