import { db } from "@/db/connection";
import { templates, templateVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
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

    it("creates a receptacle with interfaceTypeAccepted", async () => {
      const module = await createTestModule();

      const location = await locationRepository.create({
        moduleId: module.id,
        label: "A1",
        pathSegments: ["MUSE", "3", "A1"],
        locationType: "receptacle",
        interfaceTypeAccepted: "plano-3600",
      });

      expect(location.locationType).toBe("receptacle");
      expect(location.interfaceTypeAccepted).toBe("plano-3600");
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
        interfaceTypeAccepted: "plano-3600",
      });

      expect(updated.locationType).toBe("receptacle");
      expect(updated.interfaceTypeAccepted).toBe("plano-3600");
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
