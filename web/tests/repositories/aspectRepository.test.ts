import { aspectRepository } from "@/repositories/aspectRepository";
import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { transactionRepository } from "@/repositories/transactionRepository";
import { testCtx } from "../setup";

describe("aspectRepository", () => {
  describe("create", () => {
    it("creates an aspect with name and description", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
        description: "Threaded fastener properties",
      });

      expect(aspect.id).toBeDefined();
      expect(aspect.name).toBe("Thread");
      expect(aspect.description).toBe("Threaded fastener properties");
      expect(aspect.createdAt).toBeInstanceOf(Date);
    });

    it("creates with minimal fields", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Material",
      });

      expect(aspect.name).toBe("Material");
      expect(aspect.description).toBeNull();
    });

    it("logs a transaction", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      expect(txns).toHaveLength(1);
      expect(txns[0].actionType).toBe("aspect.create");
      expect(txns[0].entityId).toBe(aspect.id);
    });

    it("rejects duplicate names", async () => {
      await aspectRepository.create({ ...testCtx, name: "Thread" });
      await expect(
        aspectRepository.create({ ...testCtx, name: "Thread" })
      ).rejects.toThrow();
    });
  });

  describe("findById", () => {
    it("returns the aspect by ID", async () => {
      const created = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const found = await aspectRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Thread");
    });

    it("returns null for nonexistent ID", async () => {
      const found = await aspectRepository.findById({
        orgId: testCtx.orgId,
        id: "00000000-0000-0000-0000-000000000000",
      });
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the aspect by name", async () => {
      await aspectRepository.create({
        ...testCtx,
        name: "Drive",
        description: "Fastener drive type",
      });
      const found = await aspectRepository.findByName({
        orgId: testCtx.orgId,
        name: "Drive",
      });
      expect(found).not.toBeNull();
      expect(found!.description).toBe("Fastener drive type");
    });

    it("returns null for nonexistent name", async () => {
      const found = await aspectRepository.findByName({
        orgId: testCtx.orgId,
        name: "Nope",
      });
      expect(found).toBeNull();
    });
  });

  describe("list", () => {
    it("returns all aspects ordered by name", async () => {
      await aspectRepository.create({ ...testCtx, name: "Thread" });
      await aspectRepository.create({ ...testCtx, name: "Drive" });
      await aspectRepository.create({ ...testCtx, name: "Material" });

      const all = await aspectRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(3);
      expect(all[0].name).toBe("Drive");
      expect(all[1].name).toBe("Material");
      expect(all[2].name).toBe("Thread");
    });

    it("returns empty array when none exist", async () => {
      const all = await aspectRepository.list({ orgId: testCtx.orgId });
      expect(all).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("updates fields and returns updated record", async () => {
      const created = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
        description: "Original",
      });

      const updated = await aspectRepository.update({
        ...testCtx,
        id: created.id,
        description: "Threaded fastener characteristics",
      });

      expect(updated.description).toBe("Threaded fastener characteristics");
      expect(updated.name).toBe("Thread");
    });

    it("logs a transaction", async () => {
      const created = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      await aspectRepository.update({
        ...testCtx,
        id: created.id,
        description: "Updated",
      });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const updateTx = txns.find((t) => t.actionType === "aspect.update");
      expect(updateTx).toBeDefined();
    });

    it("throws for nonexistent aspect", async () => {
      await expect(
        aspectRepository.update({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
          name: "Nope",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("remove", () => {
    it("deletes the aspect", async () => {
      const created = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      await aspectRepository.remove({ ...testCtx, id: created.id });

      const found = await aspectRepository.findById({
        orgId: testCtx.orgId,
        id: created.id,
      });
      expect(found).toBeNull();
    });

    it("cascades to aspect parameters", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const pd = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Thread diameter",
        dataType: "numeric",
        unit: "mm",
      });
      await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd.id,
      });

      await aspectRepository.remove({ ...testCtx, id: aspect.id });

      const params = await aspectRepository.getParameters({
        orgId: testCtx.orgId,
        aspectId: aspect.id,
      });
      expect(params).toHaveLength(0);
    });

    it("logs a transaction", async () => {
      const created = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      await aspectRepository.remove({ ...testCtx, id: created.id });

      const txns = await transactionRepository.listRecent({
        orgId: testCtx.orgId,
      });
      const deleteTx = txns.find((t) => t.actionType === "aspect.delete");
      expect(deleteTx).toBeDefined();
      expect(deleteTx!.afterState).toBeNull();
    });

    it("throws for nonexistent aspect", async () => {
      await expect(
        aspectRepository.remove({
          ...testCtx,
          id: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("addParameter", () => {
    it("adds a parameter definition to an aspect", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const pd = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Thread diameter",
        dataType: "numeric",
        unit: "mm",
      });

      const ap = await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd.id,
        required: true,
        sortOrder: 1,
      });

      expect(ap.aspectId).toBe(aspect.id);
      expect(ap.parameterDefinitionId).toBe(pd.id);
      expect(ap.required).toBe(true);
      expect(ap.sortOrder).toBe(1);
    });

    it("adds with aspect-level default value", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const pd = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Thread direction",
        dataType: "text",
        defaultValue: "right",
      });

      const ap = await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd.id,
        defaultValue: "left",
      });

      expect(ap.defaultValue).toBe("left");
    });

    it("throws for nonexistent aspect", async () => {
      const pd = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Length",
        dataType: "numeric",
      });

      await expect(
        aspectRepository.addParameter({
          ...testCtx,
          aspectId: "00000000-0000-0000-0000-000000000000",
          parameterDefinitionId: pd.id,
        })
      ).rejects.toThrow("not found");
    });

    it("rejects duplicate parameter on same aspect", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const pd = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Thread diameter",
        dataType: "numeric",
      });

      await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd.id,
      });

      await expect(
        aspectRepository.addParameter({
          ...testCtx,
          aspectId: aspect.id,
          parameterDefinitionId: pd.id,
        })
      ).rejects.toThrow();
    });
  });

  describe("removeParameter", () => {
    it("removes a parameter from an aspect", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const pd = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Thread diameter",
        dataType: "numeric",
      });

      await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd.id,
      });

      await aspectRepository.removeParameter({
        orgId: testCtx.orgId,
        aspectId: aspect.id,
        parameterDefinitionId: pd.id,
      });

      const params = await aspectRepository.getParameters({
        orgId: testCtx.orgId,
        aspectId: aspect.id,
      });
      expect(params).toHaveLength(0);
    });

    it("throws when parameter not on aspect", async () => {
      await expect(
        aspectRepository.removeParameter({
          orgId: testCtx.orgId,
          aspectId: "00000000-0000-0000-0000-000000000000",
          parameterDefinitionId: "00000000-0000-0000-0000-000000000000",
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("getParameters", () => {
    it("returns parameters with joined definition data", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const pd1 = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Thread diameter",
        dataType: "numeric",
        unit: "mm",
      });
      const pd2 = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Thread pitch",
        dataType: "numeric",
        unit: "mm",
        defaultValue: 0.5,
      });

      await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd1.id,
        required: true,
        sortOrder: 1,
      });
      await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd2.id,
        required: false,
        sortOrder: 2,
        defaultValue: 0.7,
      });

      const params = await aspectRepository.getParameters({
        orgId: testCtx.orgId,
        aspectId: aspect.id,
      });

      expect(params).toHaveLength(2);
      expect(params[0].parameterName).toBe("Thread diameter");
      expect(params[0].dataType).toBe("numeric");
      expect(params[0].unit).toBe("mm");
      expect(params[0].required).toBe(true);

      expect(params[1].parameterName).toBe("Thread pitch");
      expect(params[1].defaultValue).toBe(0.7);
      expect(params[1].parameterDefaultValue).toBe(0.5);
    });

    it("returns ordered by sortOrder", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Thread",
      });
      const pd1 = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Alpha",
        dataType: "text",
      });
      const pd2 = await parameterDefinitionRepository.create({
        ...testCtx,
        name: "Beta",
        dataType: "text",
      });

      await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd2.id,
        sortOrder: 1,
      });
      await aspectRepository.addParameter({
        ...testCtx,
        aspectId: aspect.id,
        parameterDefinitionId: pd1.id,
        sortOrder: 2,
      });

      const params = await aspectRepository.getParameters({
        orgId: testCtx.orgId,
        aspectId: aspect.id,
      });
      expect(params[0].parameterName).toBe("Beta");
      expect(params[1].parameterName).toBe("Alpha");
    });

    it("returns empty array for aspect with no parameters", async () => {
      const aspect = await aspectRepository.create({
        ...testCtx,
        name: "Empty",
      });
      const params = await aspectRepository.getParameters({
        orgId: testCtx.orgId,
        aspectId: aspect.id,
      });
      expect(params).toHaveLength(0);
    });
  });
});
