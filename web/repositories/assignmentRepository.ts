import { eq, and, or } from "drizzle-orm";
import { db } from "@/db/connection";
import { assignments, coStorability } from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

async function checkPlacedCoStorability({
  locationId,
  itemId,
}: {
  locationId: string;
  itemId: string;
}) {
  // Find existing placed assignments at this location
  const existing = await db
    .select()
    .from(assignments)
    .where(
      and(
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
    itemId,
    locationId,
    assignmentType,
    metadata,
  }: {
    itemId: string;
    locationId: string;
    assignmentType: "placed" | "provisional";
    metadata?: Record<string, unknown>;
  }) {
    if (assignmentType === "placed") {
      await checkPlacedCoStorability({ locationId, itemId });
    }

    const [assignment] = await db
      .insert(assignments)
      .values({
        itemId,
        locationId,
        assignmentType,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      actionType: "assignment.create",
      entityType: "assignment",
      entityId: assignment.id,
      beforeState: null,
      afterState: assignment,
    });

    return assignment;
  },

  async findById({ id }: { id: string }) {
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, id));
    return assignment ?? null;
  },

  async findByItemId({ itemId }: { itemId: string }) {
    return db
      .select()
      .from(assignments)
      .where(eq(assignments.itemId, itemId));
  },

  async findByLocationId({ locationId }: { locationId: string }) {
    return db
      .select()
      .from(assignments)
      .where(eq(assignments.locationId, locationId));
  },

  async convertToPlaced({
    id,
    locationId,
  }: {
    id: string;
    locationId: string;
  }) {
    const before = await assignmentRepository.findById({ id });
    if (!before) throw new Error(`Assignment ${id} not found`);

    await checkPlacedCoStorability({ locationId, itemId: before.itemId });

    const [updated] = await db
      .update(assignments)
      .set({
        assignmentType: "placed",
        locationId,
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "assignment.convertToPlaced",
      entityType: "assignment",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async move({ id, newLocationId }: { id: string; newLocationId: string }) {
    const before = await assignmentRepository.findById({ id });
    if (!before) throw new Error(`Assignment ${id} not found`);

    await checkPlacedCoStorability({
      locationId: newLocationId,
      itemId: before.itemId,
    });

    const [updated] = await db
      .update(assignments)
      .set({
        locationId: newLocationId,
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "assignment.move",
      entityType: "assignment",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await assignmentRepository.findById({ id });
    if (!before) throw new Error(`Assignment ${id} not found`);

    await db.delete(assignments).where(eq(assignments.id, id));

    await transactionRepository.log({
      actionType: "assignment.delete",
      entityType: "assignment",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  async listProvisional() {
    return db
      .select()
      .from(assignments)
      .where(eq(assignments.assignmentType, "provisional"));
  },
};
