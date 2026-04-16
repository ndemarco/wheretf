import { eq } from "drizzle-orm";
import { db } from "@/db/connection";
import { parameterDefinitions } from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

type DataType = "numeric" | "text" | "boolean" | "enum";

interface Constraints {
  enumValues?: string[];
  min?: number;
  max?: number;
}

export const parameterDefinitionRepository = {
  async create({
    name,
    dataType,
    unit,
    description,
    searchTerms,
    defaultValue,
    constraints,
  }: {
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

    const [paramDef] = await db
      .insert(parameterDefinitions)
      .values({
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
      actionType: "parameterDefinition.create",
      entityType: "parameterDefinition",
      entityId: paramDef.id,
      beforeState: null,
      afterState: paramDef,
    });

    return paramDef;
  },

  async findById({ id }: { id: string }) {
    const [paramDef] = await db
      .select()
      .from(parameterDefinitions)
      .where(eq(parameterDefinitions.id, id));
    return paramDef ?? null;
  },

  async findByName({ name }: { name: string }) {
    const [paramDef] = await db
      .select()
      .from(parameterDefinitions)
      .where(eq(parameterDefinitions.name, name));
    return paramDef ?? null;
  },

  async list() {
    return db.select().from(parameterDefinitions).orderBy(parameterDefinitions.name);
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    dataType?: DataType;
    unit?: string;
    description?: string | null;
    searchTerms?: string[] | null;
    defaultValue?: unknown;
    constraints?: Constraints;
  }) {
    const before = await parameterDefinitionRepository.findById({ id });
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
      .where(eq(parameterDefinitions.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "parameterDefinition.update",
      entityType: "parameterDefinition",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await parameterDefinitionRepository.findById({ id });
    if (!before) throw new Error(`ParameterDefinition ${id} not found`);

    await db
      .delete(parameterDefinitions)
      .where(eq(parameterDefinitions.id, id));

    await transactionRepository.log({
      actionType: "parameterDefinition.delete",
      entityType: "parameterDefinition",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
