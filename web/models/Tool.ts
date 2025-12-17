import mongoose, { Schema, Document } from 'mongoose';

export interface IToolParameterProperty {
  type: string;
  description?: string;
  items?: { type: string };
}

export interface IToolParameter {
  name: string;
  type: 'string' | 'number' | 'array' | 'object' | 'boolean';
  description?: string;
  required: boolean;
  enum?: string[];
  items?: {
    type: string;
    properties?: Record<string, IToolParameterProperty>;
  };
}

export interface ITool extends Document {
  name: string;
  description?: string;
  category: 'agents' | 'items' | 'modules' | 'templates' | 'params' | 'units' | 'utility';
  parameters: IToolParameter[];
  handler: string;
  isSystem: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toolParameterSchema = new Schema<IToolParameter>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['string', 'number', 'array', 'object', 'boolean'],
    },
    description: { type: String },
    required: { type: Boolean, default: false },
    enum: [{ type: String }], // Optional allowed values
    items: { type: Object }, // Schema for array items
  },
  { _id: false }
);

const toolSchema = new Schema<ITool>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: { type: String }, // For OpenAI function calling
    category: {
      type: String,
      enum: ['agents', 'items', 'modules', 'templates', 'params', 'units', 'utility'],
    },
    parameters: [toolParameterSchema],
    handler: { type: String, required: true }, // Reference to handler function
    isSystem: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Tool ||
  mongoose.model<ITool>('Tool', toolSchema);
