import { interfaceTypeRepository } from "@/repositories/interfaceTypeRepository";
import { testCtx, createTestOrg } from "../setup";

describe("interfaceTypeRepository isolation (additive)", () => {
  it("list returns global + own, not other org's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await interfaceTypeRepository.create({
      ...testCtx,
      asGlobal: true,
      identifier: "global-plano",
      description: "Global",
    });
    await interfaceTypeRepository.create({
      ...testCtx,
      identifier: "a-custom",
      description: "A private",
    });
    await interfaceTypeRepository.create({
      ...b,
      identifier: "b-custom",
      description: "B private",
    });

    const aIdents = (await interfaceTypeRepository.list({ orgId: testCtx.orgId }))
      .map((i) => i.identifier)
      .sort();
    const bIdents = (await interfaceTypeRepository.list({ orgId: b.orgId }))
      .map((i) => i.identifier)
      .sort();

    expect(aIdents).toEqual(["a-custom", "global-plano"]);
    expect(bIdents).toEqual(["b-custom", "global-plano"]);
  });

  it("org A cannot fetch org B's private interface by id", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bIface = await interfaceTypeRepository.create({
      ...b,
      identifier: "b-only",
    });

    const fromA = await interfaceTypeRepository.findById({
      orgId: testCtx.orgId,
      id: bIface.id,
    });
    expect(fromA).toBeNull();
  });

  it("findByIdentifier is scoped to org + globals", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    await interfaceTypeRepository.create({
      ...b,
      identifier: "b-only",
    });

    const fromA = await interfaceTypeRepository.findByIdentifier({
      orgId: testCtx.orgId,
      identifier: "b-only",
    });
    expect(fromA).toBeNull();
  });

  it("update on another org's private interface throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bIface = await interfaceTypeRepository.create({
      ...b,
      identifier: "b-only",
    });

    await expect(
      interfaceTypeRepository.update({
        ...testCtx,
        id: bIface.id,
        description: "hijack",
      }),
    ).rejects.toThrow("not found");
  });

  it("merge cannot reach another org's private interfaces", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bSource = await interfaceTypeRepository.create({
      ...b,
      identifier: "b-source",
    });
    const aTarget = await interfaceTypeRepository.create({
      ...testCtx,
      identifier: "a-target",
    });

    await expect(
      interfaceTypeRepository.merge({
        ...testCtx,
        sourceIds: [bSource.id],
        targetId: aTarget.id,
      }),
    ).rejects.toThrow("not found");
  });
});
