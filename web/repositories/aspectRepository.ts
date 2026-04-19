import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  aspects,
  aspectParameters,
  aspectStandards,
  parameterDefinitions,
  itemAspects,
  items,
} from "@/db/schema";
import { additiveOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";
import { type AuditCheck, jaccardTokens } from "@/lib/audit";

// aspects + related junctions are additive. NULL = global taxonomy;
// set = org-private. Junction inserts inherit ownerOrgId from the
// parent aspect.
export const aspectRepository = {
  async create({
    userId,
    orgId,
    asGlobal,
    name,
    description,
  }: {
    userId: string;
    orgId: string;
    asGlobal?: boolean;
    name: string;
    description?: string;
  }) {
    const ownerOrgId = asGlobal ? null : orgId;
    const [aspect] = await db
      .insert(aspects)
      .values({ ownerOrgId, name, description })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "aspect.create",
      entityType: "aspect",
      entityId: aspect.id,
      beforeState: null,
      afterState: aspect,
    });

    return aspect;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [aspect] = await db
      .select()
      .from(aspects)
      .where(and(additiveOrgFilter(aspects.ownerOrgId, orgId), eq(aspects.id, id)));
    return aspect ?? null;
  },

  async findByName({ orgId, name }: { orgId: string; name: string }) {
    const [aspect] = await db
      .select()
      .from(aspects)
      .where(and(additiveOrgFilter(aspects.ownerOrgId, orgId), eq(aspects.name, name)));
    return aspect ?? null;
  },

  async list({ orgId }: { orgId: string }) {
    return db
      .select()
      .from(aspects)
      .where(additiveOrgFilter(aspects.ownerOrgId, orgId))
      .orderBy(aspects.name);
  },

  async listWithUsage({ orgId }: { orgId: string }) {
    const rows = await db
      .select({
        id: aspects.id,
        ownerOrgId: aspects.ownerOrgId,
        name: aspects.name,
        description: aspects.description,
        createdAt: aspects.createdAt,
        updatedAt: aspects.updatedAt,
        parameterCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${aspectParameters}
          WHERE ${aspectParameters.aspectId} = ${aspects.id}
            AND (${aspectParameters.ownerOrgId} IS NULL OR ${aspectParameters.ownerOrgId} = ${orgId})
        )`.as("parameterCount"),
        itemCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${itemAspects}
          WHERE ${itemAspects.aspectId} = ${aspects.id}
            AND (${itemAspects.ownerOrgId} IS NULL OR ${itemAspects.ownerOrgId} = ${orgId})
        )`.as("itemCount"),
        standardCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${aspectStandards}
          WHERE ${aspectStandards.aspectId} = ${aspects.id}
            AND (${aspectStandards.ownerOrgId} IS NULL OR ${aspectStandards.ownerOrgId} = ${orgId})
        )`.as("standardCount"),
      })
      .from(aspects)
      .where(additiveOrgFilter(aspects.ownerOrgId, orgId))
      .orderBy(aspects.name);
    return rows.map((r) => ({
      ...r,
      parameterCount: Number(r.parameterCount ?? 0),
      itemCount: Number(r.itemCount ?? 0),
      standardCount: Number(r.standardCount ?? 0),
    }));
  },

  async listItemsUsing({
    orgId,
    aspectId,
    limit = 50,
  }: {
    orgId: string;
    aspectId: string;
    limit?: number;
  }) {
    const rows = await db
      .select({
        itemId: items.id,
        itemName: items.name,
        appliedAt: itemAspects.createdAt,
      })
      .from(itemAspects)
      .innerJoin(items, eq(itemAspects.itemId, items.id))
      .where(
        and(
          additiveOrgFilter(itemAspects.ownerOrgId, orgId),
          additiveOrgFilter(items.ownerOrgId, orgId),
          eq(itemAspects.aspectId, aspectId),
        ),
      )
      .orderBy(sql`${itemAspects.createdAt} DESC`)
      .limit(limit);
    return rows;
  },

  async getUsage({ orgId, aspectId }: { orgId: string; aspectId: string }) {
    const [pc] = await db
      .select({ n: count() })
      .from(aspectParameters)
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          eq(aspectParameters.aspectId, aspectId),
        ),
      );
    const [ic] = await db
      .select({ n: count() })
      .from(itemAspects)
      .where(
        and(
          additiveOrgFilter(itemAspects.ownerOrgId, orgId),
          eq(itemAspects.aspectId, aspectId),
        ),
      );
    const [sc] = await db
      .select({ n: count() })
      .from(aspectStandards)
      .where(
        and(
          additiveOrgFilter(aspectStandards.ownerOrgId, orgId),
          eq(aspectStandards.aspectId, aspectId),
        ),
      );
    return {
      parameterCount: pc?.n ?? 0,
      itemCount: ic?.n ?? 0,
      standardCount: sc?.n ?? 0,
    };
  },

  async suggestCoOccurringParameters({
    orgId,
    aspectId,
    limit = 5,
  }: {
    orgId: string;
    aspectId: string;
    limit?: number;
  }) {
    const attachedRows = await db
      .select({ id: aspectParameters.parameterDefinitionId })
      .from(aspectParameters)
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          eq(aspectParameters.aspectId, aspectId),
        ),
      );
    const attached = new Set(attachedRows.map((r) => r.id));
    if (attached.size === 0) return [];

    const sharingRows = await db
      .selectDistinctOn([aspectParameters.aspectId], {
        aspectId: aspectParameters.aspectId,
      })
      .from(aspectParameters)
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          sql`${aspectParameters.parameterDefinitionId} IN (${sql.join(Array.from(attached).map((id) => sql`${id}`), sql`, `)})`,
        ),
      );
    const sharingAspectIds = sharingRows
      .map((r) => r.aspectId)
      .filter((id) => id !== aspectId);
    if (sharingAspectIds.length === 0) return [];

    const candidateRows = await db
      .select({
        aspectId: aspectParameters.aspectId,
        aspectName: aspects.name,
        parameterDefinitionId: aspectParameters.parameterDefinitionId,
        parameterName: parameterDefinitions.name,
        dataType: parameterDefinitions.dataType,
        unit: parameterDefinitions.unit,
      })
      .from(aspectParameters)
      .innerJoin(aspects, eq(aspects.id, aspectParameters.aspectId))
      .innerJoin(
        parameterDefinitions,
        eq(parameterDefinitions.id, aspectParameters.parameterDefinitionId),
      )
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          additiveOrgFilter(aspects.ownerOrgId, orgId),
          additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
          sql`${aspectParameters.aspectId} IN (${sql.join(sharingAspectIds.map((id) => sql`${id}`), sql`, `)})`,
        ),
      );

    const tally = new Map<
      string,
      {
        parameterDefinitionId: string;
        name: string;
        dataType: string;
        unit: string | null;
        frequency: number;
        sourceAspects: Set<string>;
      }
    >();
    for (const r of candidateRows) {
      if (attached.has(r.parameterDefinitionId)) continue;
      const existing = tally.get(r.parameterDefinitionId);
      if (existing) {
        existing.frequency += 1;
        existing.sourceAspects.add(r.aspectName);
      } else {
        tally.set(r.parameterDefinitionId, {
          parameterDefinitionId: r.parameterDefinitionId,
          name: r.parameterName,
          dataType: r.dataType,
          unit: r.unit,
          frequency: 1,
          sourceAspects: new Set([r.aspectName]),
        });
      }
    }

    return Array.from(tally.values())
      .map((t) => ({
        parameterDefinitionId: t.parameterDefinitionId,
        name: t.name,
        dataType: t.dataType,
        unit: t.unit,
        frequency: t.frequency,
        sourceAspects: Array.from(t.sourceAspects),
      }))
      .sort((a, b) => b.frequency - a.frequency || a.name.localeCompare(b.name))
      .slice(0, limit);
  },

  async audit({ orgId }: { orgId: string }): Promise<AuditCheck[]> {
    const withUsage = await aspectRepository.listWithUsage({ orgId });
    const paramRows = await db
      .select({
        aspectId: aspectParameters.aspectId,
        parameterDefinitionId: aspectParameters.parameterDefinitionId,
      })
      .from(aspectParameters)
      .where(additiveOrgFilter(aspectParameters.ownerOrgId, orgId));
    const paramsByAspect = new Map<string, Set<string>>();
    for (const r of paramRows) {
      const bag = paramsByAspect.get(r.aspectId) ?? new Set<string>();
      bag.add(r.parameterDefinitionId);
      paramsByAspect.set(r.aspectId, bag);
    }

    const out: AuditCheck[] = [];

    const empty = withUsage.filter((a) => (a.parameterCount ?? 0) === 0);
    if (empty.length > 0) {
      out.push({
        check: "aspect.empty",
        severity: "warning",
        subjects: empty.map((a) => ({ id: a.id, name: a.name })),
        suggestion: "Attach parameters or delete.",
      });
    }

    const unused = withUsage.filter((a) => (a.itemCount ?? 0) === 0);
    if (unused.length > 0) {
      out.push({
        check: "aspect.no_items",
        severity: "info",
        subjects: unused.map((a) => ({ id: a.id, name: a.name })),
        suggestion: "Aspect has never been applied to an item yet.",
      });
    }

    const dupSet: Array<{ id: string; name: string }> = [];
    const subsetOverlap: Array<{ id: string; name: string }> = [];
    for (let i = 0; i < withUsage.length; i++) {
      for (let j = i + 1; j < withUsage.length; j++) {
        const a = withUsage[i];
        const b = withUsage[j];
        const pa = paramsByAspect.get(a.id) ?? new Set<string>();
        const pb = paramsByAspect.get(b.id) ?? new Set<string>();
        if (pa.size === 0 || pb.size === 0) continue;
        if (pa.size === pb.size) {
          let same = true;
          for (const x of pa) {
            if (!pb.has(x)) {
              same = false;
              break;
            }
          }
          if (same) {
            dupSet.push({ id: a.id, name: a.name });
            dupSet.push({ id: b.id, name: b.name });
            continue;
          }
        }
        const [smaller, bigger] = pa.size < pb.size ? [pa, pb] : [pb, pa];
        let subset = true;
        for (const x of smaller) {
          if (!bigger.has(x)) {
            subset = false;
            break;
          }
        }
        if (subset) {
          subsetOverlap.push({ id: a.id, name: a.name });
          subsetOverlap.push({ id: b.id, name: b.name });
        }
      }
    }
    if (dupSet.length > 0) {
      out.push({
        check: "aspect.duplicate_param_set",
        severity: "warning",
        subjects: dupSet,
        suggestion:
          "These aspects have identical parameter sets. Strong merge candidate.",
      });
    }
    if (subsetOverlap.length > 0) {
      out.push({
        check: "aspect.subset_overlap",
        severity: "info",
        subjects: subsetOverlap,
        suggestion:
          "One aspect's parameters are a proper subset of another's — possibly a fragment.",
      });
    }

    const similar: Array<{ id: string; name: string }> = [];
    for (let i = 0; i < withUsage.length; i++) {
      for (let j = i + 1; j < withUsage.length; j++) {
        if (jaccardTokens(withUsage[i].name, withUsage[j].name) >= 0.6) {
          similar.push({ id: withUsage[i].id, name: withUsage[i].name });
          similar.push({ id: withUsage[j].id, name: withUsage[j].name });
        }
      }
    }
    if (similar.length > 0) {
      out.push({
        check: "aspect.name_similarity",
        severity: "info",
        subjects: similar,
        suggestion: "Names share tokens — might describe the same facet.",
      });
    }

    return out;
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
  }) {
    const before = await aspectRepository.findById({ orgId, id });
    if (!before) throw new Error(`Aspect ${id} not found`);

    const [updated] = await db
      .update(aspects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(additiveOrgFilter(aspects.ownerOrgId, orgId), eq(aspects.id, id)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "aspect.update",
      entityType: "aspect",
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
    const before = await aspectRepository.findById({ orgId, id });
    if (!before) throw new Error(`Aspect ${id} not found`);

    await db
      .delete(aspects)
      .where(and(additiveOrgFilter(aspects.ownerOrgId, orgId), eq(aspects.id, id)));

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "aspect.delete",
      entityType: "aspect",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async countItemsUsing({
    orgId,
    aspectId,
  }: {
    orgId: string;
    aspectId: string;
  }) {
    const [result] = await db
      .select({ count: count() })
      .from(itemAspects)
      .where(
        and(
          additiveOrgFilter(itemAspects.ownerOrgId, orgId),
          eq(itemAspects.aspectId, aspectId),
        ),
      );
    return result?.count ?? 0;
  },

  // --- Aspect parameter management ---

  async addParameter({
    userId,
    orgId,
    aspectId,
    parameterDefinitionId,
    required,
    defaultValue,
    sortOrder,
  }: {
    userId: string;
    orgId: string;
    aspectId: string;
    parameterDefinitionId: string;
    required?: boolean;
    defaultValue?: unknown;
    sortOrder?: number;
  }) {
    const aspect = await aspectRepository.findById({ orgId, id: aspectId });
    if (!aspect) throw new Error(`Aspect ${aspectId} not found`);

    const [ap] = await db
      .insert(aspectParameters)
      .values({
        ownerOrgId: aspect.ownerOrgId,
        aspectId,
        parameterDefinitionId,
        required: required ?? false,
        defaultValue,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    void userId;
    return ap;
  },

  async removeParameter({
    orgId,
    aspectId,
    parameterDefinitionId,
  }: {
    orgId: string;
    aspectId: string;
    parameterDefinitionId: string;
  }) {
    const [deleted] = await db
      .delete(aspectParameters)
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          eq(aspectParameters.aspectId, aspectId),
          eq(aspectParameters.parameterDefinitionId, parameterDefinitionId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new Error(
        `Parameter ${parameterDefinitionId} not found on aspect ${aspectId}`,
      );
    }
  },

  async getParameters({
    orgId,
    aspectId,
  }: {
    orgId: string;
    aspectId: string;
  }) {
    return db
      .select({
        id: aspectParameters.id,
        parameterDefinitionId: aspectParameters.parameterDefinitionId,
        required: aspectParameters.required,
        defaultValue: aspectParameters.defaultValue,
        sortOrder: aspectParameters.sortOrder,
        parameterName: parameterDefinitions.name,
        dataType: parameterDefinitions.dataType,
        unit: parameterDefinitions.unit,
        parameterDefaultValue: parameterDefinitions.defaultValue,
        constraints: parameterDefinitions.constraints,
      })
      .from(aspectParameters)
      .innerJoin(
        parameterDefinitions,
        eq(aspectParameters.parameterDefinitionId, parameterDefinitions.id),
      )
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
          eq(aspectParameters.aspectId, aspectId),
        ),
      )
      .orderBy(aspectParameters.sortOrder);
  },
};
