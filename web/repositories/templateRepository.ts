import DimensionTemplate, { IDimensionTemplate, IDimensionDef } from '@/models/DimensionTemplate';
import dbConnect from '@/lib/mongodb';

export interface CreateTemplateInput {
  name: string;
  description?: string;
  dimensions: IDimensionDef[];
}

export interface SearchTemplatesInput {
  query?: string;
}

export async function create(input: CreateTemplateInput): Promise<IDimensionTemplate> {
  await dbConnect();

  const existing = await DimensionTemplate.findOne({ name: input.name.toLowerCase() });
  if (existing) {
    throw new Error(`Template "${input.name}" already exists`);
  }

  const template = await DimensionTemplate.create({
    name: input.name,
    description: input.description,
    dimensions: input.dimensions,
  });

  return template;
}

export async function search(input: SearchTemplatesInput): Promise<IDimensionTemplate[]> {
  await dbConnect();

  const filter: Record<string, unknown> = {};

  if (input.query) {
    filter.$or = [
      { name: { $regex: input.query, $options: 'i' } },
      { description: { $regex: input.query, $options: 'i' } },
    ];
  }

  return DimensionTemplate.find(filter).sort({ name: 1 });
}

export async function findByName(name: string): Promise<IDimensionTemplate | null> {
  await dbConnect();
  return DimensionTemplate.findOne({ name: name.toLowerCase() });
}

export async function list(): Promise<IDimensionTemplate[]> {
  await dbConnect();
  return DimensionTemplate.find().sort({ name: 1 });
}

export async function update(
  name: string,
  updates: Partial<CreateTemplateInput>
): Promise<IDimensionTemplate> {
  await dbConnect();

  const template = await DimensionTemplate.findOne({ name: name.toLowerCase() });
  if (!template) {
    throw new Error(`Template "${name}" not found`);
  }

  Object.assign(template, updates);
  await template.save();

  return template;
}

export async function remove(name: string): Promise<{ success: boolean }> {
  await dbConnect();

  const result = await DimensionTemplate.deleteOne({ name: name.toLowerCase() });
  if (result.deletedCount === 0) {
    throw new Error(`Template "${name}" not found`);
  }

  return { success: true };
}

/**
 * Upsert a template - create if not exists, update if exists
 */
export async function upsertDefault(input: CreateTemplateInput): Promise<IDimensionTemplate> {
  await dbConnect();

  const result = await DimensionTemplate.findOneAndUpdate(
    { name: input.name.toLowerCase() },
    {
      $set: {
        description: input.description,
        dimensions: input.dimensions,
      },
      $setOnInsert: { name: input.name.toLowerCase() },
    },
    { upsert: true, new: true }
  );

  return result;
}
