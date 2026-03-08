import mongoose, { Schema, Document, Types } from 'mongoose';

export type AuditAction =
  | 'item.create'
  | 'item.update'
  | 'item.delete'
  | 'item.move'
  | 'module.create'
  | 'module.update'
  | 'module.delete'
  | 'module.setSubdimensions'
  | 'module.mergeCells'
  | 'module.unmergeCells'
  | 'module.renameDimensionValue'
  | 'module.addDimensionValue'
  | 'module.removeDimensionValue';

export interface IAuditLog extends Document {
  user: Types.ObjectId;
  action: AuditAction;
  entityType: 'item' | 'module';
  entityId?: string; // MongoDB _id if applicable
  entityName: string; // Human-readable identifier (item name, module name)
  location?: string; // For items, the location path
  before: Record<string, unknown> | null; // State before change (null for creates)
  after: Record<string, unknown> | null; // State after change (null for deletes)
  metadata?: Record<string, unknown>; // Additional context (e.g., move from/to)
  sessionId?: string; // Chat session that triggered this
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['item', 'module'],
      index: true,
    },
    entityId: { type: String },
    entityName: { type: String, required: true },
    location: { type: String },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    sessionId: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for querying user's audit history
auditLogSchema.index({ user: 1, createdAt: -1 });

// Index for finding changes to specific entities
auditLogSchema.index({ user: 1, entityType: 1, entityName: 1 });

// TTL index - keep audit logs for 90 days by default
// Can be adjusted or removed for permanent retention
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
