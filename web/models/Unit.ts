import mongoose, { Schema, Document } from 'mongoose';

export interface IUnit extends Document {
  name: string;
  fullName?: string;
  type?: string;
  siConversion?: number;
  createdAt: Date;
  updatedAt: Date;
}

const unitSchema = new Schema<IUnit>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: { type: String }, // "millimeters"
    type: { type: String }, // "length", "weight", "voltage", etc.
    siConversion: { type: Number }, // optional, for future conversion features
  },
  { timestamps: true }
);

export default mongoose.models.Unit ||
  mongoose.model<IUnit>('Unit', unitSchema);
