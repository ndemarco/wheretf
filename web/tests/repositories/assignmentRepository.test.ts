import { db } from "@/db/connection";
import { locations } from "@/db/schema";
import { moduleRepository } from "@/repositories/moduleRepository";
import { itemRepository } from "@/repositories/itemRepository";
import { assignmentRepository } from "@/repositories/assignmentRepository";
import { transactionRepository } from "@/repositories/transactionRepository";

async function createTestModule() {
  return moduleRepository.create({
    name: `MOD-${Date.now()}`,
    primaryDimensionLabel: "level",
    primaryDimensionCount: 5,
  });
}

async function createTestLocation(moduleId: string, label: string) {
  const [loc] = await db
    .insert(locations)
    .values({
      moduleId,
      label,
      path: `TEST:${label}`,
      pathSegments: ["TEST", label],
      locationType: "leaf",
    })
    .returning();
  return loc;
}

async function createTestItem(name: string) {
  return itemRepository.create({ name });
}

describe("assignmentRepository", () => {
  describe("create", () => {
    it("creates a placed assignment", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item = await createTestItem("Resistor Pack");

      const assignment = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      expect(assignment.id).toBeDefined();
      expect(assignment.itemId).toBe(item.id);
      expect(assignment.locationId).toBe(loc.id);
      expect(assignment.assignmentType).toBe("placed");
    });

    it("creates a provisional assignment", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item = await createTestItem("Capacitor Pack");

      const assignment = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "provisional",
      });

      expect(assignment.assignmentType).toBe("provisional");
    });

    it("logs a transaction on create", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item = await createTestItem("LED Strip");

      const assignment = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      const txns = await transactionRepository.listRecent();
      const createTx = txns.find(
        (t) =>
          t.actionType === "assignment.create" &&
          t.entityId === assignment.id,
      );
      expect(createTx).toBeDefined();
      expect(createTx!.entityType).toBe("assignment");
      expect(createTx!.beforeState).toBeNull();
    });

    it("blocks second placed assignment at same location without co-storability", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item1 = await createTestItem("Item A");
      const item2 = await createTestItem("Item B");

      await assignmentRepository.create({
        itemId: item1.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      await expect(
        assignmentRepository.create({
          itemId: item2.id,
          locationId: loc.id,
          assignmentType: "placed",
        }),
      ).rejects.toThrow(
        "Location already has a placed assignment and items are not co-storable",
      );
    });

    it("allows co-storable items to share a placed location", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item1 = await createTestItem("M3 Bolt");
      const item2 = await createTestItem("M3 Nut");

      await itemRepository.addCoStorability({
        itemAId: item1.id,
        itemBId: item2.id,
        reason: "Same thread size",
      });

      await assignmentRepository.create({
        itemId: item1.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      const second = await assignmentRepository.create({
        itemId: item2.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      expect(second.assignmentType).toBe("placed");
      expect(second.locationId).toBe(loc.id);
    });

    it("allows multiple provisional assignments at the same location", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item1 = await createTestItem("Widget A");
      const item2 = await createTestItem("Widget B");

      const a1 = await assignmentRepository.create({
        itemId: item1.id,
        locationId: loc.id,
        assignmentType: "provisional",
      });

      const a2 = await assignmentRepository.create({
        itemId: item2.id,
        locationId: loc.id,
        assignmentType: "provisional",
      });

      expect(a1.assignmentType).toBe("provisional");
      expect(a2.assignmentType).toBe("provisional");
    });
  });

  describe("findById", () => {
    it("returns the assignment by ID", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item = await createTestItem("Screw");

      const created = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      const found = await assignmentRepository.findById({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.itemId).toBe(item.id);
    });

    it("returns null for nonexistent ID", async () => {
      const found = await assignmentRepository.findById({
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByItemId", () => {
    it("returns all assignments for an item", async () => {
      const mod = await createTestModule();
      const loc1 = await createTestLocation(mod.id, "A1");
      const loc2 = await createTestLocation(mod.id, "A2");
      const item = await createTestItem("Washer");

      await assignmentRepository.create({
        itemId: item.id,
        locationId: loc1.id,
        assignmentType: "placed",
      });
      await assignmentRepository.create({
        itemId: item.id,
        locationId: loc2.id,
        assignmentType: "provisional",
      });

      const results = await assignmentRepository.findByItemId({
        itemId: item.id,
      });
      expect(results).toHaveLength(2);
    });
  });

  describe("findByLocationId", () => {
    it("returns all assignments at a location", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item1 = await createTestItem("Bolt");
      const item2 = await createTestItem("Nut");

      await itemRepository.addCoStorability({
        itemAId: item1.id,
        itemBId: item2.id,
      });

      await assignmentRepository.create({
        itemId: item1.id,
        locationId: loc.id,
        assignmentType: "placed",
      });
      await assignmentRepository.create({
        itemId: item2.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      const results = await assignmentRepository.findByLocationId({
        locationId: loc.id,
      });
      expect(results).toHaveLength(2);
    });
  });

  describe("convertToPlaced", () => {
    it("converts a provisional assignment to placed", async () => {
      const mod = await createTestModule();
      const loc1 = await createTestLocation(mod.id, "A1");
      const loc2 = await createTestLocation(mod.id, "A2");
      const item = await createTestItem("Diode");

      const provisional = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc1.id,
        assignmentType: "provisional",
      });

      const placed = await assignmentRepository.convertToPlaced({
        id: provisional.id,
        locationId: loc2.id,
      });

      expect(placed.assignmentType).toBe("placed");
      expect(placed.locationId).toBe(loc2.id);
    });

    it("logs a transaction on convert", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item = await createTestItem("Transistor");

      const provisional = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "provisional",
      });

      await assignmentRepository.convertToPlaced({
        id: provisional.id,
        locationId: loc.id,
      });

      const txns = await transactionRepository.listRecent();
      const convertTx = txns.find(
        (t) => t.actionType === "assignment.convertToPlaced",
      );
      expect(convertTx).toBeDefined();
      expect(convertTx!.beforeState).toBeTruthy();
      expect(convertTx!.afterState).toBeTruthy();
    });

    it("throws for nonexistent assignment", async () => {
      await expect(
        assignmentRepository.convertToPlaced({
          id: "00000000-0000-0000-0000-000000000000",
          locationId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("not found");
    });
  });

  describe("move", () => {
    it("moves a placed assignment to a new location", async () => {
      const mod = await createTestModule();
      const loc1 = await createTestLocation(mod.id, "A1");
      const loc2 = await createTestLocation(mod.id, "A2");
      const item = await createTestItem("Relay");

      const assignment = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc1.id,
        assignmentType: "placed",
      });

      const moved = await assignmentRepository.move({
        id: assignment.id,
        newLocationId: loc2.id,
      });

      expect(moved.locationId).toBe(loc2.id);
    });

    it("logs a transaction on move", async () => {
      const mod = await createTestModule();
      const loc1 = await createTestLocation(mod.id, "A1");
      const loc2 = await createTestLocation(mod.id, "A2");
      const item = await createTestItem("Fuse");

      const assignment = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc1.id,
        assignmentType: "placed",
      });

      await assignmentRepository.move({
        id: assignment.id,
        newLocationId: loc2.id,
      });

      const txns = await transactionRepository.listRecent();
      const moveTx = txns.find((t) => t.actionType === "assignment.move");
      expect(moveTx).toBeDefined();
      expect(moveTx!.beforeState).toBeTruthy();
      expect(moveTx!.afterState).toBeTruthy();
    });

    it("blocks move to occupied location without co-storability", async () => {
      const mod = await createTestModule();
      const loc1 = await createTestLocation(mod.id, "A1");
      const loc2 = await createTestLocation(mod.id, "A2");
      const item1 = await createTestItem("Part X");
      const item2 = await createTestItem("Part Y");

      await assignmentRepository.create({
        itemId: item1.id,
        locationId: loc2.id,
        assignmentType: "placed",
      });

      const assignment = await assignmentRepository.create({
        itemId: item2.id,
        locationId: loc1.id,
        assignmentType: "placed",
      });

      await expect(
        assignmentRepository.move({
          id: assignment.id,
          newLocationId: loc2.id,
        }),
      ).rejects.toThrow("not co-storable");
    });
  });

  describe("remove", () => {
    it("deletes the assignment", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item = await createTestItem("Connector");

      const assignment = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      await assignmentRepository.remove({ id: assignment.id });

      const found = await assignmentRepository.findById({
        id: assignment.id,
      });
      expect(found).toBeNull();
    });

    it("logs a transaction on remove", async () => {
      const mod = await createTestModule();
      const loc = await createTestLocation(mod.id, "A1");
      const item = await createTestItem("Switch");

      const assignment = await assignmentRepository.create({
        itemId: item.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      await assignmentRepository.remove({ id: assignment.id });

      const txns = await transactionRepository.listRecent();
      const deleteTx = txns.find(
        (t) => t.actionType === "assignment.delete",
      );
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent assignment", async () => {
      await expect(
        assignmentRepository.remove({
          id: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("not found");
    });
  });

  describe("listProvisional", () => {
    it("returns all provisional assignments", async () => {
      const mod = await createTestModule();
      const loc1 = await createTestLocation(mod.id, "A1");
      const loc2 = await createTestLocation(mod.id, "A2");
      const item1 = await createTestItem("Sensor A");
      const item2 = await createTestItem("Sensor B");
      const item3 = await createTestItem("Sensor C");

      await assignmentRepository.create({
        itemId: item1.id,
        locationId: loc1.id,
        assignmentType: "provisional",
      });
      await assignmentRepository.create({
        itemId: item2.id,
        locationId: loc2.id,
        assignmentType: "provisional",
      });
      await assignmentRepository.create({
        itemId: item3.id,
        locationId: loc1.id,
        assignmentType: "placed",
      });

      const provisionals = await assignmentRepository.listProvisional();
      expect(provisionals).toHaveLength(2);
      expect(provisionals.every((a) => a.assignmentType === "provisional")).toBe(
        true,
      );
    });

    it("returns empty array when no provisional assignments exist", async () => {
      const provisionals = await assignmentRepository.listProvisional();
      expect(provisionals).toHaveLength(0);
    });
  });
});
