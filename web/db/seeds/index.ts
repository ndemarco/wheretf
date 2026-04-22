/**
 * Seed dispatcher.
 *
 * Usage:
 *   tsx db/seeds/index.ts all
 *   tsx db/seeds/index.ts taxonomy
 *   tsx db/seeds/index.ts templates
 *   tsx db/seeds/index.ts items
 *   tsx db/seeds/index.ts interface_types
 *   tsx db/seeds/index.ts modules
 *
 * Each slice is idempotent: re-running is a no-op if data is present.
 * Slices fail fast with a clear message when a dependency slice hasn't run.
 */
import { getSeedCtx } from "./context";
import { seedTaxonomy } from "./taxonomy";
import { seedInterfaceTypes } from "./interface_types";
import { seedTemplates } from "./templates";
import { seedItems } from "./items";
import { seedModules } from "./modules";

type Slice = "taxonomy" | "interface_types" | "templates" | "items" | "modules";

const SLICES: Record<Slice, (ctx: Awaited<ReturnType<typeof getSeedCtx>>) => Promise<void>> = {
  taxonomy: seedTaxonomy,
  interface_types: seedInterfaceTypes,
  templates: seedTemplates,
  items: seedItems,
  modules: seedModules,
};

// Dependency order for `all`. Independent slices first, dependents after.
const ALL_ORDER: Slice[] = ["taxonomy", "interface_types", "templates", "items", "modules"];

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx db/seeds/index.ts <slice|all>");
    console.error(`slices: ${Object.keys(SLICES).join(", ")}`);
    process.exit(2);
  }

  const ctx = await getSeedCtx();

  const run = async (slice: Slice) => {
    console.log(`→ ${slice}`);
    await SLICES[slice](ctx);
  };

  if (arg === "all") {
    for (const slice of ALL_ORDER) await run(slice);
  } else if (arg in SLICES) {
    await run(arg as Slice);
  } else {
    console.error(`unknown slice: ${arg}`);
    console.error(`valid slices: ${Object.keys(SLICES).join(", ")} | all`);
    process.exit(2);
  }

  console.log("done");
  process.exit(0);
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
