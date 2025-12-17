import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IModuleDimension {
  label: string;
  values: string[];
  template?: Types.ObjectId;
  templateMapping?: Record<string, string>; // value -> template name
}

export interface IStorageModule extends Document {
  name: string;
  description?: string;
  dimensions: IModuleDimension[];
  createdAt: Date;
  updatedAt: Date;
}

const moduleDimensionSchema = new Schema<IModuleDimension>(
  {
    label: { type: String, required: true }, // "drawer", "box", "row", "col", "level", "bin"
    values: [{ type: String, required: true }], // ["1", "2"] or ["yellow", "blue", "green"]
    template: { type: Schema.Types.ObjectId, ref: 'DimensionTemplate' },
    templateMapping: {
      type: Object, // value -> template name
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
