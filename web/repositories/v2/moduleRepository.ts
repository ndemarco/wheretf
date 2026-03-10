import Module, { IModule, ILocation, IOverride } from '@/models/v2/Module';
import { Types, FilterQuery } from 'mongoose';

export interface CreateModuleInput {
  name: string;
  description?: string;
  userId: Types.ObjectId;
  primaryDimension: {
    name: string;
    labeling: {
      type: 'numeric' | 'alpha' | 'custom';
      prefix?: string;
      startAt?: number;
    };
    values: {
      label: string;
      location: {
        label: string;
        type: 'receptacle' | 'fixed' | 'leaf';
        interfaceTypeAccepted?: string;
        templateId?: Types.ObjectId;
        templateRows?: number;
        templateCols?: number;
        children?: CreateLocationInput[];
      };
    }[];
  };
  metadata?: Record<string, unknown>;
}

export interface CreateLocationInput {
  label: string;
  type: 'receptacle' | 'fixed' | 'leaf';
  interfaceTypeAccepted?: string;
  templateId?: Types.ObjectId;
  templateRows?: number;
  templateCols?: number;
  children?: CreateLocationInput[];
}

export const moduleRepository = {
  async create(input: CreateModuleInput): Promise<IModule> {
    return Module.create(input);
  },

  async findById(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<IModule | null> {
    return Module.findOne({ _id: id, userId });
  },

  async findByName(name: string, userId: Types.ObjectId | string): Promise<IModule | null> {
    return Module.findOne({ name, userId });
  },

  async search(
    userId: Types.ObjectId | string,
    query?: { name?: string }
  ): Promise<IModule[]> {
    const filter: FilterQuery<IModule> = { userId };
    if (query?.name) {
      filter.name = { $regex: query.name, $options: 'i' };
    }
    return Module.find(filter).sort({ name: 1 });
  },

  async update(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    input: Partial<Pick<IModule, 'name' | 'description' | 'metadata'>>
  ): Promise<IModule | null> {
    return Module.findOneAndUpdate(
      { _id: id, userId },
      { $set: input },
      { new: true, runValidators: true }
    );
  },

  async remove(id: Types.ObjectId | string, userId: Types.ObjectId | string): Promise<boolean> {
    const result = await Module.deleteOne({ _id: id, userId });
    return result.deletedCount === 1;
  },

  // --- Location operations ---

  /**
   * Resolve a path (array of labels) to the location at that path.
   * Returns null if any segment doesn't match.
   */
  resolveLocation(module: IModule, path: string[]): ILocation | null {
    if (path.length === 0) return null;

    const [primaryLabel, ...rest] = path;
    const dimValue = module.primaryDimension.values.find(
      (v) => v.label === primaryLabel
    );
    if (!dimValue) return null;

    let current: ILocation = dimValue.location;
    for (const segment of rest) {
      const child = current.children.find((c) => c.label === segment);
      if (!child) return null;
      current = child;
    }
    return current;
  },

  /**
   * Add a new value to the primary dimension.
   */
  async addPrimaryDimensionValue(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    label: string,
    location: {
      type: 'receptacle' | 'fixed' | 'leaf';
      interfaceTypeAccepted?: string;
    }
  ): Promise<IModule | null> {
    return Module.findOneAndUpdate(
      { _id: id, userId },
      {
        $push: {
          'primaryDimension.values': {
            label,
            location: {
              label,
              type: location.type,
              interfaceTypeAccepted: location.interfaceTypeAccepted,
              overrides: [],
              disabled: false,
              children: [],
            },
          },
        },
      },
      { new: true, runValidators: true }
    );
  },

  /**
   * Remove a primary dimension value by label.
   */
  async removePrimaryDimensionValue(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    label: string
  ): Promise<IModule | null> {
    return Module.findOneAndUpdate(
      { _id: id, userId },
      {
        $pull: {
          'primaryDimension.values': { label },
        },
      },
      { new: true }
    );
  },

  /**
   * Apply a template to a location, creating child locations from the grid.
   * The location becomes 'fixed' with children generated from template dimensions.
   */
  async applyTemplate(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    path: string[],
    templateId: Types.ObjectId,
    rows: number,
    cols: number,
    rowLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
    colLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
    childLocationType: 'receptacle' | 'fixed' | 'leaf' = 'leaf',
    interfaceTypeAccepted?: string
  ): Promise<IModule | null> {
    const module = await Module.findOne({ _id: id, userId });
    if (!module) return null;

    const location = this.resolveLocation(module, path);
    if (!location) return null;

    // Generate child locations
    const children: ILocation[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rowLabel = generateLabel(rowLabeling, r);
        const colLabel = generateLabel(colLabeling, c);
        children.push({
          label: `${rowLabel},${colLabel}`,
          type: childLocationType,
          interfaceTypeAccepted,
          overrides: [],
          disabled: false,
          children: [],
        } as ILocation);
      }
    }

    location.type = 'fixed';
    location.templateId = templateId;
    location.templateRows = rows;
    location.templateCols = cols;
    location.children = children;

    await module.save();
    return module;
  },

  /**
   * Add an override to a location at the given path.
   */
  async addOverride(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    path: string[],
    override: IOverride
  ): Promise<IModule | null> {
    const module = await Module.findOne({ _id: id, userId });
    if (!module) return null;

    const location = this.resolveLocation(module, path);
    if (!location) return null;

    location.overrides.push(override);
    await module.save();
    return module;
  },

  /**
   * Disable a location at the given path.
   */
  async disableLocation(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    path: string[],
    reason?: string
  ): Promise<IModule | null> {
    const module = await Module.findOne({ _id: id, userId });
    if (!module) return null;

    const location = this.resolveLocation(module, path);
    if (!location) return null;

    location.disabled = true;
    location.disableReason = reason;
    location.overrides.push({
      type: 'disable',
      position: { row: 0, col: 0 },
      reason,
    } as IOverride);

    await module.save();
    return module;
  },

  /**
   * Enable a previously disabled location.
   */
  async enableLocation(
    id: Types.ObjectId | string,
    userId: Types.ObjectId | string,
    path: string[]
  ): Promise<IModule | null> {
    const module = await Module.findOne({ _id: id, userId });
    if (!module) return null;

    const location = this.resolveLocation(module, path);
    if (!location) return null;

    location.disabled = false;
    location.disableReason = undefined;
    // Remove disable overrides
    location.overrides = location.overrides.filter((o) => o.type !== 'disable') as typeof location.overrides;

    await module.save();
    return module;
  },

  /**
   * Get all leaf locations as path arrays.
   */
  getLeafPaths(module: IModule): string[][] {
    const paths: string[][] = [];

    function walk(location: ILocation, currentPath: string[]) {
      const fullPath = [...currentPath, location.label];
      if (location.children.length === 0 && !location.disabled) {
        paths.push(fullPath);
      }
      for (const child of location.children) {
        walk(child, fullPath);
      }
    }

    for (const value of module.primaryDimension.values) {
      walk(value.location, []);
    }

    return paths;
  },
};

// --- Helpers ---

function generateLabel(
  labeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number },
  index: number
): string {
  const prefix = labeling.prefix || '';
  switch (labeling.type) {
    case 'numeric':
      return `${prefix}${(labeling.startAt || 0) + index}`;
    case 'alpha':
      return `${prefix}${String.fromCharCode(65 + index)}`;
    case 'custom':
      return labeling.labels?.[index] || `${index}`;
    default:
      return `${index}`;
  }
}
