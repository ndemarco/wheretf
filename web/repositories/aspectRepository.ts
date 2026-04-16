import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  aspects,
  aspectParameters,
  aspectStandards,
  parameterDefinitions,
  itemAspects,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";
import { type AuditCheck, jaccardTokens } from "@/lib/audit";

export const aspectRepository = {
  async create({
    name,
    description,
  }: {
    name: string;
    description?: string;
  }) {
    const [aspect] = await db
      .insert(aspects)
      .values({ name, description })
      .returning();

    await transactionRepository.log({
      actionType: "aspect.create",
      entityType: "aspect",
      entityId: aspect.id,
      beforeState: null,
      afterState: aspect,
    });

    return aspect;
  },

  async findById({ id }: { id: string }) {
    const [aspect] = await db
      .select()
      .from(aspects)
      .where(eq(aspects.id, id));
    return aspect ?? null;
  },

  async findByName({ name }: { name: string }) {
    const [aspect] = await db
      .select()
      .from(aspects)
      .where(eq(aspects.name, name));
    return aspect ?? null;
  },

  async list() {
    return db.select().from(aspects).orderBy(aspects.name);
  },

  /**
   * Like list() but each row includes usage counts computed via correlated
   * subqueries so the list page can show context per aspect.
   */
  async listWithUsage() {
    const rows = await db
      .select({
        id: aspects.id,
        name: aspects.name,
        description: aspects.description,
        createdAt: aspects.createdAt,
        updatedAt: aspects.updatedAt,
        parameterCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${aspectParameters}
          WHERE ${aspectParameters.aspectId} = ${aspects.id}
        )`.as("parameterCount"),
        itemCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${itemAspects}
          WHERE ${itemAspects.aspectId} = ${aspects.id}
        )`.as("itemCount"),
        standardCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${aspectStandards}
          WHERE ${aspectStandards.aspectId} = ${aspects.id}
        )`.as("standardCount"),
      })
      .from(aspects)
      .orderBy(aspects.name);
    return rows.map((r) => ({
      ...r,
      parameterCount: Number(r.parameterCount ?? 0),
      itemCount: Number(r.itemCount ?? 0),
      standardCount: Number(r.standardCount ?? 0),
    }));
  },

  async getUsage({ aspectId }: { aspectId: string }) {
    const [pc] = await db
      .select({ n: count() })
      .from(aspectParameters)
      .where(eq(aspectParameters.aspectId, aspectId));
    const [ic] = await db
      .select({ n: count() })
      .from(itemAspects)
      .where(eq(itemAspects.aspectId, aspectId));
    const [sc] = await db
      .select({ n: count() })
      .from(aspectStandards)
      .where(eq(aspectStandards.aspectId, aspectId));
    return {
      parameterCount: pc?.n ?? 0,
      itemCount: ic?.n ?? 0,
      standardCount: sc?.n ?? 0,
    };
  },

  /**
   * Taxonomy-level audit of aspects: empty, unused, duplicate or
   * overlapping parameter sets, similar names. Complements
   * parameterDefinitionRepository.audit().
   */
  async audit(): Promise<AuditCheck[]> {
    const withUsage = await aspectRepository.listWithUsage();
    const paramRows = await db
      .select({
        aspectId: aspectParameters.aspectId,
        parameterDefinitionId: aspectParameters.parameterDefinitionId,
      })
      .from(aspectParameters);
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
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    description?: string;
  }) {
    const before = await aspectRepository.findById({ id });
    if (!before) throw new Error(`Aspect ${id} not found`);

    const [updated] = await db
      .update(aspects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aspects.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "aspect.update",
      entityType: "aspect",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await aspectRepository.findById({ id });
    if (!before) throw new Error(`Aspect ${id} not found`);

    await db.delete(aspects).where(eq(aspects.id, id));

    await transactionRepository.log({
      actionType: "aspect.delete",
      entityType: "aspect",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async countItemsUsing({ aspectId }: { aspectId: string }) {
    const [result] = await db
      .select({ count: count() })
      .from(itemAspects)
      .where(eq(itemAspects.aspectId, aspectId));
    return result?.count ?? 0;
  },

  // --- Aspect parameter management ---

  async addParameter({
    aspectId,
    parameterDefinitionId,
    required,
    defaultValue,
    sortOrder,
  }: {
    aspectId: string;
    parameterDefinitionId: string;
    required?: boolean;
    defaultValue?: unknown;
    sortOrder?: number;
  }) {
    const aspect = await aspectRepository.findById({ id: aspectId });
    if (!aspect) throw new Error(`Aspect ${aspectId} not found`);

    const [ap] = await db
      .insert(aspectParameters)
      .values({
        aspectId,
        parameterDefinitionId,
        required: required ?? false,
        defaultValue,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    return ap;
  },

  async removeParameter({
    aspectId,
    parameterDefinitionId,
  }: {
    aspectId: string;
    parameterDefinitionId: string;
  }) {
    const [deleted] = await db
      .delete(aspectParameters)
      .where(
        and(
          eq(aspectParameters.aspectId, aspectId),
          eq(aspectParameters.parameterDefinitionId, parameterDefinitionId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error(
        `Parameter ${parameterDefinitionId} not found on aspect ${aspectId}`
      );
    }
  },

  async getParameters({ aspectId }: { aspectId: string }) {
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
        eq(aspectParameters.parameterDefinitionId, parameterDefinitions.id)
      )
      .where(eq(aspectParameters.aspectId, aspectId))
      .orderBy(aspectParameters.sortOrder);
  },
};
