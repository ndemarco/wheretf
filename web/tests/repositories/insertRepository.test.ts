import { insertRepository } from "@/repositories/insertRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { moduleRepository } from "@/repositories/moduleRepository";
import { templateRepository } from "@/repositories/templateRepository";
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

  describe("cells travel with insert (IN-3 structural correctness)", () => {
    it("re-parents cells when insert moves; overrides persist", async () => {
      const mod = await moduleRepository.create({
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });
      const levelA = await locationRepository.create({
        moduleId: mod.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const levelB = await locationRepository.create({
        moduleId: mod.id,
        label: "2",
        pathSegments: ["MUSE", "2"],
        locationType: "receptacle",
      });

      const insert = await insertRepository.create({ name: "Construction screws" });
      await insertRepository.place({ id: insert.id, locationId: levelA.id });

      // Create a cell "A3" inside the insert at level 1
      const cell = await locationRepository.create({
        moduleId: mod.id,
        parentId: levelA.id,
        label: "A3",
        pathSegments: ["MUSE", "1", "A3"],
        locationType: "leaf",
        insertId: insert.id,
        gridRow: 0,
        gridColumn: 2,
      });

      // Disable the cell — this is an override on the cell row
      await locationRepository.disable({ id: cell.id, reason: "cracked" });

      // Move insert from level 1 to level 2
      await insertRepository.removeFromLocation({ id: insert.id });
      await insertRepository.place({ id: insert.id, locationId: levelB.id });

      const moved = await locationRepository.findById({ id: cell.id });
      expect(moved).not.toBeNull();
      expect(moved!.insertId).toBe(insert.id);
      expect(moved!.parentId).toBe(levelB.id);
      expect(moved!.path).toBe("MUSE:2:A3");
      // Disabled state travels with the cell
      expect(moved!.isDisabled).toBe(true);
      expect(moved!.disableReason).toBe("cracked");
    });

    it("refuses to place into a receptacle that already holds another insert", async () => {
      const mod = await moduleRepository.create({
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });
      const level = await locationRepository.create({
        moduleId: mod.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });

      const a = await insertRepository.create({ name: "first" });
      const b = await insertRepository.create({ name: "second" });
      await insertRepository.place({ id: a.id, locationId: level.id });

      await expect(
        insertRepository.place({ id: b.id, locationId: level.id })
      ).rejects.toThrow(/already holds/);
    });

    it("unplace leaves cells with insert_id set, parent_id null, path = cell label", async () => {
      const mod = await moduleRepository.create({
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });
      const level = await locationRepository.create({
        moduleId: mod.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const insert = await insertRepository.create({ name: "orphan" });
      await insertRepository.place({ id: insert.id, locationId: level.id });

      const cell = await locationRepository.create({
        moduleId: mod.id,
        parentId: level.id,
        label: "A1",
        pathSegments: ["MUSE", "1", "A1"],
        locationType: "leaf",
        insertId: insert.id,
      });

      await insertRepository.removeFromLocation({ id: insert.id });

      const unplaced = await locationRepository.findById({ id: cell.id });
      expect(unplaced!.insertId).toBe(insert.id);
      expect(unplaced!.parentId).toBeNull();
      expect(unplaced!.path).toBe("A1");
    });

    it("deleting the insert cascades its cells", async () => {
      const mod = await moduleRepository.create({
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 11,
      });
      const level = await locationRepository.create({
        moduleId: mod.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const insert = await insertRepository.create({ name: "to delete" });
      await insertRepository.place({ id: insert.id, locationId: level.id });

      const cell = await locationRepository.create({
        moduleId: mod.id,
        parentId: level.id,
        label: "A1",
        pathSegments: ["MUSE", "1", "A1"],
        locationType: "leaf",
        insertId: insert.id,
      });

      await insertRepository.remove({ id: insert.id });

      const gone = await locationRepository.findById({ id: cell.id });
      expect(gone).toBeNull();
    });
  });

  describe("listWithDetails", () => {
    it("returns inserts with template + location + module joined", async () => {
      const template = await templateRepository.create({
        name: "Plano 3600",
      });
      const version = await templateRepository.getVersion({
        templateId: template.id,
        version: 1,
      });
      const mod = await moduleRepository.create({
        name: "MUSE",
        primaryDimensionLabel: "level",
        primaryDimensionCount: 3,
      });
      const level = await locationRepository.create({
        moduleId: mod.id,
        label: "1",
        pathSegments: ["MUSE", "1"],
        locationType: "receptacle",
      });
      const placed = await insertRepository.create({
        name: "Plano #1",
        templateId: template.id,
        templateVersionId: version!.id,
      });
      await insertRepository.place({ id: placed.id, locationId: level.id });

      await insertRepository.create({
        name: "Plano #2 (on shelf)",
        templateId: template.id,
        templateVersionId: version!.id,
      });

      const all = await insertRepository.listWithDetails();
      expect(all).toHaveLength(2);
      const p1 = all.find((i) => i.name === "Plano #1")!;
      expect(p1.templateName).toBe("Plano 3600");
      expect(p1.locationPath).toBe("MUSE:1");
      expect(p1.moduleName).toBe("MUSE");

      const unplacedList = await insertRepository.listWithDetails({
        placement: "unplaced",
      });
      expect(unplacedList).toHaveLength(1);
      expect(unplacedList[0].name).toBe("Plano #2 (on shelf)");

      const placedList = await insertRepository.listWithDetails({
        placement: "placed",
      });
      expect(placedList).toHaveLength(1);
      expect(placedList[0].name).toBe("Plano #1");

      const filteredByTemplate = await insertRepository.listWithDetails({
        templateId: template.id,
      });
      expect(filteredByTemplate).toHaveLength(2);
    });
  });
});
