import { eq, or, and, ilike, inArray, sql } from "drizzle-orm";
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
import { additiveOrgFilter, isolatedOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";
import { type AuditCheck } from "@/lib/audit";

// items is an additive table. Reads union (global ∪ org). Writes default
// to org-private; pass `asGlobal: true` to contribute to the global
// catalog (any signed-in user may create or edit globals; audited).
//
// Junction / value tables (item_categories, item_aspects,
// item_parameter_values, item_standards, co_storability) are also
// additive. Each row inherits its ownerOrgId from the parent item — a
// global item's junctions are global, an org-private item's are org.
//
// assignments is isolated. Reads here (the listRich join) strictly
// scope by orgId.
export const itemRepository = {
  async create({
    userId,
    orgId,
    asGlobal,
    name,
    description,
    metadata,
  }: {
    userId: string;
    orgId: string;
    asGlobal?: boolean;
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const ownerOrgId = asGlobal ? null : orgId;

    const [item] = await db
      .insert(items)
      .values({
        ownerOrgId,
        name,
        description,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "item.create",
      entityType: "item",
      entityId: item.id,
      beforeState: null,
      afterState: item,
    });

    return item;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [item] = await db
      .select()
      .from(items)
      .where(and(additiveOrgFilter(items.ownerOrgId, orgId), eq(items.id, id)));
    return item ?? null;
  },

  async findByName({ orgId, name }: { orgId: string; name: string }) {
    const [item] = await db
      .select()
      .from(items)
      .where(
        and(additiveOrgFilter(items.ownerOrgId, orgId), eq(items.name, name)),
      );
    return item ?? null;
  },

  async search({ orgId, query }: { orgId: string; query: string }) {
    const pattern = `%${query}%`;
    return db
      .select()
      .from(items)
      .where(
        and(
          additiveOrgFilter(items.ownerOrgId, orgId),
          or(
            ilike(items.name, pattern),
            ilike(items.description, pattern),
          ),
        ),
      );
  },

  async list({ orgId }: { orgId: string }) {
    return db
      .select()
      .from(items)
      .where(additiveOrgFilter(items.ownerOrgId, orgId));
  },

  // --- Rich listing with filters, search, sort ---

  async listRich({
    orgId,
    query,
    filters,
    categoryId,
    sortBy,
    sortDirection,
  }: {
    orgId: string;
    query?: string;
    filters?: { parameterDefinitionId: string; value: unknown }[];
    categoryId?: string;
    sortBy?: string; // "name" or a parameter definition ID
    sortDirection?: "asc" | "desc";
  }) {
    const itemScope = additiveOrgFilter(items.ownerOrgId, orgId);
    const ipvScope = additiveOrgFilter(itemParameterValues.ownerOrgId, orgId);
    const icScope = additiveOrgFilter(itemCategories.ownerOrgId, orgId);
    const iaScope = additiveOrgFilter(itemAspects.ownerOrgId, orgId);
    const asScope = isolatedOrgFilter(assignments.ownerOrgId, orgId);
    const locScope = isolatedOrgFilter(locations.ownerOrgId, orgId);

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
              ipvScope,
              eq(
                itemParameterValues.parameterDefinitionId,
                filter.parameterDefinitionId,
              ),
              sql`${itemParameterValues.value} = ${JSON.stringify(filter.value)}::jsonb`,
            ),
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
        .where(
          and(icScope, eq(itemCategories.categoryId, categoryId)),
        );

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
          and(
            itemScope,
            or(ilike(items.name, pattern), ilike(items.description, pattern)),
          ),
        );

      // Items matching by parameter value (cast jsonb to text for ilike)
      const paramMatches = await db
        .select({ itemId: itemParameterValues.itemId })
        .from(itemParameterValues)
        .where(
          and(ipvScope, sql`${itemParameterValues.value}::text ILIKE ${pattern}`),
        );

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
        .where(and(itemScope, inArray(items.id, itemIds)));
    } else {
      itemRows = await db.select().from(items).where(itemScope);
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
            eq(itemCategories.categoryId, categories.id),
          )
          .where(and(icScope, inArray(itemCategories.itemId, allIds))),

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
          .where(and(iaScope, inArray(itemAspects.itemId, allIds))),

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
              parameterDefinitions.id,
            ),
          )
          .where(and(ipvScope, inArray(itemParameterValues.itemId, allIds))),

        // Assignments with location paths — isolated, strictly scoped.
        db
          .select({
            itemId: assignments.itemId,
            assignmentType: assignments.assignmentType,
            locationId: assignments.locationId,
            locationPath: locations.path,
          })
          .from(assignments)
          .innerJoin(locations, eq(assignments.locationId, locations.id))
          .where(
            and(
              asScope,
              locScope,
              inArray(assignments.itemId, allIds),
            ),
          ),
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
                pv.itemId === item.id && pv.itemAspectId === a.itemAspectId,
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
          (p) => p.parameterDefinitionId === sortBy,
        )?.value;
        const valB = allParamsB.find(
          (p) => p.parameterDefinitionId === sortBy,
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

  // --- Cross-item audit ---

  /**
   * Cross-item audit: value outliers + free-text drift suggesting an
   * enum promotion. Pulls parameter values in scope then groups by
   * parameterDefinitionId in Node.
   */
  async auditParameterValues({
    orgId,
  }: {
    orgId: string;
  }): Promise<AuditCheck[]> {
    const rows = await db
      .select({
        itemId: itemParameterValues.itemId,
        parameterDefinitionId: itemParameterValues.parameterDefinitionId,
        value: itemParameterValues.value,
      })
      .from(itemParameterValues)
      .where(additiveOrgFilter(itemParameterValues.ownerOrgId, orgId));

    // Group values per parameter.
    const byParam = new Map<string, Array<{ itemId: string; value: unknown }>>();
    for (const r of rows) {
      const bag = byParam.get(r.parameterDefinitionId) ?? [];
      bag.push({ itemId: r.itemId, value: r.value });
      byParam.set(r.parameterDefinitionId, bag);
    }

    // Need param metadata (name + dataType) so checks can report and
    // qualify their work. parameterDefinitions is also additive.
    const paramRows = await db
      .select({
        id: parameterDefinitions.id,
        name: parameterDefinitions.name,
        dataType: parameterDefinitions.dataType,
      })
      .from(parameterDefinitions)
      .where(additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId));
    const paramById = new Map(paramRows.map((p) => [p.id, p]));

    const outliers: Array<{ id: string; name: string }> = [];
    const drift: Array<{ id: string; name: string }> = [];

    for (const [paramId, values] of byParam) {
      const meta = paramById.get(paramId);
      if (!meta) continue;

      if (meta.dataType === "numeric") {
        const nums: number[] = values
          .map((v) => (typeof v.value === "number" ? v.value : Number(v.value)))
          .filter((n) => Number.isFinite(n)) as number[];
        if (nums.length < 3) continue;
        const sorted = [...nums].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (median === 0) continue;
        const hasOutlier = nums.some((n) => Math.abs(n / median) > 10);
        if (hasOutlier) {
          outliers.push({ id: meta.id, name: meta.name });
        }
      }

      if (meta.dataType === "text") {
        const distinct = new Set(
          values
            .map((v) => (typeof v.value === "string" ? v.value.trim() : null))
            .filter((s): s is string => !!s),
        );
        if (distinct.size > 0 && distinct.size <= 20 && values.length >= 5) {
          drift.push({ id: meta.id, name: meta.name });
        }
      }
    }

    const out: AuditCheck[] = [];
    if (outliers.length > 0) {
      out.push({
        check: "param.value_outliers",
        severity: "info",
        subjects: outliers,
        suggestion:
          "A stored value is >10× the median — possibly wrong unit or missing SI prefix.",
      });
    }
    if (drift.length > 0) {
      out.push({
        check: "param.enum_free_text_drift",
        severity: "info",
        subjects: drift,
        suggestion:
          "Text parameter has few distinct values — consider promoting to enum.",
      });
    }
    return out;
  },

  /**
   * Return items that *might* be duplicates of an item described by the
   * given standard+designation (plus their parameter values so the caller
   * can refine per-row for set generation). Simple first cut: any item
   * that has the same (standardId, designationId) applied.
   */
  async findSimilar({
    orgId,
    standardId,
    designationId,
  }: {
    orgId: string;
    standardId: string;
    designationId: string;
  }) {
    const matches = await db
      .select({
        itemId: items.id,
        itemName: items.name,
      })
      .from(items)
      .innerJoin(itemStandards, eq(itemStandards.itemId, items.id))
      .where(
        and(
          additiveOrgFilter(items.ownerOrgId, orgId),
          additiveOrgFilter(itemStandards.ownerOrgId, orgId),
          eq(itemStandards.standardId, standardId),
          eq(itemStandards.designationId, designationId),
        ),
      );

    if (matches.length === 0) return [];

    const ids = matches.map((m) => m.itemId);
    const pvRows = await db
      .select({
        itemId: itemParameterValues.itemId,
        parameterDefinitionId: itemParameterValues.parameterDefinitionId,
        value: itemParameterValues.value,
      })
      .from(itemParameterValues)
      .where(
        and(
          additiveOrgFilter(itemParameterValues.ownerOrgId, orgId),
          inArray(itemParameterValues.itemId, ids),
        ),
      );

    const byItem = new Map<string, Record<string, unknown>>();
    for (const r of pvRows) {
      const bag = byItem.get(r.itemId) ?? {};
      bag[r.parameterDefinitionId] = r.value;
      byItem.set(r.itemId, bag);
    }

    return matches.map((m) => ({
      itemId: m.itemId,
      itemName: m.itemName,
      paramValues: byItem.get(m.itemId) ?? {},
    }));
  },

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
    orgId,
    aspectIds = [],
    standardIds = [],
    limit = 3,
  }: {
    orgId: string;
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
        .where(
          and(
            additiveOrgFilter(itemAspects.ownerOrgId, orgId),
            inArray(itemAspects.aspectId, aspectIds),
          ),
        );
      for (const r of rows) matchingItemIds.add(r.itemId);
    }
    if (standardIds.length > 0) {
      const rows = await db
        .select({ itemId: itemStandards.itemId })
        .from(itemStandards)
        .where(
          and(
            additiveOrgFilter(itemStandards.ownerOrgId, orgId),
            inArray(itemStandards.standardId, standardIds),
          ),
        );
      for (const r of rows) matchingItemIds.add(r.itemId);
    }

    if (matchingItemIds.size === 0) return [];

    // For each category, count matching items and total items (scoped).
    const matchingRows = await db
      .select({
        categoryId: itemCategories.categoryId,
        itemId: itemCategories.itemId,
      })
      .from(itemCategories)
      .where(
        and(
          additiveOrgFilter(itemCategories.ownerOrgId, orgId),
          inArray(itemCategories.itemId, Array.from(matchingItemIds)),
        ),
      );

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
      .where(
        and(
          additiveOrgFilter(itemCategories.ownerOrgId, orgId),
          inArray(itemCategories.categoryId, Array.from(matchByCat.keys())),
        ),
      )
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
      .where(
        and(
          additiveOrgFilter(categories.ownerOrgId, orgId),
          inArray(categories.id, Array.from(matchByCat.keys())),
        ),
      );
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
      },
    );

    scored.sort((a, b) => b.score - a.score || b.matched - a.matched);
    return scored.slice(0, limit);
  },

  async getCategoryCounts({
    orgId,
    query,
    filters,
  }: {
    orgId: string;
    query?: string;
    filters?: { parameterDefinitionId: string; value: unknown }[];
  }) {
    // Get the filtered item set first (reuse filtering logic)
    const { items: filteredItems } = await itemRepository.listRich({
      orgId,
      query,
      filters,
    });

    const filteredIds = filteredItems.map((i) => i.id);

    // Get all categories with counts (categories is additive — show
    // global + org-private categories).
    const allCategories = await db
      .select()
      .from(categories)
      .where(additiveOrgFilter(categories.ownerOrgId, orgId))
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
      .where(
        and(
          additiveOrgFilter(itemCategories.ownerOrgId, orgId),
          inArray(itemCategories.itemId, filteredIds),
        ),
      )
      .groupBy(itemCategories.categoryId);

    const countMap = new Map(catCounts.map((c) => [c.categoryId, c.count]));

    return allCategories.map((c) => ({
      ...c,
      count: countMap.get(c.id) ?? 0,
    }));
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
    description?: string;
    metadata?: Record<string, unknown>;
  }) {
    const before = await itemRepository.findById({ orgId, id });
    if (!before) throw new Error(`Item ${id} not found`);

    const [updated] = await db
      .update(items)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(additiveOrgFilter(items.ownerOrgId, orgId), eq(items.id, id)),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "item.update",
      entityType: "item",
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
    const before = await itemRepository.findById({ orgId, id });
    if (!before) throw new Error(`Item ${id} not found`);

    await db
      .delete(items)
      .where(
        and(additiveOrgFilter(items.ownerOrgId, orgId), eq(items.id, id)),
      );

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "item.delete",
      entityType: "item",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async addCoStorability({
    userId,
    orgId,
    itemAId,
    itemBId,
    reason,
  }: {
    userId: string;
    orgId: string;
    itemAId: string;
    itemBId: string;
    reason?: string;
  }) {
    // Junction inherits parent item's scope. Require itemA to be
    // visible; use its ownerOrgId so a co-storability of two globals
    // is itself global.
    const parent = await itemRepository.findById({ orgId, id: itemAId });
    if (!parent) throw new Error(`Item ${itemAId} not found`);

    const [record] = await db
      .insert(coStorability)
      .values({
        ownerOrgId: parent.ownerOrgId,
        itemAId,
        itemBId,
        reason,
      })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "coStorability.create",
      entityType: "coStorability",
      entityId: record.id,
      beforeState: null,
      afterState: record,
    });

    return record;
  },

  async removeCoStorability({
    userId,
    orgId,
    itemAId,
    itemBId,
  }: {
    userId: string;
    orgId: string;
    itemAId: string;
    itemBId: string;
  }) {
    // Find the record in either direction, within scope.
    const [record] = await db
      .select()
      .from(coStorability)
      .where(
        and(
          additiveOrgFilter(coStorability.ownerOrgId, orgId),
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
        ),
      );

    if (!record) throw new Error("Co-storability relationship not found");

    await db.delete(coStorability).where(eq(coStorability.id, record.id));

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "coStorability.delete",
      entityType: "coStorability",
      entityId: record.id,
      beforeState: record,
      afterState: null,
    });
  },

  async getCoStorableItems({
    orgId,
    itemId,
  }: {
    orgId: string;
    itemId: string;
  }) {
    const records = await db
      .select()
      .from(coStorability)
      .where(
        and(
          additiveOrgFilter(coStorability.ownerOrgId, orgId),
          or(
            eq(coStorability.itemAId, itemId),
            eq(coStorability.itemBId, itemId),
          ),
        ),
      );

    // Collect the IDs of the co-storable items (the "other" side)
    const coStorableIds = records.map((r) =>
      r.itemAId === itemId ? r.itemBId : r.itemAId,
    );

    if (coStorableIds.length === 0) return [];

    // Fetch all co-storable items (scoped).
    const results = await Promise.all(
      coStorableIds.map((id) => itemRepository.findById({ orgId, id })),
    );

    return results.filter((item) => item !== null);
  },

  // --- Category management ---

  async addCategory({
    orgId,
    itemId,
    categoryId,
    isPrimary,
  }: {
    orgId: string;
    itemId: string;
    categoryId: string;
    isPrimary?: boolean;
  }) {
    const item = await itemRepository.findById({ orgId, id: itemId });
    if (!item) throw new Error(`Item ${itemId} not found`);

    // If setting as primary, unset any existing primary (within scope).
    if (isPrimary) {
      await db
        .update(itemCategories)
        .set({ isPrimary: false })
        .where(
          and(
            additiveOrgFilter(itemCategories.ownerOrgId, orgId),
            eq(itemCategories.itemId, itemId),
            eq(itemCategories.isPrimary, true),
          ),
        );
    }

    // Junction inherits the parent item's scope.
    const [ic] = await db
      .insert(itemCategories)
      .values({
        ownerOrgId: item.ownerOrgId,
        itemId,
        categoryId,
        isPrimary: isPrimary ?? false,
      })
      .returning();

    return ic;
  },

  async removeCategory({
    orgId,
    itemId,
    categoryId,
  }: {
    orgId: string;
    itemId: string;
    categoryId: string;
  }) {
    const [deleted] = await db
      .delete(itemCategories)
      .where(
        and(
          additiveOrgFilter(itemCategories.ownerOrgId, orgId),
          eq(itemCategories.itemId, itemId),
          eq(itemCategories.categoryId, categoryId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new Error(`Category ${categoryId} not on item ${itemId}`);
    }
  },

  async setPrimaryCategory({
    orgId,
    itemId,
    categoryId,
  }: {
    orgId: string;
    itemId: string;
    categoryId: string;
  }) {
    const scope = additiveOrgFilter(itemCategories.ownerOrgId, orgId);

    // Unset all primaries for this item
    await db
      .update(itemCategories)
      .set({ isPrimary: false })
      .where(and(scope, eq(itemCategories.itemId, itemId)));

    // Set the specified one as primary
    const [updated] = await db
      .update(itemCategories)
      .set({ isPrimary: true })
      .where(
        and(
          scope,
          eq(itemCategories.itemId, itemId),
          eq(itemCategories.categoryId, categoryId),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(`Category ${categoryId} not on item ${itemId}`);
    }

    return updated;
  },

  async getCategories({ orgId, itemId }: { orgId: string; itemId: string }) {
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
      .where(
        and(
          additiveOrgFilter(itemCategories.ownerOrgId, orgId),
          eq(itemCategories.itemId, itemId),
        ),
      );
  },

  // --- Aspect management ---

  async applyAspect({
    orgId,
    itemId,
    aspectId,
  }: {
    orgId: string;
    itemId: string;
    aspectId: string;
  }) {
    const item = await itemRepository.findById({ orgId, id: itemId });
    if (!item) throw new Error(`Item ${itemId} not found`);

    const junctionOwner = item.ownerOrgId;

    // Create the item-aspect link (inherits item scope).
    const [ia] = await db
      .insert(itemAspects)
      .values({ ownerOrgId: junctionOwner, itemId, aspectId })
      .returning();

    // Get the aspect's parameter definitions (additive) and create value slots
    const aspectParams = await db
      .select()
      .from(aspectParameters)
      .where(
        and(
          additiveOrgFilter(aspectParameters.ownerOrgId, orgId),
          eq(aspectParameters.aspectId, aspectId),
        ),
      );

    for (const ap of aspectParams) {
      // Get the parameter definition for its global default.
      const [pd] = await db
        .select()
        .from(parameterDefinitions)
        .where(
          and(
            additiveOrgFilter(parameterDefinitions.ownerOrgId, orgId),
            eq(parameterDefinitions.id, ap.parameterDefinitionId),
          ),
        );

      // Aspect-level default wins over parameter-level default
      const defaultVal = ap.defaultValue ?? pd?.defaultValue ?? null;

      await db.insert(itemParameterValues).values({
        ownerOrgId: junctionOwner,
        itemId,
        parameterDefinitionId: ap.parameterDefinitionId,
        itemAspectId: ia.id,
        value: defaultVal,
      });
    }

    return ia;
  },

  async removeAspect({
    orgId,
    itemId,
    aspectId,
  }: {
    orgId: string;
    itemId: string;
    aspectId: string;
  }) {
    // cascade deletes item_parameter_values linked to this item_aspect
    const [deleted] = await db
      .delete(itemAspects)
      .where(
        and(
          additiveOrgFilter(itemAspects.ownerOrgId, orgId),
          eq(itemAspects.itemId, itemId),
          eq(itemAspects.aspectId, aspectId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new Error(`Aspect ${aspectId} not applied to item ${itemId}`);
    }
  },

  async getAspects({ orgId, itemId }: { orgId: string; itemId: string }) {
    const rows = await db
      .select()
      .from(itemAspects)
      .where(
        and(
          additiveOrgFilter(itemAspects.ownerOrgId, orgId),
          eq(itemAspects.itemId, itemId),
        ),
      );
    return rows;
  },

  // --- Parameter value management ---

  async setParameterValue({
    orgId,
    itemId,
    parameterDefinitionId,
    itemAspectId,
    value,
  }: {
    orgId: string;
    itemId: string;
    parameterDefinitionId: string;
    itemAspectId?: string | null;
    value: unknown;
  }) {
    // Parent item determines junction scope on insert.
    const parent = await itemRepository.findById({ orgId, id: itemId });
    if (!parent) throw new Error(`Item ${itemId} not found`);

    // Try to update existing
    const existing = await db
      .select()
      .from(itemParameterValues)
      .where(
        and(
          additiveOrgFilter(itemParameterValues.ownerOrgId, orgId),
          eq(itemParameterValues.itemId, itemId),
          eq(
            itemParameterValues.parameterDefinitionId,
            parameterDefinitionId,
          ),
          itemAspectId
            ? eq(itemParameterValues.itemAspectId, itemAspectId)
            : undefined,
        ),
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(itemParameterValues)
        .set({ value, updatedAt: new Date() })
        .where(eq(itemParameterValues.id, existing[0].id))
        .returning();
      return updated;
    }

    // Create new (standalone parameter or ad-hoc); inherits item scope.
    const [created] = await db
      .insert(itemParameterValues)
      .values({
        ownerOrgId: parent.ownerOrgId,
        itemId,
        parameterDefinitionId,
        itemAspectId: itemAspectId ?? null,
        value,
      })
      .returning();

    return created;
  },

  async getParameterValues({
    orgId,
    itemId,
  }: {
    orgId: string;
    itemId: string;
  }) {
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
          parameterDefinitions.id,
        ),
      )
      .where(
        and(
          additiveOrgFilter(itemParameterValues.ownerOrgId, orgId),
          eq(itemParameterValues.itemId, itemId),
        ),
      );
  },
};
