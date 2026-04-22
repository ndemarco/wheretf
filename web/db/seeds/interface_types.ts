import { interfaceTypeRepository } from "../../repositories/interfaceTypeRepository";
import type { SeedCtx } from "./context";

const IFACE_SEEDS = [
  { identifier: "plano-3600", description: "Plano 3600 tackle-box footprint" },
  { identifier: "plano-3700", description: "Plano 3700 tackle-box footprint" },
  {
    identifier: "gridfinity-42mm",
    description: "Gridfinity 42mm baseplate cell",
    unitSystem: {
      width: { label: "u", mm: 42 },
      depth: { label: "u", mm: 42 },
      height: { label: "h", mm: 7 },
    },
  },
  { identifier: "alex-drawer", description: "IKEA ALEX drawer interior" },
  { identifier: "small-parts-bin", description: "Generic small-parts drawer cell" },
];

export async function seedInterfaceTypes(ctx: SeedCtx): Promise<void> {
  let created = 0;
  for (const s of IFACE_SEEDS) {
    const existing = await interfaceTypeRepository.findByIdentifier({
      orgId: ctx.orgId,
      identifier: s.identifier,
    });
    if (existing) continue;
    await interfaceTypeRepository.create({ ...ctx, asGlobal: true, ...s });
    created++;
  }
  if (created === 0) {
    console.log("interface_types: already seeded, skipping");
  } else {
    console.log(`interface_types: ${created} created (${IFACE_SEEDS.length - created} already present)`);
  }
}
