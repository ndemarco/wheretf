import { eq } from "drizzle-orm";
import { db } from "@/db/connection";
import { modules } from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const moduleRepository = {
  async create({
    name,
    description,
    primaryDimensionLabel,
    primaryDimensionCount,
    metadata,
  }: {
    name: string;
    description?: string;
    primaryDimensionLabel: string;
    primaryDimensionCount: number;
    metadata?: Record<string, unknown>;
  }) {
    const [module] = await db
      .insert(modules)
      .values({
        name,
        description,
        primaryDimensionLabel,
        primaryDimensionCount,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      actionType: "module.create",
      entityType: "module",
      entityId: module.id,
      beforeState: null,
      afterState: module,
    });

    return module;
  },

  async findById({ id }: { id: string }) {
    const [module] = await db
      .select()
      .from(modules)
      .where(eq(modules.id, id));
    return module ?? null;
  },

  async findByName({ name }: { name: string }) {
    const [module] = await db
      .select()
      .from(modules)
      .where(eq(modules.name, name));
    return module ?? null;
  },

  async list() {
    return db.select().from(modules);
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    description?: string;
    primaryDimensionLabel?: string;
    primaryDimensionCount?: number;
    metadata?: Record<string, unknown>;
  }) {
    const before = await moduleRepository.findById({ id });
    if (!before) throw new Error(`Module ${id} not found`);

    const [updated] = await db
      .update(modules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(modules.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "module.update",
      entityType: "module",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await moduleRepository.findById({ id });
    if (!before) throw new Error(`Module ${id} not found`);

    await db.delete(modules).where(eq(modules.id, id));

    await transactionRepository.log({
      actionType: "module.delete",
      entityType: "module",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
