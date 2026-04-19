import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import { categories, itemCategories, items } from "@/db/schema";
import { additiveOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";

// categories is additive. NULL = global taxonomy; set = org-private.
export const categoryRepository = {
  async create({
    userId,
    orgId,
    asGlobal,
    name,
    icon,
    svg,
    color,
    sortOrder,
  }: {
    userId: string;
    orgId: string;
    asGlobal?: boolean;
    name: string;
    icon?: string | null;
    svg?: string | null;
    color?: string | null;
    sortOrder?: number;
  }) {
    const ownerOrgId = asGlobal ? null : orgId;
    const [category] = await db
      .insert(categories)
      .values({
        ownerOrgId,
        name,
        icon: icon ?? null,
        svg: svg ?? null,
        color: color ?? null,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "category.create",
      entityType: "category",
      entityId: category.id,
      beforeState: null,
      afterState: category,
    });

    return category;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(additiveOrgFilter(categories.ownerOrgId, orgId), eq(categories.id, id)));
    return category ?? null;
  },

  async findByName({ orgId, name }: { orgId: string; name: string }) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(additiveOrgFilter(categories.ownerOrgId, orgId), eq(categories.name, name)));
    return category ?? null;
  },

  async list({ orgId }: { orgId: string }) {
    return db
      .select()
      .from(categories)
      .where(additiveOrgFilter(categories.ownerOrgId, orgId))
      .orderBy(categories.sortOrder);
  },

  async listWithUsage({ orgId }: { orgId: string }) {
    const rows = await db
      .select({
        id: categories.id,
        ownerOrgId: categories.ownerOrgId,
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
            AND (${itemCategories.ownerOrgId} IS NULL OR ${itemCategories.ownerOrgId} = ${orgId})
        )`.as("itemCount"),
      })
      .from(categories)
      .where(additiveOrgFilter(categories.ownerOrgId, orgId))
      .orderBy(categories.sortOrder);
    return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount ?? 0) }));
  },

  async listItems({
    orgId,
    categoryId,
    limit = 50,
  }: {
    orgId: string;
    categoryId: string;
    limit?: number;
  }) {
    return db
      .select({ id: items.id, name: items.name })
      .from(itemCategories)
      .innerJoin(items, eq(itemCategories.itemId, items.id))
      .where(
        and(
          additiveOrgFilter(itemCategories.ownerOrgId, orgId),
          additiveOrgFilter(items.ownerOrgId, orgId),
          eq(itemCategories.categoryId, categoryId),
        ),
      )
      .orderBy(items.name)
      .limit(limit);
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
    icon?: string | null;
    svg?: string | null;
    color?: string | null;
    sortOrder?: number;
  }) {
    const before = await categoryRepository.findById({ orgId, id });
    if (!before) throw new Error(`Category ${id} not found`);

    const [updated] = await db
      .update(categories)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(additiveOrgFilter(categories.ownerOrgId, orgId), eq(categories.id, id)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "category.update",
      entityType: "category",
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
    const before = await categoryRepository.findById({ orgId, id });
    if (!before) throw new Error(`Category ${id} not found`);

    await db
      .delete(categories)
      .where(and(additiveOrgFilter(categories.ownerOrgId, orgId), eq(categories.id, id)));

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "category.delete",
      entityType: "category",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
