import ParameterKey, { IParameterKey } from '@/models/ParameterKey';
import dbConnect from '@/lib/mongodb';

export interface CreateParameterKeyInput {
  key: string;
  description?: string;
  category?: string;
  commonUnits?: string[];
}

export interface SearchParameterKeysInput {
  query?: string;
  category?: string;
}

export async function create(input: CreateParameterKeyInput): Promise<IParameterKey> {
  await dbConnect();

  const existing = await ParameterKey.findOne({ key: input.key.toLowerCase() });
  if (existing) {
    throw new Error(`Parameter key "${input.key}" already exists`);
  }

  const parameterKey = await ParameterKey.create({
    key: input.key,
    description: input.description,
    category: input.category,
    commonUnits: input.commonUnits || [],
  });

  return parameterKey;
}

export async function search(input: SearchParameterKeysInput): Promise<IParameterKey[]> {
  await dbConnect();

  const filter: Record<string, unknown> = {};

  if (input.query) {
    filter.$or = [
      { key: { $regex: input.query, $options: 'i' } },
      { description: { $regex: input.query, $options: 'i' } },
    ];
  }

  if (input.category) {
    filter.category = input.category;
  }

  return ParameterKey.find(filter).sort({ key: 1 });
}

export async function findByKey(key: string): Promise<IParameterKey | null> {
  await dbConnect();
  return ParameterKey.findOne({ key: key.toLowerCase() });
}

export async function list(): Promise<IParameterKey[]> {
  await dbConnect();
  return ParameterKey.find().sort({ key: 1 });
}

export async function findOrCreate(input: CreateParameterKeyInput): Promise<IParameterKey> {
  await dbConnect();

  const existing = await findByKey(input.key);
  if (existing) {
    return existing;
  }

  return create(input);
}
