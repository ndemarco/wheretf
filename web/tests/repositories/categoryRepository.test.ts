import { categoryRepository } from "@/repositories/categoryRepository";
import { transactionRepository } from "@/repositories/transactionRepository";
import { testCtx } from "../setup";

describe("categoryRepository", () => {
  describe("create", () => {
    it("creates a category with all fields", async () => {
      const cat = await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
        icon: "screw",
        color: "#4488cc",
        sortOrder: 1,
      });

      expect(cat.id).toBeDefined();
      expect(cat.name).toBe("Fasteners");
      expect(cat.icon).toBe("screw");
      expect(cat.color).toBe("#4488cc");
      expect(cat.sortOrder).toBe(1);
      expect(cat.createdAt).toBeInstanceOf(Date);
    });

    it("creates with minimal fields", async () => {
      const cat = await categoryRepository.create({
        ...testCtx,
        name: "Electronics",
      });

      expect(cat.name).toBe("Electronics");
      expect(cat.icon).toBeNull();
      expect(cat.color).toBeNull();
      expect(cat.sortOrder).toBe(0);
    });

    it("logs a transaction", async () => {
      const cat = await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("category.create");
      expect(txns[0].entityId).toBe(cat.id);
    });

    it("rejects duplicate names", async () => {
      await categoryRepository.create({ ...testCtx, name: "Fasteners" });
      await expect(
        categoryRepository.create({ ...testCtx, name: "Fasteners" })
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("returns the category by ID", async () => {
      const created = await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
      });
      const found = await categoryRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Fasteners");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await categoryRepository.findById({
        orgId: testCtx.orgId,
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the category by name", async () => {
      await categoryRepository.create({ ...testCtx, name: "Electronics" });
      const found = await categoryRepository.findByName({
        orgId: testCtx.orgId,
        name: "Electronics",
      });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Electronics");
    });

    it("returns null for nonexistent name", async () => {
      const found = await categoryRepository.findByName({
        orgId: testCtx.orgId,
        name: "Nope",
      });
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all categories ordered by sortOrder", async () => {
      await categoryRepository.create({
        ...testCtx,
        name: "Zippers",
        sortOrder: 2,
      });
      await categoryRepository.create({
        ...testCtx,
        name: "Adhesives",
        sortOrder: 0,
      });
      await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
        sortOrder: 1,
      });

      const all = await categoryRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(3);
      expect(all[0].name).toBe("Adhesives");
      expect(all[1].name).toBe("Fasteners");
      expect(all[2].name).toBe("Zippers");
    });

    it("returns empty array when none exist", async () => {
      const all = await categoryRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns updated record", async () => {
      const created = await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
        icon: "bolt",
      });

      const updated = await categoryRepository.update({
        ...testCtx,
        id: created.id,
        icon: "screw",
        color: "#ff0000",
      });

      expect(updated.icon).toBe("screw");
      expect(updated.color).toBe("#ff0000");
      expect(updated.name).toBe("Fasteners");
    });

    it("logs a transaction with before and after", async () => {
      const created = await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
      });
      await categoryRepository.update({
        ...testCtx,
        id: created.id,
        icon: "screw",
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const updateTx = txns.find((t) => t.actionType === "category.update");
      expect(updateTx).toBeDefined();
      expect(updateTx!.beforeState).toBeTruthy();
      expect(updateTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent category", async () => {
      await expect(
        categoryRepository.update({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
          name: "Nope",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the category", async () => {
      const created = await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
      });
      await categoryRepository.remove({ ...testCtx, id: created.id });

      const found = await categoryRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const created = await categoryRepository.create({
        ...testCtx,
        name: "Fasteners",
      });
      await categoryRepository.remove({ ...testCtx, id: created.id });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const deleteTx = txns.find((t) => t.actionType === "category.delete");
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent category", async () => {
      await expect(
        categoryRepository.remove({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });
});
