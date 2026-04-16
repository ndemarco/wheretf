import { eq, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import { categories, itemCategories, items } from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const categoryRepository = {
  async create({
    name,
    icon,
    svg,
    color,
    sortOrder,
  }: {
    name: string;
    icon?: string | null;
    svg?: string | null;
    color?: string | null;
    sortOrder?: number;
  }) {
    const [category] = await db
      .insert(categories)
      .values({
        name,
        icon: icon ?? null,
        svg: svg ?? null,
        color: color ?? null,
        sortOrder: sortOrder ?? 0,
      })
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

  async listWithUsage() {
    const rows = await db
      .select({
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        svg: categories.svg,
        color: categories.color,
        sortOrder: categories.sortOrder,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        itemCount: sql<number>`(
          SELECT COUNT(DISTINCT ${itemCategories.itemId})::int
          FROM ${itemCategories}
          WHERE ${itemCategories.categoryId} = ${categories.id}
        )`.as("itemCount"),
      })
      .from(categories)
      .orderBy(categories.sortOrder);
    return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount ?? 0) }));
  },

  async listItems({
    categoryId,
    limit = 50,
  }: {
    categoryId: string;
    limit?: number;
  }) {
    return db
      .select({ id: items.id, name: items.name })
      .from(itemCategories)
      .innerJoin(items, eq(itemCategories.itemId, items.id))
      .where(eq(itemCategories.categoryId, categoryId))
      .orderBy(items.name)
      .limit(limit);
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    icon?: string | null;
    svg?: string | null;
    color?: string | null;
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
