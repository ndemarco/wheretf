import Item, { IItem, IParameterValue } from '@/models/Item';
import dbConnect from '@/lib/mongodb';
import { validatePath } from '@/lib/pathValidator';

export interface CreateItemInput {
  userId: string;
  name: string;
  description?: string;
  parameters?: IParameterValue[];
  location: string;
}

export interface SearchItemsInput {
  userId: string;
  query?: string;
  location?: string;
  parameters?: { key: string; value: string }[];
}

export interface UpdateItemInput {
  userId: string;
  location: string;
  updates: {
    name?: string;
    description?: string;
    parameters?: IParameterValue[];
    location?: string;
  };
}

export async function create(input: CreateItemInput): Promise<IItem> {
  await dbConnect();

  // Validate location path
  const pathValidation = await validatePath(input.location);
  if (!pathValidation.valid) {
    throw new Error(`Invalid location: ${pathValidation.error}`);
  }

  // Check for duplicate location for this user
  const existing = await Item.findOne({ user: input.userId, location: input.location });
  if (existing) {
    throw new Error(`Location ${input.location} already has an item: ${existing.name}`);
  }

  const item = await Item.create({
    user: input.userId,
    name: input.name,
    description: input.description,
    parameters: input.parameters || [],
    location: input.location,
  });

  return item;
}

export async function search(input: SearchItemsInput): Promise<IItem[]> {
  await dbConnect();

  const filter: Record<string, unknown> = { user: input.userId };

  // Text search
  if (input.query) {
    filter.$text = { $search: input.query };
  }

  // Location prefix search
  if (input.location) {
    filter.location = { $regex: `^${input.location}` };
  }

  // Parameter filters
  if (input.parameters?.length) {
    filter.$and = input.parameters.map((p) => ({
      parameters: { $elemMatch: { key: p.key, value: p.value } },
    }));
  }

  return Item.find(filter).sort({ updatedAt: -1 });
}

export async function findByLocation(
  userId: string,
  location: string
): Promise<IItem | null> {
  await dbConnect();
  return Item.findOne({ user: userId, location });
}

export async function findById(userId: string, id: string): Promise<IItem | null> {
  await dbConnect();
  return Item.findOne({ user: userId, _id: id });
}

export async function list(userId: string): Promise<IItem[]> {
  await dbConnect();
  return Item.find({ user: userId }).sort({ updatedAt: -1 });
}

export async function update(input: UpdateItemInput): Promise<IItem> {
  await dbConnect();

  const item = await Item.findOne({ user: input.userId, location: input.location });
  if (!item) {
    throw new Error(`No item found at ${input.location}`);
  }

  // If updating location, validate the new path
  if (input.updates.location && input.updates.location !== input.location) {
    const pathValidation = await validatePath(input.updates.location);
    if (!pathValidation.valid) {
      throw new Error(`Invalid new location: ${pathValidation.error}`);
    }

    // Check new location isn't taken
    const existing = await Item.findOne({
      user: input.userId,
      location: input.updates.location,
    });
    if (existing) {
      throw new Error(
        `Location ${input.updates.location} already has an item: ${existing.name}`
      );
    }
  }

  Object.assign(item, input.updates);
  await item.save();

  return item;
}

export async function remove(userId: string, location: string): Promise<{ success: boolean }> {
  await dbConnect();

  const result = await Item.deleteOne({ user: userId, location });
  if (result.deletedCount === 0) {
    throw new Error(`No item found at ${location}`);
  }

  return { success: true };
}

export async function findByModule(userId: string, moduleName: string): Promise<IItem[]> {
  await dbConnect();
  return Item.find({
    user: userId,
    location: { $regex: `^${moduleName.toUpperCase()}:` },
  }).sort({ location: 1 });
}

export async function countByModule(userId: string, moduleName: string): Promise<number> {
  await dbConnect();
  return Item.countDocuments({
    user: userId,
    location: { $regex: `^${moduleName.toUpperCase()}:` },
  });
}

export async function move(
  userId: string,
  fromLocation: string,
  toLocation: string
): Promise<IItem> {
  await dbConnect();

  const item = await Item.findOne({ user: userId, location: fromLocation });
  if (!item) {
    throw new Error(`No item found at ${fromLocation}`);
  }

  // Validate the new path
  const pathValidation = await validatePath(toLocation);
  if (!pathValidation.valid) {
    throw new Error(`Invalid destination: ${pathValidation.error}`);
  }

  // Check destination isn't taken
  const existing = await Item.findOne({ user: userId, location: toLocation });
  if (existing) {
    throw new Error(`Destination ${toLocation} already has an item: ${existing.name}`);
  }

  item.location = toLocation;
  await item.save();

  return item;
}

/**
 * Update location prefix for all items (used when renaming dimension values)
 * Returns the count of items updated
 */
export async function updateLocationPrefix(
  userId: string,
  oldPrefix: string,
  newPrefix: string
): Promise<number> {
  await dbConnect();

  // Find all items with locations starting with oldPrefix
  const items = await Item.find({
    user: userId,
    location: { $regex: `^${oldPrefix}` },
  });

  let count = 0;
  for (const item of items) {
    item.location = item.location.replace(oldPrefix, newPrefix);
    await item.save();
    count++;
  }

  return count;
}
