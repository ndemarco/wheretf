import { and, eq, isNull, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  inserts,
  locations,
  templates,
  templateVersions,
  modules,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

function generateUid(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let uid = "";
  for (let i = 0; i < 8; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return uid;
}

export const insertRepository = {
  async create({
    name,
    templateId,
    templateVersionId,
    interfaceTypeProvided,
    rows,
    columns,
    overrides,
    metadata,
  }: {
    name?: string;
    templateId?: string;
    templateVersionId?: string;
    interfaceTypeProvided?: string;
    rows?: number;
    columns?: number;
    overrides?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const uid = generateUid();

    const [insert] = await db
      .insert(inserts)
      .values({
        uid,
        name,
        templateId,
        templateVersionId,
        interfaceTypeProvided,
        rows,
        columns,
        overrides,
        metadata,
      })
      .returning();

    await transactionRepository.log({
      actionType: "insert.create",
      entityType: "insert",
      entityId: insert.id,
      beforeState: null,
      afterState: insert,
    });

    return insert;
  },

  async findById({ id }: { id: string }) {
    const [insert] = await db
      .select()
      .from(inserts)
      .where(eq(inserts.id, id));
    return insert ?? null;
  },

  async findByLocationId({ locationId }: { locationId: string }) {
    const [insert] = await db
      .select()
      .from(inserts)
      .where(eq(inserts.locationId, locationId));
    return insert ?? null;
  },

  async listUnplaced() {
    return db.select().from(inserts).where(isNull(inserts.locationId));
  },

  /**
   * Rich list of inserts for the /inserts page. Joins template name,
   * current location path, and host module. Filters:
   *   - templateId: restrict to one template
   *   - interfaceType: match insert.interfaceTypeProvided OR the template's
   *     current version's interfaceTypeProvided
   *   - placement: 'placed' | 'unplaced' | 'all' (default 'all')
   */
  async listWithDetails({
    templateId,
    interfaceType,
    placement = "all",
  }: {
    templateId?: string;
    interfaceType?: string;
    placement?: "placed" | "unplaced" | "all";
  } = {}) {
    const conditions: SQL[] = [];

    if (templateId) conditions.push(eq(inserts.templateId, templateId));
    if (placement === "placed") conditions.push(isNotNull(inserts.locationId));
    if (placement === "unplaced") conditions.push(isNull(inserts.locationId));

    if (interfaceType) {
      conditions.push(
        sql`(
          ${inserts.interfaceTypeProvided} = ${interfaceType}
          OR ${templateVersions.interfaceTypeProvided} = ${interfaceType}
        )`
      );
    }

    const where = conditions.length
      ? and(...conditions)
      : undefined;

    const rows = await db
      .select({
        insert: inserts,
        templateName: templates.name,
        templateInterfaceProvided: templateVersions.interfaceTypeProvided,
        locationPath: locations.path,
        moduleName: modules.name,
      })
      .from(inserts)
      .leftJoin(templates, eq(inserts.templateId, templates.id))
      .leftJoin(
        templateVersions,
        eq(inserts.templateVersionId, templateVersions.id)
      )
      .leftJoin(locations, eq(inserts.locationId, locations.id))
      .leftJoin(modules, eq(locations.moduleId, modules.id))
      .where(where);

    return rows.map((r) => ({
      ...r.insert,
      templateName: r.templateName,
      // effective interface type: insert-override first, else template default
      interfaceType:
        r.insert.interfaceTypeProvided ?? r.templateInterfaceProvided ?? null,
      locationPath: r.locationPath,
      moduleName: r.moduleName,
    }));
  },

  async place({ id, locationId }: { id: string; locationId: string }) {
    const insert = await insertRepository.findById({ id });
    if (!insert) throw new Error(`Insert ${id} not found`);

    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.id, locationId));
    if (!location) throw new Error(`Location ${locationId} not found`);

    if (location.locationType !== "receptacle") {
      throw new Error(
        `Location ${locationId} is not a receptacle (type: ${location.locationType})`
      );
    }

    if (
      insert.interfaceTypeProvided &&
      location.interfaceTypeAccepted &&
      insert.interfaceTypeProvided !== location.interfaceTypeAccepted
    ) {
      throw new Error(
        `Interface type mismatch: insert provides "${insert.interfaceTypeProvided}" but location accepts "${location.interfaceTypeAccepted}"`
      );
    }

    const [updated] = await db
      .update(inserts)
      .set({ locationId, updatedAt: new Date() })
      .where(eq(inserts.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "insert.place",
      entityType: "insert",
      entityId: id,
      beforeState: insert,
      afterState: updated,
    });

    return updated;
  },

  async removeFromLocation({ id }: { id: string }) {
    const before = await insertRepository.findById({ id });
    if (!before) throw new Error(`Insert ${id} not found`);

    const [updated] = await db
      .update(inserts)
      .set({ locationId: null, updatedAt: new Date() })
      .where(eq(inserts.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "insert.removeFromLocation",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async update({
    id,
    ...updates
  }: {
    id: string;
    name?: string;
    templateId?: string;
    templateVersionId?: string;
    interfaceTypeProvided?: string;
    rows?: number;
    columns?: number;
    overrides?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const before = await insertRepository.findById({ id });
    if (!before) throw new Error(`Insert ${id} not found`);

    const [updated] = await db
      .update(inserts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(inserts.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "insert.update",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await insertRepository.findById({ id });
    if (!before) throw new Error(`Insert ${id} not found`);

    await db.delete(inserts).where(eq(inserts.id, id));

    await transactionRepository.log({
      actionType: "insert.delete",
      entityType: "insert",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },
};
