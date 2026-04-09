import { eq, and, count, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  standards,
  aspectStandards,
  standardParameters,
  standardDesignations,
  itemStandards,
  parameterDefinitions,
  aspects,
  aspectParameters,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const standardRepository = {
  // --- Standard CRUD ---

  async create({
    name,
    description,
    domainTag,
  }: {
    name: string;
    description?: string;
    domainTag?: string;
  }) {
    const [standard] = await db
      .insert(standards)
      .values({ name, description, domainTag })
      .returning();

    await transactionRepository.log({
      actionType: "standard.create",
      entityType: "standard",
      entityId: standard.id,
      beforeState: null,
      afterState: standard,
    });

    return standard;
  },

  async findById({ id }: { id: string }) {
    const [standard] = await db
      .select()
      .from(standards)
      .where(eq(standards.id, id));
    return standard ?? null;
  },

  async findByName({ name }: { name: string }) {
    const [standard] = await db
      .select()
      .from(standards)
      .where(eq(standards.name, name));
    return standard ?? null;
  },

  async list() {
    return db
      .select({
        id: standards.id,
        name: standards.name,
        description: standards.description,
        domainTag: standards.domainTag,
        createdAt: standards.createdAt,
        updatedAt: standards.updatedAt,
        aspectCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_standards
          WHERE aspect_standards.standard_id = standards.id
        )`.as("aspect_count"),
      })
      .from(standards)
      .orderBy(standards.name);
  },

  async listByAspect({ aspectId }: { aspectId: string }) {
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
      .where(eq(aspectStandards.aspectId, aspectId))
      .orderBy(standards.name);
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    description?: string;
    domainTag?: string;
  }) {
    const before = await standardRepository.findById({ id });
    if (!before) throw new Error(`Standard ${id} not found`);

    const [updated] = await db
      .update(standards)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(standards.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "standard.update",
      entityType: "standard",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await standardRepository.findById({ id });
    if (!before) throw new Error(`Standard ${id} not found`);

    await db.delete(standards).where(eq(standards.id, id));

    await transactionRepository.log({
      actionType: "standard.delete",
      entityType: "standard",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async countItemsUsing({ standardId }: { standardId: string }) {
    const [result] = await db
      .select({ count: count() })
      .from(itemStandards)
      .where(eq(itemStandards.standardId, standardId));
    return result?.count ?? 0;
  },

  // --- Aspect-standard associations ---

  async addAspect({
    standardId,
    aspectId,
  }: {
    standardId: string;
    aspectId: string;
  }) {
    const [as_] = await db
      .insert(aspectStandards)
      .values({ standardId, aspectId })
      .returning();

    await transactionRepository.log({
      actionType: "aspect_standard.create",
      entityType: "aspect_standard",
      entityId: as_.id,
      beforeState: null,
      afterState: as_,
    });

    return as_;
  },

  async removeAspect({
    standardId,
    aspectId,
  }: {
    standardId: string;
    aspectId: string;
  }) {
    const [deleted] = await db
      .delete(aspectStandards)
      .where(
        and(
          eq(aspectStandards.standardId, standardId),
          eq(aspectStandards.aspectId, aspectId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error(
        `Standard ${standardId} not linked to aspect ${aspectId}`
      );
    }

    await transactionRepository.log({
      actionType: "aspect_standard.delete",
      entityType: "aspect_standard",
      entityId: deleted.id,
      beforeState: deleted,
      afterState: null,
    });
  },

  async listAspectsForStandard({ standardId }: { standardId: string }) {
    return db
      .select({
        aspectId: aspects.id,
        aspectName: aspects.name,
        parameterCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          WHERE aspect_parameters.aspect_id = ${aspects.id}
        )`.as("parameter_count"),
        coveredCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          INNER JOIN standard_parameters
            ON aspect_parameters.parameter_definition_id
               = standard_parameters.parameter_definition_id
          WHERE aspect_parameters.aspect_id = ${aspects.id}
            AND standard_parameters.standard_id = ${standardId}
        )`.as("covered_count"),
      })
      .from(aspectStandards)
      .innerJoin(aspects, eq(aspectStandards.aspectId, aspects.id))
      .where(eq(aspectStandards.standardId, standardId))
      .orderBy(aspects.name);
  },

  async listStandardsForAspectWithCoverage({
    aspectId,
  }: {
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
        )`.as("designation_count"),
        parameterCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          WHERE aspect_parameters.aspect_id = ${aspectId}
        )`.as("parameter_count"),
        coveredCount: sql<number>`(
          SELECT COUNT(*) FROM aspect_parameters
          INNER JOIN standard_parameters
            ON aspect_parameters.parameter_definition_id
               = standard_parameters.parameter_definition_id
          WHERE aspect_parameters.aspect_id = ${aspectId}
            AND standard_parameters.standard_id = ${standards.id}
        )`.as("covered_count"),
        coveredParamIds: sql<string[]>`(
          SELECT array_agg(aspect_parameters.parameter_definition_id)
          FROM aspect_parameters
          INNER JOIN standard_parameters
            ON aspect_parameters.parameter_definition_id
               = standard_parameters.parameter_definition_id
          WHERE aspect_parameters.aspect_id = ${aspectId}
            AND standard_parameters.standard_id = ${standards.id}
        )`.as("covered_param_ids"),
      })
      .from(aspectStandards)
      .innerJoin(standards, eq(aspectStandards.standardId, standards.id))
      .where(eq(aspectStandards.aspectId, aspectId))
      .orderBy(standards.name);
  },

  // --- Standard parameters ---

  async addParameter({
    standardId,
    parameterDefinitionId,
    role,
    sortOrder,
  }: {
    standardId: string;
    parameterDefinitionId: string;
    role: string;
    sortOrder?: number;
  }) {
    const [sp] = await db
      .insert(standardParameters)
      .values({
        standardId,
        parameterDefinitionId,
        role,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    return sp;
  },

  async removeParameter({
    standardId,
    parameterDefinitionId,
  }: {
    standardId: string;
    parameterDefinitionId: string;
  }) {
    const [deleted] = await db
      .delete(standardParameters)
      .where(
        and(
          eq(standardParameters.standardId, standardId),
          eq(standardParameters.parameterDefinitionId, parameterDefinitionId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error(
        `Parameter ${parameterDefinitionId} not found on standard ${standardId}`
      );
    }
  },

  async getParameters({ standardId }: { standardId: string }) {
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
        eq(standardParameters.parameterDefinitionId, parameterDefinitions.id)
      )
      .where(eq(standardParameters.standardId, standardId))
      .orderBy(standardParameters.sortOrder);
  },

  // --- Designations ---

  async createDesignation({
    standardId,
    designation,
    values,
    metadata,
  }: {
    standardId: string;
    designation: string;
    values: Record<string, unknown>;
    metadata?: unknown;
  }) {
    const [entry] = await db
      .insert(standardDesignations)
      .values({ standardId, designation, values, metadata })
      .returning();

    return entry;
  },

  async findDesignationById({ id }: { id: string }) {
    const [entry] = await db
      .select()
      .from(standardDesignations)
      .where(eq(standardDesignations.id, id));
    return entry ?? null;
  },

  async listDesignations({
    standardId,
    limit,
    offset,
  }: {
    standardId: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db
      .select()
      .from(standardDesignations)
      .where(eq(standardDesignations.standardId, standardId))
      .orderBy(standardDesignations.designation)
      .$dynamic();

    if (limit) query = query.limit(limit);
    if (offset) query = query.offset(offset);

    return query;
  },

  async countDesignations({ standardId }: { standardId: string }) {
    const [result] = await db
      .select({ count: count() })
      .from(standardDesignations)
      .where(eq(standardDesignations.standardId, standardId));
    return result?.count ?? 0;
  },

  async updateDesignation({
    id,
    ...updates
  }: {
    id: string;
    designation?: string;
    values?: Record<string, unknown>;
    metadata?: unknown;
  }) {
    const [updated] = await db
      .update(standardDesignations)
      .set(updates)
      .where(eq(standardDesignations.id, id))
      .returning();

    if (!updated) throw new Error(`Designation ${id} not found`);
    return updated;
  },

  async removeDesignation({ id }: { id: string }) {
    const [deleted] = await db
      .delete(standardDesignations)
      .where(eq(standardDesignations.id, id))
      .returning();

    if (!deleted) throw new Error(`Designation ${id} not found`);
  },

  // --- Item-standard associations ---

  async applyToItem({
    itemId,
    standardId,
    designationId,
  }: {
    itemId: string;
    standardId: string;
    designationId?: string;
  }) {
    const [is] = await db
      .insert(itemStandards)
      .values({
        itemId,
        standardId,
        designationId: designationId ?? null,
        isCustom: false,
      })
      .returning();

    await transactionRepository.log({
      actionType: "item_standard.create",
      entityType: "item_standard",
      entityId: is.id,
      beforeState: null,
      afterState: is,
    });

    return is;
  },

  async removeFromItem({
    itemId,
    standardId,
  }: {
    itemId: string;
    standardId: string;
  }) {
    const [deleted] = await db
      .delete(itemStandards)
      .where(
        and(
          eq(itemStandards.itemId, itemId),
          eq(itemStandards.standardId, standardId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error(
        `Standard ${standardId} not applied to item ${itemId}`
      );
    }

    await transactionRepository.log({
      actionType: "item_standard.delete",
      entityType: "item_standard",
      entityId: deleted.id,
      beforeState: deleted,
      afterState: null,
    });
  },

  async setDesignation({
    itemId,
    standardId,
    designationId,
  }: {
    itemId: string;
    standardId: string;
    designationId: string | null;
  }) {
    const [updated] = await db
      .update(itemStandards)
      .set({ designationId, isCustom: false })
      .where(
        and(
          eq(itemStandards.itemId, itemId),
          eq(itemStandards.standardId, standardId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error(
        `Standard ${standardId} not applied to item ${itemId}`
      );
    }

    return updated;
  },

  async markCustom({
    itemId,
    standardId,
  }: {
    itemId: string;
    standardId: string;
  }) {
    const [updated] = await db
      .update(itemStandards)
      .set({ isCustom: true })
      .where(
        and(
          eq(itemStandards.itemId, itemId),
          eq(itemStandards.standardId, standardId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error(
        `Standard ${standardId} not applied to item ${itemId}`
      );
    }

    return updated;
  },

  async getItemStandards({ itemId }: { itemId: string }) {
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
        eq(itemStandards.designationId, standardDesignations.id)
      )
      .where(eq(itemStandards.itemId, itemId));
  },
};
