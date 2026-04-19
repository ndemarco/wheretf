import { itemRepository } from "@/repositories/itemRepository";
import { transactionRepository } from "@/repositories/transactionRepository";
import { testCtx } from "../setup";

describe("itemRepository", () => {
  describe("create", () => {
    it("creates an item and returns it", async () => {
      const item = await itemRepository.create({
        ...testCtx,
        name: "M3 x 10mm Socket Head Cap Screw",
        description: "Stainless steel, DIN 912",
      });

      expect(item.id).toBeDefined();
      expect(item.name).toBe("M3 x 10mm Socket Head Cap Screw");
      expect(item.description).toBe("Stainless steel, DIN 912");
    });

    it("stores metadata as JSON", async () => {
      const item = await itemRepository.create({
        ...testCtx,
        name: "LED",
        metadata: { color: "red", datasheet: "https://example.com/led.pdf" },
      });

      const found = await itemRepository.findById({
        orgId: testCtx.orgId,
        id: item.id,
      });
      expect(found?.metadata).toEqual({
        color: "red",
        datasheet: "https://example.com/led.pdf",
      });
    });

    it("logs a transaction", async () => {
      const item = await itemRepository.create({
        ...testCtx,
        name: "Washer",
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("item.create");
      expect(txns[0].entityType).toBe("item");
      expect(txns[0].entityId).toBe(item.id);
      expect(txns[0].beforeState).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns the item by ID", async () => {
      const created = await itemRepository.create({
        ...testCtx,
        name: "Bolt",
        description: "Hex head bolt",
      });

      const found = await itemRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Bolt");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await itemRepository.findById({
        orgId: testCtx.orgId,
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the item by name", async () => {
      await itemRepository.create({
        ...testCtx,
        name: "Nut",
        description: "M3 hex nut",
      });

      const found = await itemRepository.findByName({
        orgId: testCtx.orgId,
        name: "Nut",
      });
      expect(found).not.toBeNull();
      expect(found!.description).toBe("M3 hex nut");
    });

    it("returns null for nonexistent name", async () => {
      const found = await itemRepository.findByName({
        orgId: testCtx.orgId,
        name: "Nonexistent",
      });
      expect(found).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await itemRepository.create({
        ...testCtx,
        name: "M3 Socket Head Cap Screw",
        description: "Stainless steel fastener",
      });
      await itemRepository.create({
        ...testCtx,
        name: "M4 Hex Bolt",
        description: "Grade 8.8 steel bolt",
      });
      await itemRepository.create({
        ...testCtx,
        name: "10k Resistor",
        description: "SMD 0805 package",
      });
    });

    it("finds items by name (case-insensitive)", async () => {
      const results = await itemRepository.search({
        orgId: testCtx.orgId,
        query: "screw",
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("M3 Socket Head Cap Screw");
    });

    it("finds items by description (case-insensitive)", async () => {
      const results = await itemRepository.search({
        orgId: testCtx.orgId,
        query: "steel",
      });
      expect(results).toHaveLength(2);
    });

    it("finds items by partial match", async () => {
      const results = await itemRepository.search({
        orgId: testCtx.orgId,
        query: "M3",
      });
      expect(results).toHaveLength(1);
    });

    it("returns empty array for no matches", async () => {
      const results = await itemRepository.search({
        orgId: testCtx.orgId,
        query: "capacitor",
      });
      expect(results).toHaveLength(0);
    });
  });

  describe("list", () => {
    it("returns all items", async () => {
      await itemRepository.create({ ...testCtx, name: "Item A" });
      await itemRepository.create({ ...testCtx, name: "Item B" });

      const all = await itemRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(2);
    });

    it("returns empty array when no items exist", async () => {
      const all = await itemRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns the updated item", async () => {
      const created = await itemRepository.create({
        ...testCtx,
        name: "Screw",
      });

      const updated = await itemRepository.update({
        ...testCtx,
        id: created.id,
        description: "Updated description",
      });

      expect(updated.description).toBe("Updated description");
      expect(updated.name).toBe("Screw"); // unchanged
    });

    it("logs a transaction with before and after state", async () => {
      const created = await itemRepository.create({
        ...testCtx,
        name: "Bolt",
      });

      await itemRepository.update({
        ...testCtx,
        id: created.id,
        description: "Updated",
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const updateTx = txns.find((t) => t.actionType === "item.update");
      expect(updateTx).toBeDefined();
      expect(updateTx!.beforeState).toBeTruthy();
      expect(updateTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent item", async () => {
      await expect(
        itemRepository.update({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
          name: "Ghost",
        }),
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the item", async () => {
      const created = await itemRepository.create({
        ...testCtx,
        name: "Washer",
      });

      await itemRepository.remove({ ...testCtx, id: created.id });

      const found = await itemRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const created = await itemRepository.create({
        ...testCtx,
        name: "Nut",
      });

      await itemRepository.remove({ ...testCtx, id: created.id });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const deleteTx = txns.find((t) => t.actionType === "item.delete");
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent item", async () => {
      await expect(
        itemRepository.remove({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("not found");
    });
  });

  describe("co-storability", () => {
    let itemA: Awaited<ReturnType<typeof itemRepository.create>>;
    let itemB: Awaited<ReturnType<typeof itemRepository.create>>;
    let itemC: Awaited<ReturnType<typeof itemRepository.create>>;

    beforeEach(async () => {
      itemA = await itemRepository.create({ ...testCtx, name: "M3 Screw" });
      itemB = await itemRepository.create({ ...testCtx, name: "M3 Nut" });
      itemC = await itemRepository.create({ ...testCtx, name: "M3 Washer" });
    });

    it("adds a co-storability relationship", async () => {
      const record = await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
        reason: "Same thread size",
      });

      expect(record.id).toBeDefined();
      expect(record.itemAId).toBe(itemA.id);
      expect(record.itemBId).toBe(itemB.id);
      expect(record.reason).toBe("Same thread size");
    });

    it("logs a transaction for addCoStorability", async () => {
      await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const coStorTx = txns.find(
        (t) => t.actionType === "coStorability.create",
      );
      expect(coStorTx).toBeDefined();
      expect(coStorTx!.entityType).toBe("coStorability");
      expect(coStorTx!.beforeState).toBeNull();
    });

    it("is bidirectional — querying from either side works", async () => {
      await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });

      const fromA = await itemRepository.getCoStorableItems({
        orgId: testCtx.orgId,
        itemId: itemA.id,
      });
      expect(fromA).toHaveLength(1);
      expect(fromA[0].id).toBe(itemB.id);

      const fromB = await itemRepository.getCoStorableItems({
        orgId: testCtx.orgId,
        itemId: itemB.id,
      });
      expect(fromB).toHaveLength(1);
      expect(fromB[0].id).toBe(itemA.id);
    });

    it("returns multiple co-storable items", async () => {
      await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });
      await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemC.id,
      });

      const coStorable = await itemRepository.getCoStorableItems({
        orgId: testCtx.orgId,
        itemId: itemA.id,
      });
      expect(coStorable).toHaveLength(2);
      const ids = coStorable.map((i) => i.id).sort();
      expect(ids).toEqual([itemB.id, itemC.id].sort());
    });

    it("returns empty array when no co-storability exists", async () => {
      const result = await itemRepository.getCoStorableItems({
        orgId: testCtx.orgId,
        itemId: itemA.id,
      });
      expect(result).toHaveLength(0);
    });

    it("removes a co-storability relationship", async () => {
      await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });

      await itemRepository.removeCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });

      const coStorable = await itemRepository.getCoStorableItems({
        orgId: testCtx.orgId,
        itemId: itemA.id,
      });
      expect(coStorable).toHaveLength(0);
    });

    it("removes co-storability regardless of argument order", async () => {
      await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });

      // Remove with reversed order
      await itemRepository.removeCoStorability({
        ...testCtx,
        itemAId: itemB.id,
        itemBId: itemA.id,
      });

      const coStorable = await itemRepository.getCoStorableItems({
        orgId: testCtx.orgId,
        itemId: itemA.id,
      });
      expect(coStorable).toHaveLength(0);
    });

    it("logs a transaction for removeCoStorability", async () => {
      await itemRepository.addCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });

      await itemRepository.removeCoStorability({
        ...testCtx,
        itemAId: itemA.id,
        itemBId: itemB.id,
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const deleteTx = txns.find(
        (t) => t.actionType === "coStorability.delete",
      );
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws when removing nonexistent co-storability", async () => {
      await expect(
        itemRepository.removeCoStorability({
          ...testCtx,
          itemAId: itemA.id,
          itemBId: itemB.id,
        }),
      ).rejects.toThrow("not found");
    });
  });
});
