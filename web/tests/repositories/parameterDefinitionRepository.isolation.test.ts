import { parameterDefinitionRepository } from "@/repositories/parameterDefinitionRepository";
import { testCtx, createTestOrg } from "../setup";

describe("parameterDefinitionRepository isolation (additive)", () => {
  it("list returns global + own, not other org's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await parameterDefinitionRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global Param",
      dataType: "numeric",
    });
    await parameterDefinitionRepository.create({
      ...testCtx,
      name: "A Private",
      dataType: "text",
    });
    await parameterDefinitionRepository.create({
      ...b,
      name: "B Private",
      dataType: "text",
    });

    const aNames = (
      await parameterDefinitionRepository.list({ orgId: testCtx.orgId })
    )
      .map((p) => p.name)
      .sort();
    const bNames = (
      await parameterDefinitionRepository.list({ orgId: b.orgId })
    )
      .map((p) => p.name)
      .sort();

    expect(aNames).toEqual(["A Private", "Global Param"]);
    expect(bNames).toEqual(["B Private", "Global Param"]);
  });

  it("org A cannot fetch org B's private parameter by id", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bParam = await parameterDefinitionRepository.create({
      ...b,
      name: "B Private",
      dataType: "numeric",
    });

    const fromA = await parameterDefinitionRepository.findById({
      orgId: testCtx.orgId,
      id: bParam.id,
    });
    expect(fromA).toBeNull();

    const fromB = await parameterDefinitionRepository.findById({
      orgId: b.orgId,
      id: bParam.id,
    });
    expect(fromB?.id).toBe(bParam.id);
  });

  it("update on another org's private parameter throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bParam = await parameterDefinitionRepository.create({
      ...b,
      name: "B Private",
      dataType: "numeric",
    });

    await expect(
      parameterDefinitionRepository.update({
        ...testCtx,
        id: bParam.id,
        unit: "hijack",
      }),
    ).rejects.toThrow("not found");
  });
});
