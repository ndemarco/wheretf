import { insertRepository } from "@/repositories/insertRepository";
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

async function createReceptacleLocation(
  moduleId: string,
  interfaceTypeAccepted?: string
) {
  return locationRepository.create({
    moduleId,
    label: "A1",
    pathSegments: ["MUSE", "3", "A1"],
    locationType: "receptacle",
    interfaceTypeAccepted,
  });
}

describe("insertRepository", () => {
  describe("create", () => {
    it("creates an unplaced insert", async () => {
      const insert = await insertRepository.create({
        name: "Resistor tray",
        interfaceTypeProvided: "plano-3600",
      });

      expect(insert.id).toBeDefined();
      expect(insert.name).toBe("Resistor tray");
      expect(insert.interfaceTypeProvided).toBe("plano-3600");
      expect(insert.locationId).toBeNull();
    });

    it("creates an insert with parametric dimensions", async () => {
      const insert = await insertRepository.create({
        name: "Grid bin",
        rows: 2,
        columns: 3,
      });

      expect(insert.rows).toBe(2);
      expect(insert.columns).toBe(3);
    });

    it("stores metadata and overrides as JSON", async () => {
      const insert = await insertRepository.create({
        name: "Custom tray",
        overrides: { removedDividers: [1, 3] },
        metadata: { color: "blue" },
      });

      const found = await insertRepository.findById({ id: insert.id });
      expect(found?.overrides).toEqual({ removedDividers: [1, 3] });
      expect(found?.metadata).toEqual({ color: "blue" });
    });

    it("logs a transaction", async () => {
      const insert = await insertRepository.create({
        name: "Test insert",
      });

      const txns = await transactionRepository.listRecent();
      const createTx = txns.find((t) => t.actionType === "insert.create");
      expect(createTx).toBeDefined();
      expect(createTx!.entityType).toBe("insert");
      expect(createTx!.entityId).toBe(insert.id);
      expect(createTx!.beforeState).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns the insert by ID", async () => {
      const created = await insertRepository.create({
        name: "Test insert",
      });

      const found = await insertRepository.findById({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Test insert");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await insertRepository.findById({
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("place", () => {
    it("places an insert into a receptacle location", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);
      const insert = await insertRepository.create({ name: "Tray" });

      const placed = await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      expect(placed.locationId).toBe(location.id);
    });

    it("succeeds when interface types match", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(
        module.id,
        "plano-3600"
      );
      const insert = await insertRepository.create({
        name: "Tray",
        interfaceTypeProvided: "plano-3600",
      });

      const placed = await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      expect(placed.locationId).toBe(location.id);
    });

    it("succeeds when insert has no interface type", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(
        module.id,
        "plano-3600"
      );
      const insert = await insertRepository.create({ name: "Generic tray" });

      const placed = await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      expect(placed.locationId).toBe(location.id);
    });

    it("succeeds when location has no interface type", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);
      const insert = await insertRepository.create({
        name: "Tray",
        interfaceTypeProvided: "plano-3600",
      });

      const placed = await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      expect(placed.locationId).toBe(location.id);
    });

    it("fails when interface types do not match", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(
        module.id,
        "plano-3600"
      );
      const insert = await insertRepository.create({
        name: "Tray",
        interfaceTypeProvided: "gridfinity-42mm",
      });

      await expect(
        insertRepository.place({
          id: insert.id,
          locationId: location.id,
        })
      ).rejects.toThrow("Interface type mismatch");
    });

    it("fails when location is not a receptacle", async () => {
      const module = await createTestModule();
      const location = await locationRepository.create({
        moduleId: module.id,
        label: "3",
        pathSegments: ["MUSE", "3"],
        locationType: "fixed",
      });
      const insert = await insertRepository.create({ name: "Tray" });

      await expect(
        insertRepository.place({
          id: insert.id,
          locationId: location.id,
        })
      ).rejects.toThrow("not a receptacle");
    });

    it("fails when location does not exist", async () => {
      const insert = await insertRepository.create({ name: "Tray" });

      await expect(
        insertRepository.place({
          id: insert.id,
          locationId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });

    it("fails when insert does not exist", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);

      await expect(
        insertRepository.place({
          id: "00000000-0000-0000-0000-000000000000",
          locationId: location.id,
        })
      ).rejects.toThrow("not found");
    });

    it("logs a transaction", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);
      const insert = await insertRepository.create({ name: "Tray" });

      await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      const txns = await transactionRepository.listRecent();
      const placeTx = txns.find((t) => t.actionType === "insert.place");
      expect(placeTx).toBeDefined();
      expect(placeTx!.entityId).toBe(insert.id);
    });
  });

  describe("removeFromLocation", () => {
    it("unplaces an insert", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);
      const insert = await insertRepository.create({ name: "Tray" });
      await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      const unplaced = await insertRepository.removeFromLocation({
        id: insert.id,
      });

      expect(unplaced.locationId).toBeNull();
    });

    it("logs a transaction", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);
      const insert = await insertRepository.create({ name: "Tray" });
      await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      await insertRepository.removeFromLocation({ id: insert.id });

      const txns = await transactionRepository.listRecent();
      const removeTx = txns.find(
        (t) => t.actionType === "insert.removeFromLocation"
      );
      expect(removeTx).toBeDefined();
    });
  });

  describe("findByLocationId", () => {
    it("returns the insert at a location", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);
      const insert = await insertRepository.create({ name: "Tray" });
      await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      const found = await insertRepository.findByLocationId({
        locationId: location.id,
      });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Tray");
    });

    it("returns null when no insert at location", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);

      const found = await insertRepository.findByLocationId({
        locationId: location.id,
      });
      expect(found).toBeNull();
    });
  });

  describe("listUnplaced", () => {
    it("returns only unplaced inserts", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);

      const placed = await insertRepository.create({ name: "Placed tray" });
      await insertRepository.place({
        id: placed.id,
        locationId: location.id,
      });
      await insertRepository.create({ name: "Unplaced tray 1" });
      await insertRepository.create({ name: "Unplaced tray 2" });

      const unplaced = await insertRepository.listUnplaced();
      expect(unplaced).toHaveLength(2);
      expect(unplaced.every((i) => i.locationId === null)).toBe(true);
    });

    it("returns empty array when all inserts are placed", async () => {
      const module = await createTestModule();
      const location = await createReceptacleLocation(module.id);
      const insert = await insertRepository.create({ name: "Tray" });
      await insertRepository.place({
        id: insert.id,
        locationId: location.id,
      });

      const unplaced = await insertRepository.listUnplaced();
      expect(unplaced).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns the updated insert", async () => {
      const created = await insertRepository.create({
        name: "Old name",
      });

      const updated = await insertRepository.update({
        id: created.id,
        name: "New name",
      });

      expect(updated.name).toBe("New name");
    });

    it("logs a transaction with before and after state", async () => {
      const created = await insertRepository.create({
        name: "Test insert",
      });

      await insertRepository.update({
        id: created.id,
        name: "Updated",
      });

      const txns = await transactionRepository.listRecent();
      const updateTx = txns.find((t) => t.actionType === "insert.update");
      expect(updateTx).toBeDefined();
      expect(updateTx!.beforeState).toBeTruthy();
      expect(updateTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent insert", async () => {
      await expect(
        insertRepository.update({
          id: "00000000-0000-0000-0000-000000000000",
          name: "GHOST",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the insert", async () => {
      const created = await insertRepository.create({
        name: "Test insert",
      });

      await insertRepository.remove({ id: created.id });

      const found = await insertRepository.findById({ id: created.id });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const created = await insertRepository.create({
        name: "Test insert",
      });

      await insertRepository.remove({ id: created.id });

      const txns = await transactionRepository.listRecent();
      const deleteTx = txns.find((t) => t.actionType === "insert.delete");
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent insert", async () => {
      await expect(
        insertRepository.remove({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });
});
