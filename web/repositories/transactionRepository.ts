import { eq, desc } from "drizzle-orm";
import { db } from "@/db/connection";
import { transactions } from "@/db/schema";

export const transactionRepository = {
  async log({
    parentId,
    actionType,
    entityType,
    entityId,
    beforeState,
    afterState,
  }: {
    parentId?: string;
    actionType: string;
    entityType: string;
    entityId: string;
    beforeState: unknown;
    afterState: unknown;
  }) {
    const [tx] = await db
      .insert(transactions)
      .values({
        parentId,
        actionType,
        entityType,
        entityId,
        beforeState,
        afterState,
      })
      .returning();

    return tx;
  },

  async findById({ id }: { id: string }) {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return tx ?? null;
  },

  async listRecent({ limit = 50 }: { limit?: number } = {}) {
    return db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  },

  async markUndone({
    id,
    undoneByTransactionId,
  }: {
    id: string;
    undoneByTransactionId: string;
  }) {
    await db
      .update(transactions)
      .set({ isUndone: true, undoneByTransactionId })
      .where(eq(transactions.id, id));
  },
};
