import Insert, { IInsert, IInsertLocation } from '@/models/v2/Insert';
import { IOverride } from '@/models/v2/Module';
import { Types, FilterQuery } from 'mongoose';

export interface CreateInsertInput {
  name?: string;
  userId: Types.ObjectId;
  templateId?: Types.ObjectId;
  structuralDefinition?: {
    rows: number;
    cols: number;
    rowLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
    colLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
  };
  footprint?: { rows: number; cols: number };
  interfaceTypeProvided?: string;
  locations?: IInsertLocation[];
  moduleId?: Types.ObjectId;
  locationPath?: string[];
  metadata?: Record<string, unknown>;
}

export const insertRepository = {
  async create(input: CreateInsertInput): Promise<IInsert> {
    return Insert.create(input);
  },

  async findById(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<IInsert | null> {
    return Insert.findOne({ _id: id, userId });
  },

  async search(
    userId: Types.ObjectId | string,
    query?: {
      name?: string;
      templateId?: Types.ObjectId | string;
      moduleId?: Types.ObjectId | string;
      unassigned?: boolean;
    }
  ): Promise<IInsert[]> {
    const filter: FilterQuery<IInsert> = { userId };
    if (query?.name) {
      filter.name = { $regex: query.name, $options: 'i' };
    }
    if (query?.templateId) {
      filter.templateId = query.templateId;
    }
    if (query?.moduleId) {
      filter.moduleId = query.moduleId;
    }
    if (query?.unassigned) {
      filter.moduleId = { $exists: false };
    }
    return Insert.find(filter).sort({ name: 1, createdAt: -1 });
  },

  /**
   * Find all inserts placed at a specific module location.
   */
  async findByModuleLocation(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string,
    locationPath: string[]
  ): Promise<IInsert[]> {
    return Insert.find({
      userId,
      moduleId,
      locationPath,
    });
  },

  /**
   * Find all inserts placed anywhere in a module.
   */
  async findByModule(
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId | string
  ): Promise<IInsert[]> {
    return Insert.find({ userId, moduleId }).sort({ locationPath: 1 });
  },

  /**
   * Place an insert at a module location.
   */
  async place(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    moduleId: Types.ObjectId,
    locationPath: string[]
  ): Promise<IInsert | null> {
    return Insert.findOneAndUpdate(
      { _id: id, userId },
      { $set: { moduleId, locationPath } },
      { new: true }
    );
  },

  /**
   * Remove an insert from its current location (make it unassigned).
   */
  async unplace(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string
  ): Promise<IInsert | null> {
    return Insert.findOneAndUpdate(
      { _id: id, userId },
      { $unset: { moduleId: 1, locationPath: 1 } },
      { new: true }
    );
  },

  /**
   * Relocate an insert to a different module location.
   */
  async relocate(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    newModuleId: Types.ObjectId,
    newLocationPath: string[]
  ): Promise<IInsert | null> {
    return Insert.findOneAndUpdate(
      { _id: id, userId },
      { $set: { moduleId: newModuleId, locationPath: newLocationPath } },
      { new: true }
    );
  },

  /**
   * Add an override to the insert.
   */
  async addOverride(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    override: IOverride
  ): Promise<IInsert | null> {
    return Insert.findOneAndUpdate(
      { _id: id, userId },
      { $push: { overrides: override } },
      { new: true }
    );
  },

  async update(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    input: Partial<Pick<IInsert, 'name' | 'metadata'>>
  ): Promise<IInsert | null> {
    return Insert.findOneAndUpdate(
      { _id: id, userId },
      { $set: input },
      { new: true, runValidators: true }
    );
  },

  async remove(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<boolean> {
    const result = await Insert.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  },

  /**
   * Resolve a path within an insert's internal locations.
   */
  resolveLocation(insert: IInsert, path: string[]): IInsertLocation | null {
    if (path.length === 0) return null;

    let current: IInsertLocation | undefined = insert.locations.find(
      (l) => l.label === path[0]
    );
    if (!current) return null;

    for (let i = 1; i < path.length; i++) {
      current = current.children.find((c) => c.label === path[i]);
      if (!current) return null;
    }
    return current;
  },

  /**
   * Get all leaf location labels within the insert.
   */
  getLeafLabels(insert: IInsert): string[][] {
    const paths: string[][] = [];

    function walk(loc: IInsertLocation, currentPath: string[]) {
      const fullPath = [...currentPath, loc.label];
      if (loc.children.length === 0 && !loc.disabled) {
        paths.push(fullPath);
      }
      for (const child of loc.children) {
        walk(child, fullPath);
      }
    }

    for (const loc of insert.locations) {
      walk(loc, []);
    }
    return paths;
  },
};
