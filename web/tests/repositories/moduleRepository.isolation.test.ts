import { moduleRepository } from "@/repositories/moduleRepository";
import { testCtx, createTestOrg } from "../setup";

describe("moduleRepository isolation", () => {
  it("org A cannot see org B's modules", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await moduleRepository.create({
      ...testCtx,
      name: "A-only",
      primaryDimensionLabel: "level",
      primaryDimensionCount: 1,
    });
    await moduleRepository.create({
      ...b,
      name: "B-only",
      primaryDimensionLabel: "level",
      primaryDimensionCount: 1,
    });

    const aList = await moduleRepository.list({ orgId: testCtx.orgId });
    const bList = await moduleRepository.list({ orgId: b.orgId });

    expect(aList.map((m) => m.name)).toEqual(["A-only"]);
    expect(bList.map((m) => m.name)).toEqual(["B-only"]);
  });

  it("findById is scoped: org A cannot fetch org B's module", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const bModule = await moduleRepository.create({
      ...b,
      name: "B-only",
      primaryDimensionLabel: "level",
      primaryDimensionCount: 1,
    });

    const fromA = await moduleRepository.findById({
      orgId: testCtx.orgId,
      id: bModule.id,
    });
    expect(fromA).toBeNull();

    const fromB = await moduleRepository.findById({
      orgId: b.orgId,
      id: bModule.id,
    });
    expect(fromB?.id).toBe(bModule.id);
  });

  it("update on another org's module throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const bModule = await moduleRepository.create({
      ...b,
      name: "B-only",
      primaryDimensionLabel: "level",
      primaryDimensionCount: 1,
    });

    await expect(
      moduleRepository.update({
        ...testCtx,
        id: bModule.id,
        description: "hijack",
      }),
    ).rejects.toThrow("not found");
  });
});
