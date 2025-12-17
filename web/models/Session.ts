import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface IMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string;
  images?: string[];
  toolCalls?: IToolCall[];
  agent?: string;
  tokenCount?: number;
  timestamp: Date;
}

export interface ISession extends Document {
  user: Types.ObjectId;
  name?: string;
  messages: IMessage[];
  totalTokens: number;
  maxTokens: number;
  status: 'active' | 'archived' | 'compressed';
  compressedSummary?: string;
  parentSession?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  contextUsage: number; // Virtual
}

const toolCallSchema = new Schema<IToolCall>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    arguments: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'tool', 'system'],
      required: true,
    },
    content: { type: String },
    images: [{ type: String }], // URLs or base64 for uploaded images
    toolCalls: [toolCallSchema],
    agent: { type: String }, // Which agent handled this message
    tokenCount: { type: Number }, // Track tokens for this message
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessionSchema = new Schema<ISession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String }, // Optional user-provided name
    messages: [messageSchema],
    totalTokens: {
      type: Number,
      default: 0,
    },
    maxTokens: {
      type: Number,
      default: 128000, // GPT-4o default
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'compressed'],
      default: 'active',
    },
    compressedSummary: { type: String }, // If compressed, store summary here
    parentSession: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
    },
  },
  { timestamps: true }
);

// Virtual for context usage percentage
sessionSchema.virtual('contextUsage').get(function (this: ISession) {
  return Math.round((this.totalTokens / this.maxTokens) * 100);
});

// Index for listing user's sessions
sessionSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.models.Session ||
  mongoose.model<ISession>('Session', sessionSchema);
