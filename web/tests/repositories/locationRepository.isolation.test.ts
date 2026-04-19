import { locationRepository } from "@/repositories/locationRepository";
import { moduleRepository } from "@/repositories/moduleRepository";
import { testCtx, createTestOrg } from "../setup";

async function seedModule(ctx: { userId: string; orgId: string }, name: string) {
  return moduleRepository.create({
    ...ctx,
    name,
    primaryDimensionLabel: "level",
    primaryDimensionCount: 1,
  });
}

describe("locationRepository isolation", () => {
  it("findByModuleId is scoped: org A cannot see org B's locations", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const modA = await seedModule(testCtx, "MUSE-A");
    const modB = await seedModule(b, "MUSE-B");

    await locationRepository.create({
      ...testCtx,
      moduleId: modA.id,
      label: "1",
      pathSegments: ["MUSE-A", "1"],
      locationType: "fixed",
    });
    await locationRepository.create({
      ...b,
      moduleId: modB.id,
      label: "1",
      pathSegments: ["MUSE-B", "1"],
      locationType: "fixed",
    });

    const aList = await locationRepository.findByModuleId({
      orgId: testCtx.orgId,
      moduleId: modA.id,
    });
    const bList = await locationRepository.findByModuleId({
      orgId: b.orgId,
      moduleId: modB.id,
    });

    expect(aList).toHaveLength(1);
    expect(bList).toHaveLength(1);
    expect(aList[0].ownerOrgId).toBe(testCtx.orgId);
    expect(bList[0].ownerOrgId).toBe(b.orgId);

    // Cross-org query must not leak rows even if a caller supplies the
    // other org's moduleId.
    const leak = await locationRepository.findByModuleId({
      orgId: testCtx.orgId,
      moduleId: modB.id,
    });
    expect(leak).toHaveLength(0);
  });

  it("findById is scoped: org A cannot fetch org B's location", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const modB = await seedModule(b, "MUSE-B");
    const bLoc = await locationRepository.create({
      ...b,
      moduleId: modB.id,
      label: "1",
      pathSegments: ["MUSE-B", "1"],
      locationType: "fixed",
    });

    const fromA = await locationRepository.findById({
      orgId: testCtx.orgId,
      id: bLoc.id,
    });
    expect(fromA).toBeNull();

    const fromB = await locationRepository.findById({
      orgId: b.orgId,
      id: bLoc.id,
    });
    expect(fromB?.id).toBe(bLoc.id);
  });

  it("update on another org's location throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const modB = await seedModule(b, "MUSE-B");
    const bLoc = await locationRepository.create({
      ...b,
      moduleId: modB.id,
      label: "1",
      pathSegments: ["MUSE-B", "1"],
      locationType: "fixed",
    });

    await expect(
      locationRepository.update({
        ...testCtx,
        id: bLoc.id,
        label: "hijack",
      }),
    ).rejects.toThrow("not found");
  });

  it("remove on another org's location throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const modB = await seedModule(b, "MUSE-B");
    const bLoc = await locationRepository.create({
      ...b,
      moduleId: modB.id,
      label: "1",
      pathSegments: ["MUSE-B", "1"],
      locationType: "fixed",
    });

    await expect(
      locationRepository.remove({
        ...testCtx,
        id: bLoc.id,
      }),
    ).rejects.toThrow("not found");

    // B can still see it
    const stillThere = await locationRepository.findById({
      orgId: b.orgId,
      id: bLoc.id,
    });
    expect(stillThere).not.toBeNull();
  });

  it("findChildren is scoped: children of an org B parent invisible to org A", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const modB = await seedModule(b, "MUSE-B");
    const bParent = await locationRepository.create({
      ...b,
      moduleId: modB.id,
      label: "1",
      pathSegments: ["MUSE-B", "1"],
      locationType: "fixed",
    });
    await locationRepository.create({
      ...b,
      moduleId: modB.id,
      parentId: bParent.id,
      label: "A1",
      pathSegments: ["MUSE-B", "1", "A1"],
      locationType: "leaf",
    });

    const aViewsB = await locationRepository.findChildren({
      orgId: testCtx.orgId,
      parentId: bParent.id,
    });
    expect(aViewsB).toHaveLength(0);

    const bViewsB = await locationRepository.findChildren({
      orgId: b.orgId,
      parentId: bParent.id,
    });
    expect(bViewsB).toHaveLength(1);
  });
});
