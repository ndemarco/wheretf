import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  parameterDefinitions,
  aspectParameters,
  itemParameterValues,
  standardParameters,
  aspects,
  items,
  standards,
} from "@/db/schema";
import { additiveOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";
import {
  type AuditCheck,
  dedupe,
  jaccardTokens,
} from "@/lib/audit";

type DataType = "numeric" | "text" | "boolean" | "enum";

interface Constraints {
  enumValues?: string[];
  min?: number;
  max?: number;
}

// parameter_definitions is additive. NULL = global taxonomy; set = org-private.
export const parameterDefinitionRepository = {
  async create({
    userId,
    orgId,
    asGlobal,
    name,
    dataType,
    unit,
    description,
    searchTerms,
    defaultValue,
    constraints,
  }: {
    userId: string;
    orgId: string;
    asGlobal?: boolean;
    name: string;
    dataType: DataType;
    unit?: string;
    description?: string | null;
    searchTerms?: string[] | null;
    defaultValue?: unknown;
    constraints?: Constraints;
  }) {
    if (dataType === "enum") {
      if (!constraints?.enumValues?.length) {
        throw new Error("Enum parameters require enumValues in constraints");
      }
    }

    const ownerOrgId = asGlobal ? null : orgId;
    const [paramDef] = await db
      .insert(parameterDefinitions)
      .values({
        ownerOrgId,
        name,
        dataType,
        unit,
        description: description ?? null,
        searchTerms: searchTerms ?? null,
        defaultValue,
        constraints,
      })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "parameterDefinition.create",
      entityType: "parameterDefinition",
      entityId: paramDef.id,
      beforeState: null,
      afterState: paramDef,
    });

    return paramDef;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [paramDef] = await db
      .select()
      .from(parameterDefinitions)
      .where(
        and(
          additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
          eq(parameterDefinitions.id, id),
        ),
      );
    return paramDef ?? null;
  },

  async findByName({ orgId, name }: { orgId: string; name: string }) {
    const [paramDef] = await db
      .select()
      .from(parameterDefinitions)
      .where(
        and(
          additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
          eq(parameterDefinitions.name, name),
        ),
      );
    return paramDef ?? null;
  },

  async list({ orgId }: { orgId: string }) {
    return db
      .select()
      .from(parameterDefinitions)
      .where(additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId))
      .orderBy(parameterDefinitions.name);
  },

  async listWithUsage({ orgId }: { orgId: string }) {
    const rows = await db
      .select({
        id: parameterDefinitions.id,
        ownerOrgId: parameterDefinitions.ownerOrgId,
        name: parameterDefinitions.name,
        dataType: parameterDefinitions.dataType,
        unit: parameterDefinitions.unit,
        description: parameterDefinitions.description,
        searchTerms: parameterDefinitions.searchTerms,
        defaultValue: parameterDefinitions.defaultValue,
        constraints: parameterDefinitions.constraints,
        createdAt: parameterDefinitions.createdAt,
        updatedAt: parameterDefinitions.updatedAt,
        aspectCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${aspectParameters}
          WHERE ${aspectParameters.parameterDefinitionId} = ${parameterDefinitions.id}
            AND (${aspectParameters.ownerOrgId} IS NULL OR ${aspectParameters.ownerOrgId} = ${orgId})
        )`.as("aspectCount"),
        itemCount: sql<number>`(
          SELECT COUNT(DISTINCT ${itemParameterValues.itemId})::int
          FROM ${itemParameterValues}
          WHERE ${itemParameterValues.parameterDefinitionId} = ${parameterDefinitions.id}
            AND (${itemParameterValues.ownerOrgId} IS NULL OR ${itemParameterValues.ownerOrgId} = ${orgId})
        )`.as("itemCount"),
        standardCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${standardParameters}
          WHERE ${standardParameters.parameterDefinitionId} = ${parameterDefinitions.id}
            AND (${standardParameters.ownerOrgId} IS NULL OR ${standardParameters.ownerOrgId} = ${orgId})
        )`.as("standardCount"),
      })
      .from(parameterDefinitions)
      .where(additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId))
      .orderBy(parameterDefinitions.name);
    return rows.map((r) => ({
      ...r,
      aspectCount: Number(r.aspectCount ?? 0),
      itemCount: Number(r.itemCount ?? 0),
      standardCount: Number(r.standardCount ?? 0),
    }));
  },

  /**
   * Where-used drilldown for a single parameter definition.
   * Returns the aspects that include it, the items that have a stored
   * value, and the standards that reference it.
   */
  async getUsage({
    orgId,
    parameterDefinitionId,
  }: {
    orgId: string;
    parameterDefinitionId: string;
  }) {
    const aspectRows = await db
      .select({ id: aspects.id, name: aspects.name })
      .from(aspectParameters)
      .innerJoin(aspects, eq(aspectParameters.aspectId, aspects.id))
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          additiveOrgFilter(aspects.ownerOrgId, orgId),
          eq(aspectParameters.parameterDefinitionId, parameterDefinitionId),
        ),
      )
      .orderBy(aspects.name);

    const itemRows = await db
      .selectDistinctOn([items.id], { id: items.id, name: items.name })
      .from(itemParameterValues)
      .innerJoin(items, eq(itemParameterValues.itemId, items.id))
      .where(
        and(
          additiveOrgFilter(itemParameterValues.ownerOrgId, orgId),
          additiveOrgFilter(items.ownerOrgId, orgId),
          eq(itemParameterValues.parameterDefinitionId, parameterDefinitionId),
        ),
      )
      .orderBy(items.id, items.name);

    const standardRows = await db
      .select({ id: standards.id, name: standards.name })
      .from(standardParameters)
      .innerJoin(standards, eq(standardParameters.standardId, standards.id))
      .where(
        and(
          additiveOrgFilter(standardParameters.ownerOrgId, orgId),
          additiveOrgFilter(standards.ownerOrgId, orgId),
          eq(standardParameters.parameterDefinitionId, parameterDefinitionId),
        ),
      )
      .orderBy(standards.name);

    return {
      aspects: aspectRows,
      items: itemRows,
      standards: standardRows,
    };
  },

  async audit({ orgId }: { orgId: string }): Promise<AuditCheck[]> {
    const defs = await parameterDefinitionRepository.listWithUsage({ orgId });
    const out: AuditCheck[] = [];

    const noDesc = defs.filter((d) => !d.description || !d.description.trim());
    if (noDesc.length > 0) {
      out.push({
        check: "param.no_description",
        severity: "info",
        subjects: noDesc.map((d) => ({ id: d.id, name: d.name })),
        suggestion: "Add a one-line description so humans know what each parameter means.",
      });
    }

    const numericNoUnit = defs.filter(
      (d) => d.dataType === "numeric" && !d.unit,
    );
    if (numericNoUnit.length > 0) {
      out.push({
        check: "param.numeric_no_unit",
        severity: "error",
        subjects: numericNoUnit.map((d) => ({ id: d.id, name: d.name })),
        suggestion: "Numeric parameters should declare a unit (ohm, mm, V, …).",
      });
    }

    const enumNoValues = defs.filter((d) => {
      if (d.dataType !== "enum") return false;
      const c = d.constraints as { enumValues?: string[] } | null;
      return !c?.enumValues?.length;
    });
    if (enumNoValues.length > 0) {
      out.push({
        check: "param.enum_no_values",
        severity: "error",
        subjects: enumNoValues.map((d) => ({ id: d.id, name: d.name })),
        suggestion: "Enum parameters must list their allowed values.",
      });
    }

    const orphans = defs.filter((d) => (d.aspectCount ?? 0) === 0);
    if (orphans.length > 0) {
      out.push({
        check: "param.orphan",
        severity: "warning",
        subjects: orphans.map((d) => ({ id: d.id, name: d.name })),
        suggestion: "Attach to an aspect or delete.",
      });
    }

    const byName = new Map(defs.map((d) => [d.name.toLowerCase(), d]));
    const collisions: Array<{ id: string; name: string }> = [];
    for (const d of defs) {
      for (const term of d.searchTerms ?? []) {
        const match = byName.get(term.toLowerCase());
        if (match && match.id !== d.id) {
          collisions.push({ id: match.id, name: match.name });
        }
      }
    }
    if (collisions.length > 0) {
      out.push({
        check: "param.name_collision_with_searchterm",
        severity: "warning",
        subjects: dedupe(collisions),
        suggestion: "Another parameter lists this one's name as a search term — likely the same thing.",
      });
    }

    const normalized = new Map<string, Array<{ id: string; name: string }>>();
    for (const d of defs) {
      const key = d.name.toLowerCase().replace(/[_\s-]+/g, "");
      const bucket = normalized.get(key) ?? [];
      bucket.push({ id: d.id, name: d.name });
      normalized.set(key, bucket);
    }
    const dupSeparators: Array<{ id: string; name: string }> = [];
    for (const bucket of normalized.values()) {
      if (bucket.length > 1) dupSeparators.push(...bucket);
    }
    if (dupSeparators.length > 0) {
      out.push({
        check: "param.duplicate_name_ignoring_separators",
        severity: "warning",
        subjects: dupSeparators,
        suggestion: "These names collapse to the same slug once separators are removed — likely duplicates.",
      });
    }

    const nearDup: Array<{ id: string; name: string }> = [];
    for (let i = 0; i < defs.length; i++) {
      for (let j = i + 1; j < defs.length; j++) {
        const a = defs[i];
        const b = defs[j];
        if (a.dataType !== b.dataType) continue;
        if ((a.unit ?? "") !== (b.unit ?? "")) continue;
        if (jaccardTokens(a.name, b.name) >= 0.6) {
          nearDup.push({ id: a.id, name: a.name });
          nearDup.push({ id: b.id, name: b.name });
        }
      }
    }
    if (nearDup.length > 0) {
      out.push({
        check: "param.near_duplicate",
        severity: "warning",
        subjects: dedupe(nearDup),
        suggestion: "Same dataType + unit, similar names — candidates for merge.",
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
    dataType?: DataType;
    unit?: string;
    description?: string | null;
    searchTerms?: string[] | null;
    defaultValue?: unknown;
    constraints?: Constraints;
  }) {
    const before = await parameterDefinitionRepository.findById({ orgId, id });
    if (!before) throw new Error(`ParameterDefinition ${id} not found`);

    const effectiveDataType = updates.dataType ?? before.dataType;
    const effectiveConstraints = (updates.constraints ?? before.constraints) as Constraints | null;

    if (effectiveDataType === "enum") {
      if (!effectiveConstraints?.enumValues?.length) {
        throw new Error("Enum parameters require enumValues in constraints");
      }
    }

    const [updated] = await db
      .update(parameterDefinitions)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
          eq(parameterDefinitions.id, id),
        ),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "parameterDefinition.update",
      entityType: "parameterDefinition",
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
    const before = await parameterDefinitionRepository.findById({ orgId, id });
    if (!before) throw new Error(`ParameterDefinition ${id} not found`);

    await db
      .delete(parameterDefinitions)
      .where(
        and(
          additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
          eq(parameterDefinitions.id, id),
        ),
      );

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "parameterDefinition.delete",
      entityType: "parameterDefinition",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
