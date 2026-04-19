import { moduleRepository } from "@/repositories/moduleRepository";
import { transactionRepository } from "@/repositories/transactionRepository";
import { testCtx } from "../setup";

describe("moduleRepository", () => {
  describe("create", () => {
    it("creates a module and returns it", async () => {
      const module = await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        description: "Red cabinet with shelf levels",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });

      expect(module.id).toBeDefined();
      expect(module.name).toBe("MUSE");
      expect(module.description).toBe("Red cabinet with shelf levels");
      expect(module.primaryDimensionLabel).toBe("level");
      expect(module.primaryDimensionCount).toBe(11);
      expect(module.ownerOrgId).toBe(testCtx.orgId);
    });

    it("logs a transaction", async () => {
      const module = await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });

      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("module.create");
      expect(txns[0].entityType).toBe("module");
      expect(txns[0].entityId).toBe(module.id);
      expect(txns[0].beforeState).toBeNull();
      expect(txns[0].actorUserId).toBe(testCtx.userId);
      expect(txns[0].ownerOrgId).toBe(testCtx.orgId);
    });

    it("stores metadata as JSON", async () => {
      const module = await moduleRepository.create({
        ...testCtx,
        name: "ALEX",
        primaryDimensionLabel: "drawer",
        primaryDimensionCount: 9,
        metadata: { manufacturer: "IKEA", color: "white" },
      });

      const found = await moduleRepository.findById({
        orgId: testCtx.orgId,
        id: module.id,
      });
      expect(found?.metadata).toEqual({ manufacturer: "IKEA", color: "white" });
    });
  });

  describe("findById", () => {
    it("returns the module by ID", async () => {
      const created = await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });

      const found = await moduleRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("MUSE");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await moduleRepository.findById({
        orgId: testCtx.orgId,
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the module by name", async () => {
      await moduleRepository.create({
        ...testCtx,
        name: "NEON",
        primaryDimensionLabel: "drawer",
        primaryDimensionCount: 10,
      });

      const found = await moduleRepository.findByName({
        orgId: testCtx.orgId,
        name: "NEON",
      });
      expect(found).not.toBeNull();
      expect(found!.primaryDimensionCount).toBe(10);
    });

    it("returns null for nonexistent name", async () => {
      const found = await moduleRepository.findByName({
        orgId: testCtx.orgId,
        name: "GHOST",
      });
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all modules in the org", async () => {
      await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });
      await moduleRepository.create({
        ...testCtx,
        name: "ALEX",
        primaryDimensionLabel: "drawer",
        primaryDimensionCount: 9,
      });

      const all = await moduleRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(2);
    });

    it("returns empty array when no modules exist", async () => {
      const all = await moduleRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns the updated module", async () => {
      const created = await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });

      const updated = await moduleRepository.update({
        ...testCtx,
        id: created.id,
        description: "Updated description",
      });

      expect(updated.description).toBe("Updated description");
      expect(updated.name).toBe("MUSE"); // unchanged
    });

    it("logs a transaction with before and after state", async () => {
      const created = await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });

      await moduleRepository.update({
        ...testCtx,
        id: created.id,
        description: "Updated",
      });

      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      const updateTx = txns.find((t) => t.actionType === "module.update");
      expect(updateTx).toBeDefined();
      expect(updateTx!.beforeState).toBeTruthy();
      expect(updateTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent module", async () => {
      await expect(
        moduleRepository.update({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
          name: "GHOST",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the module", async () => {
      const created = await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });

      await moduleRepository.remove({ ...testCtx, id: created.id });

      const found = await moduleRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const created = await moduleRepository.create({
        ...testCtx,
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });

      await moduleRepository.remove({ ...testCtx, id: created.id });

      const txns = await transactionRepository.listRecent({ orgId: testCtx.orgId });
      const deleteTx = txns.find((t) => t.actionType === "module.delete");
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent module", async () => {
      await expect(
        moduleRepository.remove({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });
});
