import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { transactionRepository } from "@/repositories/transactionRepository";
import { db } from "@/db/connection";
import { eq } from "drizzle-orm";
import {
  templates,
  templateVersions,
  templateVersionInterfacesProvided,
  templateVersionInterfacesAccepted,
  locations,
  locationInterfacesAccepted,
  modules,
} from "@/db/schema";
import { testCtx } from "../setup";

describe("interfaceTypeRepository", () => {
  describe("create", () => {
    it("creates an interface type and returns it", async () => {
      const it = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
        description: "Plano Stowaway 3600 series tray slot",
      });

      expect(it.id).toBeDefined();
      expect(it.identifier).toBe("plano-3600");
      expect(it.description).toBe("Plano Stowaway 3600 series tray slot");
      expect(it.createdAt).toBeInstanceOf(Date);
    });

    it("creates with physicalContract as JSON", async () => {
      const it = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
        description: "Gridfinity 42mm baseplate cell",
        physicalContract: {
          cellSize: "42mm",
          height: "7mm",
          mounting: "magnet",
        },
      });

      const found = await interfaceTypeRepository.findById({
        orgId: testCtx.orgId,
        id: it.id,
      });
      expect(found?.physicalContract).toEqual({
        cellSize: "42mm",
        height: "7mm",
        mounting: "magnet",
      });
    });

    it("creates with minimal fields", async () => {
      const it = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "custom-slot",
      });

      expect(it.identifier).toBe("custom-slot");
      expect(it.description).toBeNull();
      expect(it.physicalContract).toBeNull();
    });

    it("logs a transaction", async () => {
      const it = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });

      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("interfaceType.create");
      expect(txns[0].entityType).toBe("interfaceType");
      expect(txns[0].entityId).toBe(it.id);
      expect(txns[0].beforeState).toBeNull();
    });

    it("rejects duplicate identifiers", async () => {
      await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });

      await expect(
        interfaceTypeRepository.create({
          ...testCtx,
          identifier: "plano-3600",
        })
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("returns the interface type by ID", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
        description: "Plano slot",
      });

      const found = await interfaceTypeRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).not.toBeNull();
      expect(found!.identifier).toBe("plano-3600");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await interfaceTypeRepository.findById({
        orgId: testCtx.orgId,
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByIdentifier", () => {
    it("returns the interface type by identifier", async () => {
      await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
        description: "Gridfinity cell",
      });

      const found = await interfaceTypeRepository.findByIdentifier({
        orgId: testCtx.orgId,
        identifier: "gridfinity-42mm",
      });
      expect(found).not.toBeNull();
      expect(found!.description).toBe("Gridfinity cell");
    });

    it("returns null for nonexistent identifier", async () => {
      const found = await interfaceTypeRepository.findByIdentifier({
        orgId: testCtx.orgId,
        identifier: "does-not-exist",
      });
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all interface types", async () => {
      await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
      });

      const all = await interfaceTypeRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(2);
    });

    it("returns empty array when none exist", async () => {
      const all = await interfaceTypeRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates description and returns the updated record", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
        description: "Original",
      });

      const updated = await interfaceTypeRepository.update({
        ...testCtx,
        id: created.id,
        description: "Updated description",
      });

      expect(updated.description).toBe("Updated description");
      expect(updated.identifier).toBe("plano-3600"); // unchanged
    });

    it("updates physicalContract", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
      });

      const updated = await interfaceTypeRepository.update({
        ...testCtx,
        id: created.id,
        physicalContract: { cellSize: "42mm", depth: "50mm" },
      });

      expect(updated.physicalContract).toEqual({
        cellSize: "42mm",
        depth: "50mm",
      });
    });

    it("logs a transaction with before and after state", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });

      await interfaceTypeRepository.update({
        ...testCtx,
        id: created.id,
        description: "Updated",
      });

      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      const updateTx = txns.find(
        (t) => t.actionType === "interfaceType.update"
      );
      expect(updateTx).toBeDefined();
      expect(updateTx!.beforeState).toBeTruthy();
      expect(updateTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent interface type", async () => {
      await expect(
        interfaceTypeRepository.update({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
          description: "Nope",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes an archived, unused interface type", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await interfaceTypeRepository.archive({ ...testCtx, id: created.id });

      await interfaceTypeRepository.remove({ ...testCtx, id: created.id });

      const found = await interfaceTypeRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await interfaceTypeRepository.archive({ ...testCtx, id: created.id });

      await interfaceTypeRepository.remove({ ...testCtx, id: created.id });

      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      const deleteTx = txns.find(
        (t) => t.actionType === "interfaceType.delete"
      );
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent interface type", async () => {
      await expect(
        interfaceTypeRepository.remove({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });

    it("refuses to delete an active (non-archived) type", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await expect(
        interfaceTypeRepository.remove({ ...testCtx, id: created.id })
      ).rejects.toThrow(/archive/i);
    });

    it("refuses to delete an archived type with usage", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
      });
      const { templateVersionId } = await seedTemplateWithProvidedInterface(
        created.id
      );
      expect(templateVersionId).toBeDefined();
      await interfaceTypeRepository.archive({ ...testCtx, id: created.id });

      await expect(
        interfaceTypeRepository.remove({ ...testCtx, id: created.id })
      ).rejects.toThrow(/usage|in use/i);
    });
  });

  // ───────────── lifecycle: create defaults + maturity ─────────────
  describe("create — maturity", () => {
    it("defaults maturity to 'stable'", async () => {
      const it = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      expect(it.maturity).toBe("stable");
    });

    it("accepts maturity='draft'", async () => {
      const it = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-48mm",
        maturity: "draft",
      });
      expect(it.maturity).toBe("draft");
    });

    it("rejects invalid maturity via DB check", async () => {
      await expect(
        interfaceTypeRepository.create({
          ...testCtx,
          identifier: "weird",
          // @ts-expect-error invalid value on purpose
          maturity: "invalid",
        })
      ).rejects.toThrow();
    });

    it("persists unitSystem as JSON", async () => {
      const it = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
        unitSystem: {
          width: { label: "u", mm: 42 },
          depth: { label: "u", mm: 42 },
          height: { label: "h", mm: 7 },
        },
      });
      const found = await interfaceTypeRepository.findById({
        orgId: testCtx.orgId,
        id: it.id,
      });
      expect(found?.unitSystem).toEqual({
        width: { label: "u", mm: 42 },
        depth: { label: "u", mm: 42 },
        height: { label: "h", mm: 7 },
      });
    });
  });

  // ───────────── list with filter ─────────────
  describe("list — filter", () => {
    it("defaults to all (active + archived)", async () => {
      const a = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "a",
      });
      await interfaceTypeRepository.create({ ...testCtx, identifier: "b" });
      await interfaceTypeRepository.archive({ ...testCtx, id: a.id });

      const all = await interfaceTypeRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(2);
    });

    it("filters to active only", async () => {
      const a = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "a",
      });
      await interfaceTypeRepository.create({ ...testCtx, identifier: "b" });
      await interfaceTypeRepository.archive({ ...testCtx, id: a.id });

      const active = await interfaceTypeRepository.list({
        orgId: testCtx.orgId,
        status: "active",
      });
      expect(active).toHaveLength(1);
      expect(active[0].identifier).toBe("b");
    });

    it("filters to archived only", async () => {
      const a = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "a",
      });
      await interfaceTypeRepository.create({ ...testCtx, identifier: "b" });
      await interfaceTypeRepository.archive({ ...testCtx, id: a.id });

      const archived = await interfaceTypeRepository.list({
        orgId: testCtx.orgId,
        status: "archived",
      });
      expect(archived).toHaveLength(1);
      expect(archived[0].identifier).toBe("a");
    });
  });

  // ───────────── archive / unarchive ─────────────
  describe("archive / unarchive", () => {
    it("archive sets archivedAt", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      expect(created.archivedAt).toBeNull();

      const archived = await interfaceTypeRepository.archive({
        ...testCtx,
        id: created.id,
      });
      expect(archived.archivedAt).toBeInstanceOf(Date);
    });

    it("unarchive clears archivedAt", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await interfaceTypeRepository.archive({ ...testCtx, id: created.id });

      const restored = await interfaceTypeRepository.unarchive({
        ...testCtx,
        id: created.id,
      });
      expect(restored.archivedAt).toBeNull();
    });

    it("archive logs a transaction", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await interfaceTypeRepository.archive({ ...testCtx, id: created.id });
      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      const tx = txns.find((t) => t.actionType === "interfaceType.archive");
      expect(tx).toBeDefined();
    });

    it("unarchive logs a transaction", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await interfaceTypeRepository.archive({ ...testCtx, id: created.id });
      await interfaceTypeRepository.unarchive({ ...testCtx, id: created.id });
      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      const tx = txns.find((t) => t.actionType === "interfaceType.unarchive");
      expect(tx).toBeDefined();
    });

    it("archive is idempotent on an already-archived type", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      const first = await interfaceTypeRepository.archive({
        ...testCtx,
        id: created.id,
      });
      const again = await interfaceTypeRepository.archive({
        ...testCtx,
        id: created.id,
      });
      expect(again.archivedAt).toEqual(first.archivedAt);
    });
  });

  // ───────────── maturity guard on update ─────────────
  describe("update — maturity guard", () => {
    it("promotes draft → stable", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-48mm",
        maturity: "draft",
      });
      const updated = await interfaceTypeRepository.update({
        ...testCtx,
        id: created.id,
        maturity: "stable",
      });
      expect(updated.maturity).toBe("stable");
    });

    it("refuses to demote stable → draft", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
        maturity: "stable",
      });
      await expect(
        interfaceTypeRepository.update({
          ...testCtx,
          id: created.id,
          maturity: "draft",
        })
      ).rejects.toThrow(/demote|stable is terminal|one-way/i);
    });

    it("allows updating identifier (slug rename)", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      const updated = await interfaceTypeRepository.update({
        ...testCtx,
        id: created.id,
        identifier: "plano-3600-renamed",
      });
      expect(updated.identifier).toBe("plano-3600-renamed");
    });

    it("allows updating unitSystem", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
      });
      const updated = await interfaceTypeRepository.update({
        ...testCtx,
        id: created.id,
        unitSystem: {
          width: { label: "u", mm: 42 },
          height: { label: "h", mm: 7 },
        },
      });
      expect(updated.unitSystem).toEqual({
        width: { label: "u", mm: 42 },
        height: { label: "h", mm: 7 },
      });
    });
  });

  // ───────────── merge ─────────────
  describe("merge", () => {
    it("rewrites template-version provided junctions from source to target", async () => {
      const source = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "src-iface",
      });
      const target = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "tgt-iface",
      });
      const { templateVersionId } = await seedTemplateWithProvidedInterface(
        source.id
      );

      const result = await interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [source.id],
        targetId: target.id,
      });

      expect(result.referencesUpdated).toBe(1);
      expect(result.templateVersionsMinted).toBeGreaterThanOrEqual(1);

      const rows = await db
        .select()
        .from(templateVersionInterfacesProvided)
        .where(
          eq(templateVersionInterfacesProvided.interfaceTypeId, target.id)
        );
      expect(rows.length).toBeGreaterThan(0);
      // Original row on the old version should be gone
      const srcRows = await db
        .select()
        .from(templateVersionInterfacesProvided)
        .where(
          eq(templateVersionInterfacesProvided.templateVersionId, templateVersionId)
        );
      expect(
        srcRows.every((r) => r.interfaceTypeId !== source.id)
      ).toBe(true);
    });

    it("rewrites template-version accepted junctions from source to target", async () => {
      const source = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "src-iface",
      });
      const target = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "tgt-iface",
      });
      await seedTemplateWithAcceptedInterface(source.id);

      await interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [source.id],
        targetId: target.id,
      });

      const rows = await db
        .select()
        .from(templateVersionInterfacesAccepted)
        .where(
          eq(templateVersionInterfacesAccepted.interfaceTypeId, target.id)
        );
      expect(rows.length).toBeGreaterThan(0);
    });

    it("rewrites location junctions from source to target", async () => {
      const source = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "src-iface",
      });
      const target = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "tgt-iface",
      });
      await seedLocationAcceptingInterface(source.id);
      await seedLocationAcceptingInterface(source.id);

      await interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [source.id],
        targetId: target.id,
      });

      const tgtRows = await db
        .select()
        .from(locationInterfacesAccepted)
        .where(eq(locationInterfacesAccepted.interfaceTypeId, target.id));
      expect(tgtRows).toHaveLength(2);

      const srcRows = await db
        .select()
        .from(locationInterfacesAccepted)
        .where(eq(locationInterfacesAccepted.interfaceTypeId, source.id));
      expect(srcRows).toHaveLength(0);
    });

    it("deletes source interface types after merge", async () => {
      const source = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "src-iface",
      });
      const target = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "tgt-iface",
      });
      await seedTemplateWithProvidedInterface(source.id);

      await interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [source.id],
        targetId: target.id,
      });

      const gone = await interfaceTypeRepository.findById({
        orgId: testCtx.orgId,
        id: source.id,
      });
      expect(gone).toBeNull();
    });

    it("mints a new template version for every affected template", async () => {
      const source = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "src-iface",
      });
      const target = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "tgt-iface",
      });
      const seedA = await seedTemplateWithProvidedInterface(source.id);
      const seedB = await seedTemplateWithProvidedInterface(source.id);

      const before = await db.select().from(templateVersions);
      await interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [source.id],
        targetId: target.id,
      });
      const after = await db.select().from(templateVersions);
      // Two affected templates → two new versions
      expect(after.length - before.length).toBe(2);

      // New versions should provide target, not source
      const newVersionIds = after
        .filter((v) => !before.find((b) => b.id === v.id))
        .map((v) => v.id);
      for (const vid of newVersionIds) {
        const rows = await db
          .select()
          .from(templateVersionInterfacesProvided)
          .where(eq(templateVersionInterfacesProvided.templateVersionId, vid));
        expect(rows.map((r) => r.interfaceTypeId)).toContain(target.id);
        expect(rows.map((r) => r.interfaceTypeId)).not.toContain(source.id);
      }

      // Touch seedA, seedB to satisfy TS unused warnings
      expect(seedA.templateId).toBeDefined();
      expect(seedB.templateId).toBeDefined();
    });

    it("dedups when a template version already provides both source and target", async () => {
      const source = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "src-iface",
      });
      const target = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "tgt-iface",
      });
      const { templateVersionId } = await seedTemplateWithProvidedInterface(
        source.id
      );
      // Add target to the same version
      await db.insert(templateVersionInterfacesProvided).values({
        templateVersionId,
        interfaceTypeId: target.id,
      });

      await interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [source.id],
        targetId: target.id,
      });

      const rows = await db
        .select()
        .from(templateVersionInterfacesProvided)
        .where(
          eq(templateVersionInterfacesProvided.templateVersionId, templateVersionId)
        );
      // Should be just target, no source
      expect(rows).toHaveLength(1);
      expect(rows[0].interfaceTypeId).toBe(target.id);
    });

    it("rejects when target is in sources", async () => {
      const a = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "a",
      });
      await expect(
        interfaceTypeRepository.merge({
          ...testCtx,
          sourceIds: [a.id],
          targetId: a.id,
        })
      ).rejects.toThrow(/target.*source/i);
    });

    it("rejects when target does not exist", async () => {
      const a = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "a",
      });
      await expect(
        interfaceTypeRepository.merge({
          ...testCtx,
          sourceIds: [a.id],
          targetId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow(/target.*not found/i);
    });

    it("rejects empty sources", async () => {
      const a = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "a",
      });
      await expect(
        interfaceTypeRepository.merge({
          ...testCtx,
          sourceIds: [],
          targetId: a.id,
        })
      ).rejects.toThrow(/source/i);
    });

    it("logs a merge transaction", async () => {
      const source = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "src-iface",
      });
      const target = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "tgt-iface",
      });
      await seedTemplateWithProvidedInterface(source.id);

      await interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [source.id],
        targetId: target.id,
      });

      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      const tx = txns.find((t) => t.actionType === "interfaceType.merge");
      expect(tx).toBeDefined();
      expect(tx!.entityId).toBe(target.id);
    });
  });

  // ───────────── usage counts ─────────────
  describe("usageCount", () => {
    it("returns zeros when nothing references the type", async () => {
      const created = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "unused",
      });
      const u = await interfaceTypeRepository.usageCount({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(u).toEqual({ providers: 0, accepters: 0, receptacles: 0 });
    });

    it("counts template versions providing the type", async () => {
      const ifc = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
      });
      await seedTemplateWithProvidedInterface(ifc.id);
      await seedTemplateWithProvidedInterface(ifc.id);

      const u = await interfaceTypeRepository.usageCount({
        orgId: testCtx.orgId,
        id: ifc.id,
      });
      expect(u.providers).toBe(2);
      expect(u.accepters).toBe(0);
      expect(u.receptacles).toBe(0);
    });

    it("counts template versions accepting the type", async () => {
      const ifc = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "gridfinity-42mm",
      });
      await seedTemplateWithAcceptedInterface(ifc.id);

      const u = await interfaceTypeRepository.usageCount({
        orgId: testCtx.orgId,
        id: ifc.id,
      });
      expect(u.accepters).toBe(1);
    });

    it("counts receptacle locations accepting the type", async () => {
      const ifc = await interfaceTypeRepository.create({
        ...testCtx,
        identifier: "plano-3600",
      });
      await seedLocationAcceptingInterface(ifc.id);
      await seedLocationAcceptingInterface(ifc.id);
      await seedLocationAcceptingInterface(ifc.id);

      const u = await interfaceTypeRepository.usageCount({
        orgId: testCtx.orgId,
        id: ifc.id,
      });
      expect(u.receptacles).toBe(3);
    });
  });
});

// ───────────── seed helpers ─────────────

async function seedTemplateWithProvidedInterface(interfaceTypeId: string) {
  const [template] = await db
    .insert(templates)
    .values({ name: `template-${Math.random()}`, ownerOrgId: testCtx.orgId })
    .returning();
  const [version] = await db
    .insert(templateVersions)
    .values({
      templateId: template.id,
      version: 1,
      ownerOrgId: testCtx.orgId,
    })
    .returning();
  await db.insert(templateVersionInterfacesProvided).values({
    templateVersionId: version.id,
    interfaceTypeId,
    ownerOrgId: testCtx.orgId,
  });
  return { templateId: template.id, templateVersionId: version.id };
}

async function seedTemplateWithAcceptedInterface(interfaceTypeId: string) {
  const [template] = await db
    .insert(templates)
    .values({ name: `template-${Math.random()}`, ownerOrgId: testCtx.orgId })
    .returning();
  const [version] = await db
    .insert(templateVersions)
    .values({
      templateId: template.id,
      version: 1,
      ownerOrgId: testCtx.orgId,
    })
    .returning();
  await db.insert(templateVersionInterfacesAccepted).values({
    templateVersionId: version.id,
    interfaceTypeId,
    ownerOrgId: testCtx.orgId,
  });
  return { templateId: template.id, templateVersionId: version.id };
}

async function seedLocationAcceptingInterface(interfaceTypeId: string) {
  const [mod] = await db
    .insert(modules)
    .values({
      name: `mod-${Math.random()}`,
      primaryDimensionLabel: "level",
      primaryDimensionCount: 1,
      ownerOrgId: testCtx.orgId,
    })
    .returning();
  const [template] = await db
    .insert(templates)
    .values({ name: `template-${Math.random()}`, ownerOrgId: testCtx.orgId })
    .returning();
  const [version] = await db
    .insert(templateVersions)
    .values({
      templateId: template.id,
      version: 1,
      ownerOrgId: testCtx.orgId,
    })
    .returning();
  const [loc] = await db
    .insert(locations)
    .values({
      moduleId: mod.id,
      label: "1",
      path: `${mod.name}:1`,
      pathSegments: [mod.name, "1"],
      locationType: "receptacle",
      templateVersionId: version.id,
      ownerOrgId: testCtx.orgId,
    })
    .returning();
  await db.insert(locationInterfacesAccepted).values({
    locationId: loc.id,
    interfaceTypeId,
    ownerOrgId: testCtx.orgId,
  });
  return { locationId: loc.id };
}
