import { eq, and, or } from "drizzle-orm";
import { db } from "@/db/connection";
import { assignments, coStorability } from "@/db/schema";
import { isolatedOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";

// assignments is an isolated table. Every method is org-scoped.
// Co-storability is additive (global catalog entries visible to every
// org), but when we look up co-storability we key by item IDs only —
// the lookup doesn't need an org filter because any org that can see
// both items should benefit from a global pairing.
async function checkPlacedCoStorability({
  orgId,
  locationId,
  itemId,
}: {
  orgId: string;
  locationId: string;
  itemId: string;
}) {
  // Find existing placed assignments at this location (scoped to org).
  const existing = await db
    .select()
    .from(assignments)
    .where(
      and(
        isolatedOrgFilter(assignments.ownerOrgId, orgId),
        eq(assignments.locationId, locationId),
        eq(assignments.assignmentType, "placed"),
      ),
    );

  if (existing.length === 0) return;

  // Check co-storability with each existing placed item
  for (const existingAssignment of existing) {
    const existingItemId = existingAssignment.itemId;

    const [coStorable] = await db
      .select()
      .from(coStorability)
      .where(
        or(
          and(
            eq(coStorability.itemAId, existingItemId),
            eq(coStorability.itemBId, itemId),
          ),
          and(
            eq(coStorability.itemAId, itemId),
            eq(coStorability.itemBId, existingItemId),
          ),
        ),
      );

    if (!coStorable) {
      throw new Error(
        "Location already has a placed assignment and items are not co-storable",
      );
    }
  }
}

export const assignmentRepository = {
  async create({
    userId,
    orgId,
    itemId,
    locationId,
    assignmentType,
    metadata,
  }: {
    userId: string;
    orgId: string;
    itemId: string;
    locationId: string;
    assignmentType: "placed" | "provisional";
    metadata?: Record<string, unknown>;
  }) {
    if (assignmentType === "placed") {
      await checkPlacedCoStorability({ orgId, locationId, itemId });
    }

    const [assignment] = await db
      .insert(assignments)
      .values({
        ownerOrgId: orgId,
        itemId,
        locationId,
        assignmentType,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "assignment.create",
      entityType: "assignment",
      entityId: assignment.id,
      beforeState: null,
      afterState: assignment,
    });

    return assignment;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.id, id),
        ),
      );
    return assignment ?? null;
  },

  async findByItemId({ orgId, itemId }: { orgId: string; itemId: string }) {
    return db
      .select()
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.itemId, itemId),
        ),
      );
  },

  async findByLocationId({
    orgId,
    locationId,
  }: {
    orgId: string;
    locationId: string;
  }) {
    return db
      .select()
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.locationId, locationId),
        ),
      );
  },

  async convertToPlaced({
    userId,
    orgId,
    id,
    locationId,
  }: {
    userId: string;
    orgId: string;
    id: string;
    locationId: string;
  }) {
    const before = await assignmentRepository.findById({ orgId, id });
    if (!before) throw new Error(`Assignment ${id} not found`);

    await checkPlacedCoStorability({ orgId, locationId, itemId: before.itemId });

    const [updated] = await db
      .update(assignments)
      .set({
        assignmentType: "placed",
        locationId,
        updatedAt: new Date(),
      })
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.id, id),
        ),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "assignment.convertToPlaced",
      entityType: "assignment",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async move({
    userId,
    orgId,
    id,
    newLocationId,
  }: {
    userId: string;
    orgId: string;
    id: string;
    newLocationId: string;
  }) {
    const before = await assignmentRepository.findById({ orgId, id });
    if (!before) throw new Error(`Assignment ${id} not found`);

    await checkPlacedCoStorability({
      orgId,
      locationId: newLocationId,
      itemId: before.itemId,
    });

    const [updated] = await db
      .update(assignments)
      .set({
        locationId: newLocationId,
        updatedAt: new Date(),
      })
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.id, id),
        ),
      )
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "assignment.move",
      entityType: "assignment",
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
    const before = await assignmentRepository.findById({ orgId, id });
    if (!before) throw new Error(`Assignment ${id} not found`);

    await db
      .delete(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.id, id),
        ),
      );

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "assignment.delete",
      entityType: "assignment",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async listProvisional({ orgId }: { orgId: string }) {
    return db
      .select()
      .from(assignments)
      .where(
        and(
          isolatedOrgFilter(assignments.ownerOrgId, orgId),
          eq(assignments.assignmentType, "provisional"),
        ),
      );
  },
};
