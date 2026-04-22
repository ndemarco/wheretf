import { db } from "../connection";
import { templates } from "../schema";
import { templateRepository } from "../../repositories/templateRepository";
import { interfaceTypeRepository } from "../../repositories/interfaceTypeRepository";
import type { SeedCtx } from "./context";

async function requireIface(ctx: SeedCtx, identifier: string): Promise<string> {
  const row = await interfaceTypeRepository.findByIdentifier({
    orgId: ctx.orgId,
    identifier,
  });
  if (!row) {
    throw new Error(
      `templates: interface type "${identifier}" not found — run 'npm run db:seed:interfaces' first`,
    );
  }
  return row.id;
}

export async function seedTemplates(ctx: SeedCtx): Promise<void> {
  const existing = await db.select().from(templates);
  if (existing.length > 0) {
    console.log("templates: already seeded, skipping");
    return;
  }

  const ifacePlano3600 = await requireIface(ctx, "plano-3600");
  const ifacePlano3700 = await requireIface(ctx, "plano-3700");
  const ifaceGridfinity = await requireIface(ctx, "gridfinity-42mm");
  const ifaceAlex = await requireIface(ctx, "alex-drawer");
  const ifaceSmallParts = await requireIface(ctx, "small-parts-bin");

  const tplPlano3600 = await templateRepository.create({
    ...ctx,
    asGlobal: true,
    name: "Plano 3600 Stowaway",
    description: "4-row adjustable compartment box, removable column dividers",
    rows: 4,
    columns: 6,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: false,
    interfacesProvidedIds: [ifacePlano3600],
    metadata: { unitSystem: "imperial", manufacturer: "Plano", productNumber: "2-3600" },
  });

  await templateRepository.publishVersion({
    ...ctx,
    templateId: tplPlano3600.id,
    rows: 4,
    columns: 4,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: false,
    interfacesProvidedIds: [ifacePlano3600],
  });

  await templateRepository.create({
    ...ctx,
    asGlobal: true,
    name: "Plano 3700 Stowaway",
    description: "3-row deep compartment box, removable dividers",
    rows: 3,
    columns: 6,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: false,
    interfacesProvidedIds: [ifacePlano3700],
    metadata: { unitSystem: "imperial", manufacturer: "Plano", productNumber: "2-3700" },
  });

  await templateRepository.create({
    ...ctx,
    asGlobal: true,
    name: "Gridfinity Baseplate",
    description: "42mm modular grid system, parametric sizing",
    isParametric: true,
    rows: 4,
    columns: 4,
    minRows: 1,
    maxRows: 10,
    minColumns: 1,
    maxColumns: 10,
    rowLabelScheme: "numeric",
    columnLabelScheme: "alpha",
    originPosition: "bottom-left",
    rowDividersFixed: false,
    columnDividersFixed: false,
    interfacesProvidedIds: [ifaceGridfinity],
    metadata: { unitSystem: "metric" },
  });

  await templateRepository.create({
    ...ctx,
    asGlobal: true,
    name: "Small Parts Drawer",
    description: "Simple 2×3 compartment drawer insert",
    rows: 2,
    columns: 3,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: true,
    interfacesProvidedIds: [ifaceSmallParts],
    metadata: { unitSystem: "metric" },
  });

  await templateRepository.create({
    ...ctx,
    asGlobal: true,
    name: "ALEX Drawer Divider",
    description: "IKEA ALEX drawer compartment layout",
    rows: 3,
    columns: 4,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: false,
    columnDividersFixed: false,
    interfacesProvidedIds: [ifaceAlex],
    metadata: { unitSystem: "metric", manufacturer: "IKEA", productNumber: "ALEX" },
  });

  console.log("templates: 5 templates seeded (Plano 3600 has v1 and v2)");
}
