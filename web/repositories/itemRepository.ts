import Item, { IItem, IParameter } from '@/models/Item';
import { Types, FilterQuery } from 'mongoose';

export interface CreateItemInput {
  name: string;
  description?: string;
  userId: Types.ObjectId;
  parameters?: IParameter[];
  metadata?: Record<string, unknown>;
}

export interface UpdateItemInput {
  name?: string;
  description?: string;
  parameters?: IParameter[];
  metadata?: Record<string, unknown>;
}

export const itemRepository = {
  async create(input: CreateItemInput): Promise<IItem> {
    return Item.create(input);
  },

  async findById(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<IItem | null> {
    return Item.findOne({ _id: id, userId });
  },

  async findByName(name: string, userId: Types.ObjectId | string): Promise<IItem | null> {
    return Item.findOne({ name, userId });
  },

  async search(
    userId: Types.ObjectId | string,
    query?: {
      text?: string;
      name?: string;
      parameterKey?: string;
      parameterValue?: string;
    }
  ): Promise<IItem[]> {
    const filter: FilterQuery<IItem> = { userId };

    if (query?.text) {
      filter.$text = { $search: query.text };
    }
    if (query?.name) {
      filter.name = { $regex: query.name, $options: 'i' };
    }
    if (query?.parameterKey && query?.parameterValue) {
      filter.parameters = {
        $elemMatch: {
          key: query.parameterKey,
          value: { $regex: query.parameterValue, $options: 'i' },
        },
      };
    } else if (query?.parameterKey) {
      filter['parameters.key'] = query.parameterKey;
    }

    return Item.find(filter).sort({ name: 1 });
  },

  async update(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    input: UpdateItemInput
  ): Promise<IItem | null> {
    return Item.findOneAndUpdate(
      { _id: id, userId },
      { $set: input },
      { new: true, runValidators: true }
    );
  },

  async addParameter(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    parameter: IParameter
  ): Promise<IItem | null> {
    return Item.findOneAndUpdate(
      { _id: id, userId },
      { $push: { parameters: parameter } },
      { new: true }
    );
  },

  async removeParameter(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    key: string
  ): Promise<IItem | null> {
    return Item.findOneAndUpdate(
      { _id: id, userId },
      { $pull: { parameters: { key } } },
      { new: true }
    );
  },

  async remove(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<boolean> {
    const result = await Item.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  },
};
