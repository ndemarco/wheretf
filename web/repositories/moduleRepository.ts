import StorageModule, { IStorageModule, IModuleDimension, ISubdimensions, ICellGroup } from '@/models/StorageModule';
import dbConnect from '@/lib/mongodb';

export interface CreateModuleInput {
  name: string;
  description?: string;
  dimensions: IModuleDimension[];
}

export interface SearchModulesInput {
  query?: string;
  name?: string;
}

export async function create(input: CreateModuleInput): Promise<IStorageModule> {
  await dbConnect();

  const moduleName = input.name.toUpperCase();
  const existing = await StorageModule.findOne({ name: moduleName });
  if (existing) {
    throw new Error(`Module "${moduleName}" already exists`);
  }

  const module = await StorageModule.create({
    name: moduleName,
    description: input.description,
    dimensions: input.dimensions,
  });

  return module;
}

export async function search(input: SearchModulesInput): Promise<IStorageModule[]> {
  await dbConnect();

  const filter: Record<string, unknown> = {};

  if (input.name) {
    filter.name = input.name.toUpperCase();
  } else if (input.query) {
    filter.$or = [
      { name: { $regex: input.query, $options: 'i' } },
      { description: { $regex: input.query, $options: 'i' } },
    ];
  }

  return StorageModule.find(filter).sort({ name: 1 });
}

export async function findByName(name: string): Promise<IStorageModule | null> {
  await dbConnect();
  return StorageModule.findOne({ name: name.toUpperCase() });
}

export async function list(): Promise<IStorageModule[]> {
  await dbConnect();
  return StorageModule.find().sort({ name: 1 });
}

export async function update(
  name: string,
  updates: Partial<CreateModuleInput>
): Promise<IStorageModule> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: name.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${name}" not found`);
  }

  if (updates.name) {
    updates.name = updates.name.toUpperCase();
  }

  Object.assign(module, updates);
  await module.save();

  return module;
}

export async function remove(name: string): Promise<{ success: boolean }> {
  await dbConnect();

  const result = await StorageModule.deleteOne({ name: name.toUpperCase() });
  if (result.deletedCount === 0) {
    throw new Error(`Module "${name}" not found`);
  }

  return { success: true };
}

/**
 * Get all valid location paths for a module
 * Expands subdimensions to generate full path structure
 */
export async function getValidPaths(name: string): Promise<string[]> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: name.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${name}" not found`);
  }

  const paths: string[] = [];

  function expandDimensions(
    dimensionIndex: number,
    currentPath: string,
    subdimensions?: { label: string; values: string[] }[]
  ): void {
    // If we have subdimensions to process, process them first
    if (subdimensions && subdimensions.length > 0) {
      const dim = subdimensions[0];
      const remainingSubdims = subdimensions.slice(1);

      for (const value of dim.values) {
        const newPath = `${currentPath}:${dim.label}-${value}`;
        if (remainingSubdims.length === 0 && dimensionIndex >= module.dimensions.length) {
          paths.push(newPath);
        } else {
          expandDimensions(dimensionIndex, newPath, remainingSubdims);
        }
      }
      return;
    }

    // If we've processed all module dimensions, we're done
    if (dimensionIndex >= module.dimensions.length) {
      paths.push(currentPath);
      return;
    }

    const dim = module.dimensions[dimensionIndex];

    for (const value of dim.values) {
      const newPath = currentPath ? `${currentPath}:${dim.label}-${value}` : `${module.name}:${dim.label}-${value}`;

      // Check if this value has subdimensions
      const subdims = dim.subdimensions?.[value];
      if (subdims) {
        expandDimensions(dimensionIndex + 1, newPath, subdims.dimensions);
        continue;
      }

      expandDimensions(dimensionIndex + 1, newPath);
    }
  }

  expandDimensions(0, '');
  return paths;
}

/**
 * Get subdimensions for a specific dimension value
 */
export async function getSubdimensions(
  moduleName: string,
  dimensionLabel: string,
  dimensionValue: string
): Promise<ISubdimensions | null> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${moduleName}" not found`);
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    throw new Error(`Dimension "${dimensionLabel}" not found in module "${moduleName}"`);
  }

  return dimension.subdimensions?.[dimensionValue] || null;
}

/**
 * Set subdimensions for a specific dimension value
 */
export async function setSubdimensions(
  moduleName: string,
  dimensionLabel: string,
  dimensionValue: string,
  subdimensions: ISubdimensions
): Promise<IStorageModule> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${moduleName}" not found`);
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    throw new Error(`Dimension "${dimensionLabel}" not found in module "${moduleName}"`);
  }

  if (!dimension.values.includes(dimensionValue)) {
    throw new Error(`Value "${dimensionValue}" not valid for dimension "${dimensionLabel}"`);
  }

  // Initialize subdimensions map if needed
  if (!dimension.subdimensions) {
    dimension.subdimensions = {};
  }

  dimension.subdimensions[dimensionValue] = subdimensions;
  await module.save();

  return module;
}

/**
 * Add a cell group (merge cells) within a subdimension
 */
export async function addCellGroup(
  moduleName: string,
  dimensionLabel: string,
  dimensionValue: string,
  cellGroup: ICellGroup
): Promise<IStorageModule> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${moduleName}" not found`);
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    throw new Error(`Dimension "${dimensionLabel}" not found`);
  }

  const subdims = dimension.subdimensions?.[dimensionValue];
  if (!subdims) {
    throw new Error(`No subdimensions defined for ${dimensionLabel}-${dimensionValue}`);
  }

  // Check for overlapping groups
  for (const existingGroup of subdims.cellGroups || []) {
    for (const member of cellGroup.members) {
      if (existingGroup.members.includes(member)) {
        throw new Error(`Cell "${member}" is already part of a merged group (canonical: ${existingGroup.canonical})`);
      }
    }
  }

  // Add the new group
  if (!subdims.cellGroups) {
    subdims.cellGroups = [];
  }
  subdims.cellGroups.push(cellGroup);
  await module.save();

  return module;
}

/**
 * Remove a cell group (unmerge cells) within a subdimension
 */
export async function removeCellGroup(
  moduleName: string,
  dimensionLabel: string,
  dimensionValue: string,
  canonical: string
): Promise<IStorageModule> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${moduleName}" not found`);
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    throw new Error(`Dimension "${dimensionLabel}" not found`);
  }

  const subdims = dimension.subdimensions?.[dimensionValue];
  if (!subdims || !subdims.cellGroups) {
    throw new Error(`No cell groups defined for ${dimensionLabel}-${dimensionValue}`);
  }

  const groupIndex = subdims.cellGroups.findIndex((g: ICellGroup) => g.canonical === canonical);
  if (groupIndex === -1) {
    throw new Error(`Cell group with canonical "${canonical}" not found`);
  }

  subdims.cellGroups.splice(groupIndex, 1);
  await module.save();

  return module;
}

/**
 * Find which cell group (if any) a cell belongs to
 */
export async function findCellGroup(
  moduleName: string,
  dimensionLabel: string,
  dimensionValue: string,
  cellAddress: string
): Promise<ICellGroup | null> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    return null;
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    return null;
  }

  const subdims = dimension.subdimensions?.[dimensionValue];
  if (!subdims || !subdims.cellGroups) {
    return null;
  }

  return subdims.cellGroups.find((g: ICellGroup) => g.members.includes(cellAddress)) || null;
}

/**
 * Rename a dimension value (e.g., rename level "2" to "plano-box")
 * Returns the old and new path prefixes for updating items
 */
export async function renameDimensionValue(
  moduleName: string,
  dimensionLabel: string,
  oldValue: string,
  newValue: string
): Promise<{ module: IStorageModule; oldPathPrefix: string; newPathPrefix: string }> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${moduleName}" not found`);
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    throw new Error(`Dimension "${dimensionLabel}" not found in module "${moduleName}"`);
  }

  const valueIndex = dimension.values.indexOf(oldValue);
  if (valueIndex === -1) {
    throw new Error(`Value "${oldValue}" not found in dimension "${dimensionLabel}"`);
  }

  if (dimension.values.includes(newValue)) {
    throw new Error(`Value "${newValue}" already exists in dimension "${dimensionLabel}"`);
  }

  // Update the value in the array
  dimension.values[valueIndex] = newValue;

  // Move subdimensions if they exist
  if (dimension.subdimensions && dimension.subdimensions[oldValue]) {
    dimension.subdimensions[newValue] = dimension.subdimensions[oldValue];
    delete dimension.subdimensions[oldValue];
  }

  await module.save();

  // Return path prefixes for item updates
  const oldPathPrefix = `${module.name}:${dimensionLabel}-${oldValue}`;
  const newPathPrefix = `${module.name}:${dimensionLabel}-${newValue}`;

  return { module, oldPathPrefix, newPathPrefix };
}

/**
 * Add a new dimension value to an existing dimension
 */
export async function addDimensionValue(
  moduleName: string,
  dimensionLabel: string,
  newValue: string,
  position?: number
): Promise<IStorageModule> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${moduleName}" not found`);
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    throw new Error(`Dimension "${dimensionLabel}" not found in module "${moduleName}"`);
  }

  if (dimension.values.includes(newValue)) {
    throw new Error(`Value "${newValue}" already exists in dimension "${dimensionLabel}"`);
  }

  // Add at position or end
  if (position !== undefined && position >= 0 && position <= dimension.values.length) {
    dimension.values.splice(position, 0, newValue);
  } else {
    dimension.values.push(newValue);
  }

  await module.save();
  return module;
}

/**
 * Remove a dimension value from an existing dimension
 * Will fail if items exist at that location
 */
export async function removeDimensionValue(
  moduleName: string,
  dimensionLabel: string,
  value: string
): Promise<IStorageModule> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: moduleName.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${moduleName}" not found`);
  }

  const dimension = module.dimensions.find((d: IModuleDimension) => d.label === dimensionLabel);
  if (!dimension) {
    throw new Error(`Dimension "${dimensionLabel}" not found in module "${moduleName}"`);
  }

  const valueIndex = dimension.values.indexOf(value);
  if (valueIndex === -1) {
    throw new Error(`Value "${value}" not found in dimension "${dimensionLabel}"`);
  }

  // Remove the value
  dimension.values.splice(valueIndex, 1);

  // Remove subdimensions if they exist
  if (dimension.subdimensions && dimension.subdimensions[value]) {
    delete dimension.subdimensions[value];
  }

  await module.save();
  return module;
}
