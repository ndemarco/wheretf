import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db/connection";
import { transactions } from "@/db/schema";
import { isolatedOrgFilter } from "@/lib/auth/scope";

// transactions is an isolated table. Every log call carries the acting
// user and their active org. Reads are strictly scoped.
//
// NOTE: `userId` and `orgId` are typed optional during the Phase C.2
// rollout so repos migrate in order without a cascading type break.
// They MUST be tightened back to required in Phase C.4 (alongside the
// NOT NULL flip on transactions.owner_org_id). Until then, a log call
// without them inserts NULL, which still satisfies the nullable column.
export const transactionRepository = {
  async log({
    userId,
    orgId,
    parentId,
    actionType,
    entityType,
    entityId,
    beforeState,
    afterState,
  }: {
    userId?: string;
    orgId?: string;
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
        ownerOrgId: orgId ?? null,
        actorUserId: userId ?? null,
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

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [tx] = await db
      .select()
      .from(transactions)
      .where(
        and(isolatedOrgFilter(transactions.ownerOrgId, orgId), eq(transactions.id, id)),
      );
    return tx ?? null;
  },

  async listRecent({ orgId, limit = 50 }: { orgId: string; limit?: number }) {
    return db
      .select()
      .from(transactions)
      .where(isolatedOrgFilter(transactions.ownerOrgId, orgId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  },

  async markUndone({
    orgId,
    id,
    undoneByTransactionId,
  }: {
    orgId: string;
    id: string;
    undoneByTransactionId: string;
  }) {
    await db
      .update(transactions)
      .set({ isUndone: true, undoneByTransactionId })
      .where(
        and(isolatedOrgFilter(transactions.ownerOrgId, orgId), eq(transactions.id, id)),
      );
  },
};
