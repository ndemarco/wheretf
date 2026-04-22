import { db } from "../connection";
import { items } from "../schema";
import { itemRepository } from "../../repositories/itemRepository";
import { categoryRepository } from "../../repositories/categoryRepository";
import { aspectRepository } from "../../repositories/aspectRepository";
import { parameterDefinitionRepository } from "../../repositories/parameterDefinitionRepository";
import type { SeedCtx } from "./context";

async function requireCategory(ctx: SeedCtx, name: string): Promise<string> {
  const row = await categoryRepository.findByName({ orgId: ctx.orgId, name });
  if (!row) throw new Error(`items: category "${name}" not found — run 'npm run db:seed:taxonomy' first`);
  return row.id;
}

async function requireAspect(ctx: SeedCtx, name: string): Promise<string> {
  const row = await aspectRepository.findByName({ orgId: ctx.orgId, name });
  if (!row) throw new Error(`items: aspect "${name}" not found — run 'npm run db:seed:taxonomy' first`);
  return row.id;
}

async function requireParam(ctx: SeedCtx, name: string): Promise<string> {
  const row = await parameterDefinitionRepository.findByName({ orgId: ctx.orgId, name });
  if (!row) throw new Error(`items: parameter "${name}" not found — run 'npm run db:seed:taxonomy' first`);
  return row.id;
}

export async function seedItems(ctx: SeedCtx): Promise<void> {
  const existing = await db.select().from(items);
  if (existing.length > 0) {
    console.log("items: already seeded, skipping");
    return;
  }

  const catFastenerId = await requireCategory(ctx, "Fasteners");
  const catElectronicId = await requireCategory(ctx, "Electronics");
  const catToolId = await requireCategory(ctx, "Tools");
  const catAdhesiveId = await requireCategory(ctx, "Adhesives");
  const catWireId = await requireCategory(ctx, "Wire & Cable");
  const catMeasureId = await requireCategory(ctx, "Measurement");

  const aspectThreadId = await requireAspect(ctx, "Threading");
  const aspectScrewId = await requireAspect(ctx, "Screw Head");
  const aspectPhysicalId = await requireAspect(ctx, "Physical Properties");
  const aspectElectricalId = await requireAspect(ctx, "Electrical Ratings");

  const pdThreadSizeId = await requireParam(ctx, "thread_size");
  const pdLengthId = await requireParam(ctx, "length");
  const pdMaterialId = await requireParam(ctx, "material");
  const pdHeadTypeId = await requireParam(ctx, "head_type");
  const pdDriveTypeId = await requireParam(ctx, "drive_type");
  const pdVoltageId = await requireParam(ctx, "voltage_rating");
  const pdCapacitanceId = await requireParam(ctx, "capacitance");
  const pdResistanceId = await requireParam(ctx, "resistance");
  const pdToleranceId = await requireParam(ctx, "tolerance");
  const pdPackageId = await requireParam(ctx, "package");
  const pdColorId = await requireParam(ctx, "color");
  const pdGaugeId = await requireParam(ctx, "gauge");
  const pdCureTimeId = await requireParam(ctx, "cure_time");
  const pdTempRatingId = await requireParam(ctx, "temp_rating");

  // Machine Screws
  const screw1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "M3x10 Socket Head Cap Screw", description: "Stainless steel socket head cap screw" });
  await itemRepository.addCategory({ ...ctx, itemId: screw1.id, categoryId: catFastenerId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: screw1.id, aspectId: aspectThreadId });
  await itemRepository.applyAspect({ ...ctx, itemId: screw1.id, aspectId: aspectScrewId });
  await itemRepository.applyAspect({ ...ctx, itemId: screw1.id, aspectId: aspectPhysicalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw1.id, parameterDefinitionId: pdThreadSizeId, value: "M3" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw1.id, parameterDefinitionId: pdLengthId, value: 10 });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw1.id, parameterDefinitionId: pdHeadTypeId, value: "socket" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw1.id, parameterDefinitionId: pdDriveTypeId, value: "hex" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw1.id, parameterDefinitionId: pdMaterialId, value: "stainless_steel" });

  const screw2 = await itemRepository.create({ ...ctx, asGlobal: true, name: "M4x20 Pan Head Machine Screw", description: "Zinc-plated steel pan head screw" });
  await itemRepository.addCategory({ ...ctx, itemId: screw2.id, categoryId: catFastenerId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: screw2.id, aspectId: aspectThreadId });
  await itemRepository.applyAspect({ ...ctx, itemId: screw2.id, aspectId: aspectScrewId });
  await itemRepository.applyAspect({ ...ctx, itemId: screw2.id, aspectId: aspectPhysicalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw2.id, parameterDefinitionId: pdThreadSizeId, value: "M4" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw2.id, parameterDefinitionId: pdLengthId, value: 20 });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw2.id, parameterDefinitionId: pdHeadTypeId, value: "pan" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw2.id, parameterDefinitionId: pdDriveTypeId, value: "phillips" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw2.id, parameterDefinitionId: pdMaterialId, value: "steel" });

  const screw3 = await itemRepository.create({ ...ctx, asGlobal: true, name: "M5x16 Flat Head Screw" });
  await itemRepository.addCategory({ ...ctx, itemId: screw3.id, categoryId: catFastenerId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: screw3.id, aspectId: aspectThreadId });
  await itemRepository.applyAspect({ ...ctx, itemId: screw3.id, aspectId: aspectScrewId });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw3.id, parameterDefinitionId: pdThreadSizeId, value: "M5" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw3.id, parameterDefinitionId: pdLengthId, value: 16 });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw3.id, parameterDefinitionId: pdHeadTypeId, value: "flat" });
  await itemRepository.setParameterValue({ ...ctx, itemId: screw3.id, parameterDefinitionId: pdDriveTypeId, value: "torx" });

  // Nuts & Washers
  const nut1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "M3 Hex Nut", description: "Stainless steel hex nut" });
  await itemRepository.addCategory({ ...ctx, itemId: nut1.id, categoryId: catFastenerId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: nut1.id, aspectId: aspectThreadId });
  await itemRepository.applyAspect({ ...ctx, itemId: nut1.id, aspectId: aspectPhysicalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: nut1.id, parameterDefinitionId: pdThreadSizeId, value: "M3" });
  await itemRepository.setParameterValue({ ...ctx, itemId: nut1.id, parameterDefinitionId: pdMaterialId, value: "stainless_steel" });

  const nut2 = await itemRepository.create({ ...ctx, asGlobal: true, name: "M4 Nylon Lock Nut" });
  await itemRepository.addCategory({ ...ctx, itemId: nut2.id, categoryId: catFastenerId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: nut2.id, aspectId: aspectThreadId });
  await itemRepository.setParameterValue({ ...ctx, itemId: nut2.id, parameterDefinitionId: pdThreadSizeId, value: "M4" });

  // Electronics
  const cap1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "100µF Electrolytic Capacitor", description: "25V aluminum electrolytic capacitor" });
  await itemRepository.addCategory({ ...ctx, itemId: cap1.id, categoryId: catElectronicId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: cap1.id, aspectId: aspectElectricalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap1.id, parameterDefinitionId: pdCapacitanceId, value: 100 });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap1.id, parameterDefinitionId: pdVoltageId, value: 25 });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap1.id, parameterDefinitionId: pdPackageId, value: "through-hole" });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap1.id, parameterDefinitionId: pdToleranceId, value: "±20%" });

  const cap2 = await itemRepository.create({ ...ctx, asGlobal: true, name: "10µF Ceramic Capacitor", description: "50V X7R ceramic capacitor" });
  await itemRepository.addCategory({ ...ctx, itemId: cap2.id, categoryId: catElectronicId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: cap2.id, aspectId: aspectElectricalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap2.id, parameterDefinitionId: pdCapacitanceId, value: 10 });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap2.id, parameterDefinitionId: pdVoltageId, value: 50 });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap2.id, parameterDefinitionId: pdPackageId, value: "0805" });
  await itemRepository.setParameterValue({ ...ctx, itemId: cap2.id, parameterDefinitionId: pdToleranceId, value: "±10%" });

  const resistor1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "10kΩ Resistor", description: "1/4W metal film resistor" });
  await itemRepository.addCategory({ ...ctx, itemId: resistor1.id, categoryId: catElectronicId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: resistor1.id, aspectId: aspectElectricalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: resistor1.id, parameterDefinitionId: pdResistanceId, value: 10000 });
  await itemRepository.setParameterValue({ ...ctx, itemId: resistor1.id, parameterDefinitionId: pdToleranceId, value: "±1%" });
  await itemRepository.setParameterValue({ ...ctx, itemId: resistor1.id, parameterDefinitionId: pdPackageId, value: "through-hole" });

  const resistor2 = await itemRepository.create({ ...ctx, asGlobal: true, name: "470Ω SMD Resistor" });
  await itemRepository.addCategory({ ...ctx, itemId: resistor2.id, categoryId: catElectronicId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: resistor2.id, aspectId: aspectElectricalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: resistor2.id, parameterDefinitionId: pdResistanceId, value: 470 });
  await itemRepository.setParameterValue({ ...ctx, itemId: resistor2.id, parameterDefinitionId: pdPackageId, value: "0603" });

  const led1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "5mm Red LED", description: "Standard through-hole LED, 2.0V forward voltage" });
  await itemRepository.addCategory({ ...ctx, itemId: led1.id, categoryId: catElectronicId, isPrimary: true });
  await itemRepository.applyAspect({ ...ctx, itemId: led1.id, aspectId: aspectElectricalId });
  await itemRepository.applyAspect({ ...ctx, itemId: led1.id, aspectId: aspectPhysicalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: led1.id, parameterDefinitionId: pdVoltageId, value: 2.0 });
  await itemRepository.setParameterValue({ ...ctx, itemId: led1.id, parameterDefinitionId: pdColorId, value: "red" });
  await itemRepository.setParameterValue({ ...ctx, itemId: led1.id, parameterDefinitionId: pdPackageId, value: "through-hole" });

  // Tools
  const tool1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "Weller WE1010 Soldering Station", description: "70W digital soldering station" });
  await itemRepository.addCategory({ ...ctx, itemId: tool1.id, categoryId: catToolId, isPrimary: true });
  await itemRepository.addCategory({ ...ctx, itemId: tool1.id, categoryId: catElectronicId });
  await itemRepository.applyAspect({ ...ctx, itemId: tool1.id, aspectId: aspectElectricalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: tool1.id, parameterDefinitionId: pdVoltageId, value: 120 });
  await itemRepository.setParameterValue({ ...ctx, itemId: tool1.id, parameterDefinitionId: pdTempRatingId, value: 450 });

  const tool2 = await itemRepository.create({ ...ctx, asGlobal: true, name: "Digital Calipers", description: "6-inch stainless steel digital calipers" });
  await itemRepository.addCategory({ ...ctx, itemId: tool2.id, categoryId: catToolId, isPrimary: true });
  await itemRepository.addCategory({ ...ctx, itemId: tool2.id, categoryId: catMeasureId });

  // Adhesives
  const glue1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "Loctite Super Glue", description: "Instant cyanoacrylate adhesive" });
  await itemRepository.addCategory({ ...ctx, itemId: glue1.id, categoryId: catAdhesiveId, isPrimary: true });
  await itemRepository.setParameterValue({ ...ctx, itemId: glue1.id, parameterDefinitionId: pdCureTimeId, value: 1 });

  const glue2 = await itemRepository.create({ ...ctx, asGlobal: true, name: "JB Weld Original", description: "Two-part epoxy, steel-reinforced" });
  await itemRepository.addCategory({ ...ctx, itemId: glue2.id, categoryId: catAdhesiveId, isPrimary: true });
  await itemRepository.setParameterValue({ ...ctx, itemId: glue2.id, parameterDefinitionId: pdCureTimeId, value: 960 });
  await itemRepository.setParameterValue({ ...ctx, itemId: glue2.id, parameterDefinitionId: pdTempRatingId, value: 288 });

  // Wire
  const wire1 = await itemRepository.create({ ...ctx, asGlobal: true, name: "22 AWG Hookup Wire (Red)", description: "Solid core hookup wire, 25ft spool" });
  await itemRepository.addCategory({ ...ctx, itemId: wire1.id, categoryId: catWireId, isPrimary: true });
  await itemRepository.addCategory({ ...ctx, itemId: wire1.id, categoryId: catElectronicId });
  await itemRepository.applyAspect({ ...ctx, itemId: wire1.id, aspectId: aspectPhysicalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: wire1.id, parameterDefinitionId: pdGaugeId, value: "22 AWG" });
  await itemRepository.setParameterValue({ ...ctx, itemId: wire1.id, parameterDefinitionId: pdColorId, value: "red" });
  await itemRepository.setParameterValue({ ...ctx, itemId: wire1.id, parameterDefinitionId: pdVoltageId, value: 300 });

  const wire2 = await itemRepository.create({ ...ctx, asGlobal: true, name: "22 AWG Hookup Wire (Black)", description: "Solid core hookup wire, 25ft spool" });
  await itemRepository.addCategory({ ...ctx, itemId: wire2.id, categoryId: catWireId, isPrimary: true });
  await itemRepository.addCategory({ ...ctx, itemId: wire2.id, categoryId: catElectronicId });
  await itemRepository.applyAspect({ ...ctx, itemId: wire2.id, aspectId: aspectPhysicalId });
  await itemRepository.setParameterValue({ ...ctx, itemId: wire2.id, parameterDefinitionId: pdGaugeId, value: "22 AWG" });
  await itemRepository.setParameterValue({ ...ctx, itemId: wire2.id, parameterDefinitionId: pdColorId, value: "black" });
  await itemRepository.setParameterValue({ ...ctx, itemId: wire2.id, parameterDefinitionId: pdVoltageId, value: 300 });

  console.log("items: 16 items seeded across 6 categories");
}
