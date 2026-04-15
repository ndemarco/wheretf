import { eq, or, and, ilike, inArray, sql, asc, desc } from "drizzle-orm";
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
  aspects,
  assignments,
  locations,
  itemStandards,
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

  // --- Rich listing with filters, search, sort ---

  async listRich({
    query,
    filters,
    categoryId,
    sortBy,
    sortDirection,
  }: {
    query?: string;
    filters?: { parameterDefinitionId: string; value: unknown }[];
    categoryId?: string;
    sortBy?: string; // "name" or a parameter definition ID
    sortDirection?: "asc" | "desc";
  } = {}) {
    // Step 1: Build filtered item ID set
    let itemIds: string[] | null = null;

    // Filter by parameter values — each filter narrows the set (AND)
    if (filters?.length) {
      for (const filter of filters) {
        const matchingRows = await db
          .select({ itemId: itemParameterValues.itemId })
          .from(itemParameterValues)
          .where(
            and(
              eq(
                itemParameterValues.parameterDefinitionId,
                filter.parameterDefinitionId
              ),
              sql`${itemParameterValues.value} = ${JSON.stringify(filter.value)}::jsonb`
            )
          );

        const matchingIds = new Set(matchingRows.map((r) => r.itemId));

        if (itemIds === null) {
          itemIds = [...matchingIds];
        } else {
          itemIds = itemIds.filter((id) => matchingIds.has(id));
        }

        if (itemIds.length === 0) return { items: [], total: 0 };
      }
    }

    // Filter by category
    if (categoryId) {
      const catRows = await db
        .select({ itemId: itemCategories.itemId })
        .from(itemCategories)
        .where(eq(itemCategories.categoryId, categoryId));

      const catIds = new Set(catRows.map((r) => r.itemId));

      if (itemIds === null) {
        itemIds = [...catIds];
      } else {
        itemIds = itemIds.filter((id) => catIds.has(id));
      }

      if (itemIds.length === 0) return { items: [], total: 0 };
    }

    // Search across name, description, and parameter values
    if (query && query.length >= 2) {
      const pattern = `%${query}%`;

      // Items matching by name/description
      const nameMatches = await db
        .select({ id: items.id })
        .from(items)
        .where(
          or(ilike(items.name, pattern), ilike(items.description, pattern))
        );

      // Items matching by parameter value (cast jsonb to text for ilike)
      const paramMatches = await db
        .select({ itemId: itemParameterValues.itemId })
        .from(itemParameterValues)
        .where(sql`${itemParameterValues.value}::text ILIKE ${pattern}`);

      const searchIds = new Set([
        ...nameMatches.map((r) => r.id),
        ...paramMatches.map((r) => r.itemId),
      ]);

      if (itemIds === null) {
        itemIds = [...searchIds];
      } else {
        itemIds = itemIds.filter((id) => searchIds.has(id));
      }

      if (itemIds.length === 0) return { items: [], total: 0 };
    }

    // Step 2: Fetch items
    let itemRows;
    if (itemIds !== null) {
      if (itemIds.length === 0) return { items: [], total: 0 };
      itemRows = await db
        .select()
        .from(items)
        .where(inArray(items.id, itemIds));
    } else {
      itemRows = await db.select().from(items);
    }

    if (itemRows.length === 0) return { items: [], total: 0 };

    const allIds = itemRows.map((r) => r.id);

    // Step 3: Batch-fetch taxonomy data
    const [catRows, aspectRows, paramValueRows, assignmentRows] =
      await Promise.all([
        // Categories
        db
          .select({
            itemId: itemCategories.itemId,
            categoryId: itemCategories.categoryId,
            isPrimary: itemCategories.isPrimary,
            name: categories.name,
            icon: categories.icon,
            color: categories.color,
          })
          .from(itemCategories)
          .innerJoin(
            categories,
            eq(itemCategories.categoryId, categories.id)
          )
          .where(inArray(itemCategories.itemId, allIds)),

        // Applied aspects
        db
          .select({
            itemId: itemAspects.itemId,
            itemAspectId: itemAspects.id,
            aspectId: itemAspects.aspectId,
            aspectName: aspects.name,
            aspectDescription: aspects.description,
          })
          .from(itemAspects)
          .innerJoin(aspects, eq(itemAspects.aspectId, aspects.id))
          .where(inArray(itemAspects.itemId, allIds)),

        // Parameter values with definitions
        db
          .select({
            itemId: itemParameterValues.itemId,
            parameterDefinitionId: itemParameterValues.parameterDefinitionId,
            itemAspectId: itemParameterValues.itemAspectId,
            value: itemParameterValues.value,
            parameterName: parameterDefinitions.name,
            dataType: parameterDefinitions.dataType,
            unit: parameterDefinitions.unit,
            constraints: parameterDefinitions.constraints,
          })
          .from(itemParameterValues)
          .innerJoin(
            parameterDefinitions,
            eq(
              itemParameterValues.parameterDefinitionId,
              parameterDefinitions.id
            )
          )
          .where(inArray(itemParameterValues.itemId, allIds)),

        // Assignments with location paths
        db
          .select({
            itemId: assignments.itemId,
            assignmentType: assignments.assignmentType,
            locationId: assignments.locationId,
            locationPath: locations.path,
          })
          .from(assignments)
          .innerJoin(locations, eq(assignments.locationId, locations.id))
          .where(inArray(assignments.itemId, allIds)),
      ]);

    // Step 4: Assemble rich items
    const richItems = itemRows.map((item) => ({
      ...item,
      categories: catRows
        .filter((c) => c.itemId === item.id)
        .map(({ itemId, ...rest }) => rest),
      aspects: aspectRows
        .filter((a) => a.itemId === item.id)
        .map((a) => ({
          itemAspectId: a.itemAspectId,
          aspectId: a.aspectId,
          name: a.aspectName,
          description: a.aspectDescription,
          parameters: paramValueRows
            .filter(
              (pv) =>
                pv.itemId === item.id && pv.itemAspectId === a.itemAspectId
            )
            .map(({ itemId, ...rest }) => rest),
        })),
      standaloneParameters: paramValueRows
        .filter((pv) => pv.itemId === item.id && pv.itemAspectId === null)
        .map(({ itemId, ...rest }) => rest),
      assignments: assignmentRows
        .filter((a) => a.itemId === item.id)
        .map(({ itemId, ...rest }) => rest),
    }));

    // Step 5: Sort
    const dir = sortDirection === "desc" ? -1 : 1;
    if (sortBy === "name" || !sortBy) {
      richItems.sort((a, b) => a.name.localeCompare(b.name) * dir);
    } else {
      // Sort by a parameter value
      richItems.sort((a, b) => {
        const allParamsA = [
          ...a.aspects.flatMap((asp) => asp.parameters),
          ...a.standaloneParameters,
        ];
        const allParamsB = [
          ...b.aspects.flatMap((asp) => asp.parameters),
          ...b.standaloneParameters,
        ];
        const valA = allParamsA.find(
          (p) => p.parameterDefinitionId === sortBy
        )?.value;
        const valB = allParamsB.find(
          (p) => p.parameterDefinitionId === sortBy
        )?.value;

        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (typeof valA === "number" && typeof valB === "number") {
          return (valA - valB) * dir;
        }
        return String(valA).localeCompare(String(valB)) * dir;
      });
    }

    return { items: richItems, total: richItems.length };
  },

  // --- Category counts (respects active filters) ---

  /**
   * Rank categories by co-occurrence with the supplied aspects/standards.
   * For each category, score = count of items in that category that share at
   * least one of the given aspects or standards, divided by the total number
   * of items in the category (so small specialized categories aren't
   * penalized). Empty catalog or zero overlap → empty result.
   *
   * Used by the "Create item from designation" flow to suggest where the new
   * item fits.
   */
  async suggestCategories({
    aspectIds = [],
    standardIds = [],
    limit = 3,
  }: {
    aspectIds?: string[];
    standardIds?: string[];
    limit?: number;
  }) {
    if (aspectIds.length === 0 && standardIds.length === 0) return [];

    // Items that share at least one aspect or standard with the input.
    const matchingItemIds = new Set<string>();
    if (aspectIds.length > 0) {
      const rows = await db
        .select({ itemId: itemAspects.itemId })
        .from(itemAspects)
        .where(inArray(itemAspects.aspectId, aspectIds));
      for (const r of rows) matchingItemIds.add(r.itemId);
    }
    if (standardIds.length > 0) {
      const rows = await db
        .select({ itemId: itemStandards.itemId })
        .from(itemStandards)
        .where(inArray(itemStandards.standardId, standardIds));
      for (const r of rows) matchingItemIds.add(r.itemId);
    }

    if (matchingItemIds.size === 0) return [];

    // For each category, count matching items and total items.
    const matchingRows = await db
      .select({
        categoryId: itemCategories.categoryId,
        itemId: itemCategories.itemId,
      })
      .from(itemCategories)
      .where(inArray(itemCategories.itemId, Array.from(matchingItemIds)));

    const matchByCat = new Map<string, number>();
    for (const r of matchingRows) {
      matchByCat.set(r.categoryId, (matchByCat.get(r.categoryId) ?? 0) + 1);
    }
    if (matchByCat.size === 0) return [];

    const totalRows = await db
      .select({
        categoryId: itemCategories.categoryId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(itemCategories)
      .where(inArray(itemCategories.categoryId, Array.from(matchByCat.keys())))
      .groupBy(itemCategories.categoryId);
    const totalByCat = new Map<string, number>();
    for (const r of totalRows) totalByCat.set(r.categoryId, Number(r.count));

    const catRows = await db
      .select({
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
      })
      .from(categories)
      .where(inArray(categories.id, Array.from(matchByCat.keys())));
    const byId = new Map(catRows.map((c) => [c.id, c]));

    const scored = Array.from(matchByCat.entries()).map(
      ([categoryId, matched]) => {
        const total = totalByCat.get(categoryId) ?? matched;
        const score = total === 0 ? 0 : matched / total;
        const cat = byId.get(categoryId);
        return {
          categoryId,
          name: cat?.name ?? "",
          icon: cat?.icon ?? null,
          color: cat?.color ?? null,
          matched,
          total,
          score,
        };
      }
    );

    scored.sort((a, b) => b.score - a.score || b.matched - a.matched);
    return scored.slice(0, limit);
  },

  async getCategoryCounts({
    query,
    filters,
  }: {
    query?: string;
    filters?: { parameterDefinitionId: string; value: unknown }[];
  } = {}) {
    // Get the filtered item set first (reuse filtering logic)
    const { items: filteredItems } = await itemRepository.listRich({
      query,
      filters,
    });

    const filteredIds = filteredItems.map((i) => i.id);

    // Get all categories with counts
    const allCategories = await db
      .select()
      .from(categories)
      .orderBy(categories.sortOrder);

    if (filteredIds.length === 0) {
      return allCategories.map((c) => ({ ...c, count: 0 }));
    }

    const catCounts = await db
      .select({
        categoryId: itemCategories.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(itemCategories)
      .where(inArray(itemCategories.itemId, filteredIds))
      .groupBy(itemCategories.categoryId);

    const countMap = new Map(catCounts.map((c) => [c.categoryId, c.count]));

    return allCategories.map((c) => ({
      ...c,
      count: countMap.get(c.id) ?? 0,
    }));
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
