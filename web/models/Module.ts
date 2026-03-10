import mongoose, { Schema, Document, Types } from 'mongoose';

// --- Override Interfaces ---

export interface IMergeOverride {
  type: 'merge';
  originPosition: { row: number; col: number };
  mergedPositions: { row: number; col: number }[];
}

export interface IDivideOverride {
  type: 'divide';
  position: { row: number; col: number };
  method: 'subdivision' | 'custom';
  subdivisionOptionName?: string;
  customLabels?: string[];
}

export interface IDisableOverride {
  type: 'disable';
  position: { row: number; col: number };
  reason?: string;
}

export type IOverride = IMergeOverride | IDivideOverride | IDisableOverride;

// --- Location Interfaces ---

export interface ILocation {
  label: string;
  type: 'receptacle' | 'fixed' | 'leaf';
  interfaceTypeAccepted?: string;
  templateId?: Types.ObjectId;
  templateRows?: number;
  templateCols?: number;
  overrides: IOverride[];
  disabled: boolean;
  disableReason?: string;
  customLabel?: string;
  children: ILocation[];
}

// --- Primary Dimension ---

export interface IPrimaryDimensionValue {
  label: string;
  location: ILocation;
}

export interface IPrimaryDimension {
  name: string;
  labeling: {
    type: 'numeric' | 'alpha' | 'custom';
    prefix?: string;
    startAt?: number;
  };
  values: IPrimaryDimensionValue[];
}

// --- Module ---

export interface IModule extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  userId: Types.ObjectId;
  primaryDimension: IPrimaryDimension;
  metadata: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// --- Schemas ---

const OverrideSchema = new Schema(
  {
    type: { type: String, enum: ['merge', 'divide', 'disable'], required: true },
    // merge
    originPosition: {
      row: { type: Number },
      col: { type: Number },
    },
    mergedPositions: [
      {
        row: { type: Number },
        col: { type: Number },
        _id: false,
      },
    ],
    // divide
    position: {
      row: { type: Number },
      col: { type: Number },
    },
    method: { type: String, enum: ['subdivision', 'custom'] },
    subdivisionOptionName: { type: String },
    customLabels: { type: [String] },
    // disable
    reason: { type: String },
  },
  { _id: false, discriminatorKey: 'type' }
);

const LocationSchema: Schema = new Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: ['receptacle', 'fixed', 'leaf'], required: true },
    interfaceTypeAccepted: { type: String },
    templateId: { type: Schema.Types.ObjectId },
    templateRows: { type: Number },
    templateCols: { type: Number },
    overrides: { type: [OverrideSchema], default: [] },
    disabled: { type: Boolean, default: false },
    disableReason: { type: String },
    customLabel: { type: String },
    children: { type: [this], default: [] },
  },
  { _id: false }
);

// Self-reference for nested children
LocationSchema.add({ children: { type: [LocationSchema], default: [] } });

const PrimaryDimensionValueSchema = new Schema(
  {
    label: { type: String, required: true },
    location: { type: LocationSchema, required: true },
  },
  { _id: false }
);

const PrimaryDimensionSchema = new Schema(
  {
    name: { type: String, required: true },
    labeling: {
      type: {
        type: String,
        enum: ['numeric', 'alpha', 'custom'],
        required: true,
      },
      prefix: { type: String },
      startAt: { type: Number },
    },
    values: { type: [PrimaryDimensionValueSchema], required: true },
  },
  { _id: false }
);

const ModuleSchema = new Schema<IModule>(
  {
    name: { type: String, required: true },
    description: { type: String },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    primaryDimension: { type: PrimaryDimensionSchema, required: true },
    metadata: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  },
  { timestamps: true }
);

ModuleSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.models.Module ||
  mongoose.model<IModule>('Module', ModuleSchema);
