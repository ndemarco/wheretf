import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  templates,
  templateVersions,
  inserts,
  locations,
} from "@/db/schema";
import { transactionRepository } from "./transactionRepository";

export const templateRepository = {
  async create({
    name,
    description,
    metadata,
    scope,
    rows,
    columns,
    isParametric,
    isContinuous,
    widthMm,
    heightMm,
    depthMm,
    rowPitchMm,
    overflowDirection,
    bufferMm,
    unitSystem,
    minRows,
    maxRows,
    minColumns,
    maxColumns,
    unitSize,
    rowLabelScheme,
    columnLabelScheme,
    originPosition,
    rowDividersFixed,
    columnDividersFixed,
    interfaceTypeProvided,
    interfaceTypeAccepted,
    subdivisionOptions,
    physicalConstraints,
  }: {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
    scope?: "shared" | "single_instance";
    rows?: number;
    columns?: number;
    isParametric?: boolean;
    isContinuous?: boolean;
    widthMm?: number | null;
    heightMm?: number | null;
    depthMm?: number | null;
    rowPitchMm?: number | null;
    overflowDirection?: "up" | "down" | null;
    bufferMm?: number | null;
    unitSystem?: "metric" | "imperial";
    minRows?: number | null;
    maxRows?: number | null;
    minColumns?: number | null;
    maxColumns?: number | null;
    unitSize?: string | null;
    rowLabelScheme?: string;
    columnLabelScheme?: string;
    originPosition?: string;
    rowDividersFixed?: boolean;
    columnDividersFixed?: boolean;
    interfaceTypeProvided?: string | null;
    interfaceTypeAccepted?: string | null;
    subdivisionOptions?: Record<string, unknown> | null;
    physicalConstraints?: Record<string, unknown> | null;
  }) {
    const [template] = await db
      .insert(templates)
      .values({
        name,
        description,
        metadata,
        scope: scope ?? "shared",
        currentVersion: 1,
        activeVersion: 1,
      })
      .returning();

    // Auto-create version 1 with provided or default values
    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId: template.id,
        version: 1,
        isParametric: isParametric ?? false,
        isContinuous: isContinuous ?? false,
        widthMm: widthMm != null ? String(widthMm) : null,
        heightMm: heightMm != null ? String(heightMm) : null,
        depthMm: depthMm != null ? String(depthMm) : null,
        rowPitchMm: rowPitchMm != null ? String(rowPitchMm) : null,
        overflowDirection: overflowDirection ?? null,
        bufferMm: bufferMm != null ? String(bufferMm) : null,
        unitSystem: unitSystem ?? "metric",
        rows: rows ?? 1,
        columns: columns ?? 1,
        minRows: minRows ?? null,
        maxRows: maxRows ?? null,
        minColumns: minColumns ?? null,
        maxColumns: maxColumns ?? null,
        unitSize: unitSize ?? null,
        rowLabelScheme: rowLabelScheme ?? "alpha",
        columnLabelScheme: columnLabelScheme ?? "numeric",
        originPosition: originPosition ?? "top-left",
        primaryAxis: "row",
        rowDividersFixed: rowDividersFixed ?? false,
        columnDividersFixed: columnDividersFixed ?? false,
        interfaceTypeProvided: interfaceTypeProvided ?? null,
        interfaceTypeAccepted: interfaceTypeAccepted ?? null,
        subdivisionOptions: subdivisionOptions ?? null,
        physicalConstraints: physicalConstraints ?? null,
      })
      .returning();

    await transactionRepository.log({
      actionType: "template.create",
      entityType: "template",
      entityId: template.id,
      beforeState: null,
      afterState: { template, version },
    });

    return template;
  },

  async findById({ id }: { id: string }) {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.id, id));
    return template ?? null;
  },

  async findByName({ name }: { name: string }) {
    const [template] = await db
      .select()
      .from(templates)
      .where(eq(templates.name, name));
    return template ?? null;
  },

  async list({ includeHidden = false }: { includeHidden?: boolean } = {}) {
    if (includeHidden) return db.select().from(templates);
    return db
      .select()
      .from(templates)
      .where(eq(templates.isHidden, false));
  },

  async listWithCurrentVersion({
    includeHidden = false,
  }: { includeHidden?: boolean } = {}) {
    const allTemplates = includeHidden
      ? await db.select().from(templates)
      : await db
          .select()
          .from(templates)
          .where(eq(templates.isHidden, false));
    if (allTemplates.length === 0) return [];

    const allVersions = await db.select().from(templateVersions);
    const versionMap = new Map<string, typeof allVersions>();
    for (const v of allVersions) {
      const list = versionMap.get(v.templateId) ?? [];
      list.push(v);
      versionMap.set(v.templateId, list);
    }

    return allTemplates.map((t) => {
      const versions = versionMap.get(t.id) ?? [];
      const currentVer = versions.find((v) => v.version === t.currentVersion);
      return {
        ...t,
        currentVersionData: currentVer ?? null,
      };
    });
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
    const before = await templateRepository.findById({ id });
    if (!before) throw new Error(`Template ${id} not found`);

    const [updated] = await db
      .update(templates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "template.update",
      entityType: "template",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async remove({ id }: { id: string }) {
    const before = await templateRepository.findById({ id });
    if (!before) throw new Error(`Template ${id} not found`);

    // Delete versions then template within a transaction to avoid deadlocks with test cleanup
    await db.transaction(async (tx) => {
      await tx
        .delete(templateVersions)
        .where(eq(templateVersions.templateId, id));
      await tx.delete(templates).where(eq(templates.id, id));
    });

    await transactionRepository.log({
      actionType: "template.delete",
      entityType: "template",
      entityId: id,
      beforeState: before,
      afterState: null,
    });
  },

  /**
   * Count inserts + locations referencing any version of this template.
   * Used to decide between hard delete and soft hide.
   */
  async getReferenceCount({ id }: { id: string }) {
    const versions = await db
      .select({ id: templateVersions.id })
      .from(templateVersions)
      .where(eq(templateVersions.templateId, id));
    const versionIds = versions.map((v) => v.id);

    if (versionIds.length === 0) {
      return { insertCount: 0, locationCount: 0 };
    }

    const [insertRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(inserts)
      .where(inArray(inserts.templateVersionId, versionIds));

    const [locationRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(locations)
      .where(inArray(locations.templateVersionId, versionIds));

    return {
      insertCount: Number(insertRow?.c ?? 0),
      locationCount: Number(locationRow?.c ?? 0),
    };
  },

  async hide({ id }: { id: string }) {
    const before = await templateRepository.findById({ id });
    if (!before) throw new Error(`Template ${id} not found`);

    const [updated] = await db
      .update(templates)
      .set({ isHidden: true, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "template.hide",
      entityType: "template",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async unhide({ id }: { id: string }) {
    const before = await templateRepository.findById({ id });
    if (!before) throw new Error(`Template ${id} not found`);

    const [updated] = await db
      .update(templates)
      .set({ isHidden: false, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();

    await transactionRepository.log({
      actionType: "template.unhide",
      entityType: "template",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async publishVersion({
    templateId,
    isParametric,
    rows,
    columns,
    minRows,
    maxRows,
    minColumns,
    maxColumns,
    unitSize,
    rowLabelScheme,
    columnLabelScheme,
    originPosition,
    rowDividersFixed,
    columnDividersFixed,
    interfaceTypeProvided,
    interfaceTypeAccepted,
    subdivisionOptions,
    physicalConstraints,
  }: {
    templateId: string;
    isParametric?: boolean;
    rows?: number | null;
    columns?: number | null;
    minRows?: number | null;
    maxRows?: number | null;
    minColumns?: number | null;
    maxColumns?: number | null;
    unitSize?: string | null;
    rowLabelScheme?: string;
    columnLabelScheme?: string;
    originPosition?: string;
    rowDividersFixed?: boolean;
    columnDividersFixed?: boolean;
    interfaceTypeProvided?: string | null;
    interfaceTypeAccepted?: string | null;
    subdivisionOptions?: Record<string, unknown> | null;
    physicalConstraints?: Record<string, unknown> | null;
  }) {
    const template = await templateRepository.findById({ id: templateId });
    if (!template) throw new Error(`Template ${templateId} not found`);

    const newVersionNumber = template.currentVersion + 1;

    const [version] = await db
      .insert(templateVersions)
      .values({
        templateId,
        version: newVersionNumber,
        isParametric: isParametric ?? false,
        rows: rows ?? null,
        columns: columns ?? null,
        minRows: minRows ?? null,
        maxRows: maxRows ?? null,
        minColumns: minColumns ?? null,
        maxColumns: maxColumns ?? null,
        unitSize: unitSize ?? null,
        rowLabelScheme: rowLabelScheme ?? "alpha",
        columnLabelScheme: columnLabelScheme ?? "numeric",
        originPosition: originPosition ?? "top-left",
        primaryAxis: "row",
        rowDividersFixed: rowDividersFixed ?? false,
        columnDividersFixed: columnDividersFixed ?? false,
        interfaceTypeProvided: interfaceTypeProvided ?? null,
        interfaceTypeAccepted: interfaceTypeAccepted ?? null,
        subdivisionOptions: subdivisionOptions ?? null,
        physicalConstraints: physicalConstraints ?? null,
      })
      .returning();

    const [updatedTemplate] = await db
      .update(templates)
      .set({ currentVersion: newVersionNumber, updatedAt: new Date() })
      .where(eq(templates.id, templateId))
      .returning();

    await transactionRepository.log({
      actionType: "template.publishVersion",
      entityType: "templateVersion",
      entityId: version.id,
      beforeState: { template, previousVersion: template.currentVersion },
      afterState: { template: updatedTemplate, version },
    });

    return version;
  },

  async getVersion({
    templateId,
    version,
  }: {
    templateId: string;
    version: number;
  }) {
    const [v] = await db
      .select()
      .from(templateVersions)
      .where(
        and(
          eq(templateVersions.templateId, templateId),
          eq(templateVersions.version, version)
        )
      );
    return v ?? null;
  },

  async listVersions({ templateId }: { templateId: string }) {
    return db
      .select()
      .from(templateVersions)
      .where(eq(templateVersions.templateId, templateId));
  },

  async setActiveVersion({
    templateId,
    version,
  }: {
    templateId: string;
    version: number;
  }) {
    const template = await templateRepository.findById({ id: templateId });
    if (!template) throw new Error(`Template ${templateId} not found`);

    const versionRecord = await templateRepository.getVersion({ templateId, version });
    if (!versionRecord) throw new Error(`Version ${version} not found for template ${templateId}`);

    const [updated] = await db
      .update(templates)
      .set({ activeVersion: version, updatedAt: new Date() })
      .where(eq(templates.id, templateId))
      .returning();

    await transactionRepository.log({
      actionType: "template.setActiveVersion",
      entityType: "template",
      entityId: templateId,
      beforeState: { activeVersion: template.activeVersion },
      afterState: { activeVersion: version },
    });

    return updated;
  },
};
