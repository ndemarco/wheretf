import { eq, and, count } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  aspects,
  aspectParameters,
  parameterDefinitions,
  itemAspects,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

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
