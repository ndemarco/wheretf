import { insertRepository } from "@/repositories/insertRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { moduleRepository } from "@/repositories/moduleRepository";
import { testCtx, createTestOrg } from "../setup";

describe("insertRepository isolation", () => {
  it("org A cannot see org B's unplaced inserts", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await insertRepository.create({ ...testCtx, name: "A-tray" });
    await insertRepository.create({ ...b, name: "B-tray" });

    const aList = await insertRepository.listUnplaced({
      orgId: testCtx.orgId,
    });
    const bList = await insertRepository.listUnplaced({ orgId: b.orgId });

    expect(aList.map((i) => i.name)).toEqual(["A-tray"]);
    expect(bList.map((i) => i.name)).toEqual(["B-tray"]);
  });

  it("findById is scoped: org A cannot fetch org B's insert", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const bInsert = await insertRepository.create({ ...b, name: "B-tray" });

    const fromA = await insertRepository.findById({
      orgId: testCtx.orgId,
      id: bInsert.id,
    });
    expect(fromA).toBeNull();

    const fromB = await insertRepository.findById({
      orgId: b.orgId,
      id: bInsert.id,
    });
    expect(fromB?.id).toBe(bInsert.id);
  });

  it("update on another org's insert throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const bInsert = await insertRepository.create({ ...b, name: "B-tray" });

    await expect(
      insertRepository.update({
        ...testCtx,
        id: bInsert.id,
        name: "hijack",
      }),
    ).rejects.toThrow("not found");
  });

  it("remove on another org's insert throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const bInsert = await insertRepository.create({ ...b, name: "B-tray" });

    await expect(
      insertRepository.remove({ ...testCtx, id: bInsert.id }),
    ).rejects.toThrow("not found");

    // B can still see it.
    const stillThere = await insertRepository.findById({
      orgId: b.orgId,
      id: bInsert.id,
    });
    expect(stillThere).not.toBeNull();
  });

  it("listWithDetails is scoped: only own-org inserts are returned", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    // Org A: one unplaced insert
    await insertRepository.create({ ...testCtx, name: "A-only" });

    // Org B: one placed insert
    const bModule = await moduleRepository.create({
      ...b,
      name: "B-mod",
      primaryDimensionLabel: "level",
      primaryDimensionCount: 1,
    });
    const bLoc = await locationRepository.create({
      ...b,
      moduleId: bModule.id,
      label: "1",
      pathSegments: ["B-mod", "1"],
      locationType: "receptacle",
    });
    const bInsert = await insertRepository.create({ ...b, name: "B-only" });
    await insertRepository.place({
      ...b,
      id: bInsert.id,
      locationId: bLoc.id,
    });

    const aRows = await insertRepository.listWithDetails({
      orgId: testCtx.orgId,
    });
    const bRows = await insertRepository.listWithDetails({ orgId: b.orgId });

    expect(aRows.map((r) => r.name)).toEqual(["A-only"]);
    expect(bRows.map((r) => r.name)).toEqual(["B-only"]);
  });
});
