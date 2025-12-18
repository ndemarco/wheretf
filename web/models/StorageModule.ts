import mongoose, { Schema, Document } from 'mongoose';
import { IMergeConstraints } from './StorageType';

// Cell group for merged cells
export interface ICellGroup {
  canonical: string; // The primary address, e.g. "row-2:col-1"
  members: string[]; // All cells in the group, e.g. ["row-2:col-1", "row-2:col-2", "row-2:col-3"]
}

// Subdimension structure (replaces template references)
export interface ISubdimensions {
  dimensions: { label: string; values: string[] }[];
  cellGroups?: ICellGroup[];
  storageType?: string; // Reference to StorageType.name (e.g., "plano-3700")
  mergeConstraints?: IMergeConstraints; // Copied from StorageType or custom
}

export interface IModuleDimension {
  label: string;
  values: string[];
  subdimensions?: Record<string, ISubdimensions>; // value -> subdimension config
}

export interface IStorageModule extends Document {
  name: string;
  description?: string;
  dimensions: IModuleDimension[];
  createdAt: Date;
  updatedAt: Date;
}

const cellGroupSchema = new Schema<ICellGroup>(
  {
    canonical: { type: String, required: true },
    members: [{ type: String, required: true }],
  },
  { _id: false }
);

const mergeConstraintsSchema = new Schema(
  {
    allowedAxes: [{ type: String }],
    maxMergeSize: { type: Number },
    reason: { type: String },
  },
  { _id: false }
);

const subdimensionsSchema = new Schema<ISubdimensions>(
  {
    dimensions: [
      {
        label: { type: String, required: true },
        values: [{ type: String, required: true }],
        _id: false,
      },
    ],
    cellGroups: [cellGroupSchema],
    storageType: { type: String }, // Reference to StorageType.name
    mergeConstraints: mergeConstraintsSchema,
  },
  { _id: false }
);

const moduleDimensionSchema = new Schema<IModuleDimension>(
  {
    label: { type: String, required: true }, // "drawer", "box", "row", "col", "level", "bin"
    values: [{ type: String, required: true }], // ["1", "2"] or ["yellow", "blue", "green"]
    subdimensions: {
      type: Map,
      of: subdimensionsSchema,
    },
  },
  { _id: false }
);

const storageModuleSchema = new Schema<IStorageModule>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: { type: String }, // "Red cabinet with Plano boxes"
    dimensions: [moduleDimensionSchema],
  },
  { timestamps: true }
);

export default mongoose.models.StorageModule ||
  mongoose.model<IStorageModule>('StorageModule', storageModuleSchema);
