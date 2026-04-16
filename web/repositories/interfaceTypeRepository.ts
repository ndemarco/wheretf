import { eq } from "drizzle-orm";
import { db } from "@/db/connection";
import { interfaceTypes } from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const interfaceTypeRepository = {
  async create({
    identifier,
    description,
    physicalContract,
  }: {
    identifier: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
  }) {
    const [interfaceType] = await db
      .insert(interfaceTypes)
      .values({
        identifier,
        description,
        physicalContract,
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

  async list() {
    return db.select().from(interfaceTypes);
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
  }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

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

  async remove({ id }: { id: string }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

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
