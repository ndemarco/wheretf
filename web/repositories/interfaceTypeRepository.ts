import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  interfaceTypes,
  templateVersionInterfacesProvided,
  templateVersionInterfacesAccepted,
  locationInterfacesAccepted,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

type Maturity = "draft" | "stable";
type ListStatus = "active" | "archived" | "all";

export const interfaceTypeRepository = {
  async create({
    identifier,
    description,
    physicalContract,
    maturity,
    unitSystem,
  }: {
    identifier: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
    maturity?: Maturity;
    unitSystem?: Record<string, unknown>;
  }) {
    const [interfaceType] = await db
      .insert(interfaceTypes)
      .values({
        identifier,
        description,
        physicalContract,
        // Default to 'stable' — matches UX spec: the save button carries
        // the draft/stable intent, form has no explicit control.
        maturity: maturity ?? "stable",
        unitSystem,
      })
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.create",
      entityType: "interfaceType",
      entityId: interfaceType.id,
      beforeState: null,
      afterState: interfaceType,
    });

    return interfaceType;
  },

  async findById({ id }: { id: string }) {
    const [interfaceType] = await db
      .select()
      .from(interfaceTypes)
      .where(eq(interfaceTypes.id, id));
    return interfaceType ?? null;
  },

  async findByIdentifier({ identifier }: { identifier: string }) {
    const [interfaceType] = await db
      .select()
      .from(interfaceTypes)
      .where(eq(interfaceTypes.identifier, identifier));
    return interfaceType ?? null;
  },

  async list({ status = "all" }: { status?: ListStatus } = {}) {
    const base = db.select().from(interfaceTypes);
    if (status === "active") {
      return base.where(isNull(interfaceTypes.archivedAt));
    }
    if (status === "archived") {
      return base.where(isNotNull(interfaceTypes.archivedAt));
    }
    return base;
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    identifier?: string;
    description?: string;
    physicalContract?: Record<string, unknown>;
    maturity?: Maturity;
    unitSystem?: Record<string, unknown> | null;
  }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    // Maturity guard — stable is terminal. Demotion creates ambiguous
    // semantics when refs already point at the type. See spec
    // "Maturity" → state machine one-directional.
    if (
      updates.maturity === "draft" &&
      before.maturity === "stable"
    ) {
      throw new Error(
        "Cannot demote stable → draft. Stable is terminal (one-way state machine).",
      );
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set(updates)
      .where(eq(interfaceTypes.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.update",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async archive({ id }: { id: string }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    if (before.archivedAt) {
      return before; // idempotent
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set({ archivedAt: new Date() })
      .where(eq(interfaceTypes.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.archive",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async unarchive({ id }: { id: string }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    if (!before.archivedAt) {
      return before; // idempotent
    }

    const [updated] = await db
      .update(interfaceTypes)
      .set({ archivedAt: null })
      .where(eq(interfaceTypes.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "interfaceType.unarchive",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async usageCount({ id }: { id: string }) {
    const [providers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(templateVersionInterfacesProvided)
      .where(eq(templateVersionInterfacesProvided.interfaceTypeId, id));

    const [accepters] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(templateVersionInterfacesAccepted)
      .where(eq(templateVersionInterfacesAccepted.interfaceTypeId, id));

    const [receptacles] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(locationInterfacesAccepted)
      .where(eq(locationInterfacesAccepted.interfaceTypeId, id));

    return {
      providers: providers?.count ?? 0,
      accepters: accepters?.count ?? 0,
      receptacles: receptacles?.count ?? 0,
    };
  },

  async remove({ id }: { id: string }) {
    const before = await interfaceTypeRepository.findById({ id });
    if (!before) throw new Error(`InterfaceType ${id} not found`);

    // Delete-gate: must be archived AND unused. Spec intent — hard
    // delete is the destructive endpoint; soft-retire is archive.
    if (!before.archivedAt) {
      throw new Error(
        `InterfaceType ${id} is not archived. Archive before deleting.`,
      );
    }

    const usage = await interfaceTypeRepository.usageCount({ id });
    const total = usage.providers + usage.accepters + usage.receptacles;
    if (total > 0) {
      throw new Error(
        `InterfaceType ${id} is in use (${total} references). Merge or unassign before deleting.`,
      );
    }

    await db.delete(interfaceTypes).where(eq(interfaceTypes.id, id));

    await transactionRepository.log({
      actionType: "interfaceType.delete",
      entityType: "interfaceType",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
