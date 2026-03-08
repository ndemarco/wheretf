import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { auditRepository } from '@/repositories';
import { AuditAction } from '@/models/AuditLog';

// GET /api/audit - Get audit logs for the current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const entityType = searchParams.get('entityType') as 'item' | 'module' | null;
    const action = searchParams.get('action') as AuditAction | null;
    const entityName = searchParams.get('entityName');

    // If entityName provided, get history for that specific entity
    if (entityName && entityType) {
      const logs = await auditRepository.getEntityHistory(
        session.user.id,
        entityType,
        entityName
      );
      return Response.json({ logs, total: logs.length });
    }

    // Otherwise get general audit logs
    const logs = await auditRepository.list(session.user.id, {
      limit,
      offset,
      entityType: entityType || undefined,
      action: action || undefined,
    });

    const total = await auditRepository.count(session.user.id, {
      entityType: entityType || undefined,
      action: action || undefined,
    });

    return Response.json({ logs, total, limit, offset });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
