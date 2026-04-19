import { categoryRepository } from "@/repositories/categoryRepository";
import { testCtx, createTestOrg } from "../setup";

describe("categoryRepository isolation (additive)", () => {
  it("list returns global + own, not other org's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await categoryRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global Cat",
    });
    await categoryRepository.create({
      ...testCtx,
      name: "A Private",
    });
    await categoryRepository.create({
      ...b,
      name: "B Private",
    });

    const aNames = (await categoryRepository.list({ orgId: testCtx.orgId }))
      .map((c) => c.name)
      .sort();
    const bNames = (await categoryRepository.list({ orgId: b.orgId }))
      .map((c) => c.name)
      .sort();

    expect(aNames).toEqual(["A Private", "Global Cat"]);
    expect(bNames).toEqual(["B Private", "Global Cat"]);
  });

  it("org A cannot fetch org B's private category by id", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bCat = await categoryRepository.create({
      ...b,
      name: "B Private",
    });

    const fromA = await categoryRepository.findById({
      orgId: testCtx.orgId,
      id: bCat.id,
    });
    expect(fromA).toBeNull();

    const fromB = await categoryRepository.findById({
      orgId: b.orgId,
      id: bCat.id,
    });
    expect(fromB?.id).toBe(bCat.id);
  });

  it("update on another org's private category throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bCat = await categoryRepository.create({
      ...b,
      name: "B Private",
    });

    await expect(
      categoryRepository.update({
        ...testCtx,
        id: bCat.id,
        icon: "hijack",
      }),
    ).rejects.toThrow("not found");
  });
});
