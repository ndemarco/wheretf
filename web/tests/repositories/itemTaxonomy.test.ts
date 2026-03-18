import { itemRepository } from "@/repositories/itemRepository";
import { categoryRepository } from "@/repositories/categoryRepository";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { aspectRepository } from "@/repositories/aspectRepository";

describe("item taxonomy", () => {
  // Helpers
  async function createItem(name = "M3x10 SHCS") {
    return itemRepository.create({ name });
  }

  async function createCategory(name = "Fasteners") {
    return categoryRepository.create({ name, icon: "screw", color: "#4488cc" });
  }

  async function createThreadAspect() {
    const aspect = await aspectRepository.create({
      name: "Thread",
      description: "Threaded fastener properties",
    });
    const diameter = await parameterDefinitionRepository.create({
      name: "Thread diameter",
      dataType: "text",
    });
    const pitch = await parameterDefinitionRepository.create({
      name: "Thread pitch",
      dataType: "numeric",
      unit: "mm",
      defaultValue: 0.5,
    });
    const direction = await parameterDefinitionRepository.create({
      name: "Thread direction",
      dataType: "text",
      defaultValue: "right",
    });

    await aspectRepository.addParameter({
      aspectId: aspect.id,
      parameterDefinitionId: diameter.id,
      required: true,
      sortOrder: 1,
    });
    await aspectRepository.addParameter({
      aspectId: aspect.id,
      parameterDefinitionId: pitch.id,
      required: false,
      sortOrder: 2,
    });
    await aspectRepository.addParameter({
      aspectId: aspect.id,
      parameterDefinitionId: direction.id,
      required: false,
      sortOrder: 3,
    });

    return { aspect, diameter, pitch, direction };
  }

  describe("categories", () => {
    it("adds a category to an item", async () => {
      const item = await createItem();
      const cat = await createCategory();

      const ic = await itemRepository.addCategory({
        itemId: item.id,
        categoryId: cat.id,
      });

      expect(ic.itemId).toBe(item.id);
      expect(ic.categoryId).toBe(cat.id);
      expect(ic.isPrimary).toBe(false);
    });

    it("adds a primary category", async () => {
      const item = await createItem();
      const cat = await createCategory();

      const ic = await itemRepository.addCategory({
        itemId: item.id,
        categoryId: cat.id,
        isPrimary: true,
      });

      expect(ic.isPrimary).toBe(true);
    });

    it("supports multiple categories on one item", async () => {
      const item = await createItem();
      const cat1 = await createCategory("Fasteners");
      const cat2 = await categoryRepository.create({ name: "Hardware" });

      await itemRepository.addCategory({ itemId: item.id, categoryId: cat1.id });
      await itemRepository.addCategory({ itemId: item.id, categoryId: cat2.id });

      const cats = await itemRepository.getCategories({ itemId: item.id });
      expect(cats).toHaveLength(2);
    });

    it("enforces single primary — setting new primary unsets old", async () => {
      const item = await createItem();
      const cat1 = await createCategory("Fasteners");
      const cat2 = await categoryRepository.create({ name: "Hardware" });

      await itemRepository.addCategory({
        itemId: item.id,
        categoryId: cat1.id,
        isPrimary: true,
      });
      await itemRepository.addCategory({
        itemId: item.id,
        categoryId: cat2.id,
        isPrimary: true,
      });

      const cats = await itemRepository.getCategories({ itemId: item.id });
      const primaries = cats.filter((c) => c.isPrimary);
      expect(primaries).toHaveLength(1);
      expect(primaries[0].name).toBe("Hardware");
    });

    it("removes a category from an item", async () => {
      const item = await createItem();
      const cat = await createCategory();

      await itemRepository.addCategory({ itemId: item.id, categoryId: cat.id });
      await itemRepository.removeCategory({ itemId: item.id, categoryId: cat.id });

      const cats = await itemRepository.getCategories({ itemId: item.id });
      expect(cats).toHaveLength(0);
    });

    it("throws when removing category not on item", async () => {
      const item = await createItem();
      await expect(
        itemRepository.removeCategory({
          itemId: item.id,
          categoryId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not on item");
    });

    it("sets primary category", async () => {
      const item = await createItem();
      const cat1 = await createCategory("Fasteners");
      const cat2 = await categoryRepository.create({ name: "Hardware" });

      await itemRepository.addCategory({ itemId: item.id, categoryId: cat1.id, isPrimary: true });
      await itemRepository.addCategory({ itemId: item.id, categoryId: cat2.id });

      await itemRepository.setPrimaryCategory({
        itemId: item.id,
        categoryId: cat2.id,
      });

      const cats = await itemRepository.getCategories({ itemId: item.id });
      const primary = cats.find((c) => c.isPrimary);
      expect(primary!.name).toBe("Hardware");
      const nonPrimary = cats.find((c) => !c.isPrimary);
      expect(nonPrimary!.name).toBe("Fasteners");
    });

    it("getCategories returns joined data", async () => {
      const item = await createItem();
      const cat = await createCategory();

      await itemRepository.addCategory({
        itemId: item.id,
        categoryId: cat.id,
        isPrimary: true,
      });

      const cats = await itemRepository.getCategories({ itemId: item.id });
      expect(cats[0].name).toBe("Fasteners");
      expect(cats[0].icon).toBe("screw");
      expect(cats[0].color).toBe("#4488cc");
      expect(cats[0].isPrimary).toBe(true);
    });

    it("rejects duplicate category on same item", async () => {
      const item = await createItem();
      const cat = await createCategory();

      await itemRepository.addCategory({ itemId: item.id, categoryId: cat.id });
      await expect(
        itemRepository.addCategory({ itemId: item.id, categoryId: cat.id })
      ).rejects.toThrow();
    });

    it("throws when item does not exist", async () => {
      const cat = await createCategory();
      await expect(
        itemRepository.addCategory({
          itemId: "00000000-0000-0000-0000-000000000000",
          categoryId: cat.id,
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("applyAspect", () => {
    it("applies an aspect and creates parameter value slots", async () => {
      const item = await createItem();
      const { aspect } = await createThreadAspect();

      const ia = await itemRepository.applyAspect({
        itemId: item.id,
        aspectId: aspect.id,
      });

      expect(ia.itemId).toBe(item.id);
      expect(ia.aspectId).toBe(aspect.id);

      const values = await itemRepository.getParameterValues({ itemId: item.id });
      expect(values).toHaveLength(3);
    });

    it("pre-fills parameter defaults from param definition", async () => {
      const item = await createItem();
      const { aspect } = await createThreadAspect();

      await itemRepository.applyAspect({ itemId: item.id, aspectId: aspect.id });

      const values = await itemRepository.getParameterValues({ itemId: item.id });
      const pitchVal = values.find((v) => v.parameterName === "Thread pitch");
      expect(pitchVal!.value).toBe(0.5);

      const dirVal = values.find((v) => v.parameterName === "Thread direction");
      expect(dirVal!.value).toBe("right");
    });

    it("pre-fills aspect-level default over param-level default", async () => {
      const item = await createItem();
      const aspect = await aspectRepository.create({ name: "Left Thread" });
      const direction = await parameterDefinitionRepository.create({
        name: "Direction",
        dataType: "text",
        defaultValue: "right",
      });
      await aspectRepository.addParameter({
        aspectId: aspect.id,
        parameterDefinitionId: direction.id,
        defaultValue: "left",
      });

      await itemRepository.applyAspect({ itemId: item.id, aspectId: aspect.id });

      const values = await itemRepository.getParameterValues({ itemId: item.id });
      expect(values[0].value).toBe("left");
    });

    it("leaves value null when no defaults exist", async () => {
      const item = await createItem();
      const { aspect } = await createThreadAspect();

      await itemRepository.applyAspect({ itemId: item.id, aspectId: aspect.id });

      const values = await itemRepository.getParameterValues({ itemId: item.id });
      const diameterVal = values.find((v) => v.parameterName === "Thread diameter");
      expect(diameterVal!.value).toBeNull();
    });

    it("rejects duplicate aspect on same item", async () => {
      const item = await createItem();
      const { aspect } = await createThreadAspect();

      await itemRepository.applyAspect({ itemId: item.id, aspectId: aspect.id });
      await expect(
        itemRepository.applyAspect({ itemId: item.id, aspectId: aspect.id })
      ).rejects.toThrow();
    });

    it("throws when item does not exist", async () => {
      const { aspect } = await createThreadAspect();
      await expect(
        itemRepository.applyAspect({
          itemId: "00000000-0000-0000-0000-000000000000",
          aspectId: aspect.id,
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("removeAspect", () => {
    it("removes aspect and cascades parameter values", async () => {
      const item = await createItem();
      const { aspect } = await createThreadAspect();

      await itemRepository.applyAspect({ itemId: item.id, aspectId: aspect.id });
      await itemRepository.removeAspect({ itemId: item.id, aspectId: aspect.id });

      const aspects = await itemRepository.getAspects({ itemId: item.id });
      expect(aspects).toHaveLength(0);

      const values = await itemRepository.getParameterValues({ itemId: item.id });
      expect(values).toHaveLength(0);
    });

    it("throws when aspect not applied", async () => {
      const item = await createItem();
      await expect(
        itemRepository.removeAspect({
          itemId: item.id,
          aspectId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not applied");
    });
  });

  describe("setParameterValue", () => {
    it("updates an existing parameter value from aspect", async () => {
      const item = await createItem();
      const { aspect, diameter } = await createThreadAspect();

      const ia = await itemRepository.applyAspect({
        itemId: item.id,
        aspectId: aspect.id,
      });

      const updated = await itemRepository.setParameterValue({
        itemId: item.id,
        parameterDefinitionId: diameter.id,
        itemAspectId: ia.id,
        value: "M3",
      });

      expect(updated.value).toBe("M3");
    });

    it("creates a standalone parameter value", async () => {
      const item = await createItem();
      const length = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
        unit: "mm",
      });

      const pv = await itemRepository.setParameterValue({
        itemId: item.id,
        parameterDefinitionId: length.id,
        value: 10,
      });

      expect(pv.value).toBe(10);
      expect(pv.itemAspectId).toBeNull();
    });

    it("getParameterValues returns joined definition data", async () => {
      const item = await createItem();
      const length = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
        unit: "mm",
      });

      await itemRepository.setParameterValue({
        itemId: item.id,
        parameterDefinitionId: length.id,
        value: 10,
      });

      const values = await itemRepository.getParameterValues({ itemId: item.id });
      expect(values).toHaveLength(1);
      expect(values[0].parameterName).toBe("Length");
      expect(values[0].dataType).toBe("numeric");
      expect(values[0].unit).toBe("mm");
      expect(values[0].value).toBe(10);
    });
  });

  describe("full composition", () => {
    it("models a machine screw with aspects, categories, and standalone params", async () => {
      // Create the item
      const item = await itemRepository.create({
        name: "M3x10 Socket Head Cap Screw",
        description: "18-8 stainless, black oxide",
      });

      // Add categories
      const fasteners = await categoryRepository.create({
        name: "Fasteners",
        icon: "screw",
      });
      const hardware = await categoryRepository.create({ name: "Hardware" });

      await itemRepository.addCategory({
        itemId: item.id,
        categoryId: fasteners.id,
        isPrimary: true,
      });
      await itemRepository.addCategory({
        itemId: item.id,
        categoryId: hardware.id,
      });

      // Create and apply Thread aspect
      const { aspect: threadAspect, diameter, pitch } = await createThreadAspect();
      const ia = await itemRepository.applyAspect({
        itemId: item.id,
        aspectId: threadAspect.id,
      });

      // Fill in values
      await itemRepository.setParameterValue({
        itemId: item.id,
        parameterDefinitionId: diameter.id,
        itemAspectId: ia.id,
        value: "M3",
      });
      await itemRepository.setParameterValue({
        itemId: item.id,
        parameterDefinitionId: pitch.id,
        itemAspectId: ia.id,
        value: 0.5,
      });

      // Add standalone Length parameter
      const lengthDef = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
        unit: "mm",
      });
      await itemRepository.setParameterValue({
        itemId: item.id,
        parameterDefinitionId: lengthDef.id,
        value: 10,
      });

      // Verify full state
      const cats = await itemRepository.getCategories({ itemId: item.id });
      expect(cats).toHaveLength(2);
      expect(cats.find((c) => c.isPrimary)!.name).toBe("Fasteners");

      const aspects = await itemRepository.getAspects({ itemId: item.id });
      expect(aspects).toHaveLength(1);

      const values = await itemRepository.getParameterValues({ itemId: item.id });
      expect(values).toHaveLength(4); // 3 from Thread aspect + 1 standalone

      const lengthVal = values.find((v) => v.parameterName === "Length");
      expect(lengthVal!.value).toBe(10);
      expect(lengthVal!.itemAspectId).toBeNull();

      const diameterVal = values.find((v) => v.parameterName === "Thread diameter");
      expect(diameterVal!.value).toBe("M3");
      expect(diameterVal!.itemAspectId).toBe(ia.id);
    });
  });
});
