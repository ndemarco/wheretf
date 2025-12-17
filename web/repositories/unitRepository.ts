import Unit, { IUnit } from '@/models/Unit';
import dbConnect from '@/lib/mongodb';

export interface CreateUnitInput {
  name: string;
  fullName?: string;
  type?: string;
  siConversion?: number;
}

export interface SearchUnitsInput {
  query?: string;
  type?: string;
}

export async function create(input: CreateUnitInput): Promise<IUnit> {
  await dbConnect();

  const existing = await Unit.findOne({ name: input.name.toLowerCase() });
  if (existing) {
    throw new Error(`Unit "${input.name}" already exists`);
  }

  const unit = await Unit.create({
    name: input.name,
    fullName: input.fullName,
    type: input.type,
    siConversion: input.siConversion,
  });

  return unit;
}

export async function search(input: SearchUnitsInput): Promise<IUnit[]> {
  await dbConnect();

  const filter: Record<string, unknown> = {};

  if (input.query) {
    filter.$or = [
      { name: { $regex: input.query, $options: 'i' } },
      { fullName: { $regex: input.query, $options: 'i' } },
    ];
  }

  if (input.type) {
    filter.type = input.type;
  }

  return Unit.find(filter).sort({ name: 1 });
}

export async function findByName(name: string): Promise<IUnit | null> {
  await dbConnect();
  return Unit.findOne({ name: name.toLowerCase() });
}

export async function list(): Promise<IUnit[]> {
  await dbConnect();
  return Unit.find().sort({ name: 1 });
}

export async function findOrCreate(input: CreateUnitInput): Promise<IUnit> {
  await dbConnect();

  const existing = await findByName(input.name);
  if (existing) {
    return existing;
  }

  return create(input);
}
