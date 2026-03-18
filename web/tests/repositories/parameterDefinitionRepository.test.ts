import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { transactionRepository } from "@/repositories/transactionRepository";

describe("parameterDefinitionRepository", () => {
  describe("create", () => {
    it("creates a numeric parameter with unit", async () => {
      const pd = await parameterDefinitionRepository.create({
        name: "Thread diameter",
        dataType: "numeric",
        unit: "mm",
      });

      expect(pd.id).toBeDefined();
      expect(pd.name).toBe("Thread diameter");
      expect(pd.dataType).toBe("numeric");
      expect(pd.unit).toBe("mm");
      expect(pd.defaultValue).toBeNull();
      expect(pd.constraints).toBeNull();
    });

    it("creates a boolean parameter", async () => {
      const pd = await parameterDefinitionRepository.create({
        name: "RoHS compliant",
        dataType: "boolean",
        defaultValue: true,
      });

      expect(pd.dataType).toBe("boolean");
      expect(pd.defaultValue).toBe(true);
    });

    it("creates an enum parameter with enumValues", async () => {
      const pd = await parameterDefinitionRepository.create({
        name: "Drive style",
        dataType: "enum",
        constraints: {
          enumValues: ["Phillips", "Torx", "Hex", "Slotted"],
        },
      });

      expect(pd.dataType).toBe("enum");
      expect(pd.constraints).toEqual({
        enumValues: ["Phillips", "Torx", "Hex", "Slotted"],
      });
    });

    it("rejects enum without enumValues", async () => {
      await expect(
        parameterDefinitionRepository.create({
          name: "Bad enum",
          dataType: "enum",
        })
      ).rejects.toThrow("enumValues");
    });

    it("creates numeric with range constraints", async () => {
      const pd = await parameterDefinitionRepository.create({
        name: "Thread pitch",
        dataType: "numeric",
        unit: "mm",
        constraints: { min: 0.2, max: 6.0 },
      });

      expect(pd.constraints).toEqual({ min: 0.2, max: 6.0 });
    });

    it("creates with default value", async () => {
      const pd = await parameterDefinitionRepository.create({
        name: "Thread direction",
        dataType: "text",
        defaultValue: "right",
      });

      expect(pd.defaultValue).toBe("right");
    });

    it("logs a transaction", async () => {
      const pd = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
        unit: "mm",
      });

      const txns = await transactionRepository.listRecent();
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("parameterDefinition.create");
      expect(txns[0].entityId).toBe(pd.id);
    });

    it("rejects duplicate names", async () => {
      await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
      });
      await expect(
        parameterDefinitionRepository.create({
          name: "Length",
          dataType: "numeric",
        })
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("returns the parameter definition by ID", async () => {
      const created = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
        unit: "mm",
      });
      const found = await parameterDefinitionRepository.findById({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Length");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await parameterDefinitionRepository.findById({
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the parameter definition by name", async () => {
      await parameterDefinitionRepository.create({
        name: "Voltage rating",
        dataType: "numeric",
        unit: "V",
      });
      const found = await parameterDefinitionRepository.findByName({
        name: "Voltage rating",
      });
      expect(found).not.toBeNull();
      expect(found!.unit).toBe("V");
    });

    it("returns null for nonexistent name", async () => {
      const found = await parameterDefinitionRepository.findByName({ name: "Nope" });
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all parameter definitions ordered by name", async () => {
      await parameterDefinitionRepository.create({ name: "Voltage", dataType: "numeric" });
      await parameterDefinitionRepository.create({ name: "Color", dataType: "text" });
      await parameterDefinitionRepository.create({ name: "Length", dataType: "numeric" });

      const all = await parameterDefinitionRepository.list();
      expect(all).toHaveLength(3);
      expect(all[0].name).toBe("Color");
      expect(all[1].name).toBe("Length");
      expect(all[2].name).toBe("Voltage");
    });

    it("returns empty array when none exist", async () => {
      const all = await parameterDefinitionRepository.list();
      expect(all).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns updated record", async () => {
      const created = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
        unit: "mm",
      });

      const updated = await parameterDefinitionRepository.update({
        id: created.id,
        unit: "inches",
        defaultValue: 1.0,
      });

      expect(updated.unit).toBe("inches");
      expect(updated.defaultValue).toBe(1.0);
      expect(updated.name).toBe("Length");
    });

    it("validates enum constraints on update", async () => {
      const created = await parameterDefinitionRepository.create({
        name: "Drive style",
        dataType: "enum",
        constraints: { enumValues: ["Phillips", "Torx"] },
      });

      await expect(
        parameterDefinitionRepository.update({
          id: created.id,
          constraints: {},
        })
      ).rejects.toThrow("enumValues");
    });

    it("logs a transaction", async () => {
      const created = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
      });
      await parameterDefinitionRepository.update({
        id: created.id,
        unit: "mm",
      });

      const txns = await transactionRepository.listRecent();
      const updateTx = txns.find(
        (t) => t.actionType === "parameterDefinition.update"
      );
      expect(updateTx).toBeDefined();
    });

    it("throws for nonexistent parameter definition", async () => {
      await expect(
        parameterDefinitionRepository.update({
          id: "00000000-0000-0000-0000-000000000000",
          unit: "mm",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the parameter definition", async () => {
      const created = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
      });
      await parameterDefinitionRepository.remove({ id: created.id });

      const found = await parameterDefinitionRepository.findById({ id: created.id });
      expect(found).toBeNull();
    });

    it("logs a transaction", async () => {
      const created = await parameterDefinitionRepository.create({
        name: "Length",
        dataType: "numeric",
      });
      await parameterDefinitionRepository.remove({ id: created.id });

      const txns = await transactionRepository.listRecent();
      const deleteTx = txns.find(
        (t) => t.actionType === "parameterDefinition.delete"
      );
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent parameter definition", async () => {
      await expect(
        parameterDefinitionRepository.remove({
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });
});
