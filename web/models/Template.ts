import mongoose, { Schema, Document, Types } from 'mongoose';

// --- Subdocument Interfaces ---

export interface ISubdivisionOption {
  name: string;
  description?: string;
  resultingLabels: string[];
  accessoryProduct?: string;
}

export interface IDimensionConstraint {
  min?: number;
  max?: number;
  softMin?: number;
  softMax?: number;
}

export interface ILabelingScheme {
  type: 'numeric' | 'alpha' | 'custom';
  prefix?: string;
  labels?: string[];
  startAt?: number;
}

// --- Main Interface ---

export interface ITemplate extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  kind: 'fixed' | 'parametric';
  userId: Types.ObjectId;

  // Structural core
  origin: { row: number; col: number };
  primaryAxis: 'row' | 'col';
  rowLabeling: ILabelingScheme;
  colLabeling: ILabelingScheme;

  // Fixed: exact dimensions. Parametric: default dimensions.
  rows: number;
  cols: number;

  // Parametric constraints (only relevant when kind === 'parametric')
  rowConstraints?: IDimensionConstraint;
  colConstraints?: IDimensionConstraint;
  unitSizeMm?: number;

  // Subdivision options
  subdivisionOptions: ISubdivisionOption[];

  // Compatibility interfaces
  interfaceTypesAccepted: string[];
  interfaceTypeProvided?: string;

  // Extensible metadata — no prescribed shape
  metadata: Map<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

// --- Schemas ---

const SubdivisionOptionSchema = new Schema<ISubdivisionOption>(
  {
    name: { type: String, required: true },
    description: { type: String },
    resultingLabels: { type: [String], required: true },
    accessoryProduct: { type: String },
  },
  { _id: false }
);

const DimensionConstraintSchema = new Schema<IDimensionConstraint>(
  {
    min: { type: Number },
    max: { type: Number },
    softMin: { type: Number },
    softMax: { type: Number },
  },
  { _id: false }
);

const LabelingSchemeSchema = new Schema<ILabelingScheme>(
  {
    type: { type: String, enum: ['numeric', 'alpha', 'custom'], required: true },
    prefix: { type: String },
    labels: { type: [String] },
    startAt: { type: Number },
  },
  { _id: false }
);

const TemplateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true },
    description: { type: String },
    kind: { type: String, enum: ['fixed', 'parametric'], required: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },

    origin: {
      row: { type: Number, required: true, default: 0 },
      col: { type: Number, required: true, default: 0 },
    },
    primaryAxis: { type: String, enum: ['row', 'col'], required: true, default: 'row' },
    rowLabeling: { type: LabelingSchemeSchema, required: true },
    colLabeling: { type: LabelingSchemeSchema, required: true },

    rows: { type: Number, required: true, min: 1 },
    cols: { type: Number, required: true, min: 1 },

    rowConstraints: { type: DimensionConstraintSchema },
    colConstraints: { type: DimensionConstraintSchema },
    unitSizeMm: { type: Number },

    subdivisionOptions: { type: [SubdivisionOptionSchema], default: [] },

    interfaceTypesAccepted: { type: [String], default: [] },
    interfaceTypeProvided: { type: String },

    metadata: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  },
  { timestamps: true }
);

TemplateSchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.models.Template ||
  mongoose.model<ITemplate>('Template', TemplateSchema);
