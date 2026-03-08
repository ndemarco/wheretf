import AuditLog, { IAuditLog, AuditAction } from '@/models/AuditLog';
import dbConnect from '@/lib/mongodb';

export interface CreateAuditLogInput {
  userId: string;
  action: AuditAction;
  entityType: 'item' | 'module';
  entityId?: string;
  entityName: string;
  location?: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

/**
 * Log an audit event
 */
export async function log(input: CreateAuditLogInput): Promise<IAuditLog> {
  await dbConnect();

  const auditLog = await AuditLog.create({
    user: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    location: input.location,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    sessionId: input.sessionId,
  });

  return auditLog;
}

/**
 * Get recent audit logs for a user
 */
export async function list(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    entityType?: 'item' | 'module';
    action?: AuditAction;
  } = {}
): Promise<IAuditLog[]> {
  await dbConnect();

  const { limit = 50, offset = 0, entityType, action } = options;

  const filter: Record<string, unknown> = { user: userId };
  if (entityType) filter.entityType = entityType;
  if (action) filter.action = action;

  return AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
}

/**
 * Get audit history for a specific entity
 */
export async function getEntityHistory(
  userId: string,
  entityType: 'item' | 'module',
  entityName: string
): Promise<IAuditLog[]> {
  await dbConnect();

  return AuditLog.find({
    user: userId,
    entityType,
    entityName: { $regex: new RegExp(`^${entityName}$`, 'i') },
  }).sort({ createdAt: -1 });
}

/**
 * Get audit logs within a time range
 */
export async function getByTimeRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<IAuditLog[]> {
  await dbConnect();

  return AuditLog.find({
    user: userId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).sort({ createdAt: -1 });
}

/**
 * Count audit logs for a user
 */
export async function count(
  userId: string,
  options: {
    entityType?: 'item' | 'module';
    action?: AuditAction;
  } = {}
): Promise<number> {
  await dbConnect();

  const filter: Record<string, unknown> = { user: userId };
  if (options.entityType) filter.entityType = options.entityType;
  if (options.action) filter.action = options.action;

  return AuditLog.countDocuments(filter);
}

/**
 * Helper to serialize a document for audit logging
 * Removes mongoose internals and converts to plain object
 */
export function serializeForAudit(doc: unknown): Record<string, unknown> | null {
  if (!doc) return null;

  // Handle mongoose documents
  if (doc && typeof doc === 'object' && 'toObject' in doc) {
    const obj = (doc as { toObject: () => Record<string, unknown> }).toObject();
    // Remove mongoose internals
    delete obj.__v;
    return obj;
  }

  // Handle plain objects
  if (typeof doc === 'object') {
    const obj = { ...doc } as Record<string, unknown>;
    delete obj.__v;
    return obj;
  }

  return null;
}
