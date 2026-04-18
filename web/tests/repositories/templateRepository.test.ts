import { templateRepository } from "@/repositories/templateRepository";
import { transactionRepository } from "@/repositories/transactionRepository";
import { moduleRepository } from "@/repositories/moduleRepository";
import { locationRepository } from "@/repositories/locationRepository";

describe("templateRepository", () => {
  describe("create", () => {
    it("creates a template and returns it", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
        description: "Standard tackle box",
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe("Plano 3600");
      expect(template.description).toBe("Standard tackle box");
      expect(template.currentVersion).toBe(1);
    });

    it("auto-creates version 1", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      const version = await templateRepository.getVersion({
        templateId: template.id,
        version: 1,
      });

      expect(version).not.toBeNull();
      expect(version!.version).toBe(1);
      expect(version!.isParametric).toBe(false);
      expect(version!.rows).toBe(1);
      expect(version!.columns).toBe(1);
      expect(version!.rowLabelScheme).toBe("alpha");
      expect(version!.columnLabelScheme).toBe("numeric");
      expect(version!.originPosition).toBe("top-left");
      expect(version!.primaryAxis).toBe("row");
    });

    it("logs a transaction", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      const txns = await transactionRepository.listRecent();
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("template.create");
      expect(txns[0].entityType).toBe("template");
      expect(txns[0].entityId).toBe(template.id);
      expect(txns[0].beforeState).toBeNull();
    });

    it("stores metadata as JSON", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
        metadata: { manufacturer: "Plano", sku: "3600" },
      });

      const found = await templateRepository.findById({ id: template.id });
      expect(found?.metadata).toEqual({ manufacturer: "Plano", sku: "3600" });
    });

    it("defaults scope to shared", async () => {
      const template = await templateRepository.create({ name: "Plano 3600" });
      expect(template.scope).toBe("shared");
    });

    it("accepts scope=single_instance for ad-hoc templates", async () => {
      const template = await templateRepository.create({
        name: "ad-hoc shelf",
        scope: "single_instance",
      });
      expect(template.scope).toBe("single_instance");
    });

    it("stores continuous-dimension capacity on the version", async () => {
      const template = await templateRepository.create({
        name: "Akro-Mils 30636",
        isContinuous: true,
        widthMm: 914.4, // 36 in
        rowPitchMm: 88.9, // 3.5 in
        overflowDirection: "down",
        unitSystem: "imperial",
      });

      const version = await templateRepository.getVersion({
        templateId: template.id,
        version: 1,
      });

      expect(version!.isContinuous).toBe(true);
      expect(Number(version!.widthMm)).toBeCloseTo(914.4);
      expect(Number(version!.rowPitchMm)).toBeCloseTo(88.9);
      expect(version!.overflowDirection).toBe("down");
      expect(version!.unitSystem).toBe("imperial");
    });

    it("stores bufferMm on insert templates", async () => {
      const template = await templateRepository.create({
        name: "Akro-Mils 30220",
        isContinuous: true,
        widthMm: 104.775, // 4⅛ in
        bufferMm: 6.35, // ¼ in
      });

      const version = await templateRepository.getVersion({
        templateId: template.id,
        version: 1,
      });

      expect(Number(version!.bufferMm)).toBeCloseTo(6.35);
    });
  });

  describe("findById", () => {
    it("returns the template by ID", async () => {
      const created = await templateRepository.create({
        name: "Plano 3600",
      });

      const found = await templateRepository.findById({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Plano 3600");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await templateRepository.findById({
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the template by name", async () => {
      await templateRepository.create({
        name: "Gridfinity 42mm",
        description: "Standard gridfinity baseplate",
      });

      const found = await templateRepository.findByName({
        name: "Gridfinity 42mm",
      });
      expect(found).not.toBeNull();
      expect(found!.description).toBe("Standard gridfinity baseplate");
    });

    it("returns null for nonexistent name", async () => {
      const found = await templateRepository.findByName({ name: "GHOST" });
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all templates", async () => {
      await templateRepository.create({ name: "Plano 3600" });
      await templateRepository.create({ name: "Gridfinity 42mm" });

      const all = await templateRepository.list();
      expect(all).toHaveLength(2);
    });

    it("returns empty array when no templates exist", async () => {
      const all = await templateRepository.list();
      expect(all).toHaveLength(0);
    });

    it("excludes hidden templates by default", async () => {
      const a = await templateRepository.create({ name: "Shown" });
      await templateRepository.create({ name: "Hidden" }).then((t) =>
        templateRepository.hide({ id: t.id })
      );
      const all = await templateRepository.list();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(a.id);
    });

    it("includes hidden when includeHidden=true", async () => {
      await templateRepository.create({ name: "Shown" });
      await templateRepository.create({ name: "Hidden" }).then((t) =>
        templateRepository.hide({ id: t.id })
      );
      const all = await templateRepository.list({ includeHidden: true });
      expect(all).toHaveLength(2);
    });
  });

  describe("hide / unhide / getReferenceCount", () => {
    it("hides and unhides a template", async () => {
      const t = await templateRepository.create({ name: "Plano 3600" });
      expect(t.isHidden).toBe(false);

      const hidden = await templateRepository.hide({ id: t.id });
      expect(hidden.isHidden).toBe(true);

      const shown = await templateRepository.unhide({ id: t.id });
      expect(shown.isHidden).toBe(false);
    });

    it("counts zero references for unused templates", async () => {
      const t = await templateRepository.create({ name: "Plano 3600" });
      const refs = await templateRepository.getReferenceCount({ id: t.id });
      expect(refs.insertCount).toBe(0);
      expect(refs.locationCount).toBe(0);
    });

    it("counts location references through any version", async () => {
      const t = await templateRepository.create({ name: "Plano 3600" });
      const mod = await moduleRepository.create({
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 1,
      });
      const v1 = await templateRepository.getVersion({
        templateId: t.id,
        version: 1,
      });
      await locationRepository.create({
        moduleId: mod.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "fixed",
        templateVersionId: v1!.id,
      });

      const refs = await templateRepository.getReferenceCount({ id: t.id });
      expect(refs.locationCount).toBe(1);
      expect(refs.insertCount).toBe(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns the updated template", async () => {
      const created = await templateRepository.create({
        name: "Plano 3600",
      });

      const updated = await templateRepository.update({
        id: created.id,
        description: "Updated description",
      });

      expect(updated.description).toBe("Updated description");
      expect(updated.name).toBe("Plano 3600"); // unchanged
    });

    it("logs a transaction with before and after state", async () => {
      const created = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.update({
        id: created.id,
        description: "Updated",
      });

      const txns = await transactionRepository.listRecent();
      const updateTx = txns.find((t) => t.actionType === "template.update");
      expect(updateTx).toBeDefined();
      expect(updateTx!.beforeState).toBeTruthy();
      expect(updateTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent template", async () => {
      await expect(
        templateRepository.update({
          id: "00000000-0000-0000-0000-000000000000",
          name: "GHOST",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the template", async () => {
      const created = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.remove({ id: created.id });

      const found = await templateRepository.findById({ id: created.id });
      expect(found).toBeNull();
    });

    it("deletes associated versions", async () => {
      const created = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.publishVersion({
        templateId: created.id,
        rows: 4,
        columns: 6,
      });

      await templateRepository.remove({ id: created.id });

      const versions = await templateRepository.listVersions({
        templateId: created.id,
      });
      expect(versions).toHaveLength(0);
    });

    it("logs a transaction", async () => {
      const created = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.remove({ id: created.id });

      const txns = await transactionRepository.listRecent();
      const deleteTx = txns.find((t) => t.actionType === "template.delete");
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent template", async () => {
      await expect(
        templateRepository.remove({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("publishVersion", () => {
    it("creates a new version with incremented version number", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      const v2 = await templateRepository.publishVersion({
        templateId: template.id,
        rows: 4,
        columns: 6,
      });

      expect(v2.version).toBe(2);
      expect(v2.templateId).toBe(template.id);
      expect(v2.rows).toBe(4);
      expect(v2.columns).toBe(6);
    });

    it("updates template currentVersion", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.publishVersion({
        templateId: template.id,
        rows: 4,
        columns: 6,
      });

      const updated = await templateRepository.findById({ id: template.id });
      expect(updated!.currentVersion).toBe(2);
    });

    it("preserves old version when new version is published", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.publishVersion({
        templateId: template.id,
        rows: 4,
        columns: 6,
      });

      const v1 = await templateRepository.getVersion({
        templateId: template.id,
        version: 1,
      });
      expect(v1).not.toBeNull();
      expect(v1!.version).toBe(1);
    });

    it("supports parametric templates", async () => {
      const template = await templateRepository.create({
        name: "Gridfinity Base",
      });

      const v2 = await templateRepository.publishVersion({
        templateId: template.id,
        isParametric: true,
        minRows: 1,
        maxRows: 10,
        minColumns: 1,
        maxColumns: 10,
      });

      expect(v2.isParametric).toBe(true);
      expect(v2.minRows).toBe(1);
      expect(v2.maxRows).toBe(10);
    });

    it("logs a transaction", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.publishVersion({
        templateId: template.id,
        rows: 4,
        columns: 6,
      });

      const txns = await transactionRepository.listRecent();
      const pubTx = txns.find(
        (t) => t.actionType === "template.publishVersion"
      );
      expect(pubTx).toBeDefined();
      expect(pubTx!.entityType).toBe("templateVersion");
    });

    it("throws for nonexistent template", async () => {
      await expect(
        templateRepository.publishVersion({
          templateId: "00000000-0000-0000-0000-000000000000",
          rows: 4,
          columns: 6,
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("getVersion", () => {
    it("returns a specific version", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      const v1 = await templateRepository.getVersion({
        templateId: template.id,
        version: 1,
      });

      expect(v1).not.toBeNull();
      expect(v1!.version).toBe(1);
      expect(v1!.templateId).toBe(template.id);
    });

    it("returns null for nonexistent version", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      const v99 = await templateRepository.getVersion({
        templateId: template.id,
        version: 99,
      });

      expect(v99).toBeNull();
    });
  });

  describe("listVersions", () => {
    it("lists all versions for a template", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });

      await templateRepository.publishVersion({
        templateId: template.id,
        rows: 4,
        columns: 6,
      });

      await templateRepository.publishVersion({
        templateId: template.id,
        rows: 5,
        columns: 7,
      });

      const versions = await templateRepository.listVersions({
        templateId: template.id,
      });
      expect(versions).toHaveLength(3); // v1 (auto) + v2 + v3
    });

    it("returns empty array for template with no versions (nonexistent template)", async () => {
      const versions = await templateRepository.listVersions({
        templateId: "00000000-0000-0000-0000-000000000000",
      });
      expect(versions).toHaveLength(0);
    });
  });
});
