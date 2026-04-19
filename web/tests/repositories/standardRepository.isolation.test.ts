import { standardRepository } from "@/repositories/standardRepository";
import { testCtx, createTestOrg } from "../setup";

describe("standardRepository isolation (additive)", () => {
  it("list returns global + own, not other org's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await standardRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global Std",
    });
    await standardRepository.create({
      ...testCtx,
      name: "A Private",
    });
    await standardRepository.create({
      ...b,
      name: "B Private",
    });

    const aNames = (await standardRepository.list({ orgId: testCtx.orgId }))
      .map((s) => s.name)
      .sort();
    const bNames = (await standardRepository.list({ orgId: b.orgId }))
      .map((s) => s.name)
      .sort();

    expect(aNames).toEqual(["A Private", "Global Std"]);
    expect(bNames).toEqual(["B Private", "Global Std"]);
  });

  it("org A cannot fetch org B's private standard by id", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bStd = await standardRepository.create({
      ...b,
      name: "B Private",
    });

    const fromA = await standardRepository.findById({
      orgId: testCtx.orgId,
      id: bStd.id,
    });
    expect(fromA).toBeNull();

    const fromB = await standardRepository.findById({
      orgId: b.orgId,
      id: bStd.id,
    });
    expect(fromB?.id).toBe(bStd.id);
  });

  it("update on another org's private standard throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bStd = await standardRepository.create({
      ...b,
      name: "B Private",
    });

    await expect(
      standardRepository.update({
        ...testCtx,
        id: bStd.id,
        description: "hijack",
      }),
    ).rejects.toThrow("not found");
  });
});
