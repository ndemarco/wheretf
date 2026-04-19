import { assignmentRepository } from "@/repositories/assignmentRepository";
import { itemRepository } from "@/repositories/itemRepository";
import { locationRepository } from "@/repositories/locationRepository";
import { moduleRepository } from "@/repositories/moduleRepository";
import { testCtx, createTestOrg } from "../setup";

async function seedLocation(ctx: { userId: string; orgId: string }, label: string) {
  const mod = await moduleRepository.create({
    ...ctx,
    name: `mod-${ctx.orgId}-${label}`,
    primaryDimensionLabel: "level",
    primaryDimensionCount: 1,
  });
  return locationRepository.create({
    ...ctx,
    moduleId: mod.id,
    label,
    pathSegments: [`mod-${ctx.orgId}`, label],
    locationType: "leaf",
  });
}

describe("assignmentRepository isolation", () => {
  it("list-style reads are scoped: org A cannot see org B's assignments", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    // One global item shared across orgs
    const item = await itemRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Shared Item",
    });

    const aLoc = await seedLocation(testCtx, "A1");
    const bLoc = await seedLocation(b, "B1");

    await assignmentRepository.create({
      ...testCtx,
      itemId: item.id,
      locationId: aLoc.id,
      assignmentType: "provisional",
    });
    await assignmentRepository.create({
      ...b,
      itemId: item.id,
      locationId: bLoc.id,
      assignmentType: "provisional",
    });

    const aList = await assignmentRepository.listProvisional({
      orgId: testCtx.orgId,
    });
    const bList = await assignmentRepository.listProvisional({ orgId: b.orgId });

    expect(aList).toHaveLength(1);
    expect(aList[0].locationId).toBe(aLoc.id);

    expect(bList).toHaveLength(1);
    expect(bList[0].locationId).toBe(bLoc.id);
  });

  it("findById is scoped: org A cannot fetch org B's assignment", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const item = await itemRepository.create({
      ...b,
      asGlobal: true,
      name: "B Item",
    });
    const bLoc = await seedLocation(b, "B1");

    const bAssignment = await assignmentRepository.create({
      ...b,
      itemId: item.id,
      locationId: bLoc.id,
      assignmentType: "placed",
    });

    const fromA = await assignmentRepository.findById({
      orgId: testCtx.orgId,
      id: bAssignment.id,
    });
    expect(fromA).toBeNull();

    const fromB = await assignmentRepository.findById({
      orgId: b.orgId,
      id: bAssignment.id,
    });
    expect(fromB?.id).toBe(bAssignment.id);
  });

  it("update (move) on another org's assignment throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    const item = await itemRepository.create({
      ...b,
      asGlobal: true,
      name: "B Item",
    });
    const bLoc1 = await seedLocation(b, "B1");
    const bLoc2 = await seedLocation(b, "B2");

    const bAssignment = await assignmentRepository.create({
      ...b,
      itemId: item.id,
      locationId: bLoc1.id,
      assignmentType: "placed",
    });

    await expect(
      assignmentRepository.move({
        ...testCtx,
        id: bAssignment.id,
        newLocationId: bLoc2.id,
      }),
    ).rejects.toThrow("not found");

    // Remove on another org's assignment also throws not-found.
    await expect(
      assignmentRepository.remove({ ...testCtx, id: bAssignment.id }),
    ).rejects.toThrow("not found");

    // B can still see it.
    const stillThere = await assignmentRepository.findById({
      orgId: b.orgId,
      id: bAssignment.id,
    });
    expect(stillThere).not.toBeNull();
  });

  it("a global item can be assigned independently in each org", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    // Single global item
    const item = await itemRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Globally Visible",
    });

    const aLoc = await seedLocation(testCtx, "A1");
    const bLoc = await seedLocation(b, "B1");

    const aAssignment = await assignmentRepository.create({
      ...testCtx,
      itemId: item.id,
      locationId: aLoc.id,
      assignmentType: "placed",
    });
    const bAssignment = await assignmentRepository.create({
      ...b,
      itemId: item.id,
      locationId: bLoc.id,
      assignmentType: "placed",
    });

    expect(aAssignment.ownerOrgId).toBe(testCtx.orgId);
    expect(bAssignment.ownerOrgId).toBe(b.orgId);

    const aByItem = await assignmentRepository.findByItemId({
      orgId: testCtx.orgId,
      itemId: item.id,
    });
    const bByItem = await assignmentRepository.findByItemId({
      orgId: b.orgId,
      itemId: item.id,
    });

    // Each org only sees its own assignment of the shared item.
    expect(aByItem).toHaveLength(1);
    expect(aByItem[0].id).toBe(aAssignment.id);
    expect(bByItem).toHaveLength(1);
    expect(bByItem[0].id).toBe(bAssignment.id);
  });
});
