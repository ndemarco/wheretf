import mongoose, { Schema, Document, Types } from 'mongoose';
import { IOverride } from './Module';

// --- Internal Location for Inserts ---

export interface IInsertLocation {
  label: string;
  disabled: boolean;
  disableReason?: string;
  customLabel?: string;
  children: IInsertLocation[];
}

// --- Insert Interface ---

export interface IInsert extends Document {
  _id: Types.ObjectId;
  name?: string;
  userId: Types.ObjectId;

  // Configuration source
  templateId?: Types.ObjectId;
  structuralDefinition?: {
    rows: number;
    cols: number;
    rowLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
    colLabeling: { type: 'numeric' | 'alpha' | 'custom'; prefix?: string; labels?: string[]; startAt?: number };
  };

  // Physical properties
  footprint: { rows: number; cols: number };
  interfaceTypeProvided?: string;

  // Overrides on this specific insert instance
  overrides: IOverride[];

  // Internal locations (generated from template or structural definition, modified by overrides)
  locations: IInsertLocation[];

  // Current placement (null if unassigned)
  moduleId?: Types.ObjectId;
  locationPath?: string[];

  metadata: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// --- Schemas ---

const InsertLocationSchema: Schema = new Schema(
  {
    label: { type: String, required: true },
    disabled: { type: Boolean, default: false },
    disableReason: { type: String },
    customLabel: { type: String },
    children: { type: [this], default: [] },
  },
  { _id: false }
);

InsertLocationSchema.add({ children: { type: [InsertLocationSchema], default: [] } });

const OverrideSchema = new Schema(
  {
    type: { type: String, enum: ['merge', 'divide', 'disable'], required: true },
    originPosition: { row: { type: Number }, col: { type: Number } },
    mergedPositions: [{ row: { type: Number }, col: { type: Number }, _id: false }],
    position: { row: { type: Number }, col: { type: Number } },
    method: { type: String, enum: ['subdivision', 'custom'] },
    subdivisionOptionName: { type: String },
    customLabels: { type: [String] },
    reason: { type: String },
  },
  { _id: false }
);

const LabelingSchemeSchema = new Schema(
  {
    type: { type: String, enum: ['numeric', 'alpha', 'custom'], required: true },
    prefix: { type: String },
    labels: { type: [String] },
    startAt: { type: Number },
  },
  { _id: false }
);

const InsertSchema = new Schema<IInsert>(
  {
    name: { type: String },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },

    templateId: { type: Schema.Types.ObjectId, index: true },
    structuralDefinition: {
      rows: { type: Number },
      cols: { type: Number },
      rowLabeling: { type: LabelingSchemeSchema },
      colLabeling: { type: LabelingSchemeSchema },
    },

    footprint: {
      rows: { type: Number, required: true, default: 1, min: 1 },
      cols: { type: Number, required: true, default: 1, min: 1 },
    },
    interfaceTypeProvided: { type: String },

    overrides: { type: [OverrideSchema], default: [] },
    locations: { type: [InsertLocationSchema], default: [] },

    moduleId: { type: Schema.Types.ObjectId, index: true },
    locationPath: { type: [String] },

    metadata: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  },
  { timestamps: true }
);

InsertSchema.index({ userId: 1, moduleId: 1 });

export default mongoose.models.Insert ||
  mongoose.model<IInsert>('Insert', InsertSchema);
