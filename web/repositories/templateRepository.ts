import Template, { ITemplate } from '@/models/Template';
import { Types, FilterQuery } from 'mongoose';

export interface CreateTemplateInput {
  name: string;
  description?: string;
  kind: 'fixed' | 'parametric';
  userId: Types.ObjectId;
  origin?: { row: number; col: number };
  primaryAxis?: 'row' | 'col';
  rowLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
  colLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
  rows: number;
  cols: number;
  rowConstraints?: { min?: number; max?: number; softMin?: number; softMax?: number };
  colConstraints?: { min?: number; max?: number; softMin?: number; softMax?: number };
  unitSizeMm?: number;
  subdivisionOptions?: {
    name: string;
    description?: string;
    resultingLabels: string[];
    accessoryProduct?: string;
  }[];
  interfaceTypesAccepted?: string[];
  interfaceTypeProvided?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  origin?: { row: number; col: number };
  primaryAxis?: 'row' | 'col';
  rowLabeling?: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
  colLabeling?: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
  rows?: number;
  cols?: number;
  rowConstraints?: { min?: number; max?: number; softMin?: number; softMax?: number };
  colConstraints?: { min?: number; max?: number; softMin?: number; softMax?: number };
  unitSizeMm?: number;
  subdivisionOptions?: {
    name: string;
    description?: string;
    resultingLabels: string[];
    accessoryProduct?: string;
  }[];
  interfaceTypesAccepted?: string[];
  interfaceTypeProvided?: string;
  metadata?: Record<string, unknown>;
}

export const templateRepository = {
  async create(input: CreateTemplateInput): Promise<ITemplate> {
    return Template.create(input);
  },

  async findById(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<ITemplate | null> {
    return Template.findOne({ _id: id, userId });
  },

  async findByName(name: string, userId: Types.ObjectId | string): Promise<ITemplate | null> {
    return Template.findOne({ name, userId });
  },

  async search(
    userId: Types.ObjectId | string,
    query?: { name?: string; kind?: 'fixed' | 'parametric'; interfaceTypeProvided?: string }
  ): Promise<ITemplate[]> {
    const filter: FilterQuery<ITemplate> = { userId };
    if (query?.name) {
      filter.name = { $regex: query.name, $options: 'i' };
    }
    if (query?.kind) {
      filter.kind = query.kind;
    }
    if (query?.interfaceTypeProvided) {
      filter.interfaceTypeProvided = query.interfaceTypeProvided;
    }
    return Template.find(filter).sort({ name: 1 });
  },

  async findByInterfaceAccepted(
    userId: Types.ObjectId | string,
    interfaceType: string
  ): Promise<ITemplate[]> {
    return Template.find({
      userId,
      interfaceTypesAccepted: interfaceType,
    }).sort({ name: 1 });
  },

  async update(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    input: UpdateTemplateInput
  ): Promise<ITemplate | null> {
    return Template.findOneAndUpdate(
      { _id: id, userId },
      { $set: input },
      { new: true, runValidators: true }
    );
  },

  async remove(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<boolean> {
    const result = await Template.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  },
};
