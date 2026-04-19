import { itemRepository } from "@/repositories/itemRepository";
import { testCtx, createTestOrg } from "../setup";

describe("itemRepository isolation (additive)", () => {
  it("list returns global + own, not other org's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await itemRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global Widget",
    });
    await itemRepository.create({
      ...testCtx,
      name: "A Private",
    });
    await itemRepository.create({
      ...b,
      name: "B Private",
    });

    const aNames = (await itemRepository.list({ orgId: testCtx.orgId }))
      .map((i) => i.name)
      .sort();
    const bNames = (await itemRepository.list({ orgId: b.orgId }))
      .map((i) => i.name)
      .sort();

    expect(aNames).toEqual(["A Private", "Global Widget"]);
    expect(bNames).toEqual(["B Private", "Global Widget"]);
  });

  it("org A cannot fetch org B's private item by id", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bItem = await itemRepository.create({
      ...b,
      name: "B Private",
    });

    const fromA = await itemRepository.findById({
      orgId: testCtx.orgId,
      id: bItem.id,
    });
    expect(fromA).toBeNull();
  });

  it("org A can fetch a global item", async () => {
    const globalItem = await itemRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global",
    });
    const b = await createTestOrg({ slug: "other-org" });

    const fromB = await itemRepository.findById({
      orgId: b.orgId,
      id: globalItem.id,
    });
    expect(fromB?.id).toBe(globalItem.id);
  });

  it("update on another org's private item throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bItem = await itemRepository.create({
      ...b,
      name: "B Private",
    });

    await expect(
      itemRepository.update({
        ...testCtx,
        id: bItem.id,
        description: "hijack",
      }),
    ).rejects.toThrow("not found");
  });

  it("junction scoping: item_categories on B's private item is invisible to A", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    // Category is global so both orgs see it via the additive filter.
    const { categoryRepository } = await import(
      "@/repositories/categoryRepository"
    );
    const cat = await categoryRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Shared",
    });

    // Org-private item + category junction owned by B.
    const bItem = await itemRepository.create({ ...b, name: "B Item" });
    await itemRepository.addCategory({
      orgId: b.orgId,
      itemId: bItem.id,
      categoryId: cat.id,
    });

    // Org A cannot see the junction row (nor the item).
    const fromA = await itemRepository.getCategories({
      orgId: testCtx.orgId,
      itemId: bItem.id,
    });
    expect(fromA).toHaveLength(0);

    // Org B sees its own junction.
    const fromB = await itemRepository.getCategories({
      orgId: b.orgId,
      itemId: bItem.id,
    });
    expect(fromB).toHaveLength(1);
    expect(fromB[0].name).toBe("Shared");
  });

  it("search is scoped: org A sees globals + own, not org B's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await itemRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global Screw",
    });
    await itemRepository.create({
      ...b,
      name: "B Screw",
    });

    const fromA = await itemRepository.search({
      orgId: testCtx.orgId,
      query: "Screw",
    });
    expect(fromA.map((i) => i.name).sort()).toEqual(["Global Screw"]);
  });
});
