/**
 * Seed script: creates sample taxonomy data and items for UI development.
 * Run: cd web && npx tsx db/seed.ts
 */
import { db } from "./connection";
import { categoryRepository } from "../repositories/categoryRepository";
import { parameterDefinitionRepository } from "../repositories/parameterDefinitionRepository";
import { aspectRepository } from "../repositories/aspectRepository";
import { itemRepository } from "../repositories/itemRepository";
import { templateRepository } from "../repositories/templateRepository";
import { moduleRepository } from "../repositories/moduleRepository";
import { locationRepository } from "../repositories/locationRepository";
import { categories, parameterDefinitions, aspects, templates, modules } from "./schema";

async function seed() {
  console.log("Seeding...");

  const existingCats = await db.select().from(categories);
  const hasTaxonomy = existingCats.length > 0;

  const existingTemplates = await db.select().from(templates);
  const hasTemplates = existingTemplates.length > 0;

  const existingMods = await db.select().from(modules);
  const hasModules = existingMods.length > 0;

  if (hasTaxonomy && hasTemplates && hasModules) {
    console.log("All seed data already exists, nothing to do.");
    process.exit(0);
  }

  // --- Categories & Items ---
  let catFastener, catElectronic, catTool, catAdhesive, catWire, catMeasure;
  let pdThreadSize, pdLength, pdMaterial, pdHeadType, pdDriveType;
  let pdVoltage, pdCapacitance, pdResistance, pdTolerance, pdPackage;
  let pdWeight, pdColor, pdGauge, pdCureTime, pdTempRating;
  let aspectThread, aspectScrew, aspectPhysical, aspectElectrical;

  if (hasTaxonomy) {
    console.log("Taxonomy/items already seeded, skipping.");
  } else {
  const catFastener = await categoryRepository.create({
    name: "Fasteners",
    icon: "🔩",
    color: "#6366f1",
    sortOrder: 1,
  });
  const catElectronic = await categoryRepository.create({
    name: "Electronics",
    icon: "⚡",
    color: "#f59e0b",
    sortOrder: 2,
  });
  const catTool = await categoryRepository.create({
    name: "Tools",
    icon: "🔧",
    color: "#10b981",
    sortOrder: 3,
  });
  const catAdhesive = await categoryRepository.create({
    name: "Adhesives",
    icon: "🧴",
    color: "#ec4899",
    sortOrder: 4,
  });
  const catWire = await categoryRepository.create({
    name: "Wire & Cable",
    icon: "🔌",
    color: "#8b5cf6",
    sortOrder: 5,
  });
  const catMeasure = await categoryRepository.create({
    name: "Measurement",
    icon: "📏",
    color: "#06b6d4",
    sortOrder: 6,
  });

  // --- Parameter Definitions ---
  const pdThreadSize = await parameterDefinitionRepository.create({
    name: "thread_size",
    dataType: "text",
  });
  const pdLength = await parameterDefinitionRepository.create({
    name: "length",
    dataType: "numeric",
    unit: "mm",
  });
  const pdMaterial = await parameterDefinitionRepository.create({
    name: "material",
    dataType: "enum",
    constraints: {
      enumValues: [
        "steel",
        "stainless_steel",
        "brass",
        "aluminum",
        "nylon",
        "copper",
      ],
    },
  });
  const pdHeadType = await parameterDefinitionRepository.create({
    name: "head_type",
    dataType: "enum",
    constraints: {
      enumValues: ["pan", "flat", "hex", "socket", "button", "truss"],
    },
  });
  const pdDriveType = await parameterDefinitionRepository.create({
    name: "drive_type",
    dataType: "enum",
    constraints: {
      enumValues: ["phillips", "slotted", "torx", "hex", "square"],
    },
  });
  const pdVoltage = await parameterDefinitionRepository.create({
    name: "voltage_rating",
    dataType: "numeric",
    unit: "V",
  });
  const pdCapacitance = await parameterDefinitionRepository.create({
    name: "capacitance",
    dataType: "numeric",
    unit: "µF",
  });
  const pdResistance = await parameterDefinitionRepository.create({
    name: "resistance",
    dataType: "numeric",
    unit: "Ω",
  });
  const pdTolerance = await parameterDefinitionRepository.create({
    name: "tolerance",
    dataType: "text",
  });
  const pdPackage = await parameterDefinitionRepository.create({
    name: "package",
    dataType: "enum",
    constraints: {
      enumValues: ["0402", "0603", "0805", "1206", "SOT-23", "SOIC-8", "DIP-8", "through-hole"],
    },
  });
  const pdWeight = await parameterDefinitionRepository.create({
    name: "weight",
    dataType: "numeric",
    unit: "g",
  });
  const pdColor = await parameterDefinitionRepository.create({
    name: "color",
    dataType: "text",
  });
  const pdGauge = await parameterDefinitionRepository.create({
    name: "gauge",
    dataType: "text",
  });
  const pdCureTime = await parameterDefinitionRepository.create({
    name: "cure_time",
    dataType: "numeric",
    unit: "min",
  });
  const pdTempRating = await parameterDefinitionRepository.create({
    name: "temp_rating",
    dataType: "numeric",
    unit: "°C",
  });

  // --- Aspects ---
  const aspectThread = await aspectRepository.create({
    name: "Threading",
    description: "Thread specifications for fasteners",
  });
  await aspectRepository.addParameter({
    aspectId: aspectThread.id,
    parameterDefinitionId: pdThreadSize.id,
    sortOrder: 0,
  });
  await aspectRepository.addParameter({
    aspectId: aspectThread.id,
    parameterDefinitionId: pdLength.id,
    sortOrder: 1,
  });

  const aspectScrew = await aspectRepository.create({
    name: "Screw Head",
    description: "Head and drive type for screws",
  });
  await aspectRepository.addParameter({
    aspectId: aspectScrew.id,
    parameterDefinitionId: pdHeadType.id,
    sortOrder: 0,
  });
  await aspectRepository.addParameter({
    aspectId: aspectScrew.id,
    parameterDefinitionId: pdDriveType.id,
    sortOrder: 1,
  });

  const aspectPhysical = await aspectRepository.create({
    name: "Physical Properties",
    description: "Weight, material, color",
  });
  await aspectRepository.addParameter({
    aspectId: aspectPhysical.id,
    parameterDefinitionId: pdMaterial.id,
    sortOrder: 0,
  });
  await aspectRepository.addParameter({
    aspectId: aspectPhysical.id,
    parameterDefinitionId: pdWeight.id,
    sortOrder: 1,
  });
  await aspectRepository.addParameter({
    aspectId: aspectPhysical.id,
    parameterDefinitionId: pdColor.id,
    sortOrder: 2,
  });

  const aspectElectrical = await aspectRepository.create({
    name: "Electrical Ratings",
    description: "Voltage, tolerance, package",
  });
  await aspectRepository.addParameter({
    aspectId: aspectElectrical.id,
    parameterDefinitionId: pdVoltage.id,
    sortOrder: 0,
  });
  await aspectRepository.addParameter({
    aspectId: aspectElectrical.id,
    parameterDefinitionId: pdTolerance.id,
    sortOrder: 1,
  });
  await aspectRepository.addParameter({
    aspectId: aspectElectrical.id,
    parameterDefinitionId: pdPackage.id,
    sortOrder: 2,
  });

  // --- Items ---

  // Machine Screws
  const screw1 = await itemRepository.create({
    name: "M3x10 Socket Head Cap Screw",
    description: "Stainless steel socket head cap screw",
  });
  await itemRepository.addCategory({ itemId: screw1.id, categoryId: catFastener.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: screw1.id, aspectId: aspectThread.id });
  await itemRepository.applyAspect({ itemId: screw1.id, aspectId: aspectScrew.id });
  await itemRepository.applyAspect({ itemId: screw1.id, aspectId: aspectPhysical.id });
  await itemRepository.setParameterValue({ itemId: screw1.id, parameterDefinitionId: pdThreadSize.id, value: "M3" });
  await itemRepository.setParameterValue({ itemId: screw1.id, parameterDefinitionId: pdLength.id, value: 10 });
  await itemRepository.setParameterValue({ itemId: screw1.id, parameterDefinitionId: pdHeadType.id, value: "socket" });
  await itemRepository.setParameterValue({ itemId: screw1.id, parameterDefinitionId: pdDriveType.id, value: "hex" });
  await itemRepository.setParameterValue({ itemId: screw1.id, parameterDefinitionId: pdMaterial.id, value: "stainless_steel" });

  const screw2 = await itemRepository.create({
    name: "M4x20 Pan Head Machine Screw",
    description: "Zinc-plated steel pan head screw",
  });
  await itemRepository.addCategory({ itemId: screw2.id, categoryId: catFastener.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: screw2.id, aspectId: aspectThread.id });
  await itemRepository.applyAspect({ itemId: screw2.id, aspectId: aspectScrew.id });
  await itemRepository.applyAspect({ itemId: screw2.id, aspectId: aspectPhysical.id });
  await itemRepository.setParameterValue({ itemId: screw2.id, parameterDefinitionId: pdThreadSize.id, value: "M4" });
  await itemRepository.setParameterValue({ itemId: screw2.id, parameterDefinitionId: pdLength.id, value: 20 });
  await itemRepository.setParameterValue({ itemId: screw2.id, parameterDefinitionId: pdHeadType.id, value: "pan" });
  await itemRepository.setParameterValue({ itemId: screw2.id, parameterDefinitionId: pdDriveType.id, value: "phillips" });
  await itemRepository.setParameterValue({ itemId: screw2.id, parameterDefinitionId: pdMaterial.id, value: "steel" });

  const screw3 = await itemRepository.create({
    name: "M5x16 Flat Head Screw",
  });
  await itemRepository.addCategory({ itemId: screw3.id, categoryId: catFastener.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: screw3.id, aspectId: aspectThread.id });
  await itemRepository.applyAspect({ itemId: screw3.id, aspectId: aspectScrew.id });
  await itemRepository.setParameterValue({ itemId: screw3.id, parameterDefinitionId: pdThreadSize.id, value: "M5" });
  await itemRepository.setParameterValue({ itemId: screw3.id, parameterDefinitionId: pdLength.id, value: 16 });
  await itemRepository.setParameterValue({ itemId: screw3.id, parameterDefinitionId: pdHeadType.id, value: "flat" });
  await itemRepository.setParameterValue({ itemId: screw3.id, parameterDefinitionId: pdDriveType.id, value: "torx" });

  // Nuts & Washers
  const nut1 = await itemRepository.create({
    name: "M3 Hex Nut",
    description: "Stainless steel hex nut",
  });
  await itemRepository.addCategory({ itemId: nut1.id, categoryId: catFastener.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: nut1.id, aspectId: aspectThread.id });
  await itemRepository.applyAspect({ itemId: nut1.id, aspectId: aspectPhysical.id });
  await itemRepository.setParameterValue({ itemId: nut1.id, parameterDefinitionId: pdThreadSize.id, value: "M3" });
  await itemRepository.setParameterValue({ itemId: nut1.id, parameterDefinitionId: pdMaterial.id, value: "stainless_steel" });

  const nut2 = await itemRepository.create({ name: "M4 Nylon Lock Nut" });
  await itemRepository.addCategory({ itemId: nut2.id, categoryId: catFastener.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: nut2.id, aspectId: aspectThread.id });
  await itemRepository.setParameterValue({ itemId: nut2.id, parameterDefinitionId: pdThreadSize.id, value: "M4" });

  // Electronics
  const cap1 = await itemRepository.create({
    name: "100µF Electrolytic Capacitor",
    description: "25V aluminum electrolytic capacitor",
  });
  await itemRepository.addCategory({ itemId: cap1.id, categoryId: catElectronic.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: cap1.id, aspectId: aspectElectrical.id });
  await itemRepository.setParameterValue({ itemId: cap1.id, parameterDefinitionId: pdCapacitance.id, value: 100 });
  await itemRepository.setParameterValue({ itemId: cap1.id, parameterDefinitionId: pdVoltage.id, value: 25 });
  await itemRepository.setParameterValue({ itemId: cap1.id, parameterDefinitionId: pdPackage.id, value: "through-hole" });
  await itemRepository.setParameterValue({ itemId: cap1.id, parameterDefinitionId: pdTolerance.id, value: "±20%" });

  const cap2 = await itemRepository.create({
    name: "10µF Ceramic Capacitor",
    description: "50V X7R ceramic capacitor",
  });
  await itemRepository.addCategory({ itemId: cap2.id, categoryId: catElectronic.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: cap2.id, aspectId: aspectElectrical.id });
  await itemRepository.setParameterValue({ itemId: cap2.id, parameterDefinitionId: pdCapacitance.id, value: 10 });
  await itemRepository.setParameterValue({ itemId: cap2.id, parameterDefinitionId: pdVoltage.id, value: 50 });
  await itemRepository.setParameterValue({ itemId: cap2.id, parameterDefinitionId: pdPackage.id, value: "0805" });
  await itemRepository.setParameterValue({ itemId: cap2.id, parameterDefinitionId: pdTolerance.id, value: "±10%" });

  const resistor1 = await itemRepository.create({
    name: "10kΩ Resistor",
    description: "1/4W metal film resistor",
  });
  await itemRepository.addCategory({ itemId: resistor1.id, categoryId: catElectronic.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: resistor1.id, aspectId: aspectElectrical.id });
  await itemRepository.setParameterValue({ itemId: resistor1.id, parameterDefinitionId: pdResistance.id, value: 10000 });
  await itemRepository.setParameterValue({ itemId: resistor1.id, parameterDefinitionId: pdTolerance.id, value: "±1%" });
  await itemRepository.setParameterValue({ itemId: resistor1.id, parameterDefinitionId: pdPackage.id, value: "through-hole" });

  const resistor2 = await itemRepository.create({
    name: "470Ω SMD Resistor",
  });
  await itemRepository.addCategory({ itemId: resistor2.id, categoryId: catElectronic.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: resistor2.id, aspectId: aspectElectrical.id });
  await itemRepository.setParameterValue({ itemId: resistor2.id, parameterDefinitionId: pdResistance.id, value: 470 });
  await itemRepository.setParameterValue({ itemId: resistor2.id, parameterDefinitionId: pdPackage.id, value: "0603" });

  const led1 = await itemRepository.create({
    name: "5mm Red LED",
    description: "Standard through-hole LED, 2.0V forward voltage",
  });
  await itemRepository.addCategory({ itemId: led1.id, categoryId: catElectronic.id, isPrimary: true });
  await itemRepository.applyAspect({ itemId: led1.id, aspectId: aspectElectrical.id });
  await itemRepository.applyAspect({ itemId: led1.id, aspectId: aspectPhysical.id });
  await itemRepository.setParameterValue({ itemId: led1.id, parameterDefinitionId: pdVoltage.id, value: 2.0 });
  await itemRepository.setParameterValue({ itemId: led1.id, parameterDefinitionId: pdColor.id, value: "red" });
  await itemRepository.setParameterValue({ itemId: led1.id, parameterDefinitionId: pdPackage.id, value: "through-hole" });

  // Tools
  const tool1 = await itemRepository.create({
    name: "Weller WE1010 Soldering Station",
    description: "70W digital soldering station",
  });
  await itemRepository.addCategory({ itemId: tool1.id, categoryId: catTool.id, isPrimary: true });
  await itemRepository.addCategory({ itemId: tool1.id, categoryId: catElectronic.id });
  await itemRepository.applyAspect({ itemId: tool1.id, aspectId: aspectElectrical.id });
  await itemRepository.setParameterValue({ itemId: tool1.id, parameterDefinitionId: pdVoltage.id, value: 120 });
  await itemRepository.setParameterValue({ itemId: tool1.id, parameterDefinitionId: pdTempRating.id, value: 450 });

  const tool2 = await itemRepository.create({
    name: "Digital Calipers",
    description: "6-inch stainless steel digital calipers",
  });
  await itemRepository.addCategory({ itemId: tool2.id, categoryId: catTool.id, isPrimary: true });
  await itemRepository.addCategory({ itemId: tool2.id, categoryId: catMeasure.id });

  // Adhesives
  const glue1 = await itemRepository.create({
    name: "Loctite Super Glue",
    description: "Instant cyanoacrylate adhesive",
  });
  await itemRepository.addCategory({ itemId: glue1.id, categoryId: catAdhesive.id, isPrimary: true });
  await itemRepository.setParameterValue({ itemId: glue1.id, parameterDefinitionId: pdCureTime.id, value: 1 });

  const glue2 = await itemRepository.create({
    name: "JB Weld Original",
    description: "Two-part epoxy, steel-reinforced",
  });
  await itemRepository.addCategory({ itemId: glue2.id, categoryId: catAdhesive.id, isPrimary: true });
  await itemRepository.setParameterValue({ itemId: glue2.id, parameterDefinitionId: pdCureTime.id, value: 960 });
  await itemRepository.setParameterValue({ itemId: glue2.id, parameterDefinitionId: pdTempRating.id, value: 288 });

  // Wire
  const wire1 = await itemRepository.create({
    name: "22 AWG Hookup Wire (Red)",
    description: "Solid core hookup wire, 25ft spool",
  });
  await itemRepository.addCategory({ itemId: wire1.id, categoryId: catWire.id, isPrimary: true });
  await itemRepository.addCategory({ itemId: wire1.id, categoryId: catElectronic.id });
  await itemRepository.applyAspect({ itemId: wire1.id, aspectId: aspectPhysical.id });
  await itemRepository.setParameterValue({ itemId: wire1.id, parameterDefinitionId: pdGauge.id, value: "22 AWG" });
  await itemRepository.setParameterValue({ itemId: wire1.id, parameterDefinitionId: pdColor.id, value: "red" });
  await itemRepository.setParameterValue({ itemId: wire1.id, parameterDefinitionId: pdVoltage.id, value: 300 });

  const wire2 = await itemRepository.create({
    name: "22 AWG Hookup Wire (Black)",
    description: "Solid core hookup wire, 25ft spool",
  });
  await itemRepository.addCategory({ itemId: wire2.id, categoryId: catWire.id, isPrimary: true });
  await itemRepository.addCategory({ itemId: wire2.id, categoryId: catElectronic.id });
  await itemRepository.applyAspect({ itemId: wire2.id, aspectId: aspectPhysical.id });
  await itemRepository.setParameterValue({ itemId: wire2.id, parameterDefinitionId: pdGauge.id, value: "22 AWG" });
  await itemRepository.setParameterValue({ itemId: wire2.id, parameterDefinitionId: pdColor.id, value: "black" });
  await itemRepository.setParameterValue({ itemId: wire2.id, parameterDefinitionId: pdVoltage.id, value: 300 });

    console.log("Seeded 16 items across 6 categories with aspects and parameters.");
  } // end taxonomy block

  // --- Templates ---

  if (hasTemplates) {
    console.log("Templates already seeded, skipping.");
  } else {

  // Interface types — what physical contracts exist for this seed set.
  // Templates declare which one they fit; receptacles declare which they
  // accept. Compatibility is a string match.
  const { interfaceTypes: ifaceTbl } = await import("./schema");
  const ifaceSeeds = [
    { identifier: "plano-3600", description: "Plano 3600 tackle-box footprint" },
    { identifier: "plano-3700", description: "Plano 3700 tackle-box footprint" },
    { identifier: "gridfinity-42mm", description: "Gridfinity 42mm baseplate cell" },
    { identifier: "alex-drawer", description: "IKEA ALEX drawer interior" },
    { identifier: "small-parts-bin", description: "Generic small-parts drawer cell" },
  ];
  for (const s of ifaceSeeds) {
    await db.insert(ifaceTbl).values(s).onConflictDoNothing();
  }

  // Plano 3600 Stowaway — classic tackle box tray
  const tplPlano3600 = await templateRepository.create({
    name: "Plano 3600 Stowaway",
    description: "4-row adjustable compartment box, removable column dividers",
    rows: 4,
    columns: 6,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: false,
    interfaceTypeProvided: "plano-3600",
    metadata: { unitSystem: "imperial", manufacturer: "Plano", productNumber: "2-3600" },
  });

  // Publish a v2 with different column count
  await templateRepository.publishVersion({
    templateId: tplPlano3600.id,
    rows: 4,
    columns: 4,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: false,
  });

  // Plano 3700 Stowaway — deeper, fewer rows
  await templateRepository.create({
    name: "Plano 3700 Stowaway",
    description: "3-row deep compartment box, removable dividers",
    rows: 3,
    columns: 6,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: false,
    interfaceTypeProvided: "plano-3700",
    metadata: { unitSystem: "imperial", manufacturer: "Plano", productNumber: "2-3700" },
  });

  // Gridfinity baseplate — parametric
  await templateRepository.create({
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
    unitSize: "42mm",
    interfaceTypeProvided: "gridfinity-42mm",
    metadata: { unitSystem: "metric" },
  });

  // Small parts drawer — simple 2x3
  await templateRepository.create({
    name: "Small Parts Drawer",
    description: "Simple 2×3 compartment drawer insert",
    rows: 2,
    columns: 3,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: true,
    columnDividersFixed: true,
    interfaceTypeProvided: "small-parts-bin",
    metadata: { unitSystem: "metric" },
  });

  // ALEX drawer divider — IKEA drawer organizer
  await templateRepository.create({
    name: "ALEX Drawer Divider",
    description: "IKEA ALEX drawer compartment layout",
    rows: 3,
    columns: 4,
    rowLabelScheme: "alpha",
    columnLabelScheme: "numeric",
    originPosition: "top-left",
    rowDividersFixed: false,
    columnDividersFixed: false,
    interfaceTypeProvided: "alex-drawer",
    metadata: { unitSystem: "metric", manufacturer: "IKEA", productNumber: "ALEX" },
  });

    console.log("Seeded 5 templates.");
  } // end templates block

  // --- Modules ---

  if (hasModules) {
    console.log("Modules already seeded, skipping.");
  } else {
    // MUSE — 11-shelf cabinet
    const muse = await moduleRepository.create({
      name: "MUSE",
      description: "Red metal cabinet, 11 shelf levels, under workbench",
      primaryDimensionLabel: "level",
      primaryDimensionCount: 11,
    });
    for (let i = 1; i <= 11; i++) {
      await locationRepository.create({
        moduleId: muse.id,
        label: String(i),
        pathSegments: ["MUSE", String(i)],
        locationType: "receptacle",
        interfaceTypeAccepted: "plano-3600",
      });
    }

    // ALEX — 5-drawer IKEA unit
    const alex = await moduleRepository.create({
      name: "ALEX",
      description: "IKEA ALEX 5-drawer unit, white, right side of desk",
      primaryDimensionLabel: "drawer",
      primaryDimensionCount: 5,
    });
    for (let i = 1; i <= 5; i++) {
      await locationRepository.create({
        moduleId: alex.id,
        label: String(i),
        pathSegments: ["ALEX", String(i)],
        locationType: "receptacle",
        interfaceTypeAccepted: "alex-drawer",
      });
    }

    // BENCH — workbench with 3 bays
    const bench = await moduleRepository.create({
      name: "BENCH",
      description: "Main workbench, 3 open bays underneath",
      primaryDimensionLabel: "bay",
      primaryDimensionCount: 3,
    });
    for (let i = 1; i <= 3; i++) {
      await locationRepository.create({
        moduleId: bench.id,
        label: String(i),
        pathSegments: ["BENCH", String(i)],
        locationType: i <= 2 ? "receptacle" : "fixed",
        interfaceTypeAccepted: i <= 2 ? "plano-3700" : undefined,
      });
    }

    console.log("Seeded 3 modules with levels.");
  } // end modules block

  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
