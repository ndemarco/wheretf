import { templateRepository } from "@/repositories/templateRepository";
import { testCtx, createTestOrg } from "../setup";

describe("templateRepository isolation (additive)", () => {
  it("list returns global + own, not other org's private", async () => {
    const b = await createTestOrg({ slug: "other-org" });

    await templateRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global Tray",
    });
    await templateRepository.create({
      ...testCtx,
      name: "A Private",
    });
    await templateRepository.create({
      ...b,
      name: "B Private",
    });

    const aNames = (await templateRepository.list({ orgId: testCtx.orgId }))
      .map((t) => t.name)
      .sort();
    const bNames = (await templateRepository.list({ orgId: b.orgId }))
      .map((t) => t.name)
      .sort();

    expect(aNames).toEqual(["A Private", "Global Tray"]);
    expect(bNames).toEqual(["B Private", "Global Tray"]);
  });

  it("org A cannot fetch org B's private template by id", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bTemplate = await templateRepository.create({
      ...b,
      name: "B Private",
    });

    const fromA = await templateRepository.findById({
      orgId: testCtx.orgId,
      id: bTemplate.id,
    });
    expect(fromA).toBeNull();
  });

  it("org A can fetch a global template", async () => {
    const globalT = await templateRepository.create({
      ...testCtx,
      asGlobal: true,
      name: "Global",
    });
    const b = await createTestOrg({ slug: "other-org" });

    const fromB = await templateRepository.findById({
      orgId: b.orgId,
      id: globalT.id,
    });
    expect(fromB?.id).toBe(globalT.id);
  });

  it("update on another org's private template throws not-found", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bTemplate = await templateRepository.create({
      ...b,
      name: "B Private",
    });

    await expect(
      templateRepository.update({
        ...testCtx,
        id: bTemplate.id,
        description: "hijack",
      }),
    ).rejects.toThrow("not found");
  });

  it("listVersions returns only versions in scope", async () => {
    const b = await createTestOrg({ slug: "other-org" });
    const bTemplate = await templateRepository.create({
      ...b,
      name: "B Private",
    });

    const fromA = await templateRepository.listVersions({
      orgId: testCtx.orgId,
      templateId: bTemplate.id,
    });
    expect(fromA).toEqual([]);

    const fromB = await templateRepository.listVersions({
      orgId: b.orgId,
      templateId: bTemplate.id,
    });
    expect(fromB.length).toBeGreaterThan(0);
  });
});
