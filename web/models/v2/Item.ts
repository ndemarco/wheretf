import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IParameter {
  key: string;
  value: string;
  unit?: string;
}

export interface IItem extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  userId: Types.ObjectId;
  parameters: IParameter[];
  metadata: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ParameterSchema = new Schema<IParameter>(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    unit: { type: String },
  },
  { _id: false }
);

const ItemSchema = new Schema<IItem>(
  {
    name: { type: String, required: true },
    description: { type: String },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    parameters: { type: [ParameterSchema], default: [] },
    metadata: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
  },
  { timestamps: true }
);

ItemSchema.index({ userId: 1, name: 1 });
ItemSchema.index({ name: 'text', description: 'text' });

export default mongoose.models.Item ||
  mongoose.model<IItem>('Item', ItemSchema);
