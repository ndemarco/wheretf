import mongoose, { Schema, Document } from 'mongoose';

export interface IDimensionDef {
  label: string;
  values: string[];
}

export interface IDimensionTemplate extends Document {
  name: string;
  description?: string;
  dimensions: IDimensionDef[];
  createdAt: Date;
  updatedAt: Date;
}

const dimensionDefSchema = new Schema<IDimensionDef>(
  {
    label: { type: String, required: true }, // "row", "col"
    values: [{ type: String, required: true }], // ["1","2","3","4"]
  },
  { _id: false }
);

const dimensionTemplateSchema = new Schema<IDimensionTemplate>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String }, // "Plano box with 4 rows, 6 columns"
    dimensions: [dimensionDefSchema],
  },
  { timestamps: true }
);

export default mongoose.models.DimensionTemplate ||
  mongoose.model<IDimensionTemplate>('DimensionTemplate', dimensionTemplateSchema);
