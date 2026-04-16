import { standardRepository } from "@/repositories/standardRepository";
import { aspectRepository } from "@/repositories/aspectRepository";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { itemRepository } from "@/repositories/itemRepository";
import { transactionRepository } from "@/repositories/transactionRepository";

// Helper: create an aspect
async function createAspect(name = "Machine Screw Threading") {
  return aspectRepository.create({ name });
}

// Helper: create a parameter definition
async function createParam(
  name: string,
  dataType: "numeric" | "text" | "boolean" | "enum" = "numeric",
  unit?: string
) {
  return parameterDefinitionRepository.create({ name, dataType, unit });
}

// Helper: create a standard (no aspect — caller links via addAspect)
async function createStandard(name = "UNC", domainTag?: string) {
  return standardRepository.create({
    name,
    description: `${name} standard`,
    domainTag,
  });
}

// Helper: create a standard linked to an aspect
async function createStandardForAspect(
  aspectId: string,
  name = "UNC",
  domainTag?: string
) {
  const standard = await createStandard(name, domainTag);
  await standardRepository.addAspect({ standardId: standard.id, aspectId });
  return standard;
}

describe("standardRepository", () => {
  describe("create", () => {
    it("creates a standard without requiring an aspect", async () => {
      const standard = await createStandard();

      expect(standard.id).toBeDefined();
      expect(standard.name).toBe("UNC");
      expect(standard.description).toBe("UNC standard");
      expect(standard.createdAt).toBeInstanceOf(Date);
    });

    it("stores domainTag", async () => {
      const standard = await createStandard("UNF", "Unified Thread Standard");
      expect(standard.domainTag).toBe("Unified Thread Standard");
    });

    it("logs a transaction", async () => {
      const standard = await createStandard();

      const txns = await transactionRepository.listRecent();
      const stdTxn = txns.find((t) => t.actionType === "standard.create");
      expect(stdTxn).toBeDefined();
      expect(stdTxn!.entityId).toBe(standard.id);
    });

    it("rejects duplicate names", async () => {
      await createStandard("UNC");
      await expect(createStandard("UNC")).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("returns the standard by ID", async () => {
      const created = await createStandard();
      const found = await standardRepository.findById({ id: created.id });

      expect(found).not.toBeNull();
      expect(found!.name).toBe("UNC");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await standardRepository.findById({
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the standard by name", async () => {
      await createStandard();
      const found = await standardRepository.findByName({ name: "UNC" });

      expect(found).not.toBeNull();
      expect(found!.name).toBe("UNC");
    });
  });

  describe("list", () => {
    it("returns all standards with aspect count", async () => {
      const aspect = await createAspect();
      const unc = await createStandardForAspect(aspect.id, "UNC");
      await createStandardForAspect(aspect.id, "UNF");

      const list = await standardRepository.list();
      expect(list).toHaveLength(2);
      const uncEntry = list.find((s) => s.id === unc.id);
      expect(Number(uncEntry!.aspectCount)).toBe(1);
    });

    it("returns 0 aspectCount for unlinked standard", async () => {
      await createStandard("Orphan");
      const list = await standardRepository.list();
      expect(Number(list[0].aspectCount)).toBe(0);
    });

    it("returns empty array when none exist", async () => {
      const list = await standardRepository.list();
      expect(list).toHaveLength(0);
    });
  });

  describe("listByAspect", () => {
    it("returns only standards linked to the given aspect", async () => {
      const threading = await createAspect("Threading");
      const drive = await createAspect("Fastener Drive");
      await createStandardForAspect(threading.id, "UNC");
      await createStandardForAspect(threading.id, "UNF");
      await createStandardForAspect(drive.id, "Phillips");

      const list = await standardRepository.listByAspect({
        aspectId: threading.id,
      });
      expect(list).toHaveLength(2);
      expect(list.map((s) => s.name).sort()).toEqual(["UNC", "UNF"]);
    });

    it("returns a standard linked to multiple aspects from each aspect", async () => {
      const threading = await createAspect("Threading");
      const drive = await createAspect("Fastener Drive");
      const crossAspect = await createStandard("ISO 4762");
      await standardRepository.addAspect({
        standardId: crossAspect.id,
        aspectId: threading.id,
      });
      await standardRepository.addAspect({
        standardId: crossAspect.id,
        aspectId: drive.id,
      });

      const forThreading = await standardRepository.listByAspect({
        aspectId: threading.id,
      });
      const forDrive = await standardRepository.listByAspect({
        aspectId: drive.id,
      });

      expect(forThreading.map((s) => s.id)).toContain(crossAspect.id);
      expect(forDrive.map((s) => s.id)).toContain(crossAspect.id);
    });
  });

  describe("addAspect / removeAspect / listAspectsForStandard", () => {
    it("links a standard to an aspect", async () => {
      const aspect = await createAspect();
      const standard = await createStandard();

      const link = await standardRepository.addAspect({
        standardId: standard.id,
        aspectId: aspect.id,
      });

      expect(link.standardId).toBe(standard.id);
      expect(link.aspectId).toBe(aspect.id);
    });

    it("logs a transaction on addAspect", async () => {
      const aspect = await createAspect();
      const standard = await createStandard();
      await standardRepository.addAspect({
        standardId: standard.id,
        aspectId: aspect.id,
      });

      const txns = await transactionRepository.listRecent();
      const txn = txns.find((t) => t.actionType === "aspect_standard.create");
      expect(txn).toBeDefined();
    });

    it("rejects duplicate aspect link", async () => {
      const aspect = await createAspect();
      const standard = await createStandard();
      await standardRepository.addAspect({
        standardId: standard.id,
        aspectId: aspect.id,
      });
      await expect(
        standardRepository.addAspect({
          standardId: standard.id,
          aspectId: aspect.id,
        })
      ).rejects.toThrow();
    });

    it("removes an aspect link", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);

      await standardRepository.removeAspect({
        standardId: standard.id,
        aspectId: aspect.id,
      });

      const list = await standardRepository.listByAspect({
        aspectId: aspect.id,
      });
      expect(list).toHaveLength(0);
    });

    it("throws when removing a link that does not exist", async () => {
      const aspect = await createAspect();
      const standard = await createStandard();
      await expect(
        standardRepository.removeAspect({
          standardId: standard.id,
          aspectId: aspect.id,
        })
      ).rejects.toThrow();
    });

    it("logs a transaction on removeAspect", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);

      await standardRepository.removeAspect({
        standardId: standard.id,
        aspectId: aspect.id,
      });

      const txns = await transactionRepository.listRecent();
      const txn = txns.find((t) => t.actionType === "aspect_standard.delete");
      expect(txn).toBeDefined();
    });

    it("listAspectsForStandard returns linked aspects with coverage counts", async () => {
      const aspect = await createAspect();
      const pitch = await createParam("pitch", "numeric", "mm");
      const majorDia = await createParam("major_dia", "numeric", "mm");
      await aspectRepository.addParameter({
        aspectId: aspect.id,
        parameterDefinitionId: pitch.id,
      });
      await aspectRepository.addParameter({
        aspectId: aspect.id,
        parameterDefinitionId: majorDia.id,
      });

      const standard = await createStandardForAspect(aspect.id, "UNC");
      await standardRepository.addParameter({
        standardId: standard.id,
        parameterDefinitionId: pitch.id,
        role: "key",
      });

      const aspects_ = await standardRepository.listAspectsForStandard({
        standardId: standard.id,
      });

      expect(aspects_).toHaveLength(1);
      expect(aspects_[0].aspectName).toBe("Machine Screw Threading");
      expect(Number(aspects_[0].parameterCount)).toBe(2);
      expect(Number(aspects_[0].coveredCount)).toBe(1);
    });

    it("listAspectsForStandard returns multiple aspects for a cross-aspect standard", async () => {
      const threading = await createAspect("Threading");
      const drive = await createAspect("Fastener Drive");
      const standard = await createStandard("ISO 4762");
      await standardRepository.addAspect({
        standardId: standard.id,
        aspectId: threading.id,
      });
      await standardRepository.addAspect({
        standardId: standard.id,
        aspectId: drive.id,
      });

      const aspectList = await standardRepository.listAspectsForStandard({
        standardId: standard.id,
      });

      expect(aspectList).toHaveLength(2);
      expect(aspectList.map((a) => a.aspectName).sort()).toEqual([
        "Fastener Drive",
        "Threading",
      ]);
    });
  });

  describe("listStandardsForAspectWithCoverage", () => {
    it("returns standards with coverage data", async () => {
      const aspect = await createAspect();
      const pitch = await createParam("pitch", "numeric", "mm");
      const majorDia = await createParam("major_dia", "numeric", "mm");
      await aspectRepository.addParameter({
        aspectId: aspect.id,
        parameterDefinitionId: pitch.id,
      });
      await aspectRepository.addParameter({
        aspectId: aspect.id,
        parameterDefinitionId: majorDia.id,
      });

      const standard = await createStandardForAspect(aspect.id, "UNC");
      await standardRepository.addParameter({
        standardId: standard.id,
        parameterDefinitionId: pitch.id,
        role: "key",
      });
      await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });

      const result = await standardRepository.listStandardsForAspectWithCoverage(
        { aspectId: aspect.id }
      );

      expect(result).toHaveLength(1);
      expect(result[0].standardName).toBe("UNC");
      expect(Number(result[0].parameterCount)).toBe(2);
      expect(Number(result[0].coveredCount)).toBe(1);
      expect(Number(result[0].designationCount)).toBe(1);
      expect(result[0].coveredParamIds).toContain(pitch.id);
      expect(result[0].coveredParamIds).not.toContain(majorDia.id);
    });

    it("returns empty array for aspect with no linked standards", async () => {
      const aspect = await createAspect();
      const result = await standardRepository.listStandardsForAspectWithCoverage(
        { aspectId: aspect.id }
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns the updated standard", async () => {
      const standard = await createStandard();

      const updated = await standardRepository.update({
        id: standard.id,
        description: "Unified National Coarse",
        domainTag: "Unified Thread Standard",
      });

      expect(updated.description).toBe("Unified National Coarse");
      expect(updated.domainTag).toBe("Unified Thread Standard");
    });

    it("logs a transaction", async () => {
      const standard = await createStandard();
      await standardRepository.update({
        id: standard.id,
        description: "updated",
      });

      const txns = await transactionRepository.listRecent();
      const updateTxn = txns.find((t) => t.actionType === "standard.update");
      expect(updateTxn).toBeDefined();
    });

    it("throws for nonexistent standard", async () => {
      await expect(
        standardRepository.update({
          id: "00000000-0000-0000-0000-000000000000",
          name: "nope",
        })
      ).rejects.toThrow();
    });
  });

  describe("remove", () => {
    it("deletes the standard", async () => {
      const standard = await createStandard();
      await standardRepository.remove({ id: standard.id });

      const found = await standardRepository.findById({ id: standard.id });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const standard = await createStandard();
      await standardRepository.remove({ id: standard.id });

      const txns = await transactionRepository.listRecent();
      const deleteTxn = txns.find((t) => t.actionType === "standard.delete");
      expect(deleteTxn).toBeDefined();
      expect(deleteTxn!.entityId).toBe(standard.id);
    });

    it("throws for nonexistent standard", async () => {
      await expect(
        standardRepository.remove({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow();
    });
  });

  describe("countItemsUsing", () => {
    it("returns 0 when no items use the standard", async () => {
      const standard = await createStandard();
      const count = await standardRepository.countItemsUsing({
        standardId: standard.id,
      });
      expect(count).toBe(0);
    });

    it("counts items with the standard applied", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item1 = await itemRepository.create({ name: "Screw A" });
      const item2 = await itemRepository.create({ name: "Screw B" });

      await standardRepository.applyToItem({
        itemId: item1.id,
        standardId: standard.id,
      });
      await standardRepository.applyToItem({
        itemId: item2.id,
        standardId: standard.id,
      });

      const count = await standardRepository.countItemsUsing({
        standardId: standard.id,
      });
      expect(count).toBe(2);
    });
  });

  // --- Standard parameters ---

  describe("addParameter / getParameters / removeParameter", () => {
    it("adds a parameter to a standard with role", async () => {
      const standard = await createStandard();
      const pitch = await createParam("pitch", "numeric", "mm");

      const sp = await standardRepository.addParameter({
        standardId: standard.id,
        parameterDefinitionId: pitch.id,
        role: "key",
      });

      expect(sp.id).toBeDefined();
      expect(sp.role).toBe("key");
    });

    it("retrieves parameters with definition details", async () => {
      const standard = await createStandard();
      const pitch = await createParam("pitch", "numeric", "mm");
      const majorDia = await createParam("major_dia", "numeric", "mm");

      await standardRepository.addParameter({
        standardId: standard.id,
        parameterDefinitionId: pitch.id,
        role: "key",
        sortOrder: 0,
      });
      await standardRepository.addParameter({
        standardId: standard.id,
        parameterDefinitionId: majorDia.id,
        role: "derived",
        sortOrder: 1,
      });

      const params = await standardRepository.getParameters({
        standardId: standard.id,
      });
      expect(params).toHaveLength(2);
      expect(params[0].parameterName).toBe("pitch");
      expect(params[0].unit).toBe("mm");
      expect(params[0].role).toBe("key");
      expect(params[1].parameterName).toBe("major_dia");
      expect(params[1].role).toBe("derived");
    });

    it("removes a parameter from a standard", async () => {
      const standard = await createStandard();
      const pitch = await createParam("pitch", "numeric", "mm");

      await standardRepository.addParameter({
        standardId: standard.id,
        parameterDefinitionId: pitch.id,
        role: "key",
      });

      await standardRepository.removeParameter({
        standardId: standard.id,
        parameterDefinitionId: pitch.id,
      });

      const params = await standardRepository.getParameters({
        standardId: standard.id,
      });
      expect(params).toHaveLength(0);
    });

    it("rejects duplicate parameter on same standard", async () => {
      const standard = await createStandard();
      const pitch = await createParam("pitch", "numeric", "mm");

      await standardRepository.addParameter({
        standardId: standard.id,
        parameterDefinitionId: pitch.id,
        role: "key",
      });

      await expect(
        standardRepository.addParameter({
          standardId: standard.id,
          parameterDefinitionId: pitch.id,
          role: "derived",
        })
      ).rejects.toThrow();
    });
  });

  // --- Designations ---

  describe("designations", () => {
    it("creates a designation with compound values", async () => {
      const standard = await createStandard();
      const pitch = await createParam("pitch", "numeric", "mm");

      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {
          [pitch.id]: { value: 0.794, source_value: "32", source_unit: "TPI" },
        },
      });

      expect(designation.id).toBeDefined();
      expect(designation.designation).toBe("#8-32");
      const values = designation.values as Record<string, unknown>;
      expect(values[pitch.id]).toEqual({
        value: 0.794,
        source_value: "32",
        source_unit: "TPI",
      });
    });

    it("lists designations with pagination", async () => {
      const standard = await createStandard();

      for (const d of ["#4-40", "#6-32", "#8-32", "#10-24", "#10-32"]) {
        await standardRepository.createDesignation({
          standardId: standard.id,
          designation: d,
          values: {},
        });
      }

      const page1 = await standardRepository.listDesignations({
        standardId: standard.id,
        limit: 3,
        offset: 0,
      });
      expect(page1).toHaveLength(3);

      const page2 = await standardRepository.listDesignations({
        standardId: standard.id,
        limit: 3,
        offset: 3,
      });
      expect(page2).toHaveLength(2);
    });

    it("counts designations", async () => {
      const standard = await createStandard();

      await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });
      await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#10-24",
        values: {},
      });

      const count = await standardRepository.countDesignations({
        standardId: standard.id,
      });
      expect(count).toBe(2);
    });

    it("updates designation values", async () => {
      const standard = await createStandard();
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: { old: true },
      });

      const updated = await standardRepository.updateDesignation({
        id: designation.id,
        values: { new: true },
      });

      expect(updated.values).toEqual({ new: true });
    });

    it("deletes a designation", async () => {
      const standard = await createStandard();
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });

      await standardRepository.removeDesignation({ id: designation.id });

      const found = await standardRepository.findDesignationById({
        id: designation.id,
      });
      expect(found).toBeNull();
    });

    it("rejects duplicate designation within same standard", async () => {
      const standard = await createStandard();

      await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });

      await expect(
        standardRepository.createDesignation({
          standardId: standard.id,
          designation: "#8-32",
          values: {},
        })
      ).rejects.toThrow();
    });

    it("allows same designation string in different standards", async () => {
      const std1 = await createStandard("Phillips");
      const std2 = await createStandard("Pozidriv");

      const d1 = await standardRepository.createDesignation({
        standardId: std1.id,
        designation: "#2",
        values: { system: "Phillips" },
      });
      const d2 = await standardRepository.createDesignation({
        standardId: std2.id,
        designation: "#2",
        values: { system: "Pozidriv" },
      });

      expect(d1.id).not.toBe(d2.id);
      expect(d1.designation).toBe("#2");
      expect(d2.designation).toBe("#2");
    });
  });

  // --- Item-standard associations ---

  describe("item standards", () => {
    it("applies a standard to an item", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item = await itemRepository.create({ name: "M3 Screw" });

      const is = await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
      });

      expect(is.itemId).toBe(item.id);
      expect(is.standardId).toBe(standard.id);
      expect(is.designationId).toBeNull();
      expect(is.isCustom).toBe(false);
    });

    it("applies a standard with a designation", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: { pitch: 0.794 },
      });
      const item = await itemRepository.create({ name: "#8-32 Screw" });

      const is = await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
        designationId: designation.id,
      });

      expect(is.designationId).toBe(designation.id);
    });

    it("logs a transaction", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
      });

      const txns = await transactionRepository.listRecent();
      const isTxn = txns.find(
        (t) => t.actionType === "item_standard.create"
      );
      expect(isTxn).toBeDefined();
    });

    it("rejects duplicate standard on same item", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
      });

      await expect(
        standardRepository.applyToItem({
          itemId: item.id,
          standardId: standard.id,
        })
      ).rejects.toThrow();
    });

    it("changes the designation on an item-standard", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const d1 = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });
      const d2 = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#10-24",
        values: {},
      });
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
        designationId: d1.id,
      });

      const updated = await standardRepository.setDesignation({
        itemId: item.id,
        standardId: standard.id,
        designationId: d2.id,
      });

      expect(updated.designationId).toBe(d2.id);
      expect(updated.isCustom).toBe(false);
    });

    it("marks an item-standard as custom", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
      });

      const updated = await standardRepository.markCustom({
        itemId: item.id,
        standardId: standard.id,
      });

      expect(updated.isCustom).toBe(true);
    });

    it("retrieves item standards with joined details", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const pitch = await createParam("pitch", "numeric", "mm");
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {
          [pitch.id]: { value: 0.794, source_value: "32", source_unit: "TPI" },
        },
      });
      const item = await itemRepository.create({ name: "#8-32 Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
        designationId: designation.id,
      });

      const itemStds = await standardRepository.getItemStandards({
        itemId: item.id,
      });

      expect(itemStds).toHaveLength(1);
      expect(itemStds[0].standardName).toBe("UNC");
      expect(itemStds[0].designation).toBe("#8-32");
      const values = itemStds[0].designationValues as Record<string, unknown>;
      expect(values[pitch.id]).toEqual({
        value: 0.794,
        source_value: "32",
        source_unit: "TPI",
      });
    });

    it("removes a standard from an item", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
      });

      await standardRepository.removeFromItem({
        itemId: item.id,
        standardId: standard.id,
      });

      const itemStds = await standardRepository.getItemStandards({
        itemId: item.id,
      });
      expect(itemStds).toHaveLength(0);
    });

    it("auto-fills item parameter values from the designation on apply", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const pitch = await createParam("pitch", "numeric", "mm");
      const majorDia = await createParam("major_diameter", "numeric", "mm");
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "M3x0.5",
        values: {
          [pitch.id]: { value: 0.5, source_value: "0.5", source_unit: "mm" },
          [majorDia.id]: 3,
        },
      });
      const item = await itemRepository.create({ name: "M3x0.5 screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
        designationId: designation.id,
      });

      const paramValues = await itemRepository.getParameterValues({
        itemId: item.id,
      });
      const byParam = new Map(
        paramValues.map((p) => [p.parameterDefinitionId, p.value])
      );
      expect(byParam.get(pitch.id)).toBe(0.5);
      expect(byParam.get(majorDia.id)).toBe(3);
    });

    it("auto-fills parameter values when designation is changed later", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const pitch = await createParam("pitch", "numeric", "mm");
      const d1 = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "M3x0.5",
        values: { [pitch.id]: { value: 0.5 } },
      });
      const d2 = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "M4x0.7",
        values: { [pitch.id]: { value: 0.7 } },
      });
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
        designationId: d1.id,
      });
      await standardRepository.setDesignation({
        itemId: item.id,
        standardId: standard.id,
        designationId: d2.id,
      });

      const values = await itemRepository.getParameterValues({
        itemId: item.id,
      });
      const pitchRow = values.find((v) => v.parameterDefinitionId === pitch.id);
      expect(pitchRow?.value).toBe(0.7);
    });

    it("ignores designation values keyed by non-UUID strings", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "legacy",
        values: { pitch: 0.5, "not-a-uuid": "x" },
      });
      const item = await itemRepository.create({ name: "Legacy" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
        designationId: designation.id,
      });

      const values = await itemRepository.getParameterValues({
        itemId: item.id,
      });
      expect(values).toHaveLength(0);
    });

    it("filters designations by q substring (case-insensitive)", async () => {
      const standard = await createStandard();
      await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "M3x0.5",
        values: {},
      });
      await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "M4x0.7",
        values: {},
      });
      await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });

      const hits = await standardRepository.listDesignations({
        standardId: standard.id,
        q: "m3",
      });
      expect(hits).toHaveLength(1);
      expect(hits[0].designation).toBe("M3x0.5");
    });

    it("logs a transaction on removal", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
      });
      await standardRepository.removeFromItem({
        itemId: item.id,
        standardId: standard.id,
      });

      const txns = await transactionRepository.listRecent();
      const deleteTxn = txns.find(
        (t) => t.actionType === "item_standard.delete"
      );
      expect(deleteTxn).toBeDefined();
    });
  });

  // --- Cascade behavior ---

  describe("cascades", () => {
    it("deleting a standard cascades to its designations", async () => {
      const standard = await createStandard();
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });

      await standardRepository.remove({ id: standard.id });

      const found = await standardRepository.findDesignationById({
        id: designation.id,
      });
      expect(found).toBeNull();
    });

    it("deleting a standard cascades to item_standards", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
      });

      await standardRepository.remove({ id: standard.id });

      const itemStds = await standardRepository.getItemStandards({
        itemId: item.id,
      });
      expect(itemStds).toHaveLength(0);
    });

    it("deleting a designation nullifies item_standards.designationId", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);
      const designation = await standardRepository.createDesignation({
        standardId: standard.id,
        designation: "#8-32",
        values: {},
      });
      const item = await itemRepository.create({ name: "Screw" });

      await standardRepository.applyToItem({
        itemId: item.id,
        standardId: standard.id,
        designationId: designation.id,
      });

      await standardRepository.removeDesignation({ id: designation.id });

      const itemStds = await standardRepository.getItemStandards({
        itemId: item.id,
      });
      expect(itemStds).toHaveLength(1);
      expect(itemStds[0].designationId).toBeNull();
      expect(itemStds[0].designation).toBeNull();
    });

    it("deleting an aspect removes the aspect_standards link but leaves the standard intact", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);

      await aspectRepository.remove({ id: aspect.id });

      // Standard still exists
      const found = await standardRepository.findById({ id: standard.id });
      expect(found).not.toBeNull();

      // But it's no longer linked to the aspect
      const list = await standardRepository.listByAspect({
        aspectId: aspect.id,
      });
      expect(list).toHaveLength(0);
    });

    it("deleting a standard removes the aspect_standards link", async () => {
      const aspect = await createAspect();
      const standard = await createStandardForAspect(aspect.id);

      await standardRepository.remove({ id: standard.id });

      const list = await standardRepository.listByAspect({
        aspectId: aspect.id,
      });
      expect(list).toHaveLength(0);
    });
  });
});
