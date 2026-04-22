import { db } from "../connection";
import { categories } from "../schema";
import { categoryRepository } from "../../repositories/categoryRepository";
import { parameterDefinitionRepository } from "../../repositories/parameterDefinitionRepository";
import { aspectRepository } from "../../repositories/aspectRepository";
import type { SeedCtx } from "./context";

export async function seedTaxonomy(ctx: SeedCtx): Promise<void> {
  const existing = await db.select().from(categories);
  if (existing.length > 0) {
    console.log("taxonomy: already seeded, skipping");
    return;
  }

  const catFastener = await categoryRepository.create({ ...ctx, asGlobal: true, name: "Fasteners", icon: "🔩", color: "#6366f1", sortOrder: 1 });
  const catElectronic = await categoryRepository.create({ ...ctx, asGlobal: true, name: "Electronics", icon: "⚡", color: "#f59e0b", sortOrder: 2 });
  const catTool = await categoryRepository.create({ ...ctx, asGlobal: true, name: "Tools", icon: "🔧", color: "#10b981", sortOrder: 3 });
  const catAdhesive = await categoryRepository.create({ ...ctx, asGlobal: true, name: "Adhesives", icon: "🧴", color: "#ec4899", sortOrder: 4 });
  const catWire = await categoryRepository.create({ ...ctx, asGlobal: true, name: "Wire & Cable", icon: "🔌", color: "#8b5cf6", sortOrder: 5 });
  const catMeasure = await categoryRepository.create({ ...ctx, asGlobal: true, name: "Measurement", icon: "📏", color: "#06b6d4", sortOrder: 6 });
  void catFastener; void catElectronic; void catTool; void catAdhesive; void catWire; void catMeasure;

  const pdThreadSize = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "thread_size", dataType: "text" });
  const pdLength = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "length", dataType: "numeric", unit: "mm" });
  const pdMaterial = await parameterDefinitionRepository.create({
    ...ctx,
    asGlobal: true,
    name: "material",
    dataType: "enum",
    constraints: { enumValues: ["steel", "stainless_steel", "brass", "aluminum", "nylon", "copper"] },
  });
  const pdHeadType = await parameterDefinitionRepository.create({
    ...ctx,
    asGlobal: true,
    name: "head_type",
    dataType: "enum",
    constraints: { enumValues: ["pan", "flat", "hex", "socket", "button", "truss"] },
  });
  const pdDriveType = await parameterDefinitionRepository.create({
    ...ctx,
    asGlobal: true,
    name: "drive_type",
    dataType: "enum",
    constraints: { enumValues: ["phillips", "slotted", "torx", "hex", "square"] },
  });
  const pdVoltage = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "voltage_rating", dataType: "numeric", unit: "V" });
  const pdCapacitance = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "capacitance", dataType: "numeric", unit: "µF" });
  const pdResistance = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "resistance", dataType: "numeric", unit: "Ω" });
  const pdTolerance = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "tolerance", dataType: "text" });
  const pdPackage = await parameterDefinitionRepository.create({
    ...ctx,
    asGlobal: true,
    name: "package",
    dataType: "enum",
    constraints: { enumValues: ["0402", "0603", "0805", "1206", "SOT-23", "SOIC-8", "DIP-8", "through-hole"] },
  });
  const pdWeight = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "weight", dataType: "numeric", unit: "g" });
  const pdColor = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "color", dataType: "text" });
  const pdGauge = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "gauge", dataType: "text" });
  const pdCureTime = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "cure_time", dataType: "numeric", unit: "min" });
  const pdTempRating = await parameterDefinitionRepository.create({ ...ctx, asGlobal: true, name: "temp_rating", dataType: "numeric", unit: "°C" });
  void pdResistance; void pdCapacitance; void pdWeight; void pdGauge; void pdCureTime; void pdTempRating;

  const aspectThread = await aspectRepository.create({ ...ctx, asGlobal: true, name: "Threading", description: "Thread specifications for fasteners" });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectThread.id, parameterDefinitionId: pdThreadSize.id, sortOrder: 0 });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectThread.id, parameterDefinitionId: pdLength.id, sortOrder: 1 });

  const aspectScrew = await aspectRepository.create({ ...ctx, asGlobal: true, name: "Screw Head", description: "Head and drive type for screws" });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectScrew.id, parameterDefinitionId: pdHeadType.id, sortOrder: 0 });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectScrew.id, parameterDefinitionId: pdDriveType.id, sortOrder: 1 });

  const aspectPhysical = await aspectRepository.create({ ...ctx, asGlobal: true, name: "Physical Properties", description: "Weight, material, color" });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectPhysical.id, parameterDefinitionId: pdMaterial.id, sortOrder: 0 });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectPhysical.id, parameterDefinitionId: pdWeight.id, sortOrder: 1 });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectPhysical.id, parameterDefinitionId: pdColor.id, sortOrder: 2 });

  const aspectElectrical = await aspectRepository.create({ ...ctx, asGlobal: true, name: "Electrical Ratings", description: "Voltage, tolerance, package" });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectElectrical.id, parameterDefinitionId: pdVoltage.id, sortOrder: 0 });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectElectrical.id, parameterDefinitionId: pdTolerance.id, sortOrder: 1 });
  await aspectRepository.addParameter({ ...ctx, aspectId: aspectElectrical.id, parameterDefinitionId: pdPackage.id, sortOrder: 2 });

  console.log("taxonomy: 6 categories, 15 parameter definitions, 4 aspects seeded");
}
