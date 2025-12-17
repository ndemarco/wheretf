import StorageModule, { IStorageModule, IModuleDimension } from '@/models/StorageModule';
import DimensionTemplate from '@/models/DimensionTemplate';
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
 * Expands templates to generate full path structure
 */
export async function getValidPaths(name: string): Promise<string[]> {
  await dbConnect();

  const module = await StorageModule.findOne({ name: name.toUpperCase() });
  if (!module) {
    throw new Error(`Module "${name}" not found`);
  }

  const paths: string[] = [];

  async function expandDimensions(
    dimensionIndex: number,
    currentPath: string,
    templateDimensions?: { label: string; values: string[] }[]
  ): Promise<void> {
    // If we have template dimensions to process, process them first
    if (templateDimensions && templateDimensions.length > 0) {
      const dim = templateDimensions[0];
      const remainingTemplateDims = templateDimensions.slice(1);

      for (const value of dim.values) {
        const newPath = `${currentPath}:${dim.label}-${value}`;
        if (remainingTemplateDims.length === 0 && dimensionIndex >= module.dimensions.length) {
          paths.push(newPath);
        } else {
          await expandDimensions(dimensionIndex, newPath, remainingTemplateDims);
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

      // Check if this value has a template mapping
      const templateName = dim.templateMapping?.[value];
      if (templateName) {
        const template = await DimensionTemplate.findOne({ name: templateName.toLowerCase() });
        if (template) {
          await expandDimensions(dimensionIndex + 1, newPath, template.dimensions);
          continue;
        }
      }

      await expandDimensions(dimensionIndex + 1, newPath);
    }
  }

  await expandDimensions(0, '');
  return paths;
}
