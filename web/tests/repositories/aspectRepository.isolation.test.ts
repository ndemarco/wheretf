import { aspectRepository } from "@/repositories/aspectRepository";
import { testCtx, createTestOrg } from "../setup";

describe("aspectRepository isolation (additive)", () => {
  it("list returns global + own, not other org's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await aspectRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global Aspect",
    });
    await aspectRepository.create({
      ...testCtx,
      name: "A Private",
    });
    await aspectRepository.create({
      ...b,
      name: "B Private",
    });

    const aNames = (await aspectRepository.list({ orgId: testCtx.orgId }))
      .map((a) => a.name)
      .sort();
    const bNames = (await aspectRepository.list({ orgId: b.orgId }))
      .map((a) => a.name)
      .sort();

    expect(aNames).toEqual(["A Private", "Global Aspect"]);
    expect(bNames).toEqual(["B Private", "Global Aspect"]);
  });

  it("org A cannot fetch org B's private aspect by id", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bAspect = await aspectRepository.create({
      ...b,
      name: "B Private",
    });

    const fromA = await aspectRepository.findById({
      orgId: testCtx.orgId,
      id: bAspect.id,
    });
    expect(fromA).toBeNull();

    const fromB = await aspectRepository.findById({
      orgId: b.orgId,
      id: bAspect.id,
    });
    expect(fromB?.id).toBe(bAspect.id);
  });

  it("update on another org's private aspect throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bAspect = await aspectRepository.create({
      ...b,
      name: "B Private",
    });

    await expect(
      aspectRepository.update({
        ...testCtx,
        id: bAspect.id,
        description: "hijack",
      }),
    ).rejects.toThrow("not found");
  });
});
