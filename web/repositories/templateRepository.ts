import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/connection";
import {
  templates,
  templateVersions,
  templateVersionInterfacesProvided,
  templateVersionInterfacesAccepted,
  interfaceTypes,
  inserts,
  locations,
} from "@/db/schema";
import { additiveOrgFilter } from "@/lib/auth/scope";
import { transactionRepository } from "./transactionRepository";

// templates is an additive table. Reads union (global ∪ org).
// Writes default to org-private. Pass `asGlobal: true` to contribute
// to the global catalog (per the global-catalog-edit policy: any
// signed-in user may create or edit globals; audited in transactions).
export const templateRepository = {
  async create({
    userId,
    orgId,
    asGlobal,
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
    rowLabelScheme,
    columnLabelScheme,
    originPosition,
    rowDividersFixed,
    columnDividersFixed,
    interfacesProvidedIds,
    interfacesAcceptedIds,
    subdivisionOptions,
    physicalConstraints,
  }: {
    userId: string;
    orgId: string;
    asGlobal?: boolean;
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
    rowLabelScheme?: string;
    columnLabelScheme?: string;
    originPosition?: string;
    rowDividersFixed?: boolean;
    columnDividersFixed?: boolean;
    /** UUIDs of interface_types this template version provides. */
    interfacesProvidedIds?: string[];
    /** UUIDs of interface_types this template version accepts. */
    interfacesAcceptedIds?: string[];
    subdivisionOptions?: Record<string, unknown> | null;
    physicalConstraints?: Record<string, unknown> | null;
  }) {
    const ownerOrgId = asGlobal ? null : orgId;

    const { template, version } = await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(templates)
        .values({
          ownerOrgId,
          name,
          description,
          metadata,
          scope: scope ?? "shared",
          currentVersion: 1,
          activeVersion: 1,
        })
        .returning();

      const [v] = await tx
        .insert(templateVersions)
        .values({
          ownerOrgId,
          templateId: t.id,
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
          rowLabelScheme: rowLabelScheme ?? "alpha",
          columnLabelScheme: columnLabelScheme ?? "numeric",
          originPosition: originPosition ?? "top-left",
          primaryAxis: "row",
          rowDividersFixed: rowDividersFixed ?? false,
          columnDividersFixed: columnDividersFixed ?? false,
          subdivisionOptions: subdivisionOptions ?? null,
          physicalConstraints: physicalConstraints ?? null,
        })
        .returning();

      if (interfacesProvidedIds?.length) {
        await tx.insert(templateVersionInterfacesProvided).values(
          interfacesProvidedIds.map((interfaceTypeId) => ({
            ownerOrgId,
            templateVersionId: v.id,
            interfaceTypeId,
          })),
        );
      }
      if (interfacesAcceptedIds?.length) {
        await tx.insert(templateVersionInterfacesAccepted).values(
          interfacesAcceptedIds.map((interfaceTypeId) => ({
            ownerOrgId,
            templateVersionId: v.id,
            interfaceTypeId,
          })),
        );
      }

      return { template: t, version: v };
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "template.create",
      entityType: "template",
      entityId: template.id,
      beforeState: null,
      afterState: { template, version },
    });

    return template;
  },

  async findById({ orgId, id }: { orgId: string; id: string }) {
    const [template] = await db
      .select()
      .from(templates)
      .where(and(additiveOrgFilter(templates.ownerOrgId, orgId), eq(templates.id, id)));
    return template ?? null;
  },

  async findByName({ orgId, name }: { orgId: string; name: string }) {
    const [template] = await db
      .select()
      .from(templates)
      .where(and(additiveOrgFilter(templates.ownerOrgId, orgId), eq(templates.name, name)));
    return template ?? null;
  },

  async list({
    orgId,
    includeHidden = false,
  }: {
    orgId: string;
    includeHidden?: boolean;
  }) {
    const scope = additiveOrgFilter(templates.ownerOrgId, orgId);
    if (includeHidden) {
      return db.select().from(templates).where(scope);
    }
    return db
      .select()
      .from(templates)
      .where(and(scope, eq(templates.isHidden, false)));
  },

  async listWithCurrentVersion({
    orgId,
    includeHidden = false,
  }: {
    orgId: string;
    includeHidden?: boolean;
  }) {
    const scope = additiveOrgFilter(templates.ownerOrgId, orgId);
    const allTemplates = includeHidden
      ? await db.select().from(templates).where(scope)
      : await db
          .select()
          .from(templates)
          .where(and(scope, eq(templates.isHidden, false)));
    if (allTemplates.length === 0) return [];

    const allVersions = await db
      .select()
      .from(templateVersions)
      .where(additiveOrgFilter(templateVersions.ownerOrgId, orgId));
    const versionMap = new Map<string, typeof allVersions>();
    for (const v of allVersions) {
      const list = versionMap.get(v.templateId) ?? [];
      list.push(v);
      versionMap.set(v.templateId, list);
    }

    const currentVersionIds = allTemplates
      .map((t) => versionMap.get(t.id)?.find((v) => v.version === t.currentVersion)?.id)
      .filter((x): x is string => !!x);
    const providedByVersion = new Map<
      string,
      Array<{ id: string; identifier: string }>
    >();
    const acceptedByVersion = new Map<
      string,
      Array<{ id: string; identifier: string }>
    >();
    if (currentVersionIds.length > 0) {
      const providedRows = await db
        .select({
          versionId: templateVersionInterfacesProvided.templateVersionId,
          id: interfaceTypes.id,
          identifier: interfaceTypes.identifier,
        })
        .from(templateVersionInterfacesProvided)
        .innerJoin(
          interfaceTypes,
          eq(
            templateVersionInterfacesProvided.interfaceTypeId,
            interfaceTypes.id,
          ),
        )
        .where(
          and(
            additiveOrgFilter(
              templateVersionInterfacesProvided.ownerOrgId,
              orgId,
            ),
            inArray(
              templateVersionInterfacesProvided.templateVersionId,
              currentVersionIds,
            ),
          ),
        );
      for (const r of providedRows) {
        const list = providedByVersion.get(r.versionId) ?? [];
        list.push({ id: r.id, identifier: r.identifier });
        providedByVersion.set(r.versionId, list);
      }
      const acceptedRows = await db
        .select({
          versionId: templateVersionInterfacesAccepted.templateVersionId,
          id: interfaceTypes.id,
          identifier: interfaceTypes.identifier,
        })
        .from(templateVersionInterfacesAccepted)
        .innerJoin(
          interfaceTypes,
          eq(
            templateVersionInterfacesAccepted.interfaceTypeId,
            interfaceTypes.id,
          ),
        )
        .where(
          and(
            additiveOrgFilter(
              templateVersionInterfacesAccepted.ownerOrgId,
              orgId,
            ),
            inArray(
              templateVersionInterfacesAccepted.templateVersionId,
              currentVersionIds,
            ),
          ),
        );
      for (const r of acceptedRows) {
        const list = acceptedByVersion.get(r.versionId) ?? [];
        list.push({ id: r.id, identifier: r.identifier });
        acceptedByVersion.set(r.versionId, list);
      }
    }

    return allTemplates.map((t) => {
      const versions = versionMap.get(t.id) ?? [];
      const currentVer = versions.find((v) => v.version === t.currentVersion);
      return {
        ...t,
        currentVersionData: currentVer
          ? {
              ...currentVer,
              interfacesProvided: providedByVersion.get(currentVer.id) ?? [],
              interfacesAccepted: acceptedByVersion.get(currentVer.id) ?? [],
            }
          : null,
      };
    });
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
    const before = await templateRepository.findById({ orgId, id });
    if (!before) throw new Error(`Template ${id} not found`);

    const [updated] = await db
      .update(templates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(additiveOrgFilter(templates.ownerOrgId, orgId), eq(templates.id, id)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "template.update",
      entityType: "template",
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
    const before = await templateRepository.findById({ orgId, id });
    if (!before) throw new Error(`Template ${id} not found`);

    await db.transaction(async (tx) => {
      await tx
        .delete(templateVersions)
        .where(eq(templateVersions.templateId, id));
      await tx
        .delete(templates)
        .where(
          and(additiveOrgFilter(templates.ownerOrgId, orgId), eq(templates.id, id)),
        );
    });

    await transactionRepository.log({
      userId,
      orgId,
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
  async getReferenceCount({ orgId, id }: { orgId: string; id: string }) {
    const versions = await db
      .select({ id: templateVersions.id })
      .from(templateVersions)
      .where(
        and(
          additiveOrgFilter(templateVersions.ownerOrgId, orgId),
          eq(templateVersions.templateId, id),
        ),
      );
    const versionIds = versions.map((v) => v.id);

    if (versionIds.length === 0) {
      return { insertCount: 0, locationCount: 0 };
    }

    // inserts + locations are isolated tables — count within this org only.
    const [insertRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(inserts)
      .where(
        and(
          eq(inserts.ownerOrgId, orgId),
          inArray(inserts.templateVersionId, versionIds),
        ),
      );

    const [locationRow] = await db
      .select({ c: sql<number>`COUNT(*)` })
      .from(locations)
      .where(
        and(
          eq(locations.ownerOrgId, orgId),
          inArray(locations.templateVersionId, versionIds),
        ),
      );

    return {
      insertCount: Number(insertRow?.c ?? 0),
      locationCount: Number(locationRow?.c ?? 0),
    };
  },

  async hide({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await templateRepository.findById({ orgId, id });
    if (!before) throw new Error(`Template ${id} not found`);

    const [updated] = await db
      .update(templates)
      .set({ isHidden: true, updatedAt: new Date() })
      .where(and(additiveOrgFilter(templates.ownerOrgId, orgId), eq(templates.id, id)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "template.hide",
      entityType: "template",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async unhide({
    userId,
    orgId,
    id,
  }: {
    userId: string;
    orgId: string;
    id: string;
  }) {
    const before = await templateRepository.findById({ orgId, id });
    if (!before) throw new Error(`Template ${id} not found`);

    const [updated] = await db
      .update(templates)
      .set({ isHidden: false, updatedAt: new Date() })
      .where(and(additiveOrgFilter(templates.ownerOrgId, orgId), eq(templates.id, id)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "template.unhide",
      entityType: "template",
      entityId: id,
      beforeState: before,
      afterState: updated,
    });

    return updated;
  },

  async publishVersion({
    userId,
    orgId,
    templateId,
    isParametric,
    rows,
    columns,
    minRows,
    maxRows,
    minColumns,
    maxColumns,
    rowLabelScheme,
    columnLabelScheme,
    originPosition,
    rowDividersFixed,
    columnDividersFixed,
    interfacesProvidedIds,
    interfacesAcceptedIds,
    subdivisionOptions,
    physicalConstraints,
  }: {
    userId: string;
    orgId: string;
    templateId: string;
    isParametric?: boolean;
    rows?: number | null;
    columns?: number | null;
    minRows?: number | null;
    maxRows?: number | null;
    minColumns?: number | null;
    maxColumns?: number | null;
    rowLabelScheme?: string;
    columnLabelScheme?: string;
    originPosition?: string;
    rowDividersFixed?: boolean;
    columnDividersFixed?: boolean;
    interfacesProvidedIds?: string[];
    interfacesAcceptedIds?: string[];
    subdivisionOptions?: Record<string, unknown> | null;
    physicalConstraints?: Record<string, unknown> | null;
  }) {
    const template = await templateRepository.findById({
      orgId,
      id: templateId,
    });
    if (!template) throw new Error(`Template ${templateId} not found`);

    const newVersionNumber = template.currentVersion + 1;
    // New version inherits the parent template's scope (global or org).
    const versionOwnerOrgId = template.ownerOrgId;

    const { version, updatedTemplate } = await db.transaction(async (tx) => {
      const [v] = await tx
        .insert(templateVersions)
        .values({
          ownerOrgId: versionOwnerOrgId,
          templateId,
          version: newVersionNumber,
          isParametric: isParametric ?? false,
          rows: rows ?? null,
          columns: columns ?? null,
          minRows: minRows ?? null,
          maxRows: maxRows ?? null,
          minColumns: minColumns ?? null,
          maxColumns: maxColumns ?? null,
          rowLabelScheme: rowLabelScheme ?? "alpha",
          columnLabelScheme: columnLabelScheme ?? "numeric",
          originPosition: originPosition ?? "top-left",
          primaryAxis: "row",
          rowDividersFixed: rowDividersFixed ?? false,
          columnDividersFixed: columnDividersFixed ?? false,
          subdivisionOptions: subdivisionOptions ?? null,
          physicalConstraints: physicalConstraints ?? null,
        })
        .returning();

      if (interfacesProvidedIds?.length) {
        await tx.insert(templateVersionInterfacesProvided).values(
          interfacesProvidedIds.map((interfaceTypeId) => ({
            ownerOrgId: versionOwnerOrgId,
            templateVersionId: v.id,
            interfaceTypeId,
          })),
        );
      }
      if (interfacesAcceptedIds?.length) {
        await tx.insert(templateVersionInterfacesAccepted).values(
          interfacesAcceptedIds.map((interfaceTypeId) => ({
            ownerOrgId: versionOwnerOrgId,
            templateVersionId: v.id,
            interfaceTypeId,
          })),
        );
      }

      const [t] = await tx
        .update(templates)
        .set({ currentVersion: newVersionNumber, updatedAt: new Date() })
        .where(eq(templates.id, templateId))
        .returning();

      return { version: v, updatedTemplate: t };
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "template.publishVersion",
      entityType: "templateVersion",
      entityId: version.id,
      beforeState: { template, previousVersion: template.currentVersion },
      afterState: { template: updatedTemplate, version },
    });

    return version;
  },

  /**
   * Read interfaces declared on a specific template version.
   * Returns full interface_types rows so callers can render chips / labels.
   */
  async getVersionInterfaces({
    orgId,
    versionId,
  }: {
    orgId: string;
    versionId: string;
  }) {
    const provided = await db
      .select({
        id: interfaceTypes.id,
        identifier: interfaceTypes.identifier,
        description: interfaceTypes.description,
        maturity: interfaceTypes.maturity,
        archivedAt: interfaceTypes.archivedAt,
        unitSystem: interfaceTypes.unitSystem,
      })
      .from(templateVersionInterfacesProvided)
      .innerJoin(
        interfaceTypes,
        eq(templateVersionInterfacesProvided.interfaceTypeId, interfaceTypes.id),
      )
      .where(
        and(
          additiveOrgFilter(
            templateVersionInterfacesProvided.ownerOrgId,
            orgId,
          ),
          eq(templateVersionInterfacesProvided.templateVersionId, versionId),
        ),
      );

    const accepted = await db
      .select({
        id: interfaceTypes.id,
        identifier: interfaceTypes.identifier,
        description: interfaceTypes.description,
        maturity: interfaceTypes.maturity,
        archivedAt: interfaceTypes.archivedAt,
        unitSystem: interfaceTypes.unitSystem,
      })
      .from(templateVersionInterfacesAccepted)
      .innerJoin(
        interfaceTypes,
        eq(templateVersionInterfacesAccepted.interfaceTypeId, interfaceTypes.id),
      )
      .where(
        and(
          additiveOrgFilter(
            templateVersionInterfacesAccepted.ownerOrgId,
            orgId,
          ),
          eq(templateVersionInterfacesAccepted.templateVersionId, versionId),
        ),
      );

    return { provided, accepted };
  },

  /**
   * Replace the set of provided/accepted interfaces on a template version.
   * Idempotent. Either list can be omitted to leave that side untouched.
   */
  async setVersionInterfaces({
    userId,
    orgId,
    versionId,
    providedIds,
    acceptedIds,
  }: {
    userId: string;
    orgId: string;
    versionId: string;
    providedIds?: string[];
    acceptedIds?: string[];
  }) {
    // Resolve parent version's scope so new junction rows match.
    const [parentVersion] = await db
      .select({ ownerOrgId: templateVersions.ownerOrgId })
      .from(templateVersions)
      .where(
        and(
          additiveOrgFilter(templateVersions.ownerOrgId, orgId),
          eq(templateVersions.id, versionId),
        ),
      );
    if (!parentVersion) throw new Error(`TemplateVersion ${versionId} not found`);
    const junctionOwner = parentVersion.ownerOrgId;

    await db.transaction(async (tx) => {
      if (providedIds !== undefined) {
        await tx
          .delete(templateVersionInterfacesProvided)
          .where(eq(templateVersionInterfacesProvided.templateVersionId, versionId));
        if (providedIds.length > 0) {
          await tx.insert(templateVersionInterfacesProvided).values(
            providedIds.map((interfaceTypeId) => ({
              ownerOrgId: junctionOwner,
              templateVersionId: versionId,
              interfaceTypeId,
            })),
          );
        }
      }
      if (acceptedIds !== undefined) {
        await tx
          .delete(templateVersionInterfacesAccepted)
          .where(eq(templateVersionInterfacesAccepted.templateVersionId, versionId));
        if (acceptedIds.length > 0) {
          await tx.insert(templateVersionInterfacesAccepted).values(
            acceptedIds.map((interfaceTypeId) => ({
              ownerOrgId: junctionOwner,
              templateVersionId: versionId,
              interfaceTypeId,
            })),
          );
        }
      }
    });

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "templateVersion.setInterfaces",
      entityType: "templateVersion",
      entityId: versionId,
      beforeState: null,
      afterState: { providedIds, acceptedIds },
    });
  },

  async getVersion({
    orgId,
    templateId,
    version,
  }: {
    orgId: string;
    templateId: string;
    version: number;
  }) {
    const [v] = await db
      .select()
      .from(templateVersions)
      .where(
        and(
          additiveOrgFilter(templateVersions.ownerOrgId, orgId),
          eq(templateVersions.templateId, templateId),
          eq(templateVersions.version, version),
        ),
      );
    return v ?? null;
  },

  async listVersions({
    orgId,
    templateId,
  }: {
    orgId: string;
    templateId: string;
  }) {
    return db
      .select()
      .from(templateVersions)
      .where(
        and(
          additiveOrgFilter(templateVersions.ownerOrgId, orgId),
          eq(templateVersions.templateId, templateId),
        ),
      );
  },

  async setActiveVersion({
    userId,
    orgId,
    templateId,
    version,
  }: {
    userId: string;
    orgId: string;
    templateId: string;
    version: number;
  }) {
    const template = await templateRepository.findById({ orgId, id: templateId });
    if (!template) throw new Error(`Template ${templateId} not found`);

    const versionRecord = await templateRepository.getVersion({
      orgId,
      templateId,
      version,
    });
    if (!versionRecord)
      throw new Error(`Version ${version} not found for template ${templateId}`);

    const [updated] = await db
      .update(templates)
      .set({ activeVersion: version, updatedAt: new Date() })
      .where(and(additiveOrgFilter(templates.ownerOrgId, orgId), eq(templates.id, templateId)))
      .returning();

    await transactionRepository.log({
      userId,
      orgId,
      actionType: "template.setActiveVersion",
      entityType: "template",
      entityId: templateId,
      beforeState: { activeVersion: template.activeVersion },
      afterState: { activeVersion: version },
    });

    return updated;
  },
};
