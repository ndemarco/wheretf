import { itemRepository } from "@/repositories/itemRepository";
import { categoryRepository } from "@/repositories/categoryRepository";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { aspectRepository } from "@/repositories/aspectRepository";
import { moduleRepository } from "@/repositories/moduleRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { assignmentRepository } from "@/repositories/assignmentRepository";

// Helper: create a full machine screw item with taxonomy
async function seedScrew({
  name,
  threadDiameter,
  headType,
  length,
  threadAspectId,
  headAspectId,
  threadDiameterDefId,
  headTypeDefId,
  lengthDefId,
  fastenersId,
}: {
  name: string;
  threadDiameter: string;
  headType: string;
  length: number;
  threadAspectId: string;
  headAspectId: string;
  threadDiameterDefId: string;
  headTypeDefId: string;
  lengthDefId: string;
  fastenersId: string;
}) {
  const item = await itemRepository.create({ name });
  await itemRepository.addCategory({
    itemId: item.id,
    categoryId: fastenersId,
    isPrimary: true,
  });
  const threadIa = await itemRepository.applyAspect({
    itemId: item.id,
    aspectId: threadAspectId,
  });
  const headIa = await itemRepository.applyAspect({
    itemId: item.id,
    aspectId: headAspectId,
  });
  await itemRepository.setParameterValue({
    itemId: item.id,
    parameterDefinitionId: threadDiameterDefId,
    itemAspectId: threadIa.id,
    value: threadDiameter,
  });
  await itemRepository.setParameterValue({
    itemId: item.id,
    parameterDefinitionId: headTypeDefId,
    itemAspectId: headIa.id,
    value: headType,
  });
  await itemRepository.setParameterValue({
    itemId: item.id,
    parameterDefinitionId: lengthDefId,
    value: length,
  });
  return item;
}

describe("itemRepository.listRich", () => {
  // Shared test data IDs
  let fastenersId: string;
  let electronicsId: string;
  let threadAspectId: string;
  let headAspectId: string;
  let electricalAspectId: string;
  let threadDiameterDefId: string;
  let headTypeDefId: string;
  let lengthDefId: string;
  let resistanceDefId: string;
  let packageCodeDefId: string;

  beforeEach(async () => {
    // Categories
    const fasteners = await categoryRepository.create({
      name: "Fasteners",
      icon: "screw",
      color: "#4488cc",
    });
    fastenersId = fasteners.id;

    const electronics = await categoryRepository.create({
      name: "Electronics",
      icon: "chip",
      color: "#44cc88",
    });
    electronicsId = electronics.id;

    // Parameter definitions
    const threadDiameterDef = await parameterDefinitionRepository.create({
      name: "Thread diameter",
      dataType: "text",
    });
    threadDiameterDefId = threadDiameterDef.id;

    const headTypeDef = await parameterDefinitionRepository.create({
      name: "Head type",
      dataType: "text",
    });
    headTypeDefId = headTypeDef.id;

    const lengthDef = await parameterDefinitionRepository.create({
      name: "Length",
      dataType: "numeric",
      unit: "mm",
    });
    lengthDefId = lengthDef.id;

    const resistanceDef = await parameterDefinitionRepository.create({
      name: "Resistance",
      dataType: "text",
    });
    resistanceDefId = resistanceDef.id;

    const packageCodeDef = await parameterDefinitionRepository.create({
      name: "Package code",
      dataType: "text",
    });
    packageCodeDefId = packageCodeDef.id;

    // Aspects
    const threadAspect = await aspectRepository.create({ name: "Thread" });
    threadAspectId = threadAspect.id;
    await aspectRepository.addParameter({
      aspectId: threadAspectId,
      parameterDefinitionId: threadDiameterDefId,
      required: true,
    });

    const headAspect = await aspectRepository.create({ name: "Head" });
    headAspectId = headAspect.id;
    await aspectRepository.addParameter({
      aspectId: headAspectId,
      parameterDefinitionId: headTypeDefId,
    });

    const electricalAspect = await aspectRepository.create({
      name: "Electrical",
    });
    electricalAspectId = electricalAspect.id;
    await aspectRepository.addParameter({
      aspectId: electricalAspectId,
      parameterDefinitionId: resistanceDefId,
    });
    await aspectRepository.addParameter({
      aspectId: electricalAspectId,
      parameterDefinitionId: packageCodeDefId,
    });
  });

  describe("basic listing", () => {
    it("returns all items with taxonomy data", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);

      const item = result.items[0];
      expect(item.name).toBe("M3x10 SHCS");

      // Categories
      expect(item.categories).toHaveLength(1);
      expect(item.categories[0].name).toBe("Fasteners");
      expect(item.categories[0].isPrimary).toBe(true);

      // Aspects with parameters
      expect(item.aspects).toHaveLength(2);
      const threadAspect = item.aspects.find((a) => a.name === "Thread");
      expect(threadAspect).toBeDefined();
      expect(threadAspect!.parameters).toHaveLength(1);
      expect(threadAspect!.parameters[0].parameterName).toBe(
        "Thread diameter"
      );
      expect(threadAspect!.parameters[0].value).toBe("M3");

      // Standalone parameters
      expect(item.standaloneParameters).toHaveLength(1);
      expect(item.standaloneParameters[0].parameterName).toBe("Length");
      expect(item.standaloneParameters[0].value).toBe(10);
    });

    it("returns empty result when no items exist", async () => {
      const result = await itemRepository.listRich();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("filtering by parameter value", () => {
    it("filters by a single parameter value", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });
      await seedScrew({
        name: "M4x12 SHCS",
        threadDiameter: "M4",
        headType: "SHCS",
        length: 12,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({
        filters: [
          { parameterDefinitionId: threadDiameterDefId, value: "M3" },
        ],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("M3x10 SHCS");
    });

    it("filters by multiple parameters (AND logic)", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });
      await seedScrew({
        name: "M3x10 Pan Head",
        threadDiameter: "M3",
        headType: "Pan Head",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({
        filters: [
          { parameterDefinitionId: threadDiameterDefId, value: "M3" },
          { parameterDefinitionId: headTypeDefId, value: "SHCS" },
        ],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("M3x10 SHCS");
    });

    it("returns empty when no items match filters", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({
        filters: [
          { parameterDefinitionId: threadDiameterDefId, value: "M5" },
        ],
      });

      expect(result.items).toHaveLength(0);
    });
  });

  describe("filtering by category", () => {
    it("filters by category", async () => {
      const screw = await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      // Create a resistor with Electronics category
      const resistor = await itemRepository.create({ name: "10kΩ Resistor" });
      await itemRepository.addCategory({
        itemId: resistor.id,
        categoryId: electronicsId,
        isPrimary: true,
      });

      const result = await itemRepository.listRich({
        categoryId: fastenersId,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("M3x10 SHCS");
    });
  });

  describe("search", () => {
    it("searches by item name", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });
      await seedScrew({
        name: "M4x12 SHCS",
        threadDiameter: "M4",
        headType: "SHCS",
        length: 12,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({ query: "M3" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("M3x10 SHCS");
    });

    it("searches by description", async () => {
      const item = await itemRepository.create({
        name: "Screw",
        description: "Stainless steel fastener",
      });

      const result = await itemRepository.listRich({ query: "stainless" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Screw");
    });

    it("searches across parameter values", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      // Create a resistor with "10k" parameter value
      const resistor = await itemRepository.create({
        name: "SMD Resistor",
      });
      const ia = await itemRepository.applyAspect({
        itemId: resistor.id,
        aspectId: electricalAspectId,
      });
      await itemRepository.setParameterValue({
        itemId: resistor.id,
        parameterDefinitionId: resistanceDefId,
        itemAspectId: ia.id,
        value: "10kΩ",
      });

      const result = await itemRepository.listRich({ query: "10k" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("SMD Resistor");
    });

    it("combines search with filters", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });
      await seedScrew({
        name: "M3x16 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 16,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({
        query: "x16",
        filters: [
          { parameterDefinitionId: threadDiameterDefId, value: "M3" },
        ],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("M3x16 SHCS");
    });
  });

  describe("sorting", () => {
    it("sorts by name ascending (default)", async () => {
      await seedScrew({
        name: "M4x12 SHCS",
        threadDiameter: "M4",
        headType: "SHCS",
        length: 12,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({ sortBy: "name" });

      expect(result.items[0].name).toBe("M3x10 SHCS");
      expect(result.items[1].name).toBe("M4x12 SHCS");
    });

    it("sorts by name descending", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });
      await seedScrew({
        name: "M4x12 SHCS",
        threadDiameter: "M4",
        headType: "SHCS",
        length: 12,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({
        sortBy: "name",
        sortDirection: "desc",
      });

      expect(result.items[0].name).toBe("M4x12 SHCS");
      expect(result.items[1].name).toBe("M3x10 SHCS");
    });

    it("sorts by a numeric parameter value", async () => {
      await seedScrew({
        name: "M3x16 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 16,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const result = await itemRepository.listRich({
        sortBy: lengthDefId,
        sortDirection: "asc",
      });

      expect(result.items[0].name).toBe("M3x10 SHCS");
      expect(result.items[1].name).toBe("M3x16 SHCS");
    });

    it("puts items without the sort parameter at the end", async () => {
      await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      // Item without Length parameter
      const bare = await itemRepository.create({ name: "Bare Item" });

      const result = await itemRepository.listRich({
        sortBy: lengthDefId,
      });

      expect(result.items[0].name).toBe("M3x10 SHCS");
      expect(result.items[1].name).toBe("Bare Item");
    });
  });

  describe("assignments in rich listing", () => {
    it("includes assignment locations", async () => {
      const screw = await seedScrew({
        name: "M3x10 SHCS",
        threadDiameter: "M3",
        headType: "SHCS",
        length: 10,
        threadAspectId,
        headAspectId,
        threadDiameterDefId,
        headTypeDefId,
        lengthDefId,
        fastenersId,
      });

      const mod = await moduleRepository.create({ name: "MUSE", primaryDimensionLabel: "Level", primaryDimensionCount: 4 });
      const loc = await locationRepository.create({
        moduleId: mod.id,
        label: "A3",
        pathSegments: ["MUSE", "Level 2", "A3"],
        locationType: "fixed",
      });
      await assignmentRepository.create({
        itemId: screw.id,
        locationId: loc.id,
        assignmentType: "placed",
      });

      const result = await itemRepository.listRich();

      expect(result.items[0].assignments).toHaveLength(1);
      expect(result.items[0].assignments[0].locationPath).toBe(
        "MUSE:Level 2:A3"
      );
      expect(result.items[0].assignments[0].assignmentType).toBe("placed");
    });
  });
});

describe("itemRepository.getCategoryCounts", () => {
  it("returns category counts", async () => {
    const fasteners = await categoryRepository.create({
      name: "Fasteners",
      sortOrder: 0,
    });
    const electronics = await categoryRepository.create({
      name: "Electronics",
      sortOrder: 1,
    });

    const item1 = await itemRepository.create({ name: "Screw" });
    const item2 = await itemRepository.create({ name: "Bolt" });
    const item3 = await itemRepository.create({ name: "Resistor" });

    await itemRepository.addCategory({
      itemId: item1.id,
      categoryId: fasteners.id,
    });
    await itemRepository.addCategory({
      itemId: item2.id,
      categoryId: fasteners.id,
    });
    await itemRepository.addCategory({
      itemId: item3.id,
      categoryId: electronics.id,
    });

    const counts = await itemRepository.getCategoryCounts();

    expect(counts).toHaveLength(2);
    expect(counts[0].name).toBe("Fasteners");
    expect(counts[0].count).toBe(2);
    expect(counts[1].name).toBe("Electronics");
    expect(counts[1].count).toBe(1);
  });

  it("returns zero counts when no items match filters", async () => {
    const fasteners = await categoryRepository.create({ name: "Fasteners" });
    const item = await itemRepository.create({ name: "Screw" });
    await itemRepository.addCategory({
      itemId: item.id,
      categoryId: fasteners.id,
    });

    const threadDef = await parameterDefinitionRepository.create({
      name: "Thread diameter",
      dataType: "text",
    });

    // Filter by a value no item has
    const counts = await itemRepository.getCategoryCounts({
      filters: [{ parameterDefinitionId: threadDef.id, value: "M99" }],
    });

    expect(counts[0].count).toBe(0);
  });
});
