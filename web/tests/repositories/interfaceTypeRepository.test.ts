import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { transactionRepository } from "@/repositories/transactionRepository";

describe("interfaceTypeRepository", () => {
  describe("create", () => {
    it("creates an interface type and returns it", async () => {
      const it = await interfaceTypeRepository.create({
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
        identifier: "gridfinity-42mm",
        description: "Gridfinity 42mm baseplate cell",
        physicalContract: {
          cellSize: "42mm",
          height: "7mm",
          mounting: "magnet",
        },
      });

      const found = await interfaceTypeRepository.findById({ id: it.id });
      expect(found?.physicalContract).toEqual({
        cellSize: "42mm",
        height: "7mm",
        mounting: "magnet",
      });
    });

    it("creates with minimal fields", async () => {
      const it = await interfaceTypeRepository.create({
        identifier: "custom-slot",
      });

      expect(it.identifier).toBe("custom-slot");
      expect(it.description).toBeNull();
      expect(it.physicalContract).toBeNull();
    });

    it("logs a transaction", async () => {
      const it = await interfaceTypeRepository.create({
        identifier: "plano-3600",
      });

      const txns = await transactionRepository.listRecent();
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("interfaceType.create");
      expect(txns[0].entityType).toBe("interfaceType");
      expect(txns[0].entityId).toBe(it.id);
      expect(txns[0].beforeState).toBeNull();
    });

    it("rejects duplicate identifiers", async () => {
      await interfaceTypeRepository.create({
        identifier: "plano-3600",
      });

      await expect(
        interfaceTypeRepository.create({
          identifier: "plano-3600",
        })
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("returns the interface type by ID", async () => {
      const created = await interfaceTypeRepository.create({
        identifier: "plano-3600",
        description: "Plano slot",
      });

      const found = await interfaceTypeRepository.findById({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.identifier).toBe("plano-3600");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await interfaceTypeRepository.findById({
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByIdentifier", () => {
    it("returns the interface type by identifier", async () => {
      await interfaceTypeRepository.create({
        identifier: "gridfinity-42mm",
        description: "Gridfinity cell",
      });

      const found = await interfaceTypeRepository.findByIdentifier({
        identifier: "gridfinity-42mm",
      });
      expect(found).not.toBeNull();
      expect(found!.description).toBe("Gridfinity cell");
    });

    it("returns null for nonexistent identifier", async () => {
      const found = await interfaceTypeRepository.findByIdentifier({
        identifier: "does-not-exist",
      });
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all interface types", async () => {
      await interfaceTypeRepository.create({ identifier: "plano-3600" });
      await interfaceTypeRepository.create({ identifier: "gridfinity-42mm" });

      const all = await interfaceTypeRepository.list();
      expect(all).toHaveLength(2);
    });

    it("returns empty array when none exist", async () => {
      const all = await interfaceTypeRepository.list();
      expect(all).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates description and returns the updated record", async () => {
      const created = await interfaceTypeRepository.create({
        identifier: "plano-3600",
        description: "Original",
      });

      const updated = await interfaceTypeRepository.update({
        id: created.id,
        description: "Updated description",
      });

      expect(updated.description).toBe("Updated description");
      expect(updated.identifier).toBe("plano-3600"); // unchanged
    });

    it("updates physicalContract", async () => {
      const created = await interfaceTypeRepository.create({
        identifier: "gridfinity-42mm",
      });

      const updated = await interfaceTypeRepository.update({
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
        identifier: "plano-3600",
      });

      await interfaceTypeRepository.update({
        id: created.id,
        description: "Updated",
      });

      const txns = await transactionRepository.listRecent();
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
          id: "00000000-0000-0000-0000-000000000000",
          description: "Nope",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the interface type", async () => {
      const created = await interfaceTypeRepository.create({
        identifier: "plano-3600",
      });

      await interfaceTypeRepository.remove({ id: created.id });

      const found = await interfaceTypeRepository.findById({ id: created.id });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const created = await interfaceTypeRepository.create({
        identifier: "plano-3600",
      });

      await interfaceTypeRepository.remove({ id: created.id });

      const txns = await transactionRepository.listRecent();
      const deleteTx = txns.find(
        (t) => t.actionType === "interfaceType.delete"
      );
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent interface type", async () => {
      await expect(
        interfaceTypeRepository.remove({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });
});
