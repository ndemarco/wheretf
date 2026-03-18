import { eq, or, and, ilike } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  items,
  coStorability,
  itemCategories,
  itemAspects,
  itemParameterValues,
  aspectParameters,
  parameterDefinitions,
  categories,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const itemRepository = {
  async create({
    name,
    description,
    metadata,
  }: {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const [item] = await db
      .insert(items)
      .values({
        name,
        description,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      actionType: "item.create",
      entityType: "item",
      entityId: item.id,
      beforeState: null,
      afterState: item,
    });

    return item;
  },

  async findById({ id }: { id: string }) {
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.id, id));
    return item ?? null;
  },

  async findByName({ name }: { name: string }) {
    const [item] = await db
      .select()
      .from(items)
      .where(eq(items.name, name));
    return item ?? null;
  },

  async search({ query }: { query: string }) {
    const pattern = `%${query}%`;
    return db
      .select()
      .from(items)
      .where(
        or(
          ilike(items.name, pattern),
          ilike(items.description, pattern),
        ),
      );
  },

  async list() {
    return db.select().from(items);
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const before = await itemRepository.findById({ id });
    if (!before) throw new Error(`Item ${id} not found`);

    const [updated] = await db
      .update(items)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "item.update",
      entityType: "item",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await itemRepository.findById({ id });
    if (!before) throw new Error(`Item ${id} not found`);

    await db.delete(items).where(eq(items.id, id));

    await transactionRepository.log({
      actionType: "item.delete",
      entityType: "item",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async addCoStorability({
    itemAId,
    itemBId,
    reason,
  }: {
    itemAId: string;
    itemBId: string;
    reason?: string;
  }) {
    const [record] = await db
      .insert(coStorability)
      .values({ itemAId, itemBId, reason })
      .returning();

    await transactionRepository.log({
      actionType: "coStorability.create",
      entityType: "coStorability",
      entityId: record.id,
      beforeState: null,
      afterState: record,
    });

    return record;
  },

  async removeCoStorability({
    itemAId,
    itemBId,
  }: {
    itemAId: string;
    itemBId: string;
  }) {
    // Find the record in either direction
    const [record] = await db
      .select()
      .from(coStorability)
      .where(
        or(
          and(
            eq(coStorability.itemAId, itemAId),
            eq(coStorability.itemBId, itemBId),
          ),
          and(
            eq(coStorability.itemAId, itemBId),
            eq(coStorability.itemBId, itemAId),
          ),
        ),
      );

    if (!record) throw new Error("Co-storability relationship not found");

    await db.delete(coStorability).where(eq(coStorability.id, record.id));

    await transactionRepository.log({
      actionType: "coStorability.delete",
      entityType: "coStorability",
      entityId: record.id,
      beforeState: record,
      afterState: null,
    });
  },

  async getCoStorableItems({ itemId }: { itemId: string }) {
    const records = await db
      .select()
      .from(coStorability)
      .where(
        or(
          eq(coStorability.itemAId, itemId),
          eq(coStorability.itemBId, itemId),
        ),
      );

    // Collect the IDs of the co-storable items (the "other" side)
    const coStorableIds = records.map((r) =>
      r.itemAId === itemId ? r.itemBId : r.itemAId,
    );

    if (coStorableIds.length === 0) return [];

    // Fetch all co-storable items
    const results = await Promise.all(
      coStorableIds.map((id) => itemRepository.findById({ id })),
    );

    return results.filter((item) => item !== null);
  },

  // --- Category management ---

  async addCategory({
    itemId,
    categoryId,
    isPrimary,
  }: {
    itemId: string;
    categoryId: string;
    isPrimary?: boolean;
  }) {
    const item = await itemRepository.findById({ id: itemId });
    if (!item) throw new Error(`Item ${itemId} not found`);

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      await db
        .update(itemCategories)
        .set({ isPrimary: false })
        .where(
          and(
            eq(itemCategories.itemId, itemId),
            eq(itemCategories.isPrimary, true)
          )
        );
    }

    const [ic] = await db
      .insert(itemCategories)
      .values({ itemId, categoryId, isPrimary: isPrimary ?? false })
      .returning();

    return ic;
  },

  async removeCategory({
    itemId,
    categoryId,
  }: {
    itemId: string;
    categoryId: string;
  }) {
    const [deleted] = await db
      .delete(itemCategories)
      .where(
        and(
          eq(itemCategories.itemId, itemId),
          eq(itemCategories.categoryId, categoryId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error(`Category ${categoryId} not on item ${itemId}`);
    }
  },

  async setPrimaryCategory({
    itemId,
    categoryId,
  }: {
    itemId: string;
    categoryId: string;
  }) {
    // Unset all primaries for this item
    await db
      .update(itemCategories)
      .set({ isPrimary: false })
      .where(eq(itemCategories.itemId, itemId));

    // Set the specified one as primary
    const [updated] = await db
      .update(itemCategories)
      .set({ isPrimary: true })
      .where(
        and(
          eq(itemCategories.itemId, itemId),
          eq(itemCategories.categoryId, categoryId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error(`Category ${categoryId} not on item ${itemId}`);
    }

    return updated;
  },

  async getCategories({ itemId }: { itemId: string }) {
    return db
      .select({
        categoryId: itemCategories.categoryId,
        isPrimary: itemCategories.isPrimary,
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      })
      .from(itemCategories)
      .innerJoin(categories, eq(itemCategories.categoryId, categories.id))
      .where(eq(itemCategories.itemId, itemId));
  },

  // --- Aspect management ---

  async applyAspect({
    itemId,
    aspectId,
  }: {
    itemId: string;
    aspectId: string;
  }) {
    const item = await itemRepository.findById({ id: itemId });
    if (!item) throw new Error(`Item ${itemId} not found`);

    // Create the item-aspect link
    const [ia] = await db
      .insert(itemAspects)
      .values({ itemId, aspectId })
      .returning();

    // Get the aspect's parameter definitions and create value slots
    const aspectParams = await db
      .select()
      .from(aspectParameters)
      .where(eq(aspectParameters.aspectId, aspectId));

    for (const ap of aspectParams) {
      // Get the parameter definition for its global default
      const [pd] = await db
        .select()
        .from(parameterDefinitions)
        .where(eq(parameterDefinitions.id, ap.parameterDefinitionId));

      // Aspect-level default wins over parameter-level default
      const defaultVal = ap.defaultValue ?? pd?.defaultValue ?? null;

      await db.insert(itemParameterValues).values({
        itemId,
        parameterDefinitionId: ap.parameterDefinitionId,
        itemAspectId: ia.id,
        value: defaultVal,
      });
    }

    return ia;
  },

  async removeAspect({
    itemId,
    aspectId,
  }: {
    itemId: string;
    aspectId: string;
  }) {
    // cascade deletes item_parameter_values linked to this item_aspect
    const [deleted] = await db
      .delete(itemAspects)
      .where(
        and(eq(itemAspects.itemId, itemId), eq(itemAspects.aspectId, aspectId))
      )
      .returning();

    if (!deleted) {
      throw new Error(`Aspect ${aspectId} not applied to item ${itemId}`);
    }
  },

  async getAspects({ itemId }: { itemId: string }) {
    const rows = await db
      .select()
      .from(itemAspects)
      .where(eq(itemAspects.itemId, itemId));
    return rows;
  },

  // --- Parameter value management ---

  async setParameterValue({
    itemId,
    parameterDefinitionId,
    itemAspectId,
    value,
  }: {
    itemId: string;
    parameterDefinitionId: string;
    itemAspectId?: string | null;
    value: unknown;
  }) {
    // Try to update existing
    const existing = await db
      .select()
      .from(itemParameterValues)
      .where(
        and(
          eq(itemParameterValues.itemId, itemId),
          eq(
            itemParameterValues.parameterDefinitionId,
            parameterDefinitionId
          ),
          itemAspectId
            ? eq(itemParameterValues.itemAspectId, itemAspectId)
            : undefined
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(itemParameterValues)
        .set({ value, updatedAt: new Date() })
        .where(eq(itemParameterValues.id, existing[0].id))
        .returning();
      return updated;
    }

    // Create new (standalone parameter or ad-hoc)
    const [created] = await db
      .insert(itemParameterValues)
      .values({
        itemId,
        parameterDefinitionId,
        itemAspectId: itemAspectId ?? null,
        value,
      })
      .returning();

    return created;
  },

  async getParameterValues({ itemId }: { itemId: string }) {
    return db
      .select({
        id: itemParameterValues.id,
        parameterDefinitionId: itemParameterValues.parameterDefinitionId,
        itemAspectId: itemParameterValues.itemAspectId,
        value: itemParameterValues.value,
        parameterName: parameterDefinitions.name,
        dataType: parameterDefinitions.dataType,
        unit: parameterDefinitions.unit,
      })
      .from(itemParameterValues)
      .innerJoin(
        parameterDefinitions,
        eq(
          itemParameterValues.parameterDefinitionId,
          parameterDefinitions.id
        )
      )
      .where(eq(itemParameterValues.itemId, itemId));
  },
};
