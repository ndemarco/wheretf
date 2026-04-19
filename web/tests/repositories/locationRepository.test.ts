import { db } from "@/db/connection";
import { templates, templateVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { moduleRepository } from "@/repositories/moduleRepository";
import { transactionRepository } from "@/repositories/transactionRepository";

async function createTestModule() {
  return moduleRepository.create({
    name: "MUSE",
    primaryDimensionLabel: "level",
    primaryDimensionCount: 11,
  });
}

describe("locationRepository", () => {
  describe("create", () => {
    it("creates a location with computed path from pathSegments", async () => {
      const module = await createTestModule();

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      expect(location.id).toBeDefined();
      expect(location.moduleId).toBe(module.id);
      expect(location.label).toBe("3");
      expect(location.path).toBe("MUSE:3");
      expect(location.pathSegments).toEqual(["MUSE", "3"]);
      expect(location.locationType).toBe("fixed");
    });

    it("auto-creates a single_instance template when templateVersionId is omitted", async () => {
      const module = await createTestModule();

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "shelf",
        pathSegments: ["AD-HOC", "shelf"],
        locationType: "leaf",
      });

      expect(location.templateVersionId).toBeDefined();
      expect(location.templateVersionId).not.toBeNull();

      const [version] = await db
        .select()
        .from(templateVersions)
        .where(eq(templateVersions.id, location.templateVersionId!));
      const [template] = await db
        .select()
        .from(templates)
        .where(eq(templates.id, version.templateId));

      expect(template.scope).toBe("single_instance");
      expect(template.name).toBe("ad-hoc: AD-HOC:shelf");
    });

    it("uses provided templateVersionId when given", async () => {
      const module = await createTestModule();

      // Pre-create a shared template
      const [tpl] = await db
        .insert(templates)
        .values({ name: "Plano 3600", scope: "shared" })
        .returning();
      const [ver] = await db
        .insert(templateVersions)
        .values({ templateId: tpl.id, version: 1 })
        .returning();

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "leaf",
        templateVersionId: ver.id,
      });

      expect(location.templateVersionId).toBe(ver.id);
    });

    it("creates a receptacle with accepted interface types", async () => {
      const module = await createTestModule();
      const plano = await interfaceTypeRepository.create({
        identifier: "plano-3600",
      });

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "receptacle",
        interfacesAcceptedIds: [plano.id],
      });

      expect(location.locationType).toBe("receptacle");

      const accepted = await locationRepository.getAcceptedInterfaces({
        locationId: location.id,
      });
      expect(accepted).toHaveLength(1);
      expect(accepted[0].identifier).toBe("plano-3600");
    });

    it("creates a child location with parentId", async () => {
      const module = await createTestModule();

      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      const child = await locationRepository.create({
        moduleId: module.id,
        parentId: parent.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "receptacle",
      });

      expect(child.parentId).toBe(parent.id);
      expect(child.path).toBe("MUSE:3:A1");
    });

    it("stores grid position", async () => {
      const module = await createTestModule();

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "B2",
        pathSegments: ["MUSE", "3", "B2"],
        locationType: "receptacle",
        gridRow: 1,
        gridColumn: 2,
      });

      expect(location.gridRow).toBe(1);
      expect(location.gridColumn).toBe(2);
    });

    it("stores metadata as JSON", async () => {
      const module = await createTestModule();

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
        metadata: { notes: "top shelf" },
      });

      const found = await locationRepository.findById({ id: location.id });
      expect(found?.metadata).toEqual({ notes: "top shelf" });
    });

    it("logs a transaction", async () => {
      const module = await createTestModule();

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      const txns = await transactionRepository.listRecent();
      const createTx = txns.find((t) => t.actionType === "location.create");
      expect(createTx).toBeDefined();
      expect(createTx!.entityType).toBe("location");
      expect(createTx!.entityId).toBe(location.id);
      expect(createTx!.beforeState).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns the location by ID", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      const found = await locationRepository.findById({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.label).toBe("3");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await locationRepository.findById({
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByPath", () => {
    it("finds a location by module and path", async () => {
      const module = await createTestModule();
      await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      const found = await locationRepository.findByPath({
        moduleId: module.id,
        path: "MUSE:3",
      });
      expect(found).not.toBeNull();
      expect(found!.label).toBe("3");
    });

    it("returns null for nonexistent path", async () => {
      const module = await createTestModule();
      const found = await locationRepository.findByPath({
        moduleId: module.id,
        path: "MUSE:99",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByModuleId", () => {
    it("returns all locations in a module", async () => {
      const module = await createTestModule();
      await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });
      await locationRepository.create({
        moduleId: module.id,
        label: "4",
        pathSegments: ["MUSE", "4"],
        locationType: "fixed",
      });

      const results = await locationRepository.findByModuleId({
        moduleId: module.id,
      });
      expect(results).toHaveLength(2);
    });
  });

  describe("findChildren", () => {
    it("returns direct children of a location", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      await locationRepository.create({
        moduleId: module.id,
        parentId: parent.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "receptacle",
      });
      await locationRepository.create({
        moduleId: module.id,
        parentId: parent.id,
        label: "A2",
        pathSegments: ["MUSE", "3", "A2"],
        locationType: "receptacle",
      });

      const children = await locationRepository.findChildren({
        parentId: parent.id,
      });
      expect(children).toHaveLength(2);
    });

    it("returns empty array when no children exist", async () => {
      const module = await createTestModule();
      const location = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "leaf",
      });

      const children = await locationRepository.findChildren({
        parentId: location.id,
      });
      expect(children).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns the updated location", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      const updated = await locationRepository.update({
        id: created.id,
        locationType: "receptacle",
      });

      expect(updated.locationType).toBe("receptacle");

      const plano = await interfaceTypeRepository.create({
        identifier: "plano-3600",
      });
      await locationRepository.setAcceptedInterfaces({
        locationId: created.id,
        interfaceTypeIds: [plano.id],
      });
      const accepted = await locationRepository.getAcceptedInterfaces({
        locationId: created.id,
      });
      expect(accepted.map((a) => a.identifier)).toEqual(["plano-3600"]);
    });

    it("logs a transaction with before and after state", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      await locationRepository.update({
        id: created.id,
        label: "3-updated",
      });

      const txns = await transactionRepository.listRecent();
      const updateTx = txns.find((t) => t.actionType === "location.update");
      expect(updateTx).toBeDefined();
      expect(updateTx!.beforeState).toBeTruthy();
      expect(updateTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent location", async () => {
      await expect(
        locationRepository.update({
          id: "00000000-0000-0000-0000-000000000000",
          label: "GHOST",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the location", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      await locationRepository.remove({ id: created.id });

      const found = await locationRepository.findById({ id: created.id });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      await locationRepository.remove({ id: created.id });

      const txns = await transactionRepository.listRecent();
      const deleteTx = txns.find((t) => t.actionType === "location.delete");
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent location", async () => {
      await expect(
        locationRepository.remove({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("disable / enable", () => {
    it("disables a location with reason", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      const disabled = await locationRepository.disable({
        id: created.id,
        reason: "Broken shelf",
      });

      expect(disabled.isDisabled).toBe(true);
      expect(disabled.disableReason).toBe("Broken shelf");
    });

    it("refuses to disable a location with active assignments", async () => {
      const { assignmentRepository } = await import(
        "@/repositories/assignmentRepository"
      );
      const { itemRepository } = await import(
        "@/repositories/itemRepository"
      );
      const module = await createTestModule();
      const loc = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "leaf",
      });
      const item = await itemRepository.create({ name: "Resistor" });
      await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      await expect(
        locationRepository.disable({ id: loc.id })
      ).rejects.toThrow(/active assignments/);

      const after = await locationRepository.findById({ id: loc.id });
      expect(after?.isDisabled).toBe(false);
    });

    it("enables a previously disabled location", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      await locationRepository.disable({
        id: created.id,
        reason: "Broken shelf",
      });

      const enabled = await locationRepository.enable({ id: created.id });
      expect(enabled.isDisabled).toBe(false);
      expect(enabled.disableReason).toBeNull();
    });

    it("logs transactions for disable and enable", async () => {
      const module = await createTestModule();
      const created = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });

      await locationRepository.disable({ id: created.id });
      await locationRepository.enable({ id: created.id });

      const txns = await transactionRepository.listRecent();
      expect(txns.find((t) => t.actionType === "location.disable")).toBeDefined();
      expect(txns.find((t) => t.actionType === "location.enable")).toBeDefined();
    });
  });

  describe("restrict / clearRestrict", () => {
    it("sets capacity clamps and reason", async () => {
      const module = await createTestModule();
      const loc = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "leaf",
      });

      const restricted = await locationRepository.restrict({
        id: loc.id,
        maxHeightMm: 60,
        reason: "Must slide under shelf above",
      });

      expect(Number(restricted.maxHeightMm)).toBe(60);
      expect(restricted.maxWidthMm).toBeNull();
      expect(restricted.maxDepthMm).toBeNull();
      expect(restricted.restrictReason).toBe("Must slide under shelf above");
    });

    it("clearRestrict removes all clamps", async () => {
      const module = await createTestModule();
      const loc = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "leaf",
      });
      await locationRepository.restrict({
        id: loc.id,
        maxWidthMm: 100,
        maxHeightMm: 50,
        reason: "tight",
      });
      const cleared = await locationRepository.clearRestrict({ id: loc.id });
      expect(cleared.maxWidthMm).toBeNull();
      expect(cleared.maxHeightMm).toBeNull();
      expect(cleared.maxDepthMm).toBeNull();
      expect(cleared.restrictReason).toBeNull();
    });

    it("logs a transaction", async () => {
      const module = await createTestModule();
      const loc = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "leaf",
      });
      await locationRepository.restrict({ id: loc.id, maxHeightMm: 45 });
      const txns = await transactionRepository.listRecent();
      expect(
        txns.find((t) => t.actionType === "location.restrict")
      ).toBeDefined();
    });
  });

  describe("merge / unmerge", () => {
    async function createGridCells(
      moduleId: string,
      parentId: string,
      rc: Array<[number, number, string]>,
      insertId?: string
    ) {
      const out = [];
      for (const [r, c, label] of rc) {
        out.push(
          await locationRepository.create({
            moduleId,
            parentId,
            label,
            pathSegments: ["MUSE", "1", label],
            locationType: "leaf",
            gridRow: r,
            gridColumn: c,
            insertId,
          })
        );
      }
      return out;
    }

    it("merges 2 adjacent cells under same parent", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const [a, b] = await createGridCells(module.id, parent.id, [
        [0, 0, "A1"],
        [0, 1, "A2"],
      ]);

      await locationRepository.merge({
        originId: a.id,
        aliasIds: [b.id],
      });

      const after = await locationRepository.findById({ id: b.id });
      expect(after?.mergedIntoId).toBe(a.id);
    });

    it("refuses non-adjacent merge", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const [a, b] = await createGridCells(module.id, parent.id, [
        [0, 0, "A1"],
        [0, 2, "A3"],
      ]);
      await expect(
        locationRepository.merge({ originId: a.id, aliasIds: [b.id] })
      ).rejects.toThrow(/contiguous/);
    });

    it("refuses merge across different parents", async () => {
      const module = await createTestModule();
      const p1 = await locationRepository.create({
        moduleId: module.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const p2 = await locationRepository.create({
        moduleId: module.id,
        label: "2",
        pathSegments: ["MUSE", "2"],
        locationType: "receptacle",
      });
      const [a] = await createGridCells(module.id, p1.id, [[0, 0, "A1"]]);
      const [b] = await createGridCells(module.id, p2.id, [[0, 0, "A1"]]);
      await expect(
        locationRepository.merge({ originId: a.id, aliasIds: [b.id] })
      ).rejects.toThrow(/same parent/);
    });

    it("refuses merge when any cell is disabled", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const [a, b] = await createGridCells(module.id, parent.id, [
        [0, 0, "A1"],
        [0, 1, "A2"],
      ]);
      await locationRepository.disable({ id: b.id, reason: "cracked" });
      await expect(
        locationRepository.merge({ originId: a.id, aliasIds: [b.id] })
      ).rejects.toThrow(/disabled/);
    });

    it("refuses merge with active assignments", async () => {
      const { assignmentRepository } = await import(
        "@/repositories/assignmentRepository"
      );
      const { itemRepository } = await import(
        "@/repositories/itemRepository"
      );
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const [a, b] = await createGridCells(module.id, parent.id, [
        [0, 0, "A1"],
        [0, 1, "A2"],
      ]);
      const item = await itemRepository.create({ name: "x" });
      await assignmentRepository.create({
        itemId: item.id,
        locationId: b.id,
        assignmentType: "placed",
      });
      await expect(
        locationRepository.merge({ originId: a.id, aliasIds: [b.id] })
      ).rejects.toThrow(/assignments/);
    });

    it("unmerge clears all aliases", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const [a, b, c] = await createGridCells(module.id, parent.id, [
        [0, 0, "A1"],
        [0, 1, "A2"],
        [0, 2, "A3"],
      ]);
      await locationRepository.merge({
        originId: a.id,
        aliasIds: [b.id, c.id],
      });
      const res = await locationRepository.unmerge({ originId: a.id });
      expect(res.aliasCount).toBe(2);
      const after = await locationRepository.findById({ id: b.id });
      expect(after?.mergedIntoId).toBeNull();
    });
  });

  describe("divide / undivide", () => {
    it("splits a leaf into named children", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "drawer 1",
        pathSegments: ["MUSE", "drawer 1"],
        locationType: "leaf",
      });
      const children = await locationRepository.divide({
        parentId: parent.id,
        labels: ["front", "rear"],
      });
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.label).sort()).toEqual(["front", "rear"]);
      const after = await locationRepository.findById({ id: parent.id });
      expect(after?.locationType).toBe("fixed");
      expect(after?.subdivisionSource).toBe("ad_hoc");
    });

    it("refuses divide with fewer than 2 labels", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "d",
        pathSegments: ["MUSE", "d"],
        locationType: "leaf",
      });
      await expect(
        locationRepository.divide({ parentId: parent.id, labels: ["only"] })
      ).rejects.toThrow(/at least two/);
    });

    it("refuses divide with duplicate labels", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "d",
        pathSegments: ["MUSE", "d"],
        locationType: "leaf",
      });
      await expect(
        locationRepository.divide({
          parentId: parent.id,
          labels: ["a", "a"],
        })
      ).rejects.toThrow(/unique/);
    });

    it("refuses divide when parent has active assignments", async () => {
      const { assignmentRepository } = await import(
        "@/repositories/assignmentRepository"
      );
      const { itemRepository } = await import(
        "@/repositories/itemRepository"
      );
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "d",
        pathSegments: ["MUSE", "d"],
        locationType: "leaf",
      });
      const item = await itemRepository.create({ name: "x" });
      await assignmentRepository.create({
        itemId: item.id,
        locationId: parent.id,
        assignmentType: "placed",
      });
      await expect(
        locationRepository.divide({
          parentId: parent.id,
          labels: ["a", "b"],
        })
      ).rejects.toThrow(/active assignments/);
    });

    it("undivide removes children and restores parent to leaf", async () => {
      const module = await createTestModule();
      const parent = await locationRepository.create({
        moduleId: module.id,
        label: "d",
        pathSegments: ["MUSE", "d"],
        locationType: "leaf",
      });
      await locationRepository.divide({
        parentId: parent.id,
        labels: ["a", "b"],
      });
      const res = await locationRepository.undivide({ parentId: parent.id });
      expect(res.removed).toBe(2);
      const after = await locationRepository.findById({ id: parent.id });
      expect(after?.locationType).toBe("leaf");
      expect(after?.subdivisionSource).toBeNull();
    });
  });

  describe("merge alias", () => {
    it("sets a merge alias", async () => {
      const module = await createTestModule();
      const loc1 = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "receptacle",
      });
      const loc2 = await locationRepository.create({
        moduleId: module.id,
        label: "A2",
        pathSegments: ["MUSE", "3", "A2"],
        locationType: "receptacle",
      });

      const merged = await locationRepository.setMergeAlias({
        id: loc1.id,
        mergedIntoId: loc2.id,
      });

      expect(merged.mergedIntoId).toBe(loc2.id);
    });

    it("clears a merge alias", async () => {
      const module = await createTestModule();
      const loc1 = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "receptacle",
      });
      const loc2 = await locationRepository.create({
        moduleId: module.id,
        label: "A2",
        pathSegments: ["MUSE", "3", "A2"],
        locationType: "receptacle",
      });

      await locationRepository.setMergeAlias({
        id: loc1.id,
        mergedIntoId: loc2.id,
      });

      const cleared = await locationRepository.clearMergeAlias({ id: loc1.id });
      expect(cleared.mergedIntoId).toBeNull();
    });

    it("logs transactions for set and clear", async () => {
      const module = await createTestModule();
      const loc1 = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "receptacle",
      });
      const loc2 = await locationRepository.create({
        moduleId: module.id,
        label: "A2",
        pathSegments: ["MUSE", "3", "A2"],
        locationType: "receptacle",
      });

      await locationRepository.setMergeAlias({
        id: loc1.id,
        mergedIntoId: loc2.id,
      });
      await locationRepository.clearMergeAlias({ id: loc1.id });

      const txns = await transactionRepository.listRecent();
      expect(
        txns.find((t) => t.actionType === "location.setMergeAlias")
      ).toBeDefined();
      expect(
        txns.find((t) => t.actionType === "location.clearMergeAlias")
      ).toBeDefined();
    });
  });
});
