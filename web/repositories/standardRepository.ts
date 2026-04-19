import { eq, and, count, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  standards,
  aspectStandards,
  standardParameters,
  standardDesignations,
  itemStandards,
  itemParameterValues,
  items,
  parameterDefinitions,
  aspects,
  aspectParameters,
} from "@/db/schema";
import { additiveOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";

// standards + related junctions are additive. NULL = global taxonomy;
// set = org-private. Junction inserts inherit ownerOrgId from the
// parent standard (or provided orgId if no parent lookup).
export const standardRepository = {
  // --- Standard CRUD ---

  async create({
    userId,
    orgId,
    asGlobal,
    name,
    description,
    domainTag,
  }: {
    userId: string;
    orgId: string;
    asGlobal?: boolean;
    name: string;
    description?: string;
    domainTag?: string;
  }) {
    const ownerOrgId = asGlobal ? null : orgId;
    const [standard] = await db
      .insert(standards)
      .values({ ownerOrgId, name, description, domainTag })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "standard.create",
      entityType: "standard",
      entityId: standard.id,
      beforeState: null,
      afterState: standard,
    });

    return standard;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [standard] = await db
      .select()
      .from(standards)
      .where(and(additiveOrgFilter(standards.ownerOrgId, orgId), eq(standards.id, id)));
    return standard ?? null;
  },

  async findByName({ orgId, name }: { orgId: string; name: string }) {
    const [standard] = await db
      .select()
      .from(standards)
      .where(and(additiveOrgFilter(standards.ownerOrgId, orgId), eq(standards.name, name)));
    return standard ?? null;
  },

  async list({ orgId }: { orgId: string }) {
    return db
      .select({
        id: standards.id,
        ownerOrgId: standards.ownerOrgId,
        name: standards.name,
        description: standards.description,
        domainTag: standards.domainTag,
        createdAt: standards.createdAt,
        updatedAt: standards.updatedAt,
        aspectCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_standards
          WHERE aspect_standards.standard_id = standards.id
            AND (aspect_standards.owner_org_id IS NULL OR aspect_standards.owner_org_id = ${orgId})
        )`.as("aspect_count"),
      })
      .from(standards)
      .where(additiveOrgFilter(standards.ownerOrgId, orgId))
      .orderBy(standards.name);
  },

  async listByAspect({
    orgId,
    aspectId,
  }: {
    orgId: string;
    aspectId: string;
  }) {
    return db
      .select({
        id: standards.id,
        name: standards.name,
        description: standards.description,
        domainTag: standards.domainTag,
        createdAt: standards.createdAt,
        updatedAt: standards.updatedAt,
      })
      .from(standards)
      .innerJoin(aspectStandards, eq(aspectStandards.standardId, standards.id))
      .where(
        and(
          additiveOrgFilter(standards.ownerOrgId, orgId),
          additiveOrgFilter(aspectStandards.ownerOrgId, orgId),
          eq(aspectStandards.aspectId, aspectId),
        ),
      )
      .orderBy(standards.name);
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
    domainTag?: string;
  }) {
    const before = await standardRepository.findById({ orgId, id });
    if (!before) throw new Error(`Standard ${id} not found`);

    const [updated] = await db
      .update(standards)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(additiveOrgFilter(standards.ownerOrgId, orgId), eq(standards.id, id)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "standard.update",
      entityType: "standard",
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
    const before = await standardRepository.findById({ orgId, id });
    if (!before) throw new Error(`Standard ${id} not found`);

    await db
      .delete(standards)
      .where(and(additiveOrgFilter(standards.ownerOrgId, orgId), eq(standards.id, id)));

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "standard.delete",
      entityType: "standard",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async countItemsUsing({
    orgId,
    standardId,
  }: {
    orgId: string;
    standardId: string;
  }) {
    const [result] = await db
      .select({ count: count() })
      .from(itemStandards)
      .where(
        and(
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          eq(itemStandards.standardId, standardId),
        ),
      );
    return result?.count ?? 0;
  },

  async listItemsUsing({
    orgId,
    standardId,
    limit = 50,
  }: {
    orgId: string;
    standardId: string;
    limit?: number;
  }) {
    const rows = await db
      .select({
        itemStandardId: itemStandards.id,
        itemId: itemStandards.itemId,
        itemName: items.name,
        designation: standardDesignations.designation,
        isCustom: itemStandards.isCustom,
        createdAt: itemStandards.createdAt,
      })
      .from(itemStandards)
      .innerJoin(items, eq(items.id, itemStandards.itemId))
      .leftJoin(
        standardDesignations,
        eq(itemStandards.designationId, standardDesignations.id),
      )
      .where(
        and(
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          additiveOrgFilter(items.ownerOrgId, orgId),
          eq(itemStandards.standardId, standardId),
        ),
      )
      .orderBy(sql`${itemStandards.createdAt} DESC`)
      .limit(limit);
    return rows;
  },

  async designationUsage({
    orgId,
    standardId,
  }: {
    orgId: string;
    standardId: string;
  }) {
    const rows = await db
      .select({
        designationId: itemStandards.designationId,
        designation: standardDesignations.designation,
        itemCount: count(itemStandards.id),
      })
      .from(itemStandards)
      .leftJoin(
        standardDesignations,
        eq(itemStandards.designationId, standardDesignations.id),
      )
      .where(
        and(
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          eq(itemStandards.standardId, standardId),
        ),
      )
      .groupBy(itemStandards.designationId, standardDesignations.designation)
      .orderBy(sql`count(${itemStandards.id}) DESC`);
    return rows;
  },

  // --- Aspect-standard associations ---

  async addAspect({
    userId,
    orgId,
    standardId,
    aspectId,
  }: {
    userId: string;
    orgId: string;
    standardId: string;
    aspectId: string;
  }) {
    const parent = await standardRepository.findById({ orgId, id: standardId });
    if (!parent) throw new Error(`Standard ${standardId} not found`);

    const [as_] = await db
      .insert(aspectStandards)
      .values({ ownerOrgId: parent.ownerOrgId, standardId, aspectId })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "aspect_standard.create",
      entityType: "aspect_standard",
      entityId: as_.id,
      beforeState: null,
      afterState: as_,
    });

    return as_;
  },

  async removeAspect({
    userId,
    orgId,
    standardId,
    aspectId,
  }: {
    userId: string;
    orgId: string;
    standardId: string;
    aspectId: string;
  }) {
    const [deleted] = await db
      .delete(aspectStandards)
      .where(
        and(
          additiveOrgFilter(aspectStandards.ownerOrgId, orgId),
          eq(aspectStandards.standardId, standardId),
          eq(aspectStandards.aspectId, aspectId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new Error(
        `Standard ${standardId} not linked to aspect ${aspectId}`,
      );
    }

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "aspect_standard.delete",
      entityType: "aspect_standard",
      entityId: deleted.id,
      beforeState: deleted,
      afterState: null,
    });
  },

  async listAspectsForStandard({
    orgId,
    standardId,
  }: {
    orgId: string;
    standardId: string;
  }) {
    return db
      .select({
        aspectId: aspects.id,
        aspectName: aspects.name,
        parameterCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          WHERE aspect_parameters.aspect_id = ${aspects.id}
            AND (aspect_parameters.owner_org_id IS NULL OR aspect_parameters.owner_org_id = ${orgId})
        )`.as("parameter_count"),
        coveredCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          INNER JOIN standard_parameters
            ON aspect_parameters.parameter_definition_id
               = standard_parameters.parameter_definition_id
          WHERE aspect_parameters.aspect_id = ${aspects.id}
            AND standard_parameters.standard_id = ${standardId}
            AND (aspect_parameters.owner_org_id IS NULL OR aspect_parameters.owner_org_id = ${orgId})
            AND (standard_parameters.owner_org_id IS NULL OR standard_parameters.owner_org_id = ${orgId})
        )`.as("covered_count"),
      })
      .from(aspectStandards)
      .innerJoin(aspects, eq(aspectStandards.aspectId, aspects.id))
      .where(
        and(
          additiveOrgFilter(aspectStandards.ownerOrgId, orgId),
          additiveOrgFilter(aspects.ownerOrgId, orgId),
          eq(aspectStandards.standardId, standardId),
        ),
      )
      .orderBy(aspects.name);
  },

  async listStandardsForAspectWithCoverage({
    orgId,
    aspectId,
  }: {
    orgId: string;
    aspectId: string;
  }) {
    return db
      .select({
        standardId: standards.id,
        standardName: standards.name,
        domainTag: standards.domainTag,
        designationCount: sql<number>`(
          SELECT COUNT(*) FROM standard_designations
          WHERE standard_designations.standard_id = ${standards.id}
            AND (standard_designations.owner_org_id IS NULL OR standard_designations.owner_org_id = ${orgId})
        )`.as("designation_count"),
        parameterCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          WHERE aspect_parameters.aspect_id = ${aspectId}
            AND (aspect_parameters.owner_org_id IS NULL OR aspect_parameters.owner_org_id = ${orgId})
        )`.as("parameter_count"),
        coveredCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          INNER JOIN standard_parameters
            ON aspect_parameters.parameter_definition_id
               = standard_parameters.parameter_definition_id
          WHERE aspect_parameters.aspect_id = ${aspectId}
            AND standard_parameters.standard_id = ${standards.id}
            AND (aspect_parameters.owner_org_id IS NULL OR aspect_parameters.owner_org_id = ${orgId})
            AND (standard_parameters.owner_org_id IS NULL OR standard_parameters.owner_org_id = ${orgId})
        )`.as("covered_count"),
        coveredParamIds: sql<string[]>`(
          SELECT array_agg(aspect_parameters.parameter_definition_id)
          FROM aspect_parameters
          INNER JOIN standard_parameters
            ON aspect_parameters.parameter_definition_id
               = standard_parameters.parameter_definition_id
          WHERE aspect_parameters.aspect_id = ${aspectId}
            AND standard_parameters.standard_id = ${standards.id}
            AND (aspect_parameters.owner_org_id IS NULL OR aspect_parameters.owner_org_id = ${orgId})
            AND (standard_parameters.owner_org_id IS NULL OR standard_parameters.owner_org_id = ${orgId})
        )`.as("covered_param_ids"),
      })
      .from(aspectStandards)
      .innerJoin(standards, eq(aspectStandards.standardId, standards.id))
      .where(
        and(
          additiveOrgFilter(aspectStandards.ownerOrgId, orgId),
          additiveOrgFilter(standards.ownerOrgId, orgId),
          eq(aspectStandards.aspectId, aspectId),
        ),
      )
      .orderBy(standards.name);
  },

  // --- Standard parameters ---

  async addParameter({
    orgId,
    standardId,
    parameterDefinitionId,
    role,
    sortOrder,
  }: {
    orgId: string;
    standardId: string;
    parameterDefinitionId: string;
    role: string;
    sortOrder?: number;
  }) {
    const parent = await standardRepository.findById({ orgId, id: standardId });
    if (!parent) throw new Error(`Standard ${standardId} not found`);

    const [sp] = await db
      .insert(standardParameters)
      .values({
        ownerOrgId: parent.ownerOrgId,
        standardId,
        parameterDefinitionId,
        role,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    return sp;
  },

  async removeParameter({
    orgId,
    standardId,
    parameterDefinitionId,
  }: {
    orgId: string;
    standardId: string;
    parameterDefinitionId: string;
  }) {
    const [deleted] = await db
      .delete(standardParameters)
      .where(
        and(
          additiveOrgFilter(standardParameters.ownerOrgId, orgId),
          eq(standardParameters.standardId, standardId),
          eq(standardParameters.parameterDefinitionId, parameterDefinitionId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new Error(
        `Parameter ${parameterDefinitionId} not found on standard ${standardId}`,
      );
    }
  },

  async getParameters({
    orgId,
    standardId,
  }: {
    orgId: string;
    standardId: string;
  }) {
    return db
      .select({
        id: standardParameters.id,
        parameterDefinitionId: standardParameters.parameterDefinitionId,
        role: standardParameters.role,
        sortOrder: standardParameters.sortOrder,
        parameterName: parameterDefinitions.name,
        dataType: parameterDefinitions.dataType,
        unit: parameterDefinitions.unit,
      })
      .from(standardParameters)
      .innerJoin(
        parameterDefinitions,
        eq(standardParameters.parameterDefinitionId, parameterDefinitions.id),
      )
      .where(
        and(
          additiveOrgFilter(standardParameters.ownerOrgId, orgId),
          additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
          eq(standardParameters.standardId, standardId),
        ),
      )
      .orderBy(standardParameters.sortOrder);
  },

  // --- Designations ---

  async createDesignation({
    orgId,
    standardId,
    designation,
    values,
    metadata,
  }: {
    orgId: string;
    standardId: string;
    designation: string;
    values: Record<string, unknown>;
    metadata?: unknown;
  }) {
    const parent = await standardRepository.findById({ orgId, id: standardId });
    if (!parent) throw new Error(`Standard ${standardId} not found`);

    const [entry] = await db
      .insert(standardDesignations)
      .values({
        ownerOrgId: parent.ownerOrgId,
        standardId,
        designation,
        values,
        metadata,
      })
      .returning();

    return entry;
  },

  async findDesignationById({
    orgId,
    id,
  }: {
    orgId: string;
    id: string;
  }) {
    const [entry] = await db
      .select()
      .from(standardDesignations)
      .where(
        and(
          additiveOrgFilter(standardDesignations.ownerOrgId, orgId),
          eq(standardDesignations.id, id),
        ),
      );
    return entry ?? null;
  },

  async listDesignations({
    orgId,
    standardId,
    q,
    limit,
    offset,
  }: {
    orgId: string;
    standardId: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const filters = [
      additiveOrgFilter(standardDesignations.ownerOrgId, orgId),
      eq(standardDesignations.standardId, standardId),
    ];
    if (q && q.trim().length > 0) {
      filters.push(ilike(standardDesignations.designation, `%${q.trim()}%`));
    }

    let query = db
      .select()
      .from(standardDesignations)
      .where(and(...filters))
      .orderBy(standardDesignations.designation)
      .$dynamic();

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    return query;
  },

  async countDesignations({
    orgId,
    standardId,
  }: {
    orgId: string;
    standardId: string;
  }) {
    const [result] = await db
      .select({ count: count() })
      .from(standardDesignations)
      .where(
        and(
          additiveOrgFilter(standardDesignations.ownerOrgId, orgId),
          eq(standardDesignations.standardId, standardId),
        ),
      );
    return result?.count ?? 0;
  },

  async updateDesignation({
    orgId,
    id,
    ...updates
  }: {
    orgId: string;
    id: string;
    designation?: string;
    values?: Record<string, unknown>;
    metadata?: unknown;
  }) {
    const [updated] = await db
      .update(standardDesignations)
      .set(updates)
      .where(
        and(
          additiveOrgFilter(standardDesignations.ownerOrgId, orgId),
          eq(standardDesignations.id, id),
        ),
      )
      .returning();

    if (!updated) throw new Error(`Designation ${id} not found`);
    return updated;
  },

  async removeDesignation({
    orgId,
    id,
  }: {
    orgId: string;
    id: string;
  }) {
    const [deleted] = await db
      .delete(standardDesignations)
      .where(
        and(
          additiveOrgFilter(standardDesignations.ownerOrgId, orgId),
          eq(standardDesignations.id, id),
        ),
      )
      .returning();

    if (!deleted) throw new Error(`Designation ${id} not found`);
  },

  // --- Item-standard associations ---

  async applyDesignationValues({
    orgId,
    itemId,
    designationId,
  }: {
    orgId: string;
    itemId: string;
    designationId: string;
  }) {
    const [designation] = await db
      .select()
      .from(standardDesignations)
      .where(
        and(
          additiveOrgFilter(standardDesignations.ownerOrgId, orgId),
          eq(standardDesignations.id, designationId),
        ),
      );
    if (!designation) return;

    const [item] = await db
      .select({ ownerOrgId: items.ownerOrgId })
      .from(items)
      .where(
        and(additiveOrgFilter(items.ownerOrgId, orgId), eq(items.id, itemId)),
      );
    if (!item) return;
    const valuesOwnerOrgId = item.ownerOrgId;

    const values = (designation.values ?? {}) as Record<string, unknown>;
    const allKeys = Object.keys(values);
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const keys = allKeys.filter((k) => uuidLike.test(k));
    if (keys.length === 0) return;

    const validKeys = new Set(
      (
        await db
          .select({ id: parameterDefinitions.id })
          .from(parameterDefinitions)
          .where(
            and(
              additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
              inArray(parameterDefinitions.id, keys),
            ),
          )
      ).map((r) => r.id),
    );

    for (const [paramDefId, raw] of Object.entries(values)) {
      if (!validKeys.has(paramDefId)) continue;
      const scalar =
        raw && typeof raw === "object" && "value" in raw
          ? (raw as { value: unknown }).value
          : raw;

      const existing = await db
        .select()
        .from(itemParameterValues)
        .where(
          and(
            additiveOrgFilter(itemParameterValues.ownerOrgId, orgId),
            eq(itemParameterValues.itemId, itemId),
            eq(itemParameterValues.parameterDefinitionId, paramDefId),
          ),
        );

      if (existing.length > 0) {
        await db
          .update(itemParameterValues)
          .set({ value: scalar, updatedAt: new Date() })
          .where(eq(itemParameterValues.id, existing[0].id));
      } else {
        await db.insert(itemParameterValues).values({
          ownerOrgId: valuesOwnerOrgId,
          itemId,
          parameterDefinitionId: paramDefId,
          itemAspectId: null,
          value: scalar,
        });
      }
    }
  },

  async applyToItem({
    userId,
    orgId,
    itemId,
    standardId,
    designationId,
  }: {
    userId: string;
    orgId: string;
    itemId: string;
    standardId: string;
    designationId?: string;
  }) {
    const [item] = await db
      .select({ ownerOrgId: items.ownerOrgId })
      .from(items)
      .where(
        and(additiveOrgFilter(items.ownerOrgId, orgId), eq(items.id, itemId)),
      );
    if (!item) throw new Error(`Item ${itemId} not found`);

    const [is] = await db
      .insert(itemStandards)
      .values({
        ownerOrgId: item.ownerOrgId,
        itemId,
        standardId,
        designationId: designationId ?? null,
        isCustom: false,
      })
      .returning();

    if (designationId) {
      await standardRepository.applyDesignationValues({
        orgId,
        itemId,
        designationId,
      });
    }

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "item_standard.create",
      entityType: "item_standard",
      entityId: is.id,
      beforeState: null,
      afterState: is,
    });

    return is;
  },

  async removeFromItem({
    userId,
    orgId,
    itemId,
    standardId,
  }: {
    userId: string;
    orgId: string;
    itemId: string;
    standardId: string;
  }) {
    const [deleted] = await db
      .delete(itemStandards)
      .where(
        and(
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          eq(itemStandards.itemId, itemId),
          eq(itemStandards.standardId, standardId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new Error(`Standard ${standardId} not applied to item ${itemId}`);
    }

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "item_standard.delete",
      entityType: "item_standard",
      entityId: deleted.id,
      beforeState: deleted,
      afterState: null,
    });
  },

  async setDesignation({
    orgId,
    itemId,
    standardId,
    designationId,
  }: {
    orgId: string;
    itemId: string;
    standardId: string;
    designationId: string | null;
  }) {
    const [updated] = await db
      .update(itemStandards)
      .set({ designationId, isCustom: false })
      .where(
        and(
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          eq(itemStandards.itemId, itemId),
          eq(itemStandards.standardId, standardId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(`Standard ${standardId} not applied to item ${itemId}`);
    }

    if (designationId) {
      await standardRepository.applyDesignationValues({
        orgId,
        itemId,
        designationId,
      });
    }

    return updated;
  },

  async markCustom({
    orgId,
    itemId,
    standardId,
  }: {
    orgId: string;
    itemId: string;
    standardId: string;
  }) {
    const [updated] = await db
      .update(itemStandards)
      .set({ isCustom: true })
      .where(
        and(
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          eq(itemStandards.itemId, itemId),
          eq(itemStandards.standardId, standardId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(`Standard ${standardId} not applied to item ${itemId}`);
    }

    return updated;
  },

  async getItemStandards({
    orgId,
    itemId,
  }: {
    orgId: string;
    itemId: string;
  }) {
    return db
      .select({
        id: itemStandards.id,
        standardId: itemStandards.standardId,
        standardName: standards.name,
        designationId: itemStandards.designationId,
        designation: standardDesignations.designation,
        designationValues: standardDesignations.values,
        isCustom: itemStandards.isCustom,
        createdAt: itemStandards.createdAt,
      })
      .from(itemStandards)
      .innerJoin(standards, eq(itemStandards.standardId, standards.id))
      .leftJoin(
        standardDesignations,
        eq(itemStandards.designationId, standardDesignations.id),
      )
      .where(
        and(
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          additiveOrgFilter(standards.ownerOrgId, orgId),
          eq(itemStandards.itemId, itemId),
        ),
      );
  },
};
