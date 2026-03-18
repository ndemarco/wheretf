import { eq } from "drizzle-orm";
import { db } from "@/db/connection";
import { categories } from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const categoryRepository = {
  async create({
    name,
    icon,
    color,
    sortOrder,
  }: {
    name: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
  }) {
    const [category] = await db
      .insert(categories)
      .values({ name, icon, color, sortOrder: sortOrder ?? 0 })
      .returning();

    await transactionRepository.log({
      actionType: "category.create",
      entityType: "category",
      entityId: category.id,
      beforeState: null,
      afterState: category,
    });

    return category;
  },

  async findById({ id }: { id: string }) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return category ?? null;
  },

  async findByName({ name }: { name: string }) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, name));
    return category ?? null;
  },

  async list() {
    return db.select().from(categories).orderBy(categories.sortOrder);
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
  }) {
    const before = await categoryRepository.findById({ id });
    if (!before) throw new Error(`Category ${id} not found`);

    const [updated] = await db
      .update(categories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "category.update",
      entityType: "category",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await categoryRepository.findById({ id });
    if (!before) throw new Error(`Category ${id} not found`);

    await db.delete(categories).where(eq(categories.id, id));

    await transactionRepository.log({
      actionType: "category.delete",
      entityType: "category",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
