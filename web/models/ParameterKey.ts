import mongoose, { Schema, Document } from 'mongoose';

export interface IParameterKey extends Document {
  key: string;
  description?: string;
  category?: string;
  commonUnits: string[];
  createdAt: Date;
  updatedAt: Date;
}

const parameterKeySchema = new Schema<IParameterKey>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String },
    category: { type: String }, // "dimension", "material", "electrical", etc.
    commonUnits: [{ type: String }], // ["mm", "in", "cm"] - hints for the AI
  },
  { timestamps: true }
);

export default mongoose.models.ParameterKey ||
  mongoose.model<IParameterKey>('ParameterKey', parameterKeySchema);
