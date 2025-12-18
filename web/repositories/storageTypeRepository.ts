import StorageType, { IStorageType, IMergeConstraints, IDefaultGrid } from '@/models/StorageType';
import dbConnect from '@/lib/mongodb';

export interface CreateStorageTypeInput {
  name: string;
  aliases?: string[];
  description?: string;
  defaultGrid?: IDefaultGrid;
  mergeConstraints?: IMergeConstraints;
  notes?: string;
  isSystem?: boolean;
}

export interface SearchStorageTypesInput {
  query?: string;
  name?: string;
}

export async function create(input: CreateStorageTypeInput): Promise<IStorageType> {
  await dbConnect();

  const existing = await StorageType.findOne({ name: input.name.toLowerCase() });
  if (existing) {
    throw new Error(`Storage type "${input.name}" already exists`);
  }

  const storageType = await StorageType.create({
    name: input.name.toLowerCase(),
    aliases: input.aliases || [],
    description: input.description,
    defaultGrid: input.defaultGrid,
    mergeConstraints: input.mergeConstraints,
    notes: input.notes,
    isSystem: input.isSystem || false,
  });

  return storageType;
}

export async function search(input: SearchStorageTypesInput): Promise<IStorageType[]> {
  await dbConnect();

  if (input.name) {
    const result = await StorageType.findOne({ name: input.name.toLowerCase() });
    return result ? [result] : [];
  }

  if (input.query) {
    // Search by name, aliases, or description
    const regex = new RegExp(input.query, 'i');
    return StorageType.find({
      $or: [
        { name: regex },
        { aliases: regex },
        { description: regex },
      ],
    }).sort({ name: 1 });
  }

  // Return all storage types
  return StorageType.find().sort({ name: 1 });
}

export async function findByName(name: string): Promise<IStorageType | null> {
  await dbConnect();
  return StorageType.findOne({ name: name.toLowerCase() });
}

export async function findByNameOrAlias(nameOrAlias: string): Promise<IStorageType | null> {
  await dbConnect();
  const lowered = nameOrAlias.toLowerCase();

  return StorageType.findOne({
    $or: [
      { name: lowered },
      { aliases: { $regex: new RegExp(`^${nameOrAlias}$`, 'i') } },
    ],
  });
}

export async function list(): Promise<IStorageType[]> {
  await dbConnect();
  return StorageType.find().sort({ name: 1 });
}

export async function update(
  name: string,
  updates: Partial<Omit<CreateStorageTypeInput, 'name' | 'isSystem'>>
): Promise<IStorageType> {
  await dbConnect();

  const storageType = await StorageType.findOne({ name: name.toLowerCase() });
  if (!storageType) {
    throw new Error(`Storage type "${name}" not found`);
  }

  Object.assign(storageType, updates);
  await storageType.save();

  return storageType;
}

export async function remove(name: string): Promise<{ success: boolean }> {
  await dbConnect();

  const storageType = await StorageType.findOne({ name: name.toLowerCase() });
  if (!storageType) {
    throw new Error(`Storage type "${name}" not found`);
  }

  if (storageType.isSystem) {
    throw new Error(`Cannot delete system storage type "${name}"`);
  }

  await StorageType.deleteOne({ name: name.toLowerCase() });
  return { success: true };
}

/**
 * Upsert a storage type - create if not exists, update if exists
 */
export async function upsertDefault(input: CreateStorageTypeInput): Promise<IStorageType> {
  await dbConnect();

  const result = await StorageType.findOneAndUpdate(
    { name: input.name.toLowerCase() },
    {
      $set: {
        aliases: input.aliases || [],
        description: input.description,
        defaultGrid: input.defaultGrid,
        mergeConstraints: input.mergeConstraints,
        notes: input.notes,
        isSystem: input.isSystem || false,
      },
      $setOnInsert: {
        name: input.name.toLowerCase(),
      },
    },
    { upsert: true, new: true }
  );

  return result;
}
