import { eq, or, and, ilike } from "drizzle-orm";
import { db } from "@/db/connection";
import { items, coStorability } from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const itemRepository = {
  async create({
    name,
    description,
    parameters,
    metadata,
  }: {
    name: string;
    description?: string;
    parameters?: { key: string; value: string; unit?: string }[];
    metadata?: Record<string, unknown>;
  }) {
    const [item] = await db
      .insert(items)
      .values({
        name,
        description,
        parameters,
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
    parameters?: { key: string; value: string; unit?: string }[];
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
};
