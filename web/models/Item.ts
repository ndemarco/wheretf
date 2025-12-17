import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IParameterValue {
  key: string;
  value: string;
  unit?: string;
}

export interface IItem extends Document {
  user: Types.ObjectId;
  name: string;
  description?: string;
  parameters: IParameterValue[];
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const parameterValueSchema = new Schema<IParameterValue>(
  {
    key: { type: String, required: true, lowercase: true },
    value: { type: String, required: true },
    unit: { type: String, lowercase: true },
  },
  { _id: false }
);

const itemSchema = new Schema<IItem>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    parameters: [parameterValueSchema],
    location: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound unique index - location unique per user
itemSchema.index({ user: 1, location: 1 }, { unique: true });

// Text index for searching by name/description
itemSchema.index({ name: 'text', description: 'text' });

// Index for parameter-based queries
itemSchema.index({ 'parameters.key': 1, 'parameters.value': 1 });

export default mongoose.models.Item ||
  mongoose.model<IItem>('Item', itemSchema);
