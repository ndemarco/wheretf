import { db } from "../connection";
import { modules } from "../schema";
import { moduleRepository } from "../../repositories/moduleRepository";
import { locationRepository } from "../../repositories/locationRepository";
import { interfaceTypeRepository } from "../../repositories/interfaceTypeRepository";
import type { SeedCtx } from "./context";

async function requireIface(ctx: SeedCtx, identifier: string): Promise<string> {
  const row = await interfaceTypeRepository.findByIdentifier({
    orgId: ctx.orgId,
    identifier,
  });
  if (!row) {
    throw new Error(
      `modules: interface type "${identifier}" not found — run 'npm run db:seed:interfaces' first`,
    );
  }
  return row.id;
}

export async function seedModules(ctx: SeedCtx): Promise<void> {
  const existing = await db.select().from(modules);
  if (existing.length > 0) {
    console.log("modules: already seeded, skipping");
    return;
  }

  const planoAcceptedId = await requireIface(ctx, "plano-3600");
  const alexAcceptedId = await requireIface(ctx, "alex-drawer");
  const plano3700AcceptedId = await requireIface(ctx, "plano-3700");

  const muse = await moduleRepository.create({
    ...ctx,
    name: "MUSE",
    description: "Red metal cabinet, 11 shelf levels, under workbench",
    primaryDimensionLabel: "level",
    primaryDimensionCount: 11,
  });
  for (let i = 1; i <= 11; i++) {
    await locationRepository.create({
      ...ctx,
      moduleId: muse.id,
      label: String(i),
      pathSegments: ["MUSE", String(i)],
      locationType: "receptacle",
      interfacesAcceptedIds: [planoAcceptedId],
    });
  }

  const alex = await moduleRepository.create({
    ...ctx,
    name: "ALEX",
    description: "IKEA ALEX 5-drawer unit, white, right side of desk",
    primaryDimensionLabel: "drawer",
    primaryDimensionCount: 5,
  });
  for (let i = 1; i <= 5; i++) {
    await locationRepository.create({
      ...ctx,
      moduleId: alex.id,
      label: String(i),
      pathSegments: ["ALEX", String(i)],
      locationType: "receptacle",
      interfacesAcceptedIds: [alexAcceptedId],
    });
  }

  const bench = await moduleRepository.create({
    ...ctx,
    name: "BENCH",
    description: "Main workbench, 3 open bays underneath",
    primaryDimensionLabel: "bay",
    primaryDimensionCount: 3,
  });
  for (let i = 1; i <= 3; i++) {
    await locationRepository.create({
      ...ctx,
      moduleId: bench.id,
      label: String(i),
      pathSegments: ["BENCH", String(i)],
      locationType: i <= 2 ? "receptacle" : "fixed",
      interfacesAcceptedIds: i <= 2 ? [plano3700AcceptedId] : undefined,
    });
  }

  console.log("modules: 3 modules (MUSE, ALEX, BENCH) with 19 locations total");
}
