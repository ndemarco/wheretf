import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAgent extends Document {
  user: Types.ObjectId;
  name: string;
  displayName?: string;
  description?: string;
  instructions: string;
  aiModel: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
  tools: string[];
  temperature: number;
  isRouter: boolean;
  isSystem: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const agentSchema = new Schema<IAgent>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      lowercase: true,
    },
    displayName: { type: String }, // "Inventory Agent"
    description: { type: String }, // Short description for router
    instructions: {
      type: String,
      required: true,
    },
    aiModel: {
      type: String,
      default: 'gpt-4o',
      enum: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    },
    tools: [{ type: String }], // Tool names this agent can use
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1,
    },
    isRouter: {
      type: Boolean,
      default: false,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound unique index - name unique per user
agentSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.models.Agent ||
  mongoose.model<IAgent>('Agent', agentSchema);
