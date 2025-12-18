import mongoose, { Schema, Document } from 'mongoose';

// Merge constraints define which dimensions can be merged
export interface IMergeConstraints {
  allowedAxes?: string[]; // e.g., ["col"] means only column merges allowed
  maxMergeSize?: number; // Max cells in a single merge group
  reason?: string; // Human-readable explanation
}

// Default grid configuration
export interface IDefaultGrid {
  dimensions: { label: string; values: string[] }[];
}

export interface IStorageType extends Document {
  name: string; // "plano-3700"
  aliases: string[]; // ["Plano 3700", "3700 tackle box"]
  description?: string;
  defaultGrid?: IDefaultGrid;
  mergeConstraints?: IMergeConstraints;
  notes?: string; // Additional info for the AI
  isSystem: boolean; // Seeded types vs user-created
  createdAt: Date;
  updatedAt: Date;
}

const mergeConstraintsSchema = new Schema<IMergeConstraints>(
  {
    allowedAxes: [{ type: String }],
    maxMergeSize: { type: Number },
    reason: { type: String },
  },
  { _id: false }
);

const defaultGridSchema = new Schema<IDefaultGrid>(
  {
    dimensions: [
      {
        label: { type: String, required: true },
        values: [{ type: String, required: true }],
        _id: false,
      },
    ],
  },
  { _id: false }
);

const storageTypeSchema = new Schema<IStorageType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    aliases: [{ type: String }],
    description: { type: String },
    defaultGrid: defaultGridSchema,
    mergeConstraints: mergeConstraintsSchema,
    notes: { type: String },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Text index for searching by name, aliases, description
storageTypeSchema.index({ name: 'text', aliases: 'text', description: 'text' });

export default mongoose.models.StorageType ||
  mongoose.model<IStorageType>('StorageType', storageTypeSchema);
